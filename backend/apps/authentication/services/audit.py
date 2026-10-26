"""
Audit logging service helper for tracking staff operations across all modules.
"""
from apps.authentication.models import UserAuditLog


def log_staff_action(
    user,
    action: str,
    resource_type: str,
    resource_id: str = "",
    details: dict = None,
    request=None,
) -> UserAuditLog:
    """
    Records an immutable staff activity log entry.
    """
    ip_address = None
    user_agent = ""

    if request:
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()
        else:
            ip_address = request.META.get("REMOTE_ADDR")

        user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]

    log_entry = UserAuditLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        user_email_snapshot=user.email if (user and getattr(user, "is_authenticated", False)) else "Anonymous/System",
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return log_entry
