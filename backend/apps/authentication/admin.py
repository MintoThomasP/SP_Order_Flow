from django.contrib import admin
from apps.authentication.models import User, UserAuditLog


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "role", "department", "employee_id", "is_active", "is_staff")
    list_filter = ("role", "department", "is_active", "is_staff")
    search_fields = ("email", "first_name", "last_name", "employee_id")
    readonly_fields = ("id", "created_at", "updated_at", "last_login", "last_activity_at")


@admin.register(UserAuditLog)
class UserAuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "resource_type", "resource_id", "user_email_snapshot", "ip_address")
    list_filter = ("action", "resource_type", "created_at")
    search_fields = ("action", "resource_type", "resource_id", "user_email_snapshot", "ip_address")
    readonly_fields = ("id", "user", "user_email_snapshot", "action", "resource_type", "resource_id", "details", "ip_address", "user_agent", "created_at")
