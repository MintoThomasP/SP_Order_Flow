"""
Shopfloor Workstations, Hardware Stations, and Barcode/QR Scan Audit Models.
"""
from django.db import models
from apps.core.models.base import BaseModel
from apps.authentication.models import User


class ShopfloorStation(BaseModel):
    """
    Physical touch-workstation terminal on the POD production shopfloor.
    """
    STATION_CATEGORY_CHOICES = [
        ("PRINT", "Digital Press / RIP Station"),
        ("CUT_LAMINATE", "Cutting & Thermal Lamination Station"),
        ("BIND", "Case-Making & Bindery Station"),
        ("QC_PASS", "Quality Assurance & Packing Station"),
    ]

    code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Station programmatic code (e.g., PRINT, CUT_LAMINATE, BIND, QC_PASS).",
    )
    name = models.CharField(
        max_length=128,
        help_text="Human-readable station title displayed on operator touchscreens.",
    )
    category = models.CharField(
        max_length=32,
        choices=STATION_CATEGORY_CHOICES,
        default="PRINT",
    )
    hardware_device_name = models.CharField(
        max_length=128,
        blank=True,
        help_text="Designated physical machinery (e.g. HP Indigo 12000, Polar 78, Horizon BQ-480).",
    )
    target_status_code = models.CharField(
        max_length=64,
        default="IN_PRODUCTION",
        help_text="EntityStatus code automatically applied upon successful barcode scan.",
    )
    icon = models.CharField(
        max_length=64,
        default="Printer",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        verbose_name = "Shopfloor Station"
        verbose_name_plural = "Shopfloor Stations"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class ScanEventLog(BaseModel):
    """
    High-frequency log recording every barcode/QR code scan event from mobile or Bluetooth scanners.
    """
    station = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Workstation where the scan occurred.",
    )
    barcode_scanned = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Raw payload or barcode string read by camera/scanner.",
    )
    entity_type = models.CharField(
        max_length=32,
        default="ORDER",
        help_text="Resolved target entity (e.g. ORDER, BATCH).",
    )
    entity_reference = models.CharField(
        max_length=128,
        help_text="Human-friendly reference (e.g. SP-2026-90412 or BATCH-2026-0819).",
    )
    previous_status = models.CharField(
        max_length=64,
        blank=True,
    )
    new_status = models.CharField(
        max_length=64,
    )
    operator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shopfloor_scans",
    )
    operator_name_snapshot = models.CharField(
        max_length=128,
        blank=True,
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )
    notes = models.TextField(
        blank=True,
    )

    class Meta:
        verbose_name = "Scan Event Log"
        verbose_name_plural = "Scan Event Logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.station}] {self.entity_reference} -> {self.new_status} by {self.operator_name_snapshot or 'Scanner'}"
