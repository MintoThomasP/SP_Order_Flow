from django.contrib import admin
from apps.orders.models import Order, OrderItem, PeechoPayloadLog, PeechoIntegrationConfig


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("id", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "peecho_order_id", "customer_name", "status", "is_sandbox", "sla_priority", "sla_deadline", "total_items_count", "total_amount")
    list_filter = ("is_sandbox", "status", "sla_priority", "carrier_preference", "created_at")
    search_fields = ("order_number", "peecho_order_id", "customer_name", "customer_email")
    readonly_fields = ("id", "order_number", "created_at", "updated_at")
    inlines = [OrderItemInline]


@admin.register(PeechoPayloadLog)
class PeechoPayloadLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "peecho_order_id", "event_type", "status", "is_sandbox", "payload_hash", "ip_address")
    list_filter = ("is_sandbox", "status", "event_type", "created_at")
    search_fields = ("peecho_order_id", "payload_hash", "error_message")
    readonly_fields = ("id", "peecho_order_id", "event_type", "payload_hash", "raw_payload", "status", "is_sandbox", "error_message", "ip_address", "created_at")


@admin.register(PeechoIntegrationConfig)
class PeechoIntegrationConfigAdmin(admin.ModelAdmin):
    list_display = ("api_base_url", "secret_key_source", "is_sandbox", "auto_sync_status_changes", "last_connection_status", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at", "last_connection_test_at")
    actions = ["generate_keys_and_save_to_env"]

    def save_model(self, request, obj, form, change):
        if change and ("production_secret_key" in form.changed_data or "staging_secret_key" in form.changed_data):
            obj.secret_key_source = "PEECHO_ADMIN"
        super().save_model(request, obj, form, change)
        PeechoIntegrationConfig.sync_keys_to_env_files(obj.production_secret_key, obj.staging_secret_key)

    @admin.action(description="Generate Production & Staging Secret Keys (Auto-Save to .env)")
    def generate_keys_and_save_to_env(self, request, queryset):
        for config in queryset:
            res = config.generate_keys_from_our_end(sync_env=True)
            self.message_user(
                request,
                f"Generated new Production & Staging secret keys and saved to {', '.join(res['updated_env_files']) or '.env'}.",
            )

