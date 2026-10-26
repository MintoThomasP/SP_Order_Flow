from django.contrib import admin
from apps.prepress.models import ArtworkVerification


@admin.register(ArtworkVerification)
class ArtworkVerificationAdmin(admin.ModelAdmin):
    list_display = (
        "order",
        "file_type",
        "page_count",
        "calculated_spine_width_mm",
        "resolution_dpi",
        "verification_status",
        "verified_by",
        "verified_at",
    )
    list_filter = ("verification_status", "resolution_check_passed", "bleed_check_passed", "created_at")
    search_fields = ("order__order_number", "order__peecho_order_id", "s3_key", "error_reason")
    readonly_fields = ("id", "created_at", "updated_at", "verified_at")
