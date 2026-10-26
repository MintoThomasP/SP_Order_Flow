"""
Serializers for Shopfloor Stations, Mobile Scanner Events, and Status Updates.
"""
from rest_framework import serializers
from apps.shopfloor.models import ShopfloorStation, ScanEventLog


class ShopfloorStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopfloorStation
        fields = [
            "id",
            "code",
            "name",
            "category",
            "hardware_device_name",
            "target_status_code",
            "icon",
            "sort_order",
            "is_active",
        ]
        read_only_fields = ["id"]


class ScanEventLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanEventLog
        fields = [
            "id",
            "station",
            "barcode_scanned",
            "entity_type",
            "entity_reference",
            "previous_status",
            "new_status",
            "operator_name_snapshot",
            "ip_address",
            "notes",
            "created_at",
        ]
        read_only_fields = fields


class ScanStatusUpdateRequestSerializer(serializers.Serializer):
    barcode = serializers.CharField(
        required=True,
        help_text="Scanned barcode or QR code payload string (Order #, Peecho ID, or Batch ID).",
    )
    station = serializers.CharField(
        required=False,
        default="PRINT",
        help_text="Active shopfloor station (PRINT, CUT_LAMINATE, BIND, QC_PASS).",
    )
    status_code = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Optional target dynamic status code override.",
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Optional operator scan comments or waste notes.",
    )
