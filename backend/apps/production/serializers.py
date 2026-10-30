"""
Serializers for Production Batches and Job Tickets.
"""
from rest_framework import serializers
from apps.production.models import ProductionBatch, PrintMachine, BindingMethod
from apps.orders.serializers import OrderSerializer
from apps.core.serializers.lookups import EntityStatusSerializer


class ProductionBatchSerializer(serializers.ModelSerializer):
    orders = OrderSerializer(many=True, read_only=True)
    status = serializers.CharField(source="status.code", read_only=True, default="QUEUED_PRESS")
    status_code = serializers.CharField(source="status.code", read_only=True, default="QUEUED_PRESS")
    status_details = EntityStatusSerializer(source="status", read_only=True)
    assigned_operator_name = serializers.SerializerMethodField()
    press_label = serializers.CharField(source="get_target_press_display", read_only=True)
    binding_label = serializers.CharField(source="get_binding_type_display", read_only=True)

    class Meta:
        model = ProductionBatch
        fields = [
            "id",
            "batch_number",
            "paper_stock",
            "size_format",
            "binding_type",
            "binding_label",
            "target_press",
            "press_label",
            "status",
            "status_code",
            "status_details",
            "total_orders_count",
            "total_items_count",
            "total_sheets_count",
            "priority",
            "job_ticket_pdf_url",
            "assigned_operator",
            "assigned_operator_name",
            "started_at",
            "completed_at",
            "notes",
            "created_at",
            "updated_at",
            "orders",
        ]
        read_only_fields = ["id", "batch_number", "created_at", "updated_at"]

    def get_assigned_operator_name(self, obj):
        if obj.assigned_operator:
            return obj.assigned_operator.get_full_name() or obj.assigned_operator.email
        return "Unassigned"


class CreateProductionBatchSerializer(serializers.Serializer):
    order_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        help_text="List of Order UUIDs to bundle into this batch.",
    )
    paper_stock = serializers.CharField(
        max_length=128,
        default="200gsm Silk Inner + 350gsm Hardcover Gloss",
    )
    size_format = serializers.CharField(
        max_length=128,
        default="A4 Landscape (210 x 297 mm)",
    )
    binding_type = serializers.CharField(
        max_length=64,
        default="HARDCOVER_CASEBOUND",
    )
    target_press = serializers.CharField(
        max_length=64,
        default="HP_INDIGO_12000",
    )
    priority = serializers.CharField(
        max_length=32,
        default="STANDARD",
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class PrintMachineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintMachine
        fields = [
            "id",
            "code",
            "name",
            "description",
            "sheet_format",
            "max_speed_cph",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        return value.strip().upper().replace(" ", "_")


class BindingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = BindingMethod
        fields = [
            "id",
            "code",
            "name",
            "description",
            "min_pages",
            "max_pages",
            "default_caliper_mm",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        return value.strip().upper().replace(" ", "_")
