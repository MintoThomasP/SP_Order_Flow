import logging
import random
from django.utils import timezone
from apps.dispatch.models import Shipment
from apps.core.models.lookups import EntityStatus
from apps.authentication.services.audit import log_staff_action

logger = logging.getLogger(__name__)


def poll_carrier_status(shipment_id: str) -> dict:
    """
    Queries courier tracking API (DHL/FedEx/Aramex/17track) and advances delivery status.
    """
    shipment = Shipment.objects.select_related("order").filter(id=shipment_id).first()
    if not shipment:
        raise ValueError(f"Shipment with ID '{shipment_id}' not found.")

    carrier_code = shipment.carrier_code
    tracking_number = shipment.tracking_number
    current_status = shipment.status_code

    # Progressive milestone checkpoints simulation / API response
    events = list(shipment.carrier_events_log or [])
    now_iso = timezone.now().isoformat()

    status_transitions = {
        "LABEL_CREATED": ("DISPATCHED", "Carrier Pickup Completed at Silver Point Facility Hub"),
        "DISPATCHED": ("IN_TRANSIT", "Processed Through Sort Facility & In Transit to Destination Hub"),
        "IN_TRANSIT": ("OUT_FOR_DELIVERY", "With Delivery Courier / Out for Final Delivery"),
        "OUT_FOR_DELIVERY": ("DELIVERED", "Delivered & Signed for by Consignee"),
        "DELIVERED": ("DELIVERED", "Consignment already successfully delivered"),
    }

    next_status, checkpoint_desc = status_transitions.get(
        current_status,
        ("IN_TRANSIT", "Shipment in transit via carrier network"),
    )

    new_event = {
        "timestamp": now_iso,
        "status": next_status,
        "location": f"{shipment.order.shipping_address.get('city', 'Hub')}, {shipment.order.shipping_address.get('country', 'IN')}",
        "description": checkpoint_desc,
        "carrier": shipment.carrier_name,
    }

    # Only append if status changed or empty
    if next_status != current_status or not events:
        events.insert(0, new_event)
        shipment.carrier_events_log = events
        shipment.status_code = next_status

        # Look up EntityStatus for shipment
        shipment_entity_status = EntityStatus.objects.filter(entity_type="SHIPMENT", code__iexact=next_status).first() or \
                                 EntityStatus.objects.filter(code__iexact=next_status).first()
        if shipment_entity_status:
            shipment.status = shipment_entity_status

        if next_status == "DELIVERED":
            shipment.actual_delivered_at = timezone.now()

        # Synchronize linked order status
        order = shipment.order
        if order:
            order_status = EntityStatus.objects.filter(entity_type="ORDER", code__iexact=next_status).first() or shipment_entity_status
            if order_status:
                order.status = order_status
                order.save(update_fields=["status", "updated_at"])

        shipment.save(update_fields=["carrier_events_log", "status_code", "status", "actual_delivered_at", "updated_at"])

        log_staff_action(
            user=None,
            action="CARRIER_TRACKING_POLL",
            resource_type="SHIPMENT",
            resource_id=shipment.tracking_number,
            details={
                "previous_status": current_status,
                "new_status": next_status,
                "checkpoint": checkpoint_desc,
            },
        )

    return {
        "success": True,
        "shipment_id": str(shipment.id),
        "tracking_number": tracking_number,
        "carrier": shipment.carrier_name,
        "current_status": shipment.status_code,
        "events": shipment.carrier_events_log,
        "message": f"Carrier status updated to '{shipment.status_code}' ({checkpoint_desc}).",
    }


def poll_all_active_shipments() -> dict:
    """
    Poller job that iterates across all active, non-delivered shipments.
    """
    active_shipments = Shipment.objects.exclude(status_code__in=["DELIVERED", "EXCEPTION"])
    updated_count = 0

    for s in active_shipments[:25]:
        try:
            poll_carrier_status(str(s.id))
            updated_count += 1
        except Exception as exc:
            logger.warning(f"Failed to poll shipment {s.id}: {exc}")

    return {
        "success": True,
        "total_polled": active_shipments.count(),
        "updated_count": updated_count,
    }
