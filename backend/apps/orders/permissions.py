"""
Role-based order access boundaries and permissions.
"""

ROLE_ACCESSIBLE_STATUSES = {
    "SUPER_ADMIN": "ALL",
    "ADMIN": "ALL",
    "PREPRESS_SPECIALIST": [
        "RECEIVED",
        "PREPRESS_QUEUED",
        "PENDING_PREPRESS",
        "PREPRESS_PASSED",
        "PREPRESS_REJECTED",
        "EXCEPTION_HOLD",
    ],
    "SHOPFLOOR_OPERATOR": [
        "PREPRESS_PASSED",
        "BATCHED",
        "IN_PRODUCTION",
        "PRINTING",
        "QUALITY_AUDIT",
        "PRODUCTION_COMPLETED",
        "PACKED",
    ],
    "PRESS_OPERATOR": [
        "PREPRESS_PASSED",
        "BATCHED",
        "IN_PRODUCTION",
        "PRINTING",
        "QUALITY_AUDIT",
        "PRODUCTION_COMPLETED",
        "PACKED",
    ],
    "PRODUCTION_MANAGER": [
        "PREPRESS_PASSED",
        "BATCHED",
        "IN_PRODUCTION",
        "PRINTING",
        "QUALITY_AUDIT",
        "PRODUCTION_COMPLETED",
        "PACKED",
        "EXCEPTION_HOLD",
    ],
    "DISPATCH_SPECIALIST": [
        "PACKED",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "EXCEPTION_HOLD",
    ],
    "DISPATCH_FINANCE_SPECIALIST": [
        "PACKED",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "EXCEPTION_HOLD",
    ],
    "FINANCE_SPECIALIST": [
        "DISPATCHED",
        "DELIVERED",
        "EXCEPTION_HOLD",
    ],
    "INTEGRATION_SPECIALIST": [
        "RECEIVED",
        "PREPRESS_QUEUED",
        "EXCEPTION_HOLD",
    ],
}


def is_status_accessible_for_role(role_code: str, status_code: str) -> bool:
    """
    Check if a given role is authorized to view or manage an order in this status.
    """
    if not role_code:
        return True
    role = str(role_code).strip().upper()
    if role in ["SUPER_ADMIN", "ADMIN"]:
        return True
    allowed = ROLE_ACCESSIBLE_STATUSES.get(role)
    if not allowed or allowed == "ALL":
        return True
    if not status_code:
        return True
    return str(status_code).strip().upper() in allowed


def get_user_role_code(request) -> str:
    """
    Extract the effective role code from request user or X-Staff-Role header.
    """
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        role_header = request.headers.get("X-Staff-Role") or ""
        return str(role_header).strip().upper()
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return "SUPER_ADMIN"
    user_role = getattr(user, "role", None)
    role_code = getattr(user_role, "code", "") if user_role else ""
    if not role_code and isinstance(user_role, str):
        role_code = user_role
    if not role_code:
        role_code = request.headers.get("X-Staff-Role") or ""
    return str(role_code).strip().upper()
