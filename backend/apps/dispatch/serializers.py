from rest_framework import serializers
from apps.dispatch.models import Shipment
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer


class ShipmentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    peecho_order_id = serializers.CharField(source="order.peecho_order_id", read_only=True)
    customer_name = serializers.CharField(source="order.customer_name", read_only=True)
    shipping_address = serializers.JSONField(source="order.shipping_address", read_only=True)
    carrier_display = serializers.CharField(source="get_carrier_code_display", read_only=True)
    status_display = serializers.CharField(source="get_status_code_display", read_only=True)

    class Meta:
        model = Shipment
        fields = [
            "id",
            "order",
            "order_number",
            "peecho_order_id",
            "customer_name",
            "shipping_address",
            "carrier_name",
            "carrier_code",
            "carrier_display",
            "tracking_number",
            "tracking_url",
            "awb_document_url",
            "awb_file_key",
            "weight_kg",
            "package_type",
            "shipping_cost",
            "currency",
            "status",
            "status_code",
            "status_display",
            "peecho_synced",
            "peecho_synced_at",
            "peecho_sync_attempts",
            "peecho_sync_response",
            "peecho_sync_error",
            "dispatched_by",
            "dispatched_by_name",
            "dispatched_at",
            "estimated_delivery_at",
            "actual_delivered_at",
            "carrier_events_log",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "peecho_synced",
            "peecho_synced_at",
            "peecho_sync_attempts",
            "peecho_sync_response",
            "peecho_sync_error",
            "dispatched_by_name",
            "created_at",
            "updated_at",
        ]


class ConfirmDispatchSerializer(serializers.Serializer):
    """
    Payload for packing & dispatch station confirmation.
    """
    order_identifier = serializers.CharField(
        required=True,
        help_text="Order Number (e.g. SP-2026-90412), Peecho Order ID, or Order UUID.",
    )
    carrier_code = serializers.CharField(required=False, default="DHL")
    carrier_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    tracking_number = serializers.CharField(required=True)
    tracking_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    weight_kg = serializers.DecimalField(max_digits=8, decimal_places=3, required=False, default=0.500)
    package_type = serializers.CharField(required=False, default="BUBBLE_MAILER")
    shipping_cost = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0.00)
    currency = serializers.CharField(required=False, default="USD")
    awb_document_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    trigger_peecho_sync = serializers.BooleanField(required=False, default=True)
