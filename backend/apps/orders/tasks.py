"""
Celery Asynchronous Tasks for Printify POD API Outbound Sync and Webhook Registration.
Implements automatic retry logic, exponential backoff, and strict isolation for internal manual orders.
"""
import logging
import requests
from celery import shared_task
from django.utils import timezone

from apps.orders.models import Order
from apps.orders.services.printify import PrintifyService, PrintifyAPIError, PrintifyConfigError
from apps.orders.services.printify_status import map_and_resolve_status

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=30,
)
def sync_order_to_printify(self, order_id: str, auto_send_to_production: bool = False):
    """
    Submits an OrderFlow order to the Printify REST API asynchronously.
    Enforces strict isolation: internal manual and non-Printify orders are cleanly bypassed.
    Retries on network failures or transient API errors with exponential backoff.

    Args:
        order_id: Primary key (UUID string) or order_number of the Order.
        auto_send_to_production: If True, automatically queues send_to_production after creation.
    """
    attempt = self.request.retries + 1
    logger.info(f"[Celery] sync_order_to_printify initiated for Order ID '{order_id}' (Attempt #{attempt})")

    try:
        # Lookup order by UUID or order_number
        order = Order.objects.filter(id=order_id).first() or Order.objects.filter(order_number=order_id).first()
        if not order:
            logger.error(f"[Printify Sync] Order '{order_id}' does not exist. Aborting task without retry.")
            return {"status": "failed", "error": f"Order {order_id} not found."}

        # -------------------------------------------------------------------------
        # Strict Isolation Guard:
        # Maintain strict isolation so internal manual orders bypass external Printify API calls.
        # -------------------------------------------------------------------------
        if not order.is_external_pod or order.order_source != "printify":
            logger.info(
                f"[Printify Isolation] Bypassing Order '{order.order_number}'. "
                f"is_external_pod={order.is_external_pod}, order_source='{order.order_source}'. "
                "Manual and internal orders will never trigger external Printify API calls."
            )
            return {
                "status": "bypassed",
                "order_number": order.order_number,
                "reason": "Internal/Manual order isolated from Printify API",
            }

        # If already synchronized and has external POD ID, skip duplicate submission
        if order.external_pod_order_id:
            logger.info(
                f"[Printify Sync] Order '{order.order_number}' is already synced with Printify "
                f"(ID: {order.external_pod_order_id})."
            )
            if auto_send_to_production:
                send_order_to_printify_production.delay(str(order.id))
            return {
                "status": "already_synced",
                "printify_order_id": order.external_pod_order_id,
                "order_number": order.order_number,
            }

        # Initialize API client service
        service = PrintifyService()

        # Build Printify API payload
        order_payload = service.build_order_payload(order)

        # Outbound POST to /v1/shops/{shop_id}/orders.json
        printify_resp = service.submit_order(order_payload)
        external_id = printify_resp.get("id")

        if not external_id:
            raise PrintifyAPIError(
                f"Printify responded without an order id: {printify_resp}",
                response_data=printify_resp,
            )

        # Update Order record with external POD credentials
        order.external_pod_order_id = str(external_id)
        order.is_external_pod = True
        order.order_source = "printify"

        # Update status to PENDING
        canonical_code, status_obj = map_and_resolve_status(printify_resp.get("status", "pending"))
        if status_obj:
            order.status = status_obj

        order.save(update_fields=["external_pod_order_id", "is_external_pod", "order_source", "status", "updated_at"])

        logger.info(
            f"[Printify Sync] Successfully synced Order '{order.order_number}' -> Printify ID '{external_id}'"
        )

        # Optionally advance to production immediately
        if auto_send_to_production:
            send_order_to_printify_production.delay(str(order.id))

        return {
            "status": "success",
            "order_number": order.order_number,
            "printify_order_id": external_id,
            "printify_status": printify_resp.get("status"),
        }

    except (requests.exceptions.RequestException, PrintifyAPIError) as exc:
        logger.warning(
            f"[Printify Sync] Transient failure communicating with Printify on attempt #{attempt}: {exc}"
        )
        # Exponential backoff: 30s, 60s, 120s, 240s, 480s
        countdown = min(30 * (2 ** self.request.retries), 600)
        raise self.retry(exc=exc, countdown=countdown)

    except PrintifyConfigError as cfg_err:
        logger.critical(f"[Printify Sync] Configuration error: {cfg_err}. Not retrying.")
        return {"status": "configuration_error", "error": str(cfg_err)}

    except Exception as fatal_exc:
        logger.exception(f"[Printify Sync] Unexpected fatal error syncing order '{order_id}': {fatal_exc}")
        raise fatal_exc


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=30,
)
def send_order_to_printify_production(self, order_id: str):
    """
    Asynchronously instructs Printify to move the order into production
    via /v1/shops/{shop_id}/orders/{order_id}/send_to_production.json.
    Updates internal status to UNDER_PRODUCTION.
    """
    attempt = self.request.retries + 1
    logger.info(f"[Celery] send_order_to_printify_production for Order '{order_id}' (Attempt #{attempt})")

    try:
        order = Order.objects.filter(id=order_id).first() or Order.objects.filter(order_number=order_id).first()
        if not order:
            logger.error(f"[Printify Production] Order '{order_id}' not found.")
            return {"status": "failed", "error": "Order not found"}

        # Strict isolation check
        if not order.is_external_pod or order.order_source != "printify":
            logger.info(f"[Printify Isolation] Bypassing non-Printify order '{order.order_number}'.")
            return {"status": "bypassed", "reason": "Not an external Printify order"}

        if not order.external_pod_order_id:
            logger.warning(
                f"[Printify Production] Order '{order.order_number}' missing external_pod_order_id. "
                "Queueing sync_order_to_printify first."
            )
            sync_order_to_printify.delay(str(order.id), auto_send_to_production=True)
            return {"status": "deferred_for_sync"}

        service = PrintifyService()
        resp = service.send_to_production(order.external_pod_order_id)

        # Transition internal state to UNDER_PRODUCTION
        _, status_obj = map_and_resolve_status("sent-to-production")
        if status_obj:
            order.status = status_obj
            order.save(update_fields=["status", "updated_at"])

        logger.info(
            f"[Printify Production] Order '{order.order_number}' (Printify ID: {order.external_pod_order_id}) "
            "successfully submitted to Printify production press."
        )
        return {
            "status": "in_production",
            "order_number": order.order_number,
            "printify_order_id": order.external_pod_order_id,
            "response": resp,
        }

    except (requests.exceptions.RequestException, PrintifyAPIError) as exc:
        logger.warning(f"[Printify Production] Network/API error on attempt #{attempt}: {exc}")
        countdown = min(30 * (2 ** self.request.retries), 600)
        raise self.retry(exc=exc, countdown=countdown)

    except Exception as exc:
        logger.exception(f"[Printify Production] Failed to advance order to production: {exc}")
        raise exc


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def register_printify_webhooks_task(self, callback_url: str):
    """
    Background worker task to register Printify webhooks for order updates,
    production progression, and parcel shipment tracking notifications.
    """
    logger.info(f"[Celery] Registering Printify webhooks for callback: {callback_url}")
    try:
        service = PrintifyService()
        results = service.register_webhooks(callback_url)
        logger.info(f"[Printify Webhooks] Registration completed successfully: {results}")
        return {"status": "success", "results": results}
    except Exception as exc:
        logger.error(f"[Printify Webhooks] Webhook registration failed: {exc}")
        raise self.retry(exc=exc, countdown=60)
