"""
Production Batching and Shopfloor Job Ticket Models.
"""
from django.db import models
from apps.core.models.base import BaseModel
from apps.orders.models import Order
from apps.core.models.lookups import EntityStatus
from apps.authentication.models import User


class ProductionBatch(BaseModel):
    """
    Groups verified print orders by paper stock (GSM), trim size format,
    binding type, and press availability for optimal shopfloor throughput.
    """
    BINDING_CHOICES = [
        ("HARDCOVER_CASEBOUND", "Hardcover Casebound (Greyboard 3mm)"),
        ("PUR_PERFECT_BOUND", "Softcover PUR Perfect Bound"),
        ("WIRE_O_SPIRAL", "Wire-O Spiral Bound with Thumbhook"),
        ("SADDLE_STITCH", "Saddle Stitch Booklet"),
        ("CANVAS_STRETCH", "Canvas Gallery Wrap"),
    ]

    PRESS_CHOICES = [
        ("HP_INDIGO_12000", "HP Indigo 12000 Digital Press (B2 Sheetfed)"),
        ("CANON_VARIOPRINT", "Canon varioPRINT iX3200 (Inkjet Production)"),
        ("HEIDELBERG_VERSAFIRE", "Heidelberg Versafire EP (High-Volume Toner)"),
        ("EPSON_SURECOLOR", "Epson SureColor P20000 (Fine Art & Canvas)"),
    ]

    batch_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unique production batch identifier (e.g., BATCH-2026-0819).",
    )
    paper_stock = models.CharField(
        max_length=128,
        help_text="Standardized paper stock and weight (e.g. 200gsm Silk Inner + 350gsm Cover).",
    )
    size_format = models.CharField(
        max_length=128,
        help_text="Trim format / imposition profile (e.g. A4 Landscape, A5 Portrait, 30x30 Layflat).",
    )
    binding_type = models.CharField(
        max_length=64,
        choices=BINDING_CHOICES,
        default="HARDCOVER_CASEBOUND",
    )
    target_press = models.CharField(
        max_length=64,
        choices=PRESS_CHOICES,
        default="HP_INDIGO_12000",
    )
    orders = models.ManyToManyField(
        Order,
        related_name="production_batches",
        help_text="Bundled orders included in this press batch.",
    )
    status = models.ForeignKey(
        EntityStatus,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="production_batches",
        help_text="Dynamic production status resolved from EntityStatus lookup.",
    )
    total_orders_count = models.PositiveIntegerField(
        default=0,
    )
    total_items_count = models.PositiveIntegerField(
        default=0,
    )
    total_sheets_count = models.PositiveIntegerField(
        default=0,
        help_text="Total press sheet passes required for the batch.",
    )
    priority = models.CharField(
        max_length=32,
        default="STANDARD",
        db_index=True,
    )
    job_ticket_pdf_url = models.TextField(
        blank=True,
        help_text="Relative or S3 URL to generated ReportLab PDF Job Ticket.",
    )
    assigned_operator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_batches",
        help_text="Press Operator responsible for running the batch.",
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    notes = models.TextField(
        blank=True,
    )

    class Meta:
        verbose_name = "Production Batch"
        verbose_name_plural = "Production Batches"
        ordering = ["-created_at"]

    def __str__(self):
        status_label = self.status.name if self.status else "Pending"
        return f"{self.batch_number} [{self.target_press}] - {self.total_orders_count} orders ({status_label})"
