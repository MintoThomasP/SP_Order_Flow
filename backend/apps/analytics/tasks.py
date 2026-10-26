import logging
from celery import shared_task
from apps.analytics.services.sla_alerts import evaluate_sla_and_dispatch_alerts
from apps.analytics.services.odoo_sync import sync_entity_to_odoo

logger = logging.getLogger(__name__)


@shared_task
def check_sla_breaches_and_send_alerts_task(threshold_hours: float = 4.0):
    """
    Periodic background job to evaluate SLA compliance and dispatch Email/WhatsApp notifications.
    """
    logger.info(f"Executing SLA deadline monitor (threshold={threshold_hours}h)...")
    result = evaluate_sla_and_dispatch_alerts(threshold_hours)
    return result


@shared_task
def sync_entity_to_odoo_task(model_name: str, reference_id: str):
    """
    Asynchronous task for bi-directional Odoo ERP synchronization.
    """
    logger.info(f"Dispatching Odoo sync task for {model_name} [{reference_id}]...")
    return sync_entity_to_odoo(model_name, reference_id)
