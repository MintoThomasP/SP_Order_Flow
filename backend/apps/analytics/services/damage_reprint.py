import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from apps.orders.models import Order, OrderItem
from apps.core.models.lookups import EntityStatus
from apps.authentication.services.audit import log_staff_action
from apps.analytics.models import ReprintDamageLog

logger = logging.getLogger(__name__)


def report_and_requeue_damaged_print(
    order_identifier: str,
    failure_reason: str = "PRINT_STREAKING",
    failure_description: str = "",
    reported_at_station: str = "QC_PASS",
    damaged_quantity: int = 1,
    waste_sheets_count: int = 60,
    estimated_cost_loss: Decimal = Decimal("8.50"),
    operator=None,
    auto_requeue: bool = True,
) -> dict:
    """
    Flags damaged / defective prints on the shopfloor and automatically re-queues them into production.
    Elevates order SLA priority to 'RUSH_8H'.
    """
    order = Order.objects.filter(
        order_number__iexact=order_identifier.strip()
    ).first() or Order.objects.filter(
        peecho_order_id__iexact=order_identifier.strip()
    ).first()

    if not order:
        try:
            order = Order.objects.filter(id=order_identifier.strip()).first()
        except Exception:
            pass

    if not order:
        raise ValueError(f"Order '{order_identifier}' not found.")

    with transaction.atomic():
        # Generate unique reprint code
        count = ReprintDamageLog.objects.count() + 1
        reprint_code = f"RPR-2026-{count:04d}"

        operator_name = (operator.get_full_name() or operator.email) if (operator and operator.is_authenticated) else "Quality Control Operator"

        damage_log = ReprintDamageLog.objects.create(
            reprint_code=reprint_code,
            order=order,
            failure_reason=failure_reason,
            failure_description=failure_description,
            reported_at_station=reported_at_station,
            damaged_quantity=damaged_quantity,
            waste_sheets_count=waste_sheets_count,
            estimated_cost_loss=estimated_cost_loss,
            currency="EUR",
            status="REPRINT_QUEUED" if auto_requeue else "FLAGGED",
            reported_by=operator if (operator and operator.is_authenticated) else None,
            reported_by_name=operator_name,
            notes=f"Reported at {reported_at_station} station. Auto-requeue: {auto_requeue}",
        )

        if auto_requeue:
            # Transition Order status back to IN_PRODUCTION / PREPRESS_PASSED with RUSH priority
            in_prod_status = EntityStatus.objects.filter(entity_type="ORDER", code="IN_PRODUCTION").first()
            if in_prod_status:
                order.status = in_prod_status

            order.sla_priority = "RUSH_8H"
            order.save(update_fields=["status", "sla_priority", "updated_at"])

        log_staff_action(
            user=operator if (operator and operator.is_authenticated) else None,
            action="REPORT_DAMAGE_REPRINT",
            resource_type="ORDER",
            resource_id=order.order_number,
            details={
                "reprint_code": reprint_code,
                "failure_reason": failure_reason,
                "station": reported_at_station,
                "waste_sheets": waste_sheets_count,
                "cost_loss": str(estimated_cost_loss),
                "auto_requeued": auto_requeue,
            },
        )

    logger.info(f"Damage reported for {order.order_number} ({failure_reason}). Reprint {reprint_code} queued.")
    return {
        "success": True,
        "reprint_code": reprint_code,
        "order_number": order.order_number,
        "peecho_order_id": order.peecho_order_id,
        "status": damage_log.status,
        "elevated_priority": order.sla_priority,
        "message": f"Defect logged ({failure_reason}). Order {order.order_number} auto-requeued with RUSH_8H priority.",
    }
