"""
Artwork Verification and Preflight Inspection Models for POD Operations.
"""
from decimal import Decimal
from django.db import models
from apps.core.models.base import BaseModel
from apps.orders.models import Order, OrderItem
from apps.authentication.models import User


class ArtworkVerification(BaseModel):
    """
    Tracks high-resolution PDF preflight analysis, S3 asset streaming,
    page count validation, spine thickness calculation, and operator approval/rejection.
    """
    VERIFICATION_STATUS_CHOICES = [
        ("PENDING_REVIEW", "Pending Operator Review"),
        ("APPROVED_FOR_PRINT", "Approved for Press"),
        ("FLAGGED_ERROR", "Flagged Prepress Error"),
        ("STREAMING_S3", "Streaming to S3"),
        ("RE_DOWNLOAD_REQUESTED", "Re-download Queued"),
    ]

    FILE_TYPE_CHOICES = [
        ("CONTENT_INTERIOR", "Book / Document Interior Pages"),
        ("COVER_WRAP", "Hardcover / Softcover Full Wrap"),
        ("DUST_JACKET", "Hardcover Dust Jacket"),
        ("SINGLE_SHEET", "Single Sheet / Print Asset"),
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="artwork_verifications",
        help_text="Parent POD Order.",
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="artwork_verifications",
        help_text="Associated print line item.",
    )
    file_type = models.CharField(
        max_length=32,
        choices=FILE_TYPE_CHOICES,
        default="CONTENT_INTERIOR",
    )
    file_url = models.TextField(
        help_text="Direct HTTPS URL or AWS S3 Object URL for the PDF asset.",
    )
    s3_bucket = models.CharField(
        max_length=128,
        default="silverpoint-pod-artwork-vault",
        help_text="AWS S3 destination bucket.",
    )
    s3_key = models.CharField(
        max_length=512,
        blank=True,
        help_text="AWS S3 Storage Key / path.",
    )
    file_size_bytes = models.BigIntegerField(
        default=0,
        help_text="Size of PDF binary in bytes.",
    )
    page_count = models.PositiveIntegerField(
        default=0,
        help_text="Detected PDF page count from automated preflight scanner.",
    )
    calculated_spine_width_mm = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Accurate spine width computed from paper caliper and page count.",
    )
    resolution_dpi = models.PositiveIntegerField(
        default=300,
        help_text="Average or minimum bitmap DPI detected in artwork.",
    )
    resolution_check_passed = models.BooleanField(
        default=True,
        help_text="True if all raster assets meet >= 300 DPI preflight standard.",
    )
    bleed_check_passed = models.BooleanField(
        default=True,
        help_text="True if artwork includes 3mm (or required) bleed margin.",
    )
    color_space = models.CharField(
        max_length=64,
        default="CMYK (ISO Coated v2 / FOGRA39)",
        help_text="Detected color profile.",
    )
    verification_status = models.CharField(
        max_length=32,
        choices=VERIFICATION_STATUS_CHOICES,
        default="PENDING_REVIEW",
        db_index=True,
    )
    error_reason = models.TextField(
        blank=True,
        help_text="Preflight exception details (e.g., 'Low-res images < 150 DPI on page 7', 'Missing 3mm bleed box').",
    )
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_artworks",
        help_text="Prepress Specialist who reviewed or approved the asset.",
    )
    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="UTC timestamp when operator made approval/rejection decision.",
    )
    preflight_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Granular preflight diagnostics (trim box dimensions, font embedding list, color separation data).",
    )

    class Meta:
        verbose_name = "Artwork Verification"
        verbose_name_plural = "Artwork Verifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.verification_status}] {self.order.order_number} - {self.file_type} ({self.page_count}pp, {self.calculated_spine_width_mm}mm)"
