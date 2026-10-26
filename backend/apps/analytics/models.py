from django.db import models
from django.conf import settings
from apps.core.models.base import BaseModel
from apps.orders.models import Order, OrderItem


class ReprintDamageLog(BaseModel):
    """
    Damage Waste & Automated Reprint Requeue Model.
    Tracks machine jams, trim errors, color calibration defects, and trigger instant reprints.
    """
    FAILURE_REASON_CHOICES = [
        ("PRINT_STREAKING", "Printhead Banding / Ink Streaking"),
        ("PAPER_JAM", "Paper Feed Jam / Wrinkled Sheets"),
        ("TRIM_DEFECT", "Guillotine Miscut / Bleed Clipped"),
        ("COVER_SCUFF", "Lamination Bubble / Cover Scuff"),
        ("BINDING_GLUE_FAILURE", "PUR Binding Glue Delamination"),
        ("COLOR_CALIBRATION_OFF", "Delta-E Color Profiling Deviation"),
        ("CARRIER_DAMAGED", "Transit Parcel Crushed / Damaged"),
        ("CUSTOMER_DISPUTE", "Customer Quality Rejection"),
        ("OTHER", "Other Production Defect"),
    ]

    STATUS_CHOICES = [
        ("FLAGGED", "Flagged & Awaiting Authorization"),
        ("REPRINT_QUEUED", "Reprint Auto-Queued (Rush Priority)"),
        ("IN_REPRODUCTION", "Reprint In Production"),
        ("QC_PASSED", "Reprint QC Passed"),
        ("RESOLVED", "Resolved & Replaced"),
        ("DISCARDED", "Discarded / No Reprint Required"),
    ]

    reprint_code = models.CharField(max_length=60, unique=True, db_index=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="damage_logs")
    order_item = models.ForeignKey(OrderItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="damage_logs")
    
    failure_reason = models.CharField(max_length=60, choices=FAILURE_REASON_CHOICES, default="PRINT_STREAKING")
    failure_description = models.TextField(blank=True)
    reported_at_station = models.CharField(max_length=50, default="QC_PASS")
    
    damaged_quantity = models.IntegerField(default=1)
    waste_sheets_count = models.IntegerField(default=0)
    estimated_cost_loss = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default="EUR")
    
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default="REPRINT_QUEUED")
    
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reported_damages",
    )
    reported_by_name = models.CharField(max_length=150, blank=True)
    reprinted_batch_number = models.CharField(max_length=100, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Reprint & Damage Log"
        verbose_name_plural = "Reprint & Damage Logs"

    def __str__(self):
        return f"{self.reprint_code} - {self.order.order_number} ({self.get_failure_reason_display()})"


class SLAAlertLog(BaseModel):
    """
    Automated SLA Overdue Warning & Escalation Alert Log.
    Records Email, WhatsApp, and Webhook notifications sent to managers.
    """
    ALERT_TYPE_CHOICES = [
        ("EMAIL", "Automated SMTP Email Alert"),
        ("WHATSAPP", "WhatsApp Business API Webhook"),
        ("SLACK", "Slack Operations Webhook"),
        ("SMS", "SMS Priority Dispatch"),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="sla_alerts")
    alert_type = models.CharField(max_length=30, choices=ALERT_TYPE_CHOICES, default="EMAIL")
    recipient = models.CharField(max_length=200)
    hours_remaining = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    message_body = models.TextField()
    dispatched_successfully = models.BooleanField(default=True)
    response_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "SLA Alert Log"
        verbose_name_plural = "SLA Alert Logs"

    def __str__(self):
        return f"{self.alert_type} Alert: {self.order.order_number} ({self.hours_remaining}h left)"


class OdooSyncLog(BaseModel):
    """
    Odoo ERP Enterprise Integration Synchronization Ledger.
    Maintains bi-directional sync state across sale.order, stock.picking, mrp.production, and account.move.
    """
    ODOO_MODEL_CHOICES = [
        ("sale.order", "Sales Order (sale.order)"),
        ("stock.picking", "Inventory Delivery (stock.picking)"),
        ("mrp.production", "Manufacturing Order (mrp.production)"),
        ("account.move", "Customer Invoice (account.move)"),
        ("product.template", "Product Master (product.template)"),
    ]

    DIRECTION_CHOICES = [
        ("OUTBOUND_TO_ODOO", "Outbound Sync to Odoo ERP"),
        ("INBOUND_FROM_ODOO", "Inbound Sync from Odoo ERP"),
    ]

    STATUS_CHOICES = [
        ("SYNCED", "Successfully Synced"),
        ("PENDING_RETRY", "Pending Background Retry"),
        ("FAILED", "Sync Failed / Schema Mismatch"),
    ]

    odoo_model = models.CharField(max_length=60, choices=ODOO_MODEL_CHOICES, default="sale.order")
    odoo_record_id = models.IntegerField(null=True, blank=True, help_text="Integer ID in Odoo PostgreSQL database")
    silverpoint_reference = models.CharField(max_length=150, db_index=True)
    sync_direction = models.CharField(max_length=30, choices=DIRECTION_CHOICES, default="OUTBOUND_TO_ODOO")
    sync_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="SYNCED")
    
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Odoo Sync Log"
        verbose_name_plural = "Odoo Sync Logs"

    def __str__(self):
        return f"{self.odoo_model} [{self.silverpoint_reference}] -> {self.sync_status}"
