from django.contrib import admin
from apps.shopfloor.models import ShopfloorStation, ScanEventLog


@admin.register(ShopfloorStation)
class ShopfloorStationAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "hardware_device_name", "target_status_code", "sort_order", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("code", "name", "hardware_device_name")


@admin.register(ScanEventLog)
class ScanEventLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "station", "barcode_scanned", "entity_reference", "previous_status", "new_status", "operator_name_snapshot")
    list_filter = ("station", "entity_type", "created_at")
    search_fields = ("barcode_scanned", "entity_reference", "operator_name_snapshot", "notes")
    readonly_fields = ("id", "created_at", "updated_at")
