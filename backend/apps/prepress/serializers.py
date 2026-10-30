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
    pdf_artwork_url = serializers.SerializerMethodField()
    pdf_cover_url = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    order_status = serializers.SerializerMethodField()
    order_status_name = serializers.SerializerMethodField()

    class Meta:
        model = ArtworkVerification
        fields = [
            "id",
            "order",
            "order_number",
            "peecho_order_id",
            "order_status",
            "order_status_name",
            "order_item",
            "product_type",
            "paper_stock",
            "file_type",
            "file_url",
            "pdf_artwork_url",
            "pdf_cover_url",
            "documents",
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

    def get_order_status(self, obj):
        if obj.order and obj.order.status:
            return obj.order.status.code.upper()
        return "RECEIVED"

    def get_order_status_name(self, obj):
        if obj.order and obj.order.status:
            return obj.order.status.name
        return "Received"

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.email
        return "Automated Preflight Worker"

    def get_pdf_artwork_url(self, obj):
        url = obj.order_item.pdf_artwork_url if obj.order_item and obj.order_item.pdf_artwork_url else obj.file_url
        if not url or "assets.peecho.com" in str(url) or "example.com" in str(url):
            return "/artworks/peecho_hardcover_photobook_a4.pdf"
        return url

    def get_pdf_cover_url(self, obj):
        url = obj.order_item.pdf_cover_url if obj.order_item and obj.order_item.pdf_cover_url else None
        if not url or "assets.peecho.com" in str(url) or "example.com" in str(url):
            return "/artworks/peecho_hardcover_wrap_cover.pdf"
        return url

    def get_documents(self, obj):
        docs = []
        seen_urls = set()
        item = obj.order_item

        # 1. Primary Interior Artwork
        art_url = self.get_pdf_artwork_url(obj)
        if art_url not in seen_urls:
            docs.append({
                "id": f"{obj.id}-interior",
                "name": "Book Interior Pages (PDF)",
                "file_type": "CONTENT_INTERIOR",
                "file_url": art_url,
                "page_count": item.page_count if item else obj.page_count,
                "is_primary": obj.file_type == "CONTENT_INTERIOR",
            })
            seen_urls.add(art_url)

        # 2. Cover Wrap Artwork
        cov_url = self.get_pdf_cover_url(obj)
        if cov_url and cov_url not in seen_urls:
            docs.append({
                "id": f"{obj.id}-cover",
                "name": "Book Cover Wrap (PDF)",
                "file_type": "COVER_WRAP",
                "file_url": cov_url,
                "page_count": 1,
                "is_primary": obj.file_type == "COVER_WRAP",
            })
            seen_urls.add(cov_url)

        # 3. If parent order has other items, include their documents
        if obj.order:
            for other in obj.order.items.exclude(id=getattr(item, "id", None)):
                if other.pdf_artwork_url and other.pdf_artwork_url not in seen_urls:
                    docs.append({
                        "id": f"{other.id}-interior",
                        "name": f"{other.product_type} - Interior (PDF)",
                        "file_type": "CONTENT_INTERIOR",
                        "file_url": other.pdf_artwork_url,
                        "page_count": other.page_count,
                        "is_primary": False,
                    })
                    seen_urls.add(other.pdf_artwork_url)
                if other.pdf_cover_url and other.pdf_cover_url not in seen_urls:
                    docs.append({
                        "id": f"{other.id}-cover",
                        "name": f"{other.product_type} - Cover Wrap (PDF)",
                        "file_type": "COVER_WRAP",
                        "file_url": other.pdf_cover_url,
                        "page_count": 1,
                        "is_primary": False,
                    })
                    seen_urls.add(other.pdf_cover_url)

        return docs


class PrepressDecisionSerializer(serializers.Serializer):
    error_reason = serializers.CharField(required=False, allow_blank=True, default="")
    comments = serializers.CharField(required=False, allow_blank=True, default="")
