"""
Live Activity and Real-time Broadcast Events for Multi-user Synchronization.
"""
from django.db import models
from apps.core.models.base import BaseModel


class LiveActivityEvent(BaseModel):
    """
    Real-time system event emitted when orders are received, status changes,
    production batches are scheduled, shipments are dispatched, or alerts occur.
    Broadcasts to all active staff dashboards via SSE / Polling.
    """
    EVENT_TYPE_CHOICES = [
        ("ORDER_CREATED", "New Order Received"),
        ("STATUS_CHANGED", "Order Status Updated"),
        ("PREPRESS_APPROVED", "Artwork Preflight Approved"),
        ("PREPRESS_REJECTED", "Artwork Rejected / Proof Issue"),
        ("BATCH_CREATED", "Production Batch Scheduled"),
        ("PRINT_STARTED", "Print Run Started on Press"),
        ("PRINT_COMPLETED", "Press Output Completed"),
        ("DISPATCH_WAYBILL", "Order Dispatched with Waybill"),
        ("DELIVERED", "Order Successfully Delivered"),
        ("DAMAGE_REPRINT", "Damage Reported / Reprint Queued"),
        ("SLA_ALERT", "SLA Critical Alert"),
    ]

    event_type = models.CharField(
        max_length=64,
        choices=EVENT_TYPE_CHOICES,
        default="STATUS_CHANGED",
        db_index=True,
    )
    title = models.CharField(
        max_length=255,
        help_text="Human-readable event notification title.",
    )
    message = models.TextField(
        blank=True,
        help_text="Detailed notification body or transition comments.",
    )
    order_number = models.CharField(
        max_length=128,
        blank=True,
        db_index=True,
        help_text="Associated POD order number (e.g. SP-2026-90412).",
    )
    order_id = models.CharField(
        max_length=64,
        blank=True,
        help_text="UUID string of the order if available.",
    )
    status_code = models.CharField(
        max_length=64,
        blank=True,
        help_text="New status code (e.g. IN_PRODUCTION).",
    )
    status_name = models.CharField(
        max_length=128,
        blank=True,
        help_text="Human-readable status label.",
    )
    actor_name = models.CharField(
        max_length=128,
        default="System",
        help_text="Staff name or automated worker who performed the action.",
    )
    link = models.CharField(
        max_length=255,
        blank=True,
        default="/orders",
        help_text="Target URL in frontend (e.g. /orders, /prepress, /dispatch).",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured contextual details (channel, customer, carrier, etc.).",
    )

    class Meta:
        verbose_name = "Live Activity Event"
        verbose_name_plural = "Live Activity Events"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.event_type}] {self.title} ({self.order_number}) at {self.created_at}"
