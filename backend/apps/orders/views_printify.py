"""
Printify Webhook Endpoint Views.
Consumes real-time asynchronous event notifications from Printify:
- order:shipment:created
- order:sent-to-production
- order:updated

Handles signature verification, graceful error handling, and OrderFlow state machine progression.
"""
import hmac
import hashlib
import json
import logging
from typing import Optional, Tuple
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from apps.orders.models import Order, PrintifyPayloadLog
from apps.orders.services.printify_status import map_and_resolve_status
from apps.core.models.lookups import EntityStatus

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class PrintifyWebhookView(APIView):
    """
    POST /api/v1/webhooks/printify/
    Inbound webhook receiver consuming Printify event notifications.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        client_ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR")
        )
        raw_body = request.body

        # -------------------------------------------------------------------------
        # 1. Payload Parsing with Graceful Fallback
        # -------------------------------------------------------------------------
        try:
            if not raw_body:
                return Response(
                    {"error": "Empty request body"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payload = json.loads(raw_body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as parse_err:
            logger.warning(f"[Printify Webhook] Malformed JSON received from {client_ip}: {parse_err}")
            PrintifyPayloadLog.objects.create(
                event_type="unknown.malformed",
                status="FAILED",
                error_message=f"JSON decode failure: {parse_err}",
                ip_address=client_ip,
                raw_payload={"raw_content": raw_body[:1000].decode("latin-1", errors="replace")},
            )
            return Response(
                {"error": "Invalid JSON format in webhook body"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = payload.get("type") or payload.get("event") or "order:updated"
        resource = payload.get("resource") or payload
        printify_order_id = str(resource.get("id") or payload.get("order_id") or "")

        # -------------------------------------------------------------------------
        # 2. Webhook Signature Verification
        # -------------------------------------------------------------------------
        signature_header = (
            request.headers.get("X-Printify-Signature")
            or request.headers.get("X-Pf-Signature")
            or request.META.get("HTTP_X_PRINTIFY_SIGNATURE")
            or ""
        )
        webhook_secret = (
            getattr(settings, "PRINTIFY_WEBHOOK_SECRET", None)
            or getattr(settings, "PRINTIFY_API_TOKEN", None)
        )

        is_valid_signature, sig_reason = self._verify_signature(
            raw_body=raw_body,
            signature_header=signature_header,
            secret=webhook_secret,
        )

        if not is_valid_signature:
            logger.warning(f"[Printify Webhook] Signature verification failed from {client_ip}: {sig_reason}")
            PrintifyPayloadLog.objects.create(
                printify_order_id=printify_order_id,
                event_type=event_type,
                raw_payload=payload,
                status="INVALID_SIGNATURE",
                error_message=f"Signature check rejected: {sig_reason}",
                ip_address=client_ip,
            )
            return Response(
                {"error": "Invalid webhook signature", "detail": sig_reason},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # -------------------------------------------------------------------------
        # 3. Route & Process Event Types
        # -------------------------------------------------------------------------
        try:
            processing_result = self._process_event(
                event_type=event_type,
                resource=resource,
                printify_order_id=printify_order_id,
            )

            # Record audit log
            PrintifyPayloadLog.objects.create(
                printify_order_id=printify_order_id,
                event_type=event_type,
                raw_payload=payload,
                status="PROCESSED",
                error_message="",
                ip_address=client_ip,
            )

            logger.info(
                f"[Printify Webhook] Event '{event_type}' processed successfully for "
                f"Printify Order '{printify_order_id}': {processing_result}"
            )
            return Response(
                {
                    "status": "success",
                    "event": event_type,
                    "printify_order_id": printify_order_id,
                    "result": processing_result,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as proc_exc:
            logger.exception(f"[Printify Webhook] Unhandled exception processing event '{event_type}': {proc_exc}")
            PrintifyPayloadLog.objects.create(
                printify_order_id=printify_order_id,
                event_type=event_type,
                raw_payload=payload,
                status="FAILED",
                error_message=str(proc_exc),
                ip_address=client_ip,
            )
            return Response(
                {
                    "status": "error",
                    "message": "Error processing webhook notification",
                    "detail": str(proc_exc),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    def _verify_signature(
        self,
        raw_body: bytes,
        signature_header: str,
        secret: Optional[str],
    ) -> Tuple[bool, str]:
        """
        Validates HMAC SHA256 signature against webhook secret.
        Gracefully allows request if webhook secret is not configured in development.
        """
        if not secret:
            return True, "No secret configured (development/sandbox mode enabled)"

        if not signature_header:
            return False, "Missing X-Printify-Signature header"

        try:
            expected_hmac = hmac.new(
                secret.encode("utf-8"),
                raw_body,
                hashlib.sha256,
            ).hexdigest()

            # Clean header of potential prefix (e.g. "sha256=")
            received_signature = signature_header.replace("sha256=", "").strip()

            if hmac.compare_digest(expected_hmac, received_signature):
                return True, "Signature verified"
            else:
                return False, f"Signature mismatch (received={received_signature[:8]}...)"
        except Exception as exc:
            return False, f"Signature validation computation error: {exc}"

    def _process_event(
        self,
        event_type: str,
        resource: dict,
        printify_order_id: str,
    ) -> dict:
        """
        Dispatches and parses specific Printify webhook topics.
        """
        external_id = str(resource.get("external_id") or resource.get("label") or "")

        # Resolve internal Order
        order = None
        if printify_order_id:
            order = Order.objects.filter(external_pod_order_id=printify_order_id).first()
        if not order and external_id:
            order = Order.objects.filter(order_number=external_id).first()

        if not order:
            logger.warning(
                f"[Printify Webhook] No matching internal Order found for "
                f"Printify ID '{printify_order_id}' or external_id '{external_id}'."
            )
            return {
                "matched_order": False,
                "printify_order_id": printify_order_id,
                "external_id": external_id,
                "message": "Order reference not tracked in OrderFlow",
            }

        # ---------------------------------------------------------------------
        # Event 1: order:shipment:created
        # Updates internal status to 'Dispatched' / 'Out for Delivery' and saves tracking
        # ---------------------------------------------------------------------
        if event_type == "order:shipment:created" or "shipment" in event_type:
            shipments = resource.get("shipments") or []
            first_shipment = shipments[0] if shipments else {}

            carrier = first_shipment.get("carrier") or resource.get("carrier") or "Carrier Handover"
            tracking_code = (
                first_shipment.get("number")
                or first_shipment.get("tracking_number")
                or resource.get("tracking_number")
                or "TRACKING-PRINTIFY"
            )
            tracking_url = first_shipment.get("url") or ""

            # Update Order fields
            order.tracking_number = tracking_code
            if carrier:
                order.carrier_preference = carrier

            # Status State Machine Mapping: fulfilled / shipped -> DISPATCHED
            canonical_code, status_obj = map_and_resolve_status("fulfilled")
            if status_obj:
                order.status = status_obj

            order.save(update_fields=["tracking_number", "carrier_preference", "status", "updated_at"])

            # Optionally create or update Shipment model in dispatch app if present
            self._sync_dispatch_shipment(
                order=order,
                carrier=carrier,
                tracking_code=tracking_code,
                tracking_url=tracking_url,
                status_obj=status_obj,
            )

            return {
                "matched_order": True,
                "order_number": order.order_number,
                "action": "shipment_recorded",
                "carrier": carrier,
                "tracking_number": tracking_code,
                "status": canonical_code,
            }

        # ---------------------------------------------------------------------
        # Event 2: order:sent-to-production
        # Maps to UNDER_PRODUCTION / IN_PRODUCTION
        # ---------------------------------------------------------------------
        elif event_type in ("order:sent-to-production", "order:in-production"):
            canonical_code, status_obj = map_and_resolve_status("sent-to-production")
            if status_obj:
                order.status = status_obj
                order.save(update_fields=["status", "updated_at"])

            return {
                "matched_order": True,
                "order_number": order.order_number,
                "action": "status_updated",
                "status": canonical_code,
            }

        # ---------------------------------------------------------------------
        # Event 3: order:updated (General Lifecycle Progression)
        # ---------------------------------------------------------------------
        elif event_type == "order:updated":
            printify_status = resource.get("status") or "pending"
            canonical_code, status_obj = map_and_resolve_status(printify_status)

            if status_obj:
                order.status = status_obj
                order.save(update_fields=["status", "updated_at"])

            return {
                "matched_order": True,
                "order_number": order.order_number,
                "action": "status_updated",
                "printify_status": printify_status,
                "orderflow_status": canonical_code,
            }

        # Unrecognized topic
        return {
            "matched_order": True,
            "order_number": order.order_number,
            "action": "unhandled_topic_ignored",
            "event_type": event_type,
        }

    def _sync_dispatch_shipment(
        self,
        order: Order,
        carrier: str,
        tracking_code: str,
        tracking_url: str,
        status_obj: Optional[EntityStatus],
    ):
        """
        Creates or updates a logistics Shipment manifest record in apps.dispatch.
        """
        try:
            from apps.dispatch.models import Shipment
            shipment, created = Shipment.objects.get_or_create(
                order=order,
                defaults={
                    "carrier_name": carrier,
                    "tracking_number": tracking_code,
                    "tracking_url": tracking_url or None,
                    "status": status_obj,
                },
            )
            if not created:
                shipment.carrier_name = carrier
                shipment.tracking_number = tracking_code
                if tracking_url:
                    shipment.tracking_url = tracking_url
                if status_obj:
                    shipment.status = status_obj
                shipment.save()
            logger.info(f"[Printify Webhook] Synced Shipment manifest ID {shipment.id} for Order {order.order_number}")
        except Exception as exc:
            logger.warning(f"[Printify Webhook] Could not update dispatch Shipment: {exc}")
