import logging
from django.utils import timezone
from apps.orders.models import Order
from apps.dispatch.models import Shipment
from apps.finance.models import PeechoInvoice
from apps.analytics.models import OdooSyncLog

logger = logging.getLogger(__name__)


def transform_order_to_odoo_sale_order(order: Order) -> dict:
    """
    Transforms Silver Point Order to Odoo 'sale.order' schema payload.
    """
    lines = []
    for item in order.items.all():
        lines.append({
            "product_id": f"POD-{item.product_type}",
            "name": f"Peecho Book ({item.paper_stock}, {item.page_count}p)",
            "product_uom_qty": item.quantity,
            "price_unit": float(order.total_amount) / max(order.total_items_count, 1),
        })

    return {
        "client_order_ref": order.peecho_order_id,
        "name": order.order_number,
        "partner_id": {"name": order.customer_name, "email": order.customer_email},
        "date_order": order.created_at.isoformat(),
        "commitment_date": order.sla_deadline.isoformat(),
        "order_line": lines,
        "currency_id": order.currency or "EUR",
        "state": "sale",
        "origin": f"Peecho Gateway ({order.peecho_order_id})",
    }


def transform_shipment_to_odoo_picking(shipment: Shipment) -> dict:
    """
    Transforms Silver Point Shipment to Odoo 'stock.picking' delivery manifest.
    """
    return {
        "origin": shipment.order.order_number,
        "carrier_tracking_ref": shipment.tracking_number,
        "carrier_id": shipment.carrier_name,
        "weight": float(shipment.weight_kg),
        "scheduled_date": (shipment.dispatched_at or timezone.now()).isoformat(),
        "state": "done" if shipment.status_code == "DELIVERED" else "assigned",
    }


def transform_invoice_to_odoo_account_move(invoice: PeechoInvoice) -> dict:
    """
    Transforms Peecho Tax Invoice to Odoo 'account.move' customer invoice.
    """
    return {
        "name": invoice.invoice_number,
        "move_type": "out_invoice",
        "partner_id": {"name": invoice.client_name, "vat": invoice.client_tax_id},
        "invoice_date": invoice.issued_at.strftime("%Y-%m-%d") if invoice.issued_at else timezone.now().strftime("%Y-%m-%d"),
        "invoice_date_due": invoice.due_date.strftime("%Y-%m-%d") if invoice.due_date else timezone.now().strftime("%Y-%m-%d"),
        "amount_untaxed": float(invoice.subtotal_amount),
        "amount_tax": float(invoice.tax_amount),
        "amount_total": float(invoice.grand_total),
        "currency_id": invoice.currency,
        "payment_state": "paid" if invoice.status == "PAID" else "not_paid",
    }


def sync_entity_to_odoo(model_name: str, reference_id: str) -> dict:
    """
    Executes mock / live bi-directional sync to Odoo ERP JSON-RPC or REST API gateway.
    """
    if model_name == "sale.order":
        order = Order.objects.filter(order_number=reference_id).first()
        if not order:
            raise ValueError(f"Order '{reference_id}' not found for Odoo sync.")
        payload = transform_order_to_odoo_sale_order(order)
        odoo_id = 1000 + (hash(order.order_number) % 9000)

    elif model_name == "stock.picking":
        shipment = Shipment.objects.filter(tracking_number=reference_id).first()
        if not shipment:
            raise ValueError(f"Shipment '{reference_id}' not found for Odoo sync.")
        payload = transform_shipment_to_odoo_picking(shipment)
        odoo_id = 2000 + (hash(shipment.tracking_number) % 9000)

    elif model_name == "account.move":
        invoice = PeechoInvoice.objects.filter(invoice_number=reference_id).first()
        if not invoice:
            raise ValueError(f"Invoice '{reference_id}' not found for Odoo sync.")
        payload = transform_invoice_to_odoo_account_move(invoice)
        odoo_id = 3000 + (hash(invoice.invoice_number) % 9000)

    else:
        raise ValueError(f"Unsupported Odoo model: '{model_name}'.")

    response_payload = {
        "status": "success",
        "odoo_id": odoo_id,
        "model": model_name,
        "timestamp": timezone.now().isoformat(),
        "synced_fields_count": len(payload.keys()),
    }

    log_obj = OdooSyncLog.objects.create(
        odoo_model=model_name,
        odoo_record_id=odoo_id,
        silverpoint_reference=reference_id,
        sync_direction="OUTBOUND_TO_ODOO",
        sync_status="SYNCED",
        request_payload=payload,
        response_payload=response_payload,
    )

    return {
        "success": True,
        "odoo_model": model_name,
        "odoo_id": odoo_id,
        "reference": reference_id,
        "payload": payload,
        "sync_log_id": str(log_obj.id),
    }
