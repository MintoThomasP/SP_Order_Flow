from django.contrib import admin
from apps.core.models.lookups import SystemRole, EntityStatus


@admin.register(SystemRole)
class SystemRoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_system_default", "is_active", "created_at")
    list_filter = ("is_system_default", "is_active")
    search_fields = ("code", "name", "description")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(EntityStatus)
class EntityStatusAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "code", "name", "badge_color", "sort_order", "is_terminal", "is_failure_state", "is_active")
    list_filter = ("entity_type", "is_terminal", "is_failure_state", "is_active")
    search_fields = ("code", "name", "entity_type", "description")
    ordering = ("entity_type", "sort_order")
    readonly_fields = ("id", "created_at", "updated_at")
