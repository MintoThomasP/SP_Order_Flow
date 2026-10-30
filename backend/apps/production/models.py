"""
Production Batching and Shopfloor Job Ticket Models.
"""
from decimal import Decimal
from django.db import models
from apps.core.models.base import BaseModel
from apps.orders.models import Order
from apps.core.models.lookups import EntityStatus
from apps.authentication.models import User


class PrintMachine(BaseModel):
    """
    Shopfloor digital press or offset print machine.
    """
    code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Programmatic machine identifier (e.g., HP_INDIGO_12000).",
    )
    name = models.CharField(
        max_length=128,
        help_text="Human-readable machine name (e.g. HP Indigo 12000 Digital Press).",
    )
    description = models.TextField(
        blank=True,
        help_text="Machine specifications, technology, or location notes.",
    )
    sheet_format = models.CharField(
        max_length=64,
        default="B2 (500x707mm)",
        blank=True,
        help_text="Standard imposition format (e.g. B2 Sheetfed, SRA3, Continuous Feed).",
    )
    max_speed_cph = models.PositiveIntegerField(
        default=3450,
        help_text="Maximum impressions / sheets per hour.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Enable or disable press from new batch assignments.",
    )

    class Meta:
        verbose_name = "Print Machine"
        verbose_name_plural = "Print Machines"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class BindingMethod(BaseModel):
    """
    Bookbinding and post-press finishing method.
    """
    code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Programmatic binding method code (e.g., HARDCOVER_CASEBOUND).",
    )
    name = models.CharField(
        max_length=128,
        help_text="Human-readable binding title.",
    )
    description = models.TextField(
        blank=True,
        help_text="Finishing guidelines, greyboard thickness, or spine requirements.",
    )
    min_pages = models.PositiveIntegerField(
        default=24,
        help_text="Minimum allowable page count for this binding method.",
    )
    max_pages = models.PositiveIntegerField(
        default=800,
        help_text="Maximum allowable page count for this binding method.",
    )
    default_caliper_mm = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("3.00"),
        help_text="Default cover or board caliper thickness in mm.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Enable or disable binding method from batch creation.",
    )

    class Meta:
        verbose_name = "Binding Method"
        verbose_name_plural = "Binding Methods"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


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
        default="HARDCOVER_CASEBOUND",
    )
    target_press = models.CharField(
        max_length=64,
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
        return f"{self.batch_number} [{self.get_target_press_display()}] - {self.total_orders_count} orders ({status_label})"

    def get_target_press_display(self):
        machine = PrintMachine.objects.filter(code=self.target_press).first()
        if machine:
            return machine.name
        return dict(self.PRESS_CHOICES).get(self.target_press, self.target_press)

    def get_binding_type_display(self):
        method = BindingMethod.objects.filter(code=self.binding_type).first()
        if method:
            return method.name
        return dict(self.BINDING_CHOICES).get(self.binding_type, self.binding_type)
