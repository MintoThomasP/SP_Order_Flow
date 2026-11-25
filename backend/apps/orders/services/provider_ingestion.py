"""
Common Service Provider Push API Ingestion & Status Synchronization Service.
Handles dual provider authentication (API token + optional HMAC-SHA256 + payload provider_code match),
idempotency, order/item creation, Prepress ArtworkVerification seeding, and status/tracking updates.
"""
import hashlib
import hmac
import json
import logging
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.authentication.services.audit import log_staff_action
from apps.core.models.lookups import EntityStatus
from apps.orders.models import Order, OrderItem, ProviderIngestionLog, ServiceProvider

logger = logging.getLogger(__name__)


class IdempotencyConflictError(Exception):
    """Raised when an Idempotency-Key is reused with a different payload."""


class ProviderOrderNotFoundError(Exception):
    """Raised when an external_order_id does not exist for the authenticated provider."""


class UnsupportedStatusError(Exception):
    """Raised when a pushed status code cannot be mapped to a valid EntityStatus."""


PROVIDER_STATUS_ALIASES = {
    "RECEIVED": "RECEIVED",
    "PENDING": "RECEIVED",
    "PREPRESS_QUEUED": "PREPRESS_QUEUED",
    "PREPRESS_PASSED": "PREPRESS_PASSED",
    "ARTWORK_APPROVED": "PREPRESS_PASSED",
    "BATCHED": "BATCHED",
    "IN_PRODUCTION": "IN_PRODUCTION",
    "PRODUCTION": "IN_PRODUCTION",
    "PRINTING": "PRINTING",
    "QUALITY_AUDIT": "QUALITY_AUDIT",
    "PRODUCTION_COMPLETED": "PRODUCTION_COMPLETED",
    "PACKED": "PACKED",
    "READY_FOR_DISPATCH": "READY_FOR_DISPATCH",
    "DISPATCHED": "DISPATCHED",
    "SHIPPED": "DISPATCHED",
    "FULFILLED": "DISPATCHED",
    "IN_TRANSIT": "IN_TRANSIT",
    "OUT_FOR_DELIVERY": "OUT_FOR_DELIVERY",
    "DELIVERED": "DELIVERED",
    "EXCEPTION_HOLD": "EXCEPTION_HOLD",
    "ON_HOLD": "EXCEPTION_HOLD",
    "HOLD": "EXCEPTION_HOLD",
    "REPRINT_QUEUED": "REPRINT_QUEUED",
    "CANCELLED": "CANCELLED",
    "CANCELED": "CANCELLED",
}


def extract_client_ip(request) -> Optional[str]:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def compute_payload_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _extract_api_token(request) -> str:
    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return (request.headers.get("X-API-Key") or "").strip()


def _verify_hmac_signature(raw_body: bytes, signature_header: str, secret: str) -> tuple[bool, str]:
    if not secret:
        return False, "Provider HMAC secret is not configured."
    if not signature_header:
        return False, "Missing X-Provider-Signature header."
    provided = signature_header.strip()
    if provided.lower().startswith("sha256="):
        provided = provided.split("=", 1)[1].strip()
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if hmac.compare_digest(expected, provided):
        return True, "HMAC signature verified."
    return False, "Invalid X-Provider-Signature HMAC-SHA256 digest."


def authenticate_provider_request(
    request,
    raw_body: bytes,
    payload: dict,
) -> tuple[Optional[ServiceProvider], Optional[str], Optional[dict]]:
    """
    Authenticates an incoming provider push request and resolves both the ServiceProvider
    and the key environment ('sandbox' for sp_test_... or 'production' for sp_live_...):
    1. Resolves ServiceProvider via Bearer token or X-API-Key (constant-time hash check).
    2. Checks provider.is_active and optional IP allowlist.
    3. Verifies HMAC-SHA256 signature if provider.require_hmac is enabled.
    4. Confirms payload['provider_code'] (and optional X-Provider-Code header) matches the authenticated provider.

    Returns: (provider, token_environment, error_dict_or_none)
    """
    token = _extract_api_token(request)
    if not token:
        return None, None, {
            "http_status": 401,
            "log_status": "INVALID_AUTH",
            "error_code": "MISSING_CREDENTIALS",
            "message": "Authentication required. Provide Authorization: Bearer <token> or X-API-Key.",
        }

    prefix = token[:12]
    candidates = ServiceProvider.objects.filter(
        Q(test_api_key_prefix=prefix)
        | Q(live_api_key_prefix=prefix)
        | Q(api_token_prefix=prefix)
    )
    matched_provider = None
    token_env = None
    for candidate in candidates:
        resolved_env = candidate.resolve_token_environment(token)
        if resolved_env is not None:
            matched_provider = candidate
            token_env = resolved_env
            break

    if not matched_provider:
        return None, None, {
            "http_status": 401,
            "log_status": "INVALID_AUTH",
            "error_code": "INVALID_CREDENTIALS",
            "message": "Invalid provider API token.",
        }

    if not matched_provider.is_active:
        return matched_provider, token_env, {
            "http_status": 403,
            "log_status": "INVALID_AUTH",
            "error_code": "PROVIDER_INACTIVE",
            "message": f"Service provider '{matched_provider.provider_code}' is inactive.",
        }

    if matched_provider.allowed_ips:
        client_ip = extract_client_ip(request)
        if client_ip not in matched_provider.allowed_ips:
            return matched_provider, token_env, {
                "http_status": 403,
                "log_status": "INVALID_AUTH",
                "error_code": "IP_NOT_ALLOWED",
                "message": f"Client IP '{client_ip}' is not allowlisted for provider '{matched_provider.provider_code}'.",
            }

    if matched_provider.require_hmac:
        sig_header = request.headers.get("X-Provider-Signature") or ""
        hmac_ok, hmac_reason = _verify_hmac_signature(raw_body, sig_header, matched_provider.webhook_secret)
        if not hmac_ok:
            return matched_provider, token_env, {
                "http_status": 401,
                "log_status": "INVALID_AUTH",
                "error_code": "INVALID_SIGNATURE",
                "message": hmac_reason,
            }

    payload_code = str(payload.get("provider_code") or "").strip().upper()
    header_code = str(request.headers.get("X-Provider-Code") or "").strip().upper()

    if not payload_code:
        return matched_provider, token_env, {
            "http_status": 422,
            "log_status": "VALIDATION_ERROR",
            "error_code": "MISSING_PROVIDER_CODE",
            "message": "Field 'provider_code' is required in the JSON payload.",
        }

    if payload_code != matched_provider.provider_code:
        return matched_provider, token_env, {
            "http_status": 403,
            "log_status": "PROVIDER_MISMATCH",
            "error_code": "PROVIDER_MISMATCH",
            "message": (
                f"Payload provider_code '{payload_code}' does not match "
                f"authenticated provider '{matched_provider.provider_code}'."
            ),
        }

    if header_code and header_code != matched_provider.provider_code:
        return matched_provider, token_env, {
            "http_status": 403,
            "log_status": "PROVIDER_MISMATCH",
            "error_code": "PROVIDER_MISMATCH",
            "message": (
                f"Header X-Provider-Code '{header_code}' does not match "
                f"authenticated provider '{matched_provider.provider_code}'."
            ),
        }

    return matched_provider, token_env, None


def _generate_order_number() -> str:
    year = timezone.now().year
    seq = Order.objects.count() + 1001
    candidate = f"SP-{year}-{seq}"
    while Order.objects.filter(order_number=candidate).exists():
        seq += 1
        candidate = f"SP-{year}-{seq}"
    return candidate


def _resolve_initial_status(is_sandbox: bool) -> EntityStatus:
    if is_sandbox:
        status_obj, _ = EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="TEST_ORDER",
            defaults={
                "name": "Test Order (Sandbox)",
                "badge_color": "amber",
                "badge_bg": "#FEF3C7",
                "badge_text": "#B45309",
                "sort_order": 5,
                "allowed_transitions": ["RECEIVED", "PREPRESS_QUEUED", "CANCELLED"],
            },
        )
        return status_obj

    status_obj = EntityStatus.objects.filter(entity_type="ORDER", code="RECEIVED").first()
    if not status_obj:
        status_obj, _ = EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="RECEIVED",
            defaults={
                "name": "Order Received",
                "badge_color": "blue",
                "badge_bg": "#EFF6FF",
                "badge_text": "#1D4ED8",
                "sort_order": 10,
            },
        )
    return status_obj


def ingest_provider_order(
    provider: ServiceProvider,
    validated_data: dict,
    raw_payload: dict,
    idempotency_key: str = "",
    client_ip: Optional[str] = None,
    is_sandbox_header: bool = False,
    token_env: Optional[str] = None,
) -> tuple[Order, ProviderIngestionLog, bool]:
    """
    Idempotently ingests a validated order payload from an authenticated ServiceProvider.
    Automatically sets is_sandbox=True (TEST_ORDER) when authenticated with a sp_test_... key,
    and is_sandbox=False (RECEIVED) when authenticated with a sp_live_... key.
    Creates Order, OrderItem(s), and Prepress ArtworkVerification records.
    Returns: (order, ingestion_log, is_duplicate)
    """
    external_order_id = validated_data["external_order_id"].strip()
    payload_hash = compute_payload_hash(raw_payload)

    env_val = str(validated_data.get("environment") or "").strip().lower()
    if token_env == "sandbox":
        is_sandbox = True
    else:
        is_sandbox = bool(
            provider.is_sandbox_default
            or is_sandbox_header
            or validated_data.get("is_sandbox") is True
            or env_val in ("staging", "sandbox", "test")
        )

    # 1. Idempotency-Key check
    if idempotency_key:
        prior_log = ProviderIngestionLog.objects.filter(
            provider=provider,
            idempotency_key=idempotency_key,
            event_type="order.created",
            status="PROCESSED",
        ).first()
        if prior_log:
            if prior_log.payload_hash != payload_hash:
                raise IdempotencyConflictError(
                    f"Idempotency-Key '{idempotency_key}' was already used with a different payload."
                )
            existing_order = Order.objects.filter(
                service_provider=provider,
                external_pod_order_id=external_order_id,
            ).first()
            dup_log = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=external_order_id,
                idempotency_key=idempotency_key,
                event_type="order.created",
                payload_hash=payload_hash,
                raw_payload=raw_payload,
                status="DUPLICATE",
                http_status=200,
                error_message="Duplicate request matched Idempotency-Key and payload hash.",
                ip_address=client_ip,
                is_sandbox=is_sandbox,
            )
            return existing_order, dup_log, True

    # 2. Natural-key duplicate check: (service_provider, external_pod_order_id)
    existing_order = Order.objects.filter(
        service_provider=provider,
        external_pod_order_id=external_order_id,
    ).first()
    if existing_order:
        dup_log = ProviderIngestionLog.objects.create(
            provider=provider,
            provider_code=provider.provider_code,
            external_order_id=external_order_id,
            idempotency_key=idempotency_key,
            event_type="order.created",
            payload_hash=payload_hash,
            raw_payload=raw_payload,
            status="DUPLICATE",
            http_status=200,
            error_message=(
                f"Order '{external_order_id}' already exists for provider '{provider.provider_code}' "
                f"(Internal Order: {existing_order.order_number})."
            ),
            ip_address=client_ip,
            is_sandbox=is_sandbox,
        )
        return existing_order, dup_log, True

    # 3. Create Order + OrderItems + ArtworkVerification atomically
    with transaction.atomic():
        initial_status = _resolve_initial_status(is_sandbox=is_sandbox)

        sla_priority = validated_data.get("priority") or "STANDARD_72H"
        if validated_data.get("sla_deadline"):
            sla_deadline = validated_data["sla_deadline"]
        else:
            hours_map = {"RUSH_8H": 8, "EXPRESS_24H": 24, "STANDARD_72H": 72}
            sla_deadline = timezone.now() + timedelta(hours=hours_map.get(sla_priority, 72))

        customer = validated_data["customer"]
        shipping = validated_data["shipping_address"]
        recipient_name = shipping.get("recipient_name") or customer["name"]
        shipping_payload = dict(shipping)
        shipping_payload["recipient_name"] = recipient_name

        currency = (validated_data.get("currency") or provider.default_currency or "USD").upper()
        carrier_pref = validated_data.get("carrier_preference") or provider.default_carrier or "DHL Express"
        total_amount = Decimal(str(validated_data.get("total_amount", "0.00")))

        order_metadata = {
            "provider_code": provider.provider_code,
            "provider_name": provider.name,
            "external_order_id": external_order_id,
            "key_environment": token_env or ("sandbox" if is_sandbox else "production"),
            "is_sandbox": is_sandbox,
            "environment": "STAGING_SANDBOX" if is_sandbox else "PRODUCTION",
            "event_name": validated_data.get("event_name", ""),
            "event_date": validated_data.get("event_date", ""),
            "notes": validated_data.get("notes", ""),
            "provider_metadata": validated_data.get("metadata", {}),
        }

        order = Order.objects.create(
            order_number=_generate_order_number(),
            service_provider=provider,
            order_source="provider_api",
            is_external_pod=provider.is_external_pod_default,
            is_sandbox=is_sandbox,
            external_pod_order_id=external_order_id,
            peecho_order_id=None,
            customer_name=customer["name"],
            customer_email=customer.get("email", ""),
            customer_phone=customer.get("phone", "") or shipping.get("phone", ""),
            shipping_address=shipping_payload,
            carrier_preference=carrier_pref,
            status=initial_status,
            sla_deadline=sla_deadline,
            sla_priority=sla_priority,
            total_amount=total_amount,
            currency=currency,
            peecho_metadata=order_metadata,
        )

        total_items_count = 0
        for idx, item in enumerate(validated_data["items"]):
            qty = int(item["quantity"])
            total_items_count += qty
            page_cnt = int(item.get("page_count") or 1)
            spine_w = Decimal(str(item.get("spine_width_mm") or "0.00"))
            art_url = item["_resolved_artwork_url"]
            cover_url = (item.get("pdf_cover_url") or item.get("proof_url") or "").strip()

            paper_stock = (item.get("paper_stock") or "").strip()
            if not paper_stock:
                parts = [p for p in (item.get("material"), item.get("finish"), item.get("dimensions")) if p]
                paper_stock = " | ".join(parts) if parts else "Standard Print Stock"

            item_meta = {
                "category": item.get("category", ""),
                "dimensions": item.get("dimensions", ""),
                "material": item.get("material", ""),
                "finish": item.get("finish", ""),
                "proof_url": item.get("proof_url", ""),
                "proof_status": item.get("proof_status", "PENDING"),
                "custom_specs": item.get("custom_specs", {}),
            }

            order_item = OrderItem.objects.create(
                order=order,
                external_item_id=item.get("external_item_id") or f"{external_order_id}-ITEM-{idx + 1}",
                product_type=item["product_type"],
                quantity=qty,
                page_count=page_cnt,
                spine_width_mm=spine_w,
                paper_stock=paper_stock[:128],
                pdf_artwork_url=art_url,
                pdf_cover_url=cover_url,
                preflight_passed=(item.get("proof_status") == "APPROVED"),
                metadata=item_meta,
            )

            try:
                from apps.prepress.models import ArtworkVerification
                ArtworkVerification.objects.create(
                    order=order,
                    order_item=order_item,
                    file_type="CONTENT_INTERIOR",
                    file_url=art_url,
                    s3_bucket="silverpoint-pod-artwork-vault",
                    s3_key=f"providers/{provider.provider_code}/{external_order_id}/item_{idx + 1}.pdf",
                    page_count=page_cnt,
                    calculated_spine_width_mm=spine_w,
                    resolution_dpi=300,
                    resolution_check_passed=True,
                    bleed_check_passed=True,
                    verification_status="PENDING_REVIEW",
                )
            except Exception as exc:
                logger.warning(f"[Provider Push] ArtworkVerification creation skipped: {exc}")

        order.total_items_count = total_items_count
        order.save(update_fields=["total_items_count"])

        log_entry = ProviderIngestionLog.objects.create(
            provider=provider,
            provider_code=provider.provider_code,
            external_order_id=external_order_id,
            idempotency_key=idempotency_key,
            event_type="order.created",
            payload_hash=payload_hash,
            raw_payload=raw_payload,
            status="PROCESSED",
            http_status=201,
            ip_address=client_ip,
            is_sandbox=is_sandbox,
        )

        log_staff_action(
            user=None,
            action="PROVIDER_ORDER_INGESTED",
            resource_type="ORDER",
            resource_id=order.order_number,
            details={
                "provider_code": provider.provider_code,
                "external_order_id": external_order_id,
                "items_count": order.total_items_count,
                "sla_priority": order.sla_priority,
                "is_sandbox": is_sandbox,
            },
        )

        return order, log_entry, False


def update_provider_order_status(
    provider: ServiceProvider,
    validated_data: dict,
    raw_payload: dict,
    external_order_id: str,
    idempotency_key: str = "",
    client_ip: Optional[str] = None,
) -> tuple[Order, ProviderIngestionLog, bool]:
    """
    Applies a provider-pushed status and/or tracking update to an existing Order
    owned by the authenticated ServiceProvider.
    """
    payload_hash = compute_payload_hash(raw_payload)
    order = Order.objects.filter(
        service_provider=provider,
        external_pod_order_id=external_order_id,
    ).select_related("status").first()

    if not order:
        raise ProviderOrderNotFoundError(
            f"No order found with external_order_id '{external_order_id}' for provider '{provider.provider_code}'."
        )

    if idempotency_key:
        prior_log = ProviderIngestionLog.objects.filter(
            provider=provider,
            idempotency_key=idempotency_key,
            event_type="order.status_updated",
            status="PROCESSED",
        ).first()
        if prior_log:
            if prior_log.payload_hash != payload_hash:
                raise IdempotencyConflictError(
                    f"Idempotency-Key '{idempotency_key}' was already used with a different payload."
                )
            dup_log = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=external_order_id,
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                payload_hash=payload_hash,
                raw_payload=raw_payload,
                status="DUPLICATE",
                http_status=200,
                error_message="Duplicate status update matched Idempotency-Key and payload hash.",
                ip_address=client_ip,
                is_sandbox=order.is_sandbox,
            )
            return order, dup_log, True

    raw_status = str(validated_data["status"]).strip().upper().replace("-", "_").replace(" ", "_")
    canonical_code = PROVIDER_STATUS_ALIASES.get(raw_status)
    if not canonical_code:
        raise UnsupportedStatusError(f"Unsupported status '{validated_data['status']}'.")

    target_status = EntityStatus.objects.filter(entity_type="ORDER", code=canonical_code).first()
    if not target_status:
        target_status, _ = EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code=canonical_code,
            defaults={
                "name": canonical_code.replace("_", " ").title(),
                "badge_color": "blue",
                "badge_bg": "#EFF6FF",
                "badge_text": "#1D4ED8",
                "sort_order": 50,
            },
        )

    tracking_info = validated_data.get("tracking") or {}
    tracking_number = (
        tracking_info.get("tracking_number")
        or validated_data.get("tracking_number")
        or ""
    ).strip()
    carrier_name = (
        tracking_info.get("carrier")
        or validated_data.get("carrier")
        or ""
    ).strip()
    tracking_url = (tracking_info.get("tracking_url") or "").strip()
    carrier_code = tracking_info.get("carrier_code") or "CUSTOM"

    with transaction.atomic():
        order.status = target_status
        if tracking_number:
            order.tracking_number = tracking_number
        if carrier_name:
            order.carrier_preference = carrier_name

        meta = dict(order.peecho_metadata or {})
        meta["last_provider_status_push"] = {
            "provider_code": provider.provider_code,
            "status": canonical_code,
            "notes": validated_data.get("notes", ""),
            "updated_at": timezone.now().isoformat(),
            "metadata": validated_data.get("metadata", {}),
        }
        order.peecho_metadata = meta
        order.save()

        if tracking_number:
            try:
                from apps.dispatch.models import Shipment
                shipment, created = Shipment.objects.get_or_create(
                    order=order,
                    defaults={
                        "carrier_name": carrier_name or order.carrier_preference,
                        "carrier_code": carrier_code,
                        "tracking_number": tracking_number,
                        "tracking_url": tracking_url or None,
                        "status": target_status,
                        "status_code": "DISPATCHED" if canonical_code == "DISPATCHED" else "LABEL_CREATED",
                    },
                )
                if not created:
                    shipment.tracking_number = tracking_number
                    if carrier_name:
                        shipment.carrier_name = carrier_name
                    if tracking_url:
                        shipment.tracking_url = tracking_url
                    shipment.status = target_status
                    shipment.save()
            except Exception as exc:
                logger.warning(f"[Provider Status Push] Shipment sync skipped: {exc}")

        log_entry = ProviderIngestionLog.objects.create(
            provider=provider,
            provider_code=provider.provider_code,
            external_order_id=external_order_id,
            idempotency_key=idempotency_key,
            event_type="order.status_updated",
            payload_hash=payload_hash,
            raw_payload=raw_payload,
            status="PROCESSED",
            http_status=200,
            ip_address=client_ip,
            is_sandbox=order.is_sandbox,
        )

        log_staff_action(
            user=None,
            action="PROVIDER_STATUS_UPDATED",
            resource_type="ORDER",
            resource_id=order.order_number,
            details={
                "provider_code": provider.provider_code,
                "external_order_id": external_order_id,
                "status_code": canonical_code,
                "tracking_number": tracking_number,
            },
        )

    return order, log_entry, False

