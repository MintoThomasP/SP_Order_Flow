"""
Views for the Common Service Provider Push API.
Provides standardized inbound endpoints for external service providers to push
orders and status/tracking updates into Silver Point POD.
"""
import json
import logging

from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.services.audit import log_staff_action
from apps.orders.models import ProviderIngestionLog, ServiceProvider
from apps.orders.serializers import OrderSerializer
from apps.orders.serializers_provider import (
    ProviderIngestionLogSerializer,
    ProviderOrderPushSerializer,
    ProviderStatusPushSerializer,
    ServiceProviderChannelSerializer,
    ServiceProviderCreateSerializer,
    ServiceProviderRotateKeySerializer,
)
from apps.orders.services.provider_ingestion import (
    IdempotencyConflictError,
    ProviderOrderNotFoundError,
    UnsupportedStatusError,
    authenticate_provider_request,
    compute_payload_hash,
    extract_client_ip,
    ingest_provider_order,
    update_provider_order_status,
)

logger = logging.getLogger(__name__)


def _parse_json_body(request) -> tuple[bytes, dict | None, str | None]:
    raw_body = request.body or b""
    if not raw_body:
        return raw_body, None, "Empty request body. Expected JSON object."
    try:
        parsed = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return raw_body, None, f"Malformed JSON body: {exc}"
    if not isinstance(parsed, dict):
        return raw_body, None, "Invalid JSON body. Expected a JSON object."
    return raw_body, parsed, None


@method_decorator(csrf_exempt, name="dispatch")
class ProviderOrderPushView(APIView):
    """
    POST /api/v1/providers/orders/
    Common inbound endpoint for any registered ServiceProvider to push a new POD order.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        client_ip = extract_client_ip(request)
        idempotency_key = (request.headers.get("Idempotency-Key") or "").strip()
        is_sandbox_header = (request.headers.get("X-Sandbox-Mode") or "").strip().lower() in ("true", "1", "yes")

        raw_body, payload, parse_err = _parse_json_body(request)
        if parse_err:
            log_entry = ProviderIngestionLog.objects.create(
                event_type="order.created",
                idempotency_key=idempotency_key,
                raw_payload={"raw_preview": raw_body[:500].decode("latin-1", errors="replace")},
                status="VALIDATION_ERROR",
                http_status=status.HTTP_400_BAD_REQUEST,
                error_message=parse_err,
                ip_address=client_ip,
            )
            return Response(
                {
                    "error": "BAD_REQUEST",
                    "message": parse_err,
                    "log_id": str(log_entry.id),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider, token_env, auth_err = authenticate_provider_request(request, raw_body, payload)
        effective_sandbox = bool(token_env == "sandbox" or is_sandbox_header)
        if auth_err:
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=str(payload.get("provider_code") or (provider.provider_code if provider else "")).upper()[:64],
                external_order_id=str(payload.get("external_order_id") or "")[:128],
                idempotency_key=idempotency_key,
                event_type="order.created",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status=auth_err["log_status"],
                http_status=auth_err["http_status"],
                error_message=auth_err["message"],
                ip_address=client_ip,
                is_sandbox=effective_sandbox,
            )
            return Response(
                {
                    "error": auth_err["error_code"],
                    "message": auth_err["message"],
                    "log_id": str(log_entry.id),
                },
                status=auth_err["http_status"],
            )

        serializer = ProviderOrderPushSerializer(data=payload)
        if not serializer.is_valid():
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=str(payload.get("external_order_id") or "")[:128],
                idempotency_key=idempotency_key,
                event_type="order.created",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="VALIDATION_ERROR",
                http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error_message=json.dumps(serializer.errors),
                ip_address=client_ip,
                is_sandbox=effective_sandbox,
            )
            return Response(
                {
                    "error": "VALIDATION_ERROR",
                    "message": "Payload validation failed.",
                    "details": serializer.errors,
                    "log_id": str(log_entry.id),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            order, log_entry, is_duplicate = ingest_provider_order(
                provider=provider,
                validated_data=serializer.validated_data,
                raw_payload=payload,
                idempotency_key=idempotency_key,
                client_ip=client_ip,
                is_sandbox_header=is_sandbox_header,
                token_env=token_env,
            )
        except IdempotencyConflictError as exc:
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=serializer.validated_data["external_order_id"],
                idempotency_key=idempotency_key,
                event_type="order.created",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="CONFLICT",
                http_status=status.HTTP_409_CONFLICT,
                error_message=str(exc),
                ip_address=client_ip,
                is_sandbox=is_sandbox_header,
            )
            return Response(
                {
                    "error": "IDEMPOTENCY_CONFLICT",
                    "message": str(exc),
                    "log_id": str(log_entry.id),
                },
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as exc:
            logger.exception(f"[Provider Push] Unexpected error ingesting order: {exc}")
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=serializer.validated_data["external_order_id"],
                idempotency_key=idempotency_key,
                event_type="order.created",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="FAILED",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_message=str(exc),
                ip_address=client_ip,
                is_sandbox=is_sandbox_header,
            )
            return Response(
                {
                    "error": "INTERNAL_ERROR",
                    "message": "Failed to ingest provider order.",
                    "log_id": str(log_entry.id),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if is_duplicate:
            return Response(
                {
                    "status": "DUPLICATE",
                    "message": "Order already ingested; returning existing record.",
                    "provider_code": provider.provider_code,
                    "external_order_id": order.external_pod_order_id,
                    "order_number": order.order_number,
                    "order_id": str(order.id),
                    "is_sandbox": order.is_sandbox,
                    "log_id": str(log_entry.id),
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "status": "PROCESSED",
                "message": "Provider order successfully ingested.",
                "provider_code": provider.provider_code,
                "external_order_id": order.external_pod_order_id,
                "order_number": order.order_number,
                "is_sandbox": order.is_sandbox,
                "log_id": str(log_entry.id),
                "order": OrderSerializer(order).data,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name="dispatch")
class ProviderOrderStatusPushView(APIView):
    """
    POST /api/v1/providers/orders/status/
    POST /api/v1/providers/orders/<external_order_id>/status/
    Common inbound endpoint for a registered ServiceProvider to push status or tracking updates.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, external_order_id: str = ""):
        client_ip = extract_client_ip(request)
        idempotency_key = (request.headers.get("Idempotency-Key") or "").strip()

        raw_body, payload, parse_err = _parse_json_body(request)
        if parse_err:
            log_entry = ProviderIngestionLog.objects.create(
                external_order_id=external_order_id[:128],
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                raw_payload={"raw_preview": raw_body[:500].decode("latin-1", errors="replace")},
                status="VALIDATION_ERROR",
                http_status=status.HTTP_400_BAD_REQUEST,
                error_message=parse_err,
                ip_address=client_ip,
            )
            return Response(
                {"error": "BAD_REQUEST", "message": parse_err, "log_id": str(log_entry.id)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider, _token_env, auth_err = authenticate_provider_request(request, raw_body, payload)
        resolved_ext_id = (external_order_id or str(payload.get("external_order_id") or "")).strip()

        if auth_err:
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=str(payload.get("provider_code") or (provider.provider_code if provider else "")).upper()[:64],
                external_order_id=resolved_ext_id[:128],
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status=auth_err["log_status"],
                http_status=auth_err["http_status"],
                error_message=auth_err["message"],
                ip_address=client_ip,
            )
            return Response(
                {
                    "error": auth_err["error_code"],
                    "message": auth_err["message"],
                    "log_id": str(log_entry.id),
                },
                status=auth_err["http_status"],
            )

        serializer = ProviderStatusPushSerializer(data=payload)
        if not serializer.is_valid() or not resolved_ext_id:
            errors = dict(serializer.errors) if not serializer.is_valid() else {}
            if not resolved_ext_id:
                errors["external_order_id"] = ["Provide external_order_id in URL path or JSON body."]
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=resolved_ext_id[:128],
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="VALIDATION_ERROR",
                http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error_message=json.dumps(errors),
                ip_address=client_ip,
            )
            return Response(
                {
                    "error": "VALIDATION_ERROR",
                    "message": "Status payload validation failed.",
                    "details": errors,
                    "log_id": str(log_entry.id),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            order, log_entry, is_duplicate = update_provider_order_status(
                provider=provider,
                validated_data=serializer.validated_data,
                raw_payload=payload,
                external_order_id=resolved_ext_id,
                idempotency_key=idempotency_key,
                client_ip=client_ip,
            )
        except ProviderOrderNotFoundError as exc:
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=resolved_ext_id[:128],
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="VALIDATION_ERROR",
                http_status=status.HTTP_404_NOT_FOUND,
                error_message=str(exc),
                ip_address=client_ip,
            )
            return Response(
                {"error": "ORDER_NOT_FOUND", "message": str(exc), "log_id": str(log_entry.id)},
                status=status.HTTP_404_NOT_FOUND,
            )
        except UnsupportedStatusError as exc:
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=resolved_ext_id[:128],
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="VALIDATION_ERROR",
                http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error_message=str(exc),
                ip_address=client_ip,
            )
            return Response(
                {"error": "UNSUPPORTED_STATUS", "message": str(exc), "log_id": str(log_entry.id)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except IdempotencyConflictError as exc:
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=resolved_ext_id[:128],
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="CONFLICT",
                http_status=status.HTTP_409_CONFLICT,
                error_message=str(exc),
                ip_address=client_ip,
            )
            return Response(
                {"error": "IDEMPOTENCY_CONFLICT", "message": str(exc), "log_id": str(log_entry.id)},
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as exc:
            logger.exception(f"[Provider Status Push] Unexpected error: {exc}")
            log_entry = ProviderIngestionLog.objects.create(
                provider=provider,
                provider_code=provider.provider_code,
                external_order_id=resolved_ext_id[:128],
                idempotency_key=idempotency_key,
                event_type="order.status_updated",
                payload_hash=compute_payload_hash(payload),
                raw_payload=payload,
                status="FAILED",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_message=str(exc),
                ip_address=client_ip,
            )
            return Response(
                {"error": "INTERNAL_ERROR", "message": "Failed to update order status.", "log_id": str(log_entry.id)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "status": "DUPLICATE" if is_duplicate else "PROCESSED",
                "message": "Duplicate status update ignored." if is_duplicate else "Order status updated successfully.",
                "provider_code": provider.provider_code,
                "external_order_id": order.external_pod_order_id,
                "order_number": order.order_number,
                "order_status": order.status.code if order.status else None,
                "tracking_number": order.tracking_number,
                "log_id": str(log_entry.id),
            },
            status=status.HTTP_200_OK,
        )


class ProviderIngestionLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/providers/logs/
    Read-only audit log of Common Provider Push API ingestion requests.
    """
    queryset = ProviderIngestionLog.objects.select_related("provider").all()
    serializer_class = ProviderIngestionLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["provider_code", "external_order_id", "idempotency_key", "status", "event_type"]
    ordering_fields = ["created_at", "status", "provider_code"]
    ordering = ["-created_at"]


class ServiceProviderViewSet(viewsets.ModelViewSet):
    """
    /api/v1/providers/channels/
    Channel / Service Provider registration, configuration, and dual-environment API key rotation.
    """
    queryset = ServiceProvider.objects.all().order_by("provider_code")
    serializer_class = ServiceProviderChannelSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["provider_code", "name"]
    ordering_fields = ["provider_code", "name", "created_at"]

    def create(self, request, *args, **kwargs):
        serializer = ServiceProviderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        provider = ServiceProvider.objects.create(
            name=data["name"].strip(),
            provider_code=data["provider_code"],
            default_currency=data.get("default_currency", "USD").upper(),
            default_carrier=data.get("default_carrier", "DHL Express"),
            require_hmac=data.get("require_hmac", False),
            is_external_pod_default=data.get("is_external_pod_default", False),
            allowed_ips=data.get("allowed_ips", []),
            metadata=data.get("metadata", {}),
        )
        credentials = provider.generate_credentials(save=True)

        log_staff_action(
            user=request.user if getattr(request.user, "is_authenticated", False) else None,
            action="PROVIDER_CHANNEL_CREATED",
            resource_type="SERVICE_PROVIDER",
            resource_id=provider.provider_code,
            details={"name": provider.name, "provider_code": provider.provider_code},
            request=request,
        )

        return Response(
            {
                "message": "Channel created with Test and Production API keys. Copy these keys now; they will not be shown again.",
                "channel": ServiceProviderChannelSerializer(provider).data,
                "credentials": {
                    "provider_code": provider.provider_code,
                    "test_api_key": credentials["test_api_key"],
                    "live_api_key": credentials["live_api_key"],
                    "webhook_secret": credentials["webhook_secret"],
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="rotate-key")
    def rotate_key(self, request, pk=None):
        """
        POST /api/v1/providers/channels/{id}/rotate-key/
        Independently rotates 'test' (sp_test_...), 'live' (sp_live_...), or 'both' keys.
        """
        provider = self.get_object()
        serializer = ServiceProviderRotateKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        env = serializer.validated_data["environment"]

        rotated_keys = {}
        if env in ("test", "both"):
            rotated_keys["test_api_key"] = provider.rotate_test_key(save=True)
        if env in ("live", "both"):
            rotated_keys["live_api_key"] = provider.rotate_live_key(save=True)

        log_staff_action(
            user=request.user if getattr(request.user, "is_authenticated", False) else None,
            action="PROVIDER_KEY_ROTATED",
            resource_type="SERVICE_PROVIDER",
            resource_id=provider.provider_code,
            details={"environment": env},
            request=request,
        )

        return Response(
            {
                "message": f"Rotated {env} API key(s) for '{provider.provider_code}'. Copy the new key(s) now; they will not be shown again.",
                "environment": env,
                "channel": ServiceProviderChannelSerializer(provider).data,
                "credentials": rotated_keys,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="logs")
    def logs(self, request, pk=None):
        """
        GET /api/v1/providers/channels/{id}/logs/
        Returns recent ProviderIngestionLog entries for this channel.
        """
        provider = self.get_object()
        qs = ProviderIngestionLog.objects.filter(provider=provider).order_by("-created_at")[:50]
        return Response(ProviderIngestionLogSerializer(qs, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="documentation-pdf")
    def documentation_pdf(self, request, pk=None):
        """
        GET/POST /api/v1/providers/channels/{id}/documentation-pdf/
        Generates and downloads a partner-ready API & Implementation Guide PDF for this channel,
        optionally embedding its encrypted-at-rest Test and/or Production API keys.
        """
        from apps.orders.services.provider_pdf import generate_channel_api_pdf

        provider = self.get_object()

        def _parse_bool(val) -> bool:
            if isinstance(val, bool):
                return val
            return str(val or "").strip().lower() in ("true", "1", "yes", "on")

        raw_test = request.data.get("include_test_key") if request.method == "POST" else request.query_params.get("include_test_key")
        raw_live = request.data.get("include_production_key") if request.method == "POST" else request.query_params.get("include_production_key")
        include_test = _parse_bool(raw_test)
        include_live = _parse_bool(raw_live)

        api_base_url = request.build_absolute_uri("/api/v1").rstrip("/")
        pdf_bytes = generate_channel_api_pdf(
            provider=provider,
            include_test_key=include_test,
            include_production_key=include_live,
            api_base_url=api_base_url,
        )

        log_staff_action(
            user=request.user if getattr(request.user, "is_authenticated", False) else None,
            action="PROVIDER_PDF_EXPORTED",
            resource_type="SERVICE_PROVIDER",
            resource_id=provider.provider_code,
            details={"include_test_key": include_test, "include_production_key": include_live},
            request=request,
        )

        filename = f"{provider.provider_code}-api-integration-guide.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

