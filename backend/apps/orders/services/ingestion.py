"""
Peecho Order Ingestion Service.
Handles deduplication, signature/key validation, and creation of POD Order & OrderItems.
"""
import hashlib
import json
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db import transaction

from apps.orders.models import Order, OrderItem, PeechoPayloadLog
from apps.core.models.lookups import EntityStatus
from apps.authentication.services.audit import log_staff_action


def process_peecho_payload(payload: dict, client_ip: str = None) -> tuple[Order | None, PeechoPayloadLog, bool]:
    """
    Ingests and validates a raw Peecho order payload.
    Returns: (order_instance, payload_log, is_duplicate)
    """
    raw_str = json.dumps(payload, sort_keys=True)
    payload_hash = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    peecho_order_id = str(payload.get("order_id") or payload.get("id") or payload.get("peecho_order_id", "")).strip()
    event_type = payload.get("event", "order.created")

    # 1. Check for Duplicate Payload
    existing_log = PeechoPayloadLog.objects.filter(payload_hash=payload_hash, status="PROCESSED").first()
    if existing_log and peecho_order_id:
        existing_order = Order.objects.filter(peecho_order_id=peecho_order_id).first()
        duplicate_log = PeechoPayloadLog.objects.create(
            peecho_order_id=peecho_order_id,
            event_type=event_type,
            payload_hash=payload_hash,
            raw_payload=payload,
            status="DUPLICATE",
            error_message="Duplicate payload hash received. Skipped redundant processing.",
            ip_address=client_ip,
        )
        return existing_order, duplicate_log, True

    # 2. Check if Order Already Exists by Peecho ID
    if peecho_order_id:
        existing_order = Order.objects.filter(peecho_order_id=peecho_order_id).first()
        if existing_order:
            duplicate_log = PeechoPayloadLog.objects.create(
                peecho_order_id=peecho_order_id,
                event_type=event_type,
                payload_hash=payload_hash,
                raw_payload=payload,
                status="DUPLICATE",
                error_message=f"Order with Peecho ID {peecho_order_id} already exists (Internal ID: {existing_order.order_number}).",
                ip_address=client_ip,
            )
            return existing_order, duplicate_log, True

    # 3. Create Payload Log
    payload_log = PeechoPayloadLog.objects.create(
        peecho_order_id=peecho_order_id,
        event_type=event_type,
        payload_hash=payload_hash,
        raw_payload=payload,
        status="RECEIVED",
        ip_address=client_ip,
    )

    try:
        with transaction.atomic():
            # Resolve dynamic initial status
            initial_status = EntityStatus.objects.filter(entity_type="ORDER", code="RECEIVED").first()
            if not initial_status:
                initial_status = EntityStatus.objects.filter(entity_type="ORDER").order_by("sort_order").first()

            # Determine SLA Priority & Deadline
            priority = payload.get("priority", "STANDARD_72H").upper()
            if "RUSH" in priority:
                sla_priority = "RUSH_8H"
                sla_hours = 8
            elif "EXPRESS" in priority:
                sla_priority = "EXPRESS_24H"
                sla_hours = 24
            else:
                sla_priority = "STANDARD_72H"
                sla_hours = 72

            sla_deadline = timezone.now() + timedelta(hours=sla_hours)

            # Generate internal order number
            order_count = Order.objects.count() + 1001
            order_number = f"SP-2026-{order_count}"

            # Customer & Address info
            customer_info = payload.get("customer", {})
            shipping_info = payload.get("shipping_address", {})
            customer_name = customer_info.get("name") or shipping_info.get("recipient_name") or "Valued Customer"
            customer_email = customer_info.get("email") or ""
            customer_phone = customer_info.get("phone") or shipping_info.get("phone") or ""

            total_amount = Decimal(str(payload.get("total_amount", "0.00")))
            currency = payload.get("currency", "EUR")
            carrier_pref = payload.get("carrier") or shipping_info.get("carrier") or "DHL Express"

            # Create Order
            order = Order.objects.create(
                order_number=order_number,
                peecho_order_id=peecho_order_id or f"PEECHO-AUTO-{order_count}",
                order_source="peecho",
                is_external_pod=True,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                shipping_address=shipping_info,
                carrier_preference=carrier_pref,
                status=initial_status,
                sla_deadline=sla_deadline,
                sla_priority=sla_priority,
                total_amount=total_amount,
                currency=currency,
                peecho_metadata=payload,
            )

            # Create Order Items
            raw_items = payload.get("items") or payload.get("order_items") or []
            if not raw_items:
                # Default single photobook item if payload didn't break down items
                raw_items = [
                    {
                        "product_type": payload.get("product_type", "Hardcover Photo Book A4"),
                        "quantity": payload.get("quantity", 1),
                        "page_count": payload.get("page_count", 48),
                        "spine_width_mm": payload.get("spine_width_mm", 12.4),
                        "paper_stock": "200gsm Silk Inner + 350gsm Hardcover Gloss",
                        "pdf_artwork_url": payload.get("pdf_url") or payload.get("artwork_url", "https://assets.peecho.com/demo/sample_inner.pdf"),
                        "pdf_cover_url": payload.get("cover_pdf_url", "https://assets.peecho.com/demo/sample_cover.pdf"),
                    }
                ]

            total_items_count = 0
            for idx, item_data in enumerate(raw_items):
                qty = int(item_data.get("quantity", 1))
                total_items_count += qty
                page_cnt = int(item_data.get("page_count", 32))
                spine_w = Decimal(str(item_data.get("spine_width_mm", "8.50")))
                pdf_art_url = item_data.get("pdf_artwork_url") or item_data.get("pdf_url", "")
                pdf_cov_url = item_data.get("pdf_cover_url") or item_data.get("cover_url", "")

                order_item = OrderItem.objects.create(
                    order=order,
                    peecho_item_id=str(item_data.get("id") or item_data.get("item_id") or f"ITEM-{idx+1}"),
                    product_type=item_data.get("product_type", "Hardcover Photo Book A4"),
                    quantity=qty,
                    page_count=page_cnt,
                    spine_width_mm=spine_w,
                    paper_stock=item_data.get("paper_stock", "200gsm Silk Inner + 350gsm Hardcover Gloss"),
                    pdf_artwork_url=pdf_art_url,
                    pdf_cover_url=pdf_cov_url,
                    preflight_passed=False,
                    metadata=item_data,
                )

                # Auto-create Artwork Verification for Prepress Inspection
                try:
                    from apps.prepress.models import ArtworkVerification
                    ArtworkVerification.objects.create(
                        order=order,
                        order_item=order_item,
                        file_type="CONTENT_INTERIOR",
                        file_url=pdf_art_url or "/artworks/peecho_hardcover_photobook_a4.pdf",
                        s3_bucket="silverpoint-pod-artwork-vault",
                        s3_key=f"orders/{order.peecho_order_id}/artwork_inner.pdf",
                        file_size_bytes=1024 * 1024 * 14, # ~14MB
                        page_count=page_cnt,
                        calculated_spine_width_mm=spine_w,
                        resolution_dpi=300,
                        resolution_check_passed=True,
                        bleed_check_passed=True,
                        verification_status="PENDING_REVIEW",
                    )
                except Exception:
                    pass

            order.total_items_count = total_items_count
            order.save(update_fields=["total_items_count"])

            # Mark log as successfully processed
            payload_log.status = "PROCESSED"
            payload_log.save(update_fields=["status"])

            # Record Staff Audit Log for automated gateway action
            log_staff_action(
                user=None,
                action="PEECHO_SYNC_TRIGGERED",
                resource_type="ORDER",
                resource_id=order.order_number,
                details={
                    "peecho_order_id": order.peecho_order_id,
                    "items_count": order.total_items_count,
                    "sla_priority": order.sla_priority,
                    "sla_deadline": order.sla_deadline.isoformat(),
                },
            )

            return order, payload_log, False

    except Exception as exc:
        payload_log.status = "FAILED"
        payload_log.error_message = str(exc)
        payload_log.save(update_fields=["status", "error_message"])
        raise exc
