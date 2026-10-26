from django.contrib import admin
from apps.production.models import ProductionBatch


@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = (
        "batch_number",
        "target_press",
        "paper_stock",
        "size_format",
        "binding_type",
        "total_orders_count",
        "total_sheets_count",
        "status",
        "priority",
        "created_at",
    )
    list_filter = ("target_press", "binding_type", "status", "priority", "created_at")
    search_fields = ("batch_number", "paper_stock", "size_format", "notes")
    readonly_fields = ("id", "created_at", "updated_at")
