from django.contrib import admin
from apps.production.models import ProductionBatch, PrintMachine, BindingMethod


@admin.register(PrintMachine)
class PrintMachineAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "sheet_format", "max_speed_cph", "is_active", "created_at")
    list_filter = ("is_active", "sheet_format")
    search_fields = ("name", "code", "description", "sheet_format")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(BindingMethod)
class BindingMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "min_pages", "max_pages", "default_caliper_mm", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "description")
    readonly_fields = ("id", "created_at", "updated_at")


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
