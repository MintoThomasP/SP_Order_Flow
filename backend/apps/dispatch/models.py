from django.db import models
from django.conf import settings
from apps.core.models.base import BaseModel
from apps.core.models.lookups import EntityStatus
from apps.orders.models import Order


class Shipment(BaseModel):
    """
    Shipment & Logistics Manifest Model for Silver Point POD Orders.
    Tracks waybills, carrier statuses, AWB S3 documents, and automated Peecho callbacks.
    """
    CARRIER_CHOICES = [
        ("DHL", "DHL Express Worldwide"),
        ("FEDEX", "FedEx Priority"),
        ("ARAMEX", "Aramex International"),
        ("UPS", "UPS Worldwide Express"),
        ("BLUEDART", "BlueDart Express"),
        ("DTDC", "DTDC Express"),
        ("INDIA_POST", "India Post Speed Post"),
        ("SELF_DELIVERY", "Own Delivery Person / In-House Driver"),
        ("CUSTOM", "Custom / Dedicated Courier"),
    ]

    DISPATCH_STATUS_CHOICES = [
        ("LABEL_CREATED", "Label Created / Packed"),
        ("DISPATCHED", "Dispatched / Carrier Handover"),
        ("IN_TRANSIT", "In Transit"),
        ("OUT_FOR_DELIVERY", "Out for Delivery"),
        ("DELIVERED", "Delivered"),
        ("EXCEPTION", "Delivery Exception / Delayed"),
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="shipments",
        help_text="Order associated with this parcel shipment.",
    )
    carrier_name = models.CharField(max_length=100, default="DHL Express Worldwide")
    carrier_code = models.CharField(max_length=50, choices=CARRIER_CHOICES, default="DHL")
    tracking_number = models.CharField(max_length=120, db_index=True)
    tracking_url = models.URLField(max_length=500, blank=True, null=True)

    awb_document_url = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="AWS S3 or CDN direct link to printable Air Waybill (AWB) PDF.",
    )
    awb_file_key = models.CharField(max_length=255, blank=True, null=True)

    weight_kg = models.DecimalField(max_digits=8, decimal_places=3, default=0.500)
    package_type = models.CharField(max_length=50, default="BUBBLE_MAILER")
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default="USD")

    # Dynamic status lookup & direct code
    status = models.ForeignKey(
        EntityStatus,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipments",
    )
    status_code = models.CharField(max_length=50, choices=DISPATCH_STATUS_CHOICES, default="DISPATCHED")

    # Peecho Callback Sync Status
    peecho_synced = models.BooleanField(default=False, db_index=True)
    peecho_synced_at = models.DateTimeField(null=True, blank=True)
    peecho_sync_attempts = models.IntegerField(default=0)
    peecho_sync_response = models.JSONField(default=dict, blank=True)
    peecho_sync_error = models.TextField(blank=True)

    # Operator & timestamps
    dispatched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatched_shipments",
    )
    dispatched_by_name = models.CharField(max_length=150, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    estimated_delivery_at = models.DateTimeField(null=True, blank=True)
    actual_delivered_at = models.DateTimeField(null=True, blank=True)

    # Carrier Tracking Checkpoint Logs
    carrier_events_log = models.JSONField(
        default=list,
        blank=True,
        help_text="Chronological carrier checkpoint events from polling API.",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Shipment"
        verbose_name_plural = "Shipments"

    def __str__(self):
        return f"{self.carrier_name} - {self.tracking_number} ({self.order.order_number})"
