"""
Printify Status State Machine and Lifecycle Mapping Service.
Maps external Printify order/shipment lifecycle states to internal OrderFlow statuses.
"""
import logging
from typing import Optional, Tuple
from apps.core.models.lookups import EntityStatus

logger = logging.getLogger(__name__)

# Canonical lifecycle mapping from Printify to OrderFlow status codes
PRINTIFY_STATUS_MAP = {
    # Initial / Ingestion / Queued states -> PENDING
    "draft": "PENDING",
    "pending": "PENDING",
    "action-required": "PENDING",
    "on-hold": "PENDING",
    "payment-not-received": "PENDING",

    # Production execution states -> UNDER_PRODUCTION
    "in-production": "UNDER_PRODUCTION",
    "sent-to-production": "UNDER_PRODUCTION",
    "submitting": "UNDER_PRODUCTION",
    "has-issues": "UNDER_PRODUCTION",

    # Dispatch & Fulfillment states -> DISPATCHED
    "fulfilled": "DISPATCHED",
    "shipped": "DISPATCHED",
    "partially-fulfilled": "DISPATCHED",

    # Terminal cancellation states -> CANCELLED
    "canceled": "CANCELLED",
    "cancelled": "CANCELLED",
}

# Fallback aliases if custom status codes are not explicitly created in EntityStatus table
STATUS_DB_FALLBACKS = {
    "PENDING": ["PENDING", "RECEIVED", "PREPRESS_QUEUED"],
    "UNDER_PRODUCTION": ["UNDER_PRODUCTION", "IN_PRODUCTION", "PRINTING"],
    "DISPATCHED": ["DISPATCHED", "READY_FOR_DISPATCH", "IN_TRANSIT"],
    "OUT_FOR_DELIVERY": ["OUT_FOR_DELIVERY", "DISPATCHED", "IN_TRANSIT"],
    "CANCELLED": ["CANCELLED"],
}


def map_printify_to_canonical_status(printify_status: str) -> str:
    """
    Normalizes a Printify lifecycle status string to its canonical OrderFlow code:
    - 'pending' / 'draft' -> PENDING
    - 'in-production' / 'sent-to-production' -> UNDER_PRODUCTION
    - 'fulfilled' / 'shipped' -> DISPATCHED
    - 'canceled' -> CANCELLED
    """
    if not printify_status:
        return "PENDING"
    normalized = str(printify_status).strip().lower().replace("_", "-")
    return PRINTIFY_STATUS_MAP.get(normalized, "PENDING")


def resolve_orderflow_entity_status(canonical_code: str) -> Optional[EntityStatus]:
    """
    Resolves the matching EntityStatus model instance from the database for the given canonical code.
    Gracefully tries fallback aliases if an exact code match does not exist.
    """
    candidate_codes = STATUS_DB_FALLBACKS.get(canonical_code, [canonical_code])
    for code in candidate_codes:
        status_obj = EntityStatus.objects.filter(entity_type="ORDER", code=code).first()
        if status_obj:
            return status_obj
    
    # As a final fallback, query any active order status
    return EntityStatus.objects.filter(entity_type="ORDER").first()


def map_and_resolve_status(printify_status: str) -> Tuple[str, Optional[EntityStatus]]:
    """
    Convenience helper that returns both the canonical code and the resolved EntityStatus instance.
    Example:
        code, status_obj = map_and_resolve_status('sent-to-production')
        # code -> 'UNDER_PRODUCTION'
        # status_obj -> <EntityStatus: In Production (IN_PRODUCTION)>
    """
    code = map_printify_to_canonical_status(printify_status)
    status_obj = resolve_orderflow_entity_status(code)
    logger.debug(f"[Printify State Machine] Mapped '{printify_status}' -> '{code}' (DB: {status_obj})")
    return code, status_obj
