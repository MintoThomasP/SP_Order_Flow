"""
Barcode and QR Scan Processing Service for Shopfloor Workstations.
Handles instantaneous order & batch state transitions and records audit events.
"""
from django.db import transaction
from apps.orders.models import Order
from apps.production.models import ProductionBatch
from apps.shopfloor.models import ShopfloorStation, ScanEventLog
from apps.core.models.lookups import EntityStatus
from apps.authentication.services.audit import log_staff_action


def parse_barcode_reference(raw_barcode: str) -> tuple[str, str]:
    """
    Extracts entity type and identifier from barcode or QR payload.
    Examples:
    - 'SP-2026-90412' -> ('ORDER', 'SP-2026-90412')
    - 'PEECHO-881920' -> ('ORDER', 'PEECHO-881920')
    - 'SP-POD-BATCH:BATCH-2026-0819|PRESS:HP_INDIGO_12000' -> ('BATCH', 'BATCH-2026-0819')
    - 'BATCH-2026-0819' -> ('BATCH', 'BATCH-2026-0819')
    """
    raw_barcode = raw_barcode.strip()

    if raw_barcode.startswith("SP-POD-BATCH:"):
        parts = raw_barcode.replace("SP-POD-BATCH:", "").split("|")
        return "BATCH", parts[0].strip()

    if raw_barcode.startswith("BATCH-"):
        return "BATCH", raw_barcode

    return "ORDER", raw_barcode


def process_barcode_scan(
    raw_barcode: str,
    station_code: str = "PRINT",
    target_status_code: str = None,
    operator=None,
    client_ip: str = None,
    notes: str = "",
) -> dict:
    """
    Executes instant state transition on the scanned Order or Batch.
    """
    entity_type, identifier = parse_barcode_reference(raw_barcode)

    # Station fallback status mapping
    station_status_defaults = {
        "PRINT": "PRINTING",
        "CUT_LAMINATE": "IN_PRODUCTION",
        "BIND": "IN_PRODUCTION",
        "QC_PASS": "PACKED",
        "DISPATCH": "DISPATCHED",
    }

    desired_status_code = target_status_code or station_status_defaults.get(station_code, "IN_PRODUCTION")

    with transaction.atomic():
        # Case A: BATCH SCANNED
        if entity_type == "BATCH":
            batch = ProductionBatch.objects.filter(batch_number__iexact=identifier).prefetch_related("orders").first()
            if not batch:
                raise ValueError(f"Production Batch '{identifier}' not found.")

            target_status = EntityStatus.objects.filter(code__iexact=desired_status_code).first()
            if not target_status:
                target_status = EntityStatus.objects.filter(code="IN_PRODUCTION").first()

            old_status = batch.status.name if batch.status else "Pending"
            batch.status = target_status
            batch.save(update_fields=["status", "updated_at"])

            # Also transition all orders in this batch
            order_target_status = EntityStatus.objects.filter(entity_type="ORDER", code__iexact=desired_status_code).first() or \
                                  EntityStatus.objects.filter(code__iexact=desired_status_code).first()
            if order_target_status:
                from apps.orders.services.peecho_sync import sync_order_status_to_peecho
                for ord_obj in batch.orders.all():
                    ord_obj.status = order_target_status
                    ord_obj.save(update_fields=["status", "updated_at"])
                    sync_order_status_to_peecho(
                        order=ord_obj,
                        status_code=order_target_status.code,
                        notes=f"Batch {batch.batch_number} scanned at {station_code} station.",
                        operator=operator if (operator and operator.is_authenticated) else None,
                    )

            operator_name = (operator.get_full_name() or operator.email) if (operator and operator.is_authenticated) else "Station Scanner"

            # Create scan log
            ScanEventLog.objects.create(
                station=station_code,
                barcode_scanned=raw_barcode,
                entity_type="BATCH",
                entity_reference=batch.batch_number,
                previous_status=old_status,
                new_status=target_status.name,
                operator=operator if (operator and operator.is_authenticated) else None,
                operator_name_snapshot=operator_name,
                ip_address=client_ip,
                notes=notes,
            )

            # Audit log
            log_staff_action(
                user=operator if (operator and operator.is_authenticated) else None,
                action="STATUS_CHANGE",
                resource_type="BATCH",
                resource_id=batch.batch_number,
                details={
                    "station": station_code,
                    "previous_status": old_status,
                    "new_status": target_status.name,
                    "orders_count": batch.total_orders_count,
                    "notes": notes,
                },
            )

            return {
                "success": True,
                "entity_type": "BATCH",
                "reference": batch.batch_number,
                "previous_status": old_status,
                "new_status": target_status.name,
                "station": station_code,
                "message": f"Batch {batch.batch_number} transitioned to '{target_status.name}' at {station_code} station.",
            }

        # Case B: ORDER SCANNED
        order = Order.objects.filter(
            order_number__iexact=identifier
        ).first() or Order.objects.filter(
            peecho_order_id__iexact=identifier
        ).first()

        if not order:
            # Fallback UUID match
            try:
                order = Order.objects.filter(id=identifier).first()
            except Exception:
                pass

        if not order:
            raise ValueError(f"POD Order '{identifier}' not found in active database.")

        target_status = EntityStatus.objects.filter(entity_type="ORDER", code__iexact=desired_status_code).first()
        if not target_status:
            target_status = EntityStatus.objects.filter(code__iexact=desired_status_code).first()
        if not target_status:
            target_status = EntityStatus.objects.filter(entity_type="ORDER", code="IN_PRODUCTION").first()

        old_status = order.status.name if order.status else "Received"
        order.status = target_status
        order.save(update_fields=["status", "updated_at"])

        from apps.orders.services.peecho_sync import sync_order_status_to_peecho
        sync_order_status_to_peecho(
            order=order,
            status_code=target_status.code,
            notes=f"Order scanned at {station_code} station. {notes}".strip(),
            operator=operator if (operator and operator.is_authenticated) else None,
        )

        operator_name = (operator.get_full_name() or operator.email) if (operator and operator.is_authenticated) else "Station Scanner"

        # Create scan log
        ScanEventLog.objects.create(
            station=station_code,
            barcode_scanned=raw_barcode,
            entity_type="ORDER",
            entity_reference=order.order_number,
            previous_status=old_status,
            new_status=target_status.name,
            operator=operator if (operator and operator.is_authenticated) else None,
            operator_name_snapshot=operator_name,
            ip_address=client_ip,
            notes=notes,
        )

        # Staff Audit Trail
        log_staff_action(
            user=operator if (operator and operator.is_authenticated) else None,
            action="STATUS_CHANGE",
            resource_type="ORDER",
            resource_id=order.order_number,
            details={
                "station": station_code,
                "previous_status": old_status,
                "new_status": target_status.name,
                "peecho_order_id": order.peecho_order_id,
                "notes": notes,
            },
        )

        return {
            "success": True,
            "entity_type": "ORDER",
            "reference": order.order_number,
            "peecho_order_id": order.peecho_order_id,
            "customer_name": order.customer_name,
            "previous_status": old_status,
            "new_status": target_status.name,
            "station": station_code,
            "message": f"Order {order.order_number} transitioned to '{target_status.name}' at {station_code} station.",
        }
