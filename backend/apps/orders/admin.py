from django.contrib import admin
from apps.orders.models import Order, OrderItem, PeechoPayloadLog


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("id", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "peecho_order_id", "customer_name", "status", "sla_priority", "sla_deadline", "total_items_count", "total_amount")
    list_filter = ("status", "sla_priority", "carrier_preference", "created_at")
    search_fields = ("order_number", "peecho_order_id", "customer_name", "customer_email")
    readonly_fields = ("id", "order_number", "created_at", "updated_at")
    inlines = [OrderItemInline]


@admin.register(PeechoPayloadLog)
class PeechoPayloadLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "peecho_order_id", "event_type", "status", "payload_hash", "ip_address")
    list_filter = ("status", "event_type", "created_at")
    search_fields = ("peecho_order_id", "payload_hash", "error_message")
    readonly_fields = ("id", "peecho_order_id", "event_type", "payload_hash", "raw_payload", "status", "error_message", "ip_address", "created_at")
