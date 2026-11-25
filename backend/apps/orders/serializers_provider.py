"""
Request & Response Serializers for the Common Service Provider Push API.
Supports standard POD/book specs as well as commercial & event print specifications.
"""
from rest_framework import serializers
from apps.orders.models import Order, ProviderIngestionLog, ServiceProvider


class ProviderCustomerSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    company = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class ProviderShippingAddressSerializer(serializers.Serializer):
    recipient_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    street = serializers.CharField(max_length=255)
    street2 = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=128)
    state = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    postal_code = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    country = serializers.CharField(max_length=64)
    phone = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")


class ProviderOrderItemSerializer(serializers.Serializer):
    external_item_id = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    product_type = serializers.CharField(max_length=128)
    category = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    quantity = serializers.IntegerField(min_value=1)

    # Standard POD / Book specs
    page_count = serializers.IntegerField(min_value=1, required=False, default=1)
    spine_width_mm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, default="0.00")
    paper_stock = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")

    # Commercial / Event Print specs (stored in paper_stock fallback + item metadata)
    dimensions = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    material = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    finish = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")

    # Artwork & Proofing
    pdf_artwork_url = serializers.CharField(required=False, allow_blank=True, default="")
    artwork_url = serializers.CharField(required=False, allow_blank=True, default="")
    pdf_cover_url = serializers.CharField(required=False, allow_blank=True, default="")
    proof_url = serializers.CharField(required=False, allow_blank=True, default="")
    proof_status = serializers.ChoiceField(
        choices=["PENDING", "APPROVED", "REJECTED", "NOT_REQUIRED"],
        required=False,
        default="PENDING",
    )
    custom_specs = serializers.DictField(required=False, default=dict)

    def validate(self, attrs):
        art = (attrs.get("pdf_artwork_url") or attrs.get("artwork_url") or "").strip()
        if not art:
            raise serializers.ValidationError(
                {"pdf_artwork_url": "Either 'pdf_artwork_url' or 'artwork_url' is required for each item."}
            )
        attrs["_resolved_artwork_url"] = art
        return attrs


class ProviderOrderPushSerializer(serializers.Serializer):
    provider_code = serializers.CharField(max_length=64)
    external_order_id = serializers.CharField(max_length=128)
    priority = serializers.ChoiceField(
        choices=["RUSH_8H", "EXPRESS_24H", "STANDARD_72H"],
        required=False,
        default="STANDARD_72H",
    )
    sla_deadline = serializers.DateTimeField(required=False, allow_null=True, default=None)
    currency = serializers.CharField(max_length=8, required=False, allow_blank=True, default="")
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default="0.00")
    carrier_preference = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    is_sandbox = serializers.BooleanField(required=False, default=False)
    environment = serializers.ChoiceField(
        choices=["production", "sandbox", "staging", "test", "PRODUCTION", "SANDBOX", "STAGING", "TEST"],
        required=False,
        default="production",
    )
    customer = ProviderCustomerSerializer()
    shipping_address = ProviderShippingAddressSerializer()
    items = ProviderOrderItemSerializer(many=True, allow_empty=False)

    # Optional commercial/event metadata
    event_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    event_date = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    metadata = serializers.DictField(required=False, default=dict)


class ProviderTrackingSerializer(serializers.Serializer):
    carrier = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    carrier_code = serializers.ChoiceField(
        choices=["DHL", "FEDEX", "ARAMEX", "UPS", "BLUEDART", "DTDC", "INDIA_POST", "SELF_DELIVERY", "CUSTOM"],
        required=False,
        default="CUSTOM",
    )
    tracking_number = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    tracking_url = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")


class ProviderStatusPushSerializer(serializers.Serializer):
    provider_code = serializers.CharField(max_length=64)
    external_order_id = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    status = serializers.CharField(max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    tracking = ProviderTrackingSerializer(required=False)
    tracking_number = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    carrier = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    metadata = serializers.DictField(required=False, default=dict)


class ProviderIngestionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderIngestionLog
        fields = [
            "id",
            "provider",
            "provider_code",
            "external_order_id",
            "idempotency_key",
            "event_type",
            "payload_hash",
            "raw_payload",
            "status",
            "http_status",
            "error_message",
            "ip_address",
            "is_sandbox",
            "created_at",
        ]
        read_only_fields = fields


class ServiceProviderChannelSerializer(serializers.ModelSerializer):
    """
    Serializer for listing, viewing, and updating registered Service Provider Channels.
    Never exposes raw hashed keys; provides masked prefix + last4 hints and ingestion stats.
    """
    test_api_key_masked = serializers.SerializerMethodField()
    live_api_key_masked = serializers.SerializerMethodField()
    has_encrypted_test_key = serializers.SerializerMethodField()
    has_encrypted_live_key = serializers.SerializerMethodField()
    webhook_secret_masked = serializers.SerializerMethodField()
    orders_count = serializers.SerializerMethodField()
    test_orders_count = serializers.SerializerMethodField()
    live_orders_count = serializers.SerializerMethodField()
    last_ingested_at = serializers.SerializerMethodField()

    class Meta:
        model = ServiceProvider
        fields = [
            "id",
            "provider_code",
            "name",
            "is_active",
            "require_hmac",
            "is_sandbox_default",
            "is_external_pod_default",
            "default_currency",
            "default_carrier",
            "allowed_ips",
            "metadata",
            "test_api_key_prefix",
            "test_api_key_last4",
            "test_api_key_masked",
            "has_encrypted_test_key",
            "test_key_rotated_at",
            "live_api_key_prefix",
            "live_api_key_last4",
            "live_api_key_masked",
            "has_encrypted_live_key",
            "live_key_rotated_at",
            "webhook_secret_masked",
            "orders_count",
            "test_orders_count",
            "live_orders_count",
            "last_ingested_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "provider_code",
            "test_api_key_prefix",
            "test_api_key_last4",
            "test_key_rotated_at",
            "live_api_key_prefix",
            "live_api_key_last4",
            "live_key_rotated_at",
            "created_at",
            "updated_at",
        ]

    def get_test_api_key_masked(self, obj):
        if not obj.test_api_key_prefix:
            return ""
        return f"{obj.test_api_key_prefix}••••••••{obj.test_api_key_last4}"

    def get_live_api_key_masked(self, obj):
        if not obj.live_api_key_prefix:
            return ""
        return f"{obj.live_api_key_prefix}••••••••{obj.live_api_key_last4}"

    def get_has_encrypted_test_key(self, obj):
        return bool(obj.test_api_key_encrypted)

    def get_has_encrypted_live_key(self, obj):
        return bool(obj.live_api_key_encrypted)

    def get_webhook_secret_masked(self, obj):
        val = obj.webhook_secret or ""
        if not val:
            return ""
        return f"{val[:10]}••••{val[-4:]}" if len(val) > 14 else "••••••••"

    def get_orders_count(self, obj):
        return Order.objects.filter(service_provider=obj).count()

    def get_test_orders_count(self, obj):
        return Order.objects.filter(service_provider=obj, is_sandbox=True).count()

    def get_live_orders_count(self, obj):
        return Order.objects.filter(service_provider=obj, is_sandbox=False).count()

    def get_last_ingested_at(self, obj):
        latest = ProviderIngestionLog.objects.filter(provider=obj).order_by("-created_at").values_list("created_at", flat=True).first()
        return latest.isoformat() if latest else None


class ServiceProviderCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    provider_code = serializers.RegexField(
        regex=r"^[A-Za-z0-9_-]{2,64}$",
        max_length=64,
        help_text="Alphanumeric, underscore, or hyphen code (normalized to uppercase).",
    )
    default_currency = serializers.CharField(max_length=8, required=False, default="USD")
    default_carrier = serializers.CharField(max_length=64, required=False, default="DHL Express")
    require_hmac = serializers.BooleanField(required=False, default=False)
    is_external_pod_default = serializers.BooleanField(required=False, default=False)
    allowed_ips = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    metadata = serializers.DictField(required=False, default=dict)

    def validate_provider_code(self, value):
        code = value.strip().upper()
        if ServiceProvider.objects.filter(provider_code=code).exists():
            raise serializers.ValidationError(f"Channel with provider_code '{code}' already exists.")
        return code


class ServiceProviderRotateKeySerializer(serializers.Serializer):
    environment = serializers.ChoiceField(choices=["test", "live", "both"], default="test")

