from rest_framework import serializers
from apps.analytics.models import ReprintDamageLog, SLAAlertLog, OdooSyncLog


class ReprintDamageLogSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    peecho_order_id = serializers.CharField(source="order.peecho_order_id", read_only=True)
    customer_name = serializers.CharField(source="order.customer_name", read_only=True)
    failure_reason_display = serializers.CharField(source="get_failure_reason_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ReprintDamageLog
        fields = [
            "id",
            "reprint_code",
            "order",
            "order_number",
            "peecho_order_id",
            "customer_name",
            "order_item",
            "failure_reason",
            "failure_reason_display",
            "failure_description",
            "reported_at_station",
            "damaged_quantity",
            "waste_sheets_count",
            "estimated_cost_loss",
            "currency",
            "status",
            "status_display",
            "reported_by",
            "reported_by_name",
            "reprinted_batch_number",
            "resolved_at",
            "notes",
            "created_at",
            "updated_at",
        ]


class ReportDamageRequestSerializer(serializers.Serializer):
    order_identifier = serializers.CharField(required=True)
    failure_reason = serializers.CharField(required=False, default="PRINT_STREAKING")
    failure_description = serializers.CharField(required=False, allow_blank=True)
    reported_at_station = serializers.CharField(required=False, default="QC_PASS")
    damaged_quantity = serializers.IntegerField(required=False, default=1)
    waste_sheets_count = serializers.IntegerField(required=False, default=60)
    estimated_cost_loss = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=8.50)
    auto_requeue = serializers.BooleanField(required=False, default=True)


class SLAAlertLogSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = SLAAlertLog
        fields = [
            "id",
            "order",
            "order_number",
            "alert_type",
            "recipient",
            "hours_remaining",
            "message_body",
            "dispatched_successfully",
            "response_payload",
            "created_at",
        ]


class OdooSyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = OdooSyncLog
        fields = [
            "id",
            "odoo_model",
            "odoo_record_id",
            "silverpoint_reference",
            "sync_direction",
            "sync_status",
            "request_payload",
            "response_payload",
            "error_message",
            "created_at",
        ]


class TriggerOdooSyncSerializer(serializers.Serializer):
    model_name = serializers.ChoiceField(
        choices=["sale.order", "stock.picking", "account.move", "mrp.production"]
    )
    reference_id = serializers.CharField(required=True)
