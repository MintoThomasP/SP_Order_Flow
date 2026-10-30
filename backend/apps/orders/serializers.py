"""
Serializers for POD Orders, Order Items, Status Transitions, and Peecho Webhook Logs.
"""
from rest_framework import serializers
from apps.orders.models import Order, OrderItem, PeechoPayloadLog
from apps.core.serializers.lookups import EntityStatusSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    pdf_artwork_url = serializers.SerializerMethodField()
    pdf_cover_url = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "peecho_item_id",
            "product_type",
            "quantity",
            "page_count",
            "spine_width_mm",
            "paper_stock",
            "pdf_artwork_url",
            "pdf_cover_url",
            "documents",
            "preflight_passed",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_pdf_artwork_url(self, obj):
        url = obj.pdf_artwork_url
        if not url or "assets.peecho.com" in str(url) or "example.com" in str(url):
            return "/artworks/peecho_hardcover_photobook_a4.pdf"
        return url

    def get_pdf_cover_url(self, obj):
        url = obj.pdf_cover_url
        if not url or "assets.peecho.com" in str(url) or "example.com" in str(url):
            return "/artworks/peecho_hardcover_wrap_cover.pdf"
        return url

    def get_documents(self, obj):
        art_url = self.get_pdf_artwork_url(obj)
        cov_url = self.get_pdf_cover_url(obj)
        docs = [
            {
                "id": f"{obj.id}-interior",
                "name": f"{obj.product_type} - Interior Pages (PDF)",
                "file_type": "CONTENT_INTERIOR",
                "file_url": art_url,
                "page_count": obj.page_count,
                "is_primary": True,
            }
        ]
        if cov_url and cov_url != art_url:
            docs.append({
                "id": f"{obj.id}-cover",
                "name": f"{obj.product_type} - Cover Wrap (PDF)",
                "file_type": "COVER_WRAP",
                "file_url": cov_url,
                "page_count": 1,
                "is_primary": False,
            })
        return docs


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_details = EntityStatusSerializer(source="status", read_only=True)
    time_remaining_minutes = serializers.SerializerMethodField()
    batch_info = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "peecho_order_id",
            "customer_name",
            "customer_email",
            "customer_phone",
            "shipping_address",
            "carrier_preference",
            "status",
            "status_details",
            "sla_deadline",
            "sla_priority",
            "time_remaining_minutes",
            "batch_info",
            "total_items_count",
            "total_amount",
            "currency",
            "order_source",
            "is_external_pod",
            "external_pod_order_id",
            "tracking_number",
            "peecho_metadata",
            "is_active",
            "created_at",
            "updated_at",
            "items",
        ]
        read_only_fields = ["id", "order_number", "created_at", "updated_at"]

    def get_time_remaining_minutes(self, obj):
        from django.utils import timezone
        diff = obj.sla_deadline - timezone.now()
        return int(diff.total_seconds() / 60)

    def get_batch_info(self, obj):
        batch = obj.production_batches.order_by("-created_at").first()
        if not batch:
            return None
        return {
            "id": str(batch.id),
            "batch_number": batch.batch_number,
            "target_press": batch.target_press,
            "press_label": batch.get_target_press_display(),
            "paper_stock": batch.paper_stock,
            "status_code": batch.status.code if batch.status else None,
            "status_name": batch.status.name if batch.status else None,
            "created_at": batch.created_at,
        }


class OrderStatusUpdateSerializer(serializers.Serializer):
    status_code = serializers.CharField(required=True)
    comments = serializers.CharField(required=False, allow_blank=True, default="")
    admin_approved = serializers.BooleanField(required=False, default=False)


class PeechoPayloadLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeechoPayloadLog
        fields = [
            "id",
            "peecho_order_id",
            "event_type",
            "payload_hash",
            "raw_payload",
            "status",
            "error_message",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields


class PeechoIntegrationConfigSerializer(serializers.ModelSerializer):
    api_key_masked = serializers.SerializerMethodField()
    secret_key_masked = serializers.SerializerMethodField()
    webhook_secret_masked = serializers.SerializerMethodField()
    full_webhook_url = serializers.SerializerMethodField()

    class Meta:
        from apps.orders.models import PeechoIntegrationConfig
        model = PeechoIntegrationConfig
        fields = [
            "id",
            "api_base_url",
            "button_key",
            "api_key",
            "api_key_masked",
            "secret_key",
            "secret_key_masked",
            "webhook_secret",
            "webhook_secret_masked",
            "webhook_endpoint_path",
            "full_webhook_url",
            "is_sandbox",
            "auto_sync_status_changes",
            "last_connection_test_at",
            "last_connection_status",
            "updated_at",
        ]
        extra_kwargs = {
            "api_key": {"write_only": True, "required": False},
            "secret_key": {"write_only": True, "required": False},
            "webhook_secret": {"write_only": True, "required": False},
        }

    def get_api_key_masked(self, obj):
        if not obj.api_key:
            return ""
        return f"{obj.api_key[:6]}••••••••{obj.api_key[-4:]}" if len(obj.api_key) > 10 else "••••••••"

    def get_secret_key_masked(self, obj):
        if not obj.secret_key:
            return ""
        return f"{obj.secret_key[:6]}••••••••{obj.secret_key[-4:]}" if len(obj.secret_key) > 10 else "••••••••"

    def get_webhook_secret_masked(self, obj):
        if not obj.webhook_secret:
            return ""
        return f"{obj.webhook_secret[:6]}••••••••{obj.webhook_secret[-4:]}" if len(obj.webhook_secret) > 10 else "••••••••"

    def get_full_webhook_url(self, obj):
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.webhook_endpoint_path)
        return f"http://127.0.0.1:8001{obj.webhook_endpoint_path}"


class PrintifyPayloadLogSerializer(serializers.ModelSerializer):
    class Meta:
        from apps.orders.models import PrintifyPayloadLog
        model = PrintifyPayloadLog
        fields = "__all__"


