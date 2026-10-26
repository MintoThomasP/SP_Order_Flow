import logging
from celery import shared_task
from apps.dispatch.services.peecho_callback import sync_shipment_to_peecho
from apps.dispatch.services.courier_poller import poll_all_active_shipments, poll_carrier_status

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def sync_shipment_to_peecho_task(self, shipment_id: str):
    """
    Asynchronous Celery task with exponential backoff to notify Peecho of order dispatch.
    """
    logger.info(f"Triggering Peecho tracking sync task for shipment {shipment_id} (Attempt #{self.request.retries + 1})")
    try:
        result = sync_shipment_to_peecho(shipment_id)
        return result
    except Exception as exc:
        logger.error(f"Peecho callback failed on attempt {self.request.retries + 1}: {exc}")
        # Retry with exponential backoff: 30s, 60s, 120s, 240s...
        countdown = 30 * (2 ** self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)


@shared_task
def poll_courier_tracking_updates_task():
    """
    Background poller task to sync carrier checkpoint updates for active in-transit parcels.
    """
    logger.info("Executing periodic courier tracking status poller...")
    result = poll_all_active_shipments()
    return result


@shared_task
def poll_single_shipment_task(shipment_id: str):
    """
    Ad-hoc single parcel carrier status poll.
    """
    return poll_carrier_status(shipment_id)
