"""
Production-grade Printify Print-On-Demand (POD) REST API Integration Service.
Handles authenticated communications, order submissions, production triggering, and webhook lifecycle.
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional
import requests
from django.conf import settings
from apps.orders.models import Order, OrderItem

logger = logging.getLogger(__name__)


class PrintifyError(Exception):
    """Base exception for Printify integration errors."""
    pass


class PrintifyConfigError(PrintifyError):
    """Raised when required configuration tokens or shop IDs are missing."""
    pass


class PrintifyAPIError(PrintifyError):
    """Raised when Printify REST API responds with an error code (4xx, 5xx)."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Any] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class PrintifyService:
    """
    Modular API client for the Printify REST API v1.
    Reads credentials from environment variables or Django settings.
    """
    DEFAULT_BASE_URL = "https://api.printify.com/v1"
    REQUIRED_WEBHOOK_TOPICS = [
        "order:updated",
        "order:sent-to-production",
        "order:shipment:created",
    ]

    def __init__(
        self,
        api_token: Optional[str] = None,
        shop_id: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 25,
    ):
        self.api_token = api_token or os.getenv("PRINTIFY_API_TOKEN") or getattr(settings, "PRINTIFY_API_TOKEN", "")
        self.shop_id = shop_id or os.getenv("PRINTIFY_SHOP_ID") or getattr(settings, "PRINTIFY_SHOP_ID", "")
        self.base_url = (base_url or os.getenv("PRINTIFY_BASE_URL") or getattr(settings, "PRINTIFY_BASE_URL", self.DEFAULT_BASE_URL)).rstrip("/")
        self.timeout = timeout

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "OrderFlow-POD-Integration/1.0",
            "Content-Type": "application/json",
            "Accept": "application/json",
        })
        if self.api_token:
            self.session.headers["Authorization"] = f"Bearer {self.api_token}"

    def _validate_config(self) -> None:
        """Ensures API token and Shop ID are populated before dispatching requests."""
        if not self.api_token:
            raise PrintifyConfigError(
                "PRINTIFY_API_TOKEN is not configured. Set the environment variable or Django setting."
            )
        if not self.shop_id:
            raise PrintifyConfigError(
                "PRINTIFY_SHOP_ID is not configured. Set the environment variable or Django setting."
            )

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Executes an HTTP request to the Printify REST API with structured logging and error handling.
        """
        self._validate_config()
        url = f"{self.base_url}{endpoint}"

        kwargs.setdefault("timeout", self.timeout)

        logger.info(f"[Printify API] Outbound {method.upper()} -> {url}")
        try:
            response = self.session.request(method, url, **kwargs)
        except requests.exceptions.RequestException as exc:
            logger.error(f"[Printify API] Network communication failure to {url}: {exc}")
            raise PrintifyAPIError(f"Network error communicating with Printify API: {exc}") from exc

        # Parse JSON or fallback to raw content
        try:
            data = response.json() if response.content else {}
        except json.JSONDecodeError:
            data = {"raw_response": response.text}

        if not response.ok:
            error_msg = (
                data.get("message")
                or data.get("error")
                or f"Printify request failed with HTTP {response.status_code}"
            )
            logger.error(f"[Printify API] HTTP {response.status_code} Error from {url}: {data}")
            raise PrintifyAPIError(
                message=f"Printify API error ({response.status_code}): {error_msg}",
                status_code=response.status_code,
                response_data=data,
            )

        logger.info(f"[Printify API] Successful HTTP {response.status_code} from {url}")
        return data

    def submit_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Formats and posts an order to /v1/shops/{shop_id}/orders.json.

        Args:
            order_data: Validated Printify order payload dictionary.

        Returns:
            Created Printify order dictionary with 'id', 'status', 'created_at', etc.
        """
        endpoint = f"/shops/{self.shop_id}/orders.json"
        return self._request("post", endpoint, json=order_data)

    def send_to_production(self, printify_order_id: str) -> Dict[str, Any]:
        """
        Triggers production execution for an existing order via
        /v1/shops/{shop_id}/orders/{order_id}/send_to_production.json.

        Args:
            printify_order_id: The external Printify order ID.

        Returns:
            Updated order response acknowledging production commencement.
        """
        if not printify_order_id:
            raise ValueError("printify_order_id must be provided to trigger production.")

        endpoint = f"/shops/{self.shop_id}/orders/{printify_order_id}/send_to_production.json"
        return self._request("post", endpoint, json={})

    def get_order(self, printify_order_id: str) -> Dict[str, Any]:
        """Retrieves single order details from /v1/shops/{shop_id}/orders/{order_id}.json."""
        endpoint = f"/shops/{self.shop_id}/orders/{printify_order_id}.json"
        return self._request("get", endpoint)

    def cancel_order(self, printify_order_id: str) -> Dict[str, Any]:
        """Cancels an order on Printify via /v1/shops/{shop_id}/orders/{order_id}/cancel.json."""
        endpoint = f"/shops/{self.shop_id}/orders/{printify_order_id}/cancel.json"
        return self._request("post", endpoint, json={})

    def list_webhooks(self) -> List[Dict[str, Any]]:
        """Lists all registered webhooks for the configured shop."""
        endpoint = f"/shops/{self.shop_id}/webhooks.json"
        res = self._request("get", endpoint)
        return res if isinstance(res, list) else res.get("data", [])

    def register_webhooks(self, callback_url: str) -> List[Dict[str, Any]]:
        """
        Automatically registers webhook subscriptions for:
        - order:updated
        - order:sent-to-production
        - order:shipment:created

        Avoids registering duplicates if a webhook for that topic and URL already exists.

        Args:
            callback_url: Absolute HTTPS URL where Printify should deliver webhook POSTs.

        Returns:
            List of registered or verified webhook descriptors.
        """
        if not callback_url or not callback_url.startswith("http"):
            raise ValueError("callback_url must be an absolute valid HTTP/HTTPS URL.")

        try:
            existing_webhooks = self.list_webhooks()
        except Exception as exc:
            logger.warning(f"[Printify Webhooks] Unable to query existing webhooks: {exc}. Proceeding with registration.")
            existing_webhooks = []

        # Index existing topics matching callback URL
        active_map = {
            wh.get("topic"): wh.get("id")
            for wh in existing_webhooks
            if wh.get("url") == callback_url
        }

        results = []
        for topic in self.REQUIRED_WEBHOOK_TOPICS:
            if topic in active_map:
                logger.info(f"[Printify Webhooks] Topic '{topic}' already registered for {callback_url} (ID: {active_map[topic]})")
                results.append({
                    "topic": topic,
                    "url": callback_url,
                    "id": active_map[topic],
                    "status": "already_active",
                })
                continue

            endpoint = f"/shops/{self.shop_id}/webhooks.json"
            payload = {
                "topic": topic,
                "url": callback_url,
            }
            logger.info(f"[Printify Webhooks] Registering topic '{topic}' -> {callback_url}")
            created = self._request("post", endpoint, json=payload)
            results.append({
                "topic": topic,
                "url": callback_url,
                "id": created.get("id"),
                "status": "registered",
                "response": created,
            })

        return results

    @staticmethod
    def build_order_payload(order: Order) -> Dict[str, Any]:
        """
        Constructs a Printify REST API compliant order dictionary from internal OrderFlow models.
        """
        # Parse customer shipping address
        addr = order.shipping_address or {}
        recipient_name = addr.get("recipient_name") or order.customer_name or "Valued Customer"
        name_parts = recipient_name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else "Customer"

        address_to = {
            "first_name": first_name,
            "last_name": last_name,
            "email": order.customer_email or "operations@orderflow.internal",
            "phone": order.customer_phone or addr.get("phone", ""),
            "country": addr.get("country", "US"),
            "region": addr.get("state", addr.get("region", "")),
            "address1": addr.get("street", addr.get("address1", "1 Main St")),
            "address2": addr.get("address2", ""),
            "city": addr.get("city", "New York"),
            "zip": addr.get("postal_code", addr.get("zip", "10001")),
        }

        # Build line items
        line_items = []
        for item in order.items.all():
            line_item_entry: Dict[str, Any] = {
                "quantity": item.quantity or 1,
            }
            if item.printify_product_id:
                line_item_entry["product_id"] = item.printify_product_id
            if item.printify_variant_id:
                line_item_entry["variant_id"] = item.printify_variant_id
            if item.printify_print_provider_id:
                line_item_entry["print_provider_id"] = item.printify_print_provider_id
            if item.printify_blueprint_id:
                line_item_entry["blueprint_id"] = item.printify_blueprint_id

            # Fallback if specific Printify catalog IDs are not explicitly stored
            if not line_item_entry.get("product_id") and not line_item_entry.get("blueprint_id"):
                line_item_entry["metadata"] = {
                    "product_type": item.product_type,
                    "artwork_url": getattr(item, "pdf_artwork_url", ""),
                }

            line_items.append(line_item_entry)

        # Default fallback line item if order has no registered items
        if not line_items:
            line_items.append({
                "quantity": 1,
                "metadata": {"title": "Generic Print Product"},
            })

        payload = {
            "external_id": order.order_number,
            "label": order.order_number,
            "line_items": line_items,
            "shipping_method": 1,  # Standard Printify shipping
            "send_shipping_notification": False,  # OrderFlow handles direct customer notifications
            "address_to": address_to,
        }
        return payload
