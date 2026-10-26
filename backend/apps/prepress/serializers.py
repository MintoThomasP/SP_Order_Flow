"""
Serializers for Artwork Verification and Preflight Inspection decisions.
"""
from rest_framework import serializers
from apps.prepress.models import ArtworkVerification


class ArtworkVerificationSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    peecho_order_id = serializers.CharField(source="order.peecho_order_id", read_only=True)
    product_type = serializers.CharField(source="order_item.product_type", read_only=True)
    paper_stock = serializers.CharField(source="order_item.paper_stock", read_only=True)
    verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ArtworkVerification
        fields = [
            "id",
            "order",
            "order_number",
            "peecho_order_id",
            "order_item",
            "product_type",
            "paper_stock",
            "file_type",
            "file_url",
            "s3_bucket",
            "s3_key",
            "file_size_bytes",
            "page_count",
            "calculated_spine_width_mm",
            "resolution_dpi",
            "resolution_check_passed",
            "bleed_check_passed",
            "color_space",
            "verification_status",
            "error_reason",
            "verified_by",
            "verified_by_name",
            "verified_at",
            "preflight_metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.email
        return "Automated Preflight Worker"


class PrepressDecisionSerializer(serializers.Serializer):
    error_reason = serializers.CharField(required=False, allow_blank=True, default="")
    comments = serializers.CharField(required=False, allow_blank=True, default="")
