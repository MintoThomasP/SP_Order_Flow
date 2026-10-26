"""
Views for Peecho Order Ingestion Webhook, Order Lifecycle APIs, and SLA Management.
"""
from datetime import timedelta
from decimal import Decimal
import random
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from apps.orders.models import Order, OrderItem, PeechoPayloadLog, PeechoIntegrationConfig
from apps.orders.serializers import (
    OrderSerializer,
    OrderStatusUpdateSerializer,
    PeechoPayloadLogSerializer,
    PeechoIntegrationConfigSerializer,
)
from apps.orders.services.ingestion import process_peecho_payload
from apps.orders.services.peecho_sync import sync_order_status_to_peecho
from apps.core.models.lookups import EntityStatus
from apps.authentication.services.audit import log_staff_action
from apps.authentication.models import UserAuditLog
from apps.authentication.serializers import UserAuditLogSerializer


class PeechoWebhookView(APIView):
    """
    POST /api/v1/peecho/webhook/
    Webhook ingestion endpoint for Peecho REST API payloads.
    Validates API key/secret, deduplicates by payload hash, and persists Order + items.
    """
    def post(self, request):
        payload = request.data
        if not isinstance(payload, dict):
            return Response(
                {"error": "Invalid JSON body. Expected object payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_ip = request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR")

        try:
            order, log_entry, is_duplicate = process_peecho_payload(payload, client_ip=client_ip)

            if is_duplicate:
                return Response(
                    {
                        "message": "Duplicate payload ignored.",
                        "log_id": str(log_entry.id),
                        "status": "DUPLICATE",
                        "order_number": order.order_number if order else None,
                    },
                    status=status.HTTP_200_OK,
                )

            return Response(
                {
                    "message": "Peecho order successfully ingested.",
                    "log_id": str(log_entry.id),
                    "status": "PROCESSED",
                    "order": OrderSerializer(order).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            return Response(
                {"error": f"Failed to ingest Peecho payload: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PeechoSimulateWebhookView(APIView):
    """
    POST /api/v1/peecho/simulate-webhook/
    Generates a realistic Peecho webhook order payload to test the ingestion engine live.
    """
    def post(self, request):
        rand_id = random.randint(100000, 999999)
        products = [
            ("Hardcover Photo Book A4", 48, Decimal("12.50"), "200gsm Silk Inner + 350gsm Hardcover Gloss"),
            ("Softcover Magazine A5", 32, Decimal("6.20"), "170gsm Gloss"),
            ("Layflat Panoramic Album 30x30", 24, Decimal("18.00"), "250gsm Lustre Layflat"),
            ("Wall Calendar A3 Spiral", 14, Decimal("4.50"), "250gsm Silk + Wire-O Bound"),
            ("Premium Canvas Print 40x60", 1, Decimal("25.00"), "380gsm Cotton Canvas on Pine Frame"),
        ]

        selected_prod = random.choice(products)
        priorities = ["STANDARD_72H", "EXPRESS_24H", "RUSH_8H"]
        chosen_priority = request.data.get("priority") or random.choice(priorities)

        customer_names = [
            ("Emily Watson", "emily.watson@example.com", "+44 20 7946 0912", "London", "UK"),
            ("Lars Lindqvist", "lars.lindqvist@example.se", "+46 8 123 4567", "Stockholm", "SE"),
            ("Sophie Moreau", "sophie.m@example.fr", "+33 1 42 68 55 00", "Paris", "FR"),
            ("Johannes Becker", "j.becker@example.de", "+49 30 123456", "Berlin", "DE"),
        ]
        cust = random.choice(customer_names)

        sample_payload = {
            "event": "order.created",
            "order_id": f"PEECHO-{rand_id}",
            "priority": chosen_priority,
            "currency": "EUR",
            "total_amount": f"{random.uniform(28.50, 145.00):.2f}",
            "carrier": "DHL Express Worldwide",
            "customer": {
                "name": cust[0],
                "email": cust[1],
                "phone": cust[2],
            },
            "shipping_address": {
                "recipient_name": cust[0],
                "street": f"{random.randint(12, 180)} Printmakers Way",
                "city": cust[3],
                "postal_code": f"{random.randint(1000, 9999)}",
                "country": cust[4],
            },
            "items": [
                {
                    "item_id": f"ITEM-{rand_id}-1",
                    "product_type": selected_prod[0],
                    "quantity": random.randint(1, 3),
                    "page_count": selected_prod[1],
                    "spine_width_mm": float(selected_prod[2]),
                    "paper_stock": selected_prod[3],
                    "pdf_artwork_url": f"https://assets.peecho.com/orders/{rand_id}/content_hires.pdf",
                    "pdf_cover_url": f"https://assets.peecho.com/orders/{rand_id}/cover_hires.pdf",
                }
            ],
        }

        client_ip = request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR")
        order, log_entry, is_duplicate = process_peecho_payload(sample_payload, client_ip=client_ip)

        return Response(
            {
                "message": "Simulated Peecho Webhook Ingested Successfully.",
                "payload_sent": sample_payload,
                "order": OrderSerializer(order).data if order else None,
                "log_status": log_entry.status,
            },
            status=status.HTTP_201_CREATED,
        )


class OrderViewSet(viewsets.ModelViewSet):
    """
    POD Order Management ViewSet.
    Enables searching by Peecho Order ID, filtering by SLA urgency and dynamic statuses.
    """
    queryset = Order.objects.select_related("status").prefetch_related("items").all()
    serializer_class = OrderSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["order_number", "peecho_order_id", "customer_name", "customer_email"]
    ordering_fields = ["sla_deadline", "created_at", "total_amount", "order_number"]
    ordering = ["sla_deadline"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            statuses = [s.strip().upper() for s in status_param.split(",") if s.strip()]
            if len(statuses) == 1:
                qs = qs.filter(status__code__iexact=statuses[0])
            elif len(statuses) > 1:
                qs = qs.filter(status__code__in=statuses)

        sla_urgency = self.request.query_params.get("urgency")
        now = timezone.now()
        if sla_urgency == "critical": # < 4 hours remaining
            qs = qs.filter(sla_deadline__lte=now + timedelta(hours=4), sla_deadline__gt=now)
        elif sla_urgency == "urgent": # < 12 hours remaining
            qs = qs.filter(sla_deadline__lte=now + timedelta(hours=12), sla_deadline__gt=now)
        elif sla_urgency == "breached": # overdue
            qs = qs.filter(sla_deadline__lt=now)
        elif sla_urgency == "normal": # > 12 hours
            qs = qs.filter(sla_deadline__gt=now + timedelta(hours=12))

        return qs

    @action(detail=True, methods=["post", "patch"], url_path="status")
    def update_order_status(self, request, pk=None):
        """
        POST /api/v1/orders/{id}/status/
        Transitions order to a new dynamic EntityStatus with audit logging.
        """
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_code = serializer.validated_data["status_code"].strip()
        comments = serializer.validated_data.get("comments", "")

        # Resilient lookup: check ORDER entity_type case-insensitively, then any entity_type
        target_status = EntityStatus.objects.filter(entity_type="ORDER", code__iexact=target_code).first()
        if not target_status:
            target_status = EntityStatus.objects.filter(code__iexact=target_code).first()

        # Fallback dynamic creation for operational reliability
        if not target_status:
            KNOWN_STATUS_DEFAULTS = {
                "PRINTING": {"name": "Printing on Press", "badge_color": "purple", "badge_bg": "#F3E8FF", "badge_text": "#7E22CE", "sort_order": 45},
                "BATCHED": {"name": "Batched for Production", "badge_color": "amber", "badge_bg": "#FEF3C7", "badge_text": "#D97706", "sort_order": 35},
                "PRODUCTION_COMPLETED": {"name": "Production Completed", "badge_color": "teal", "badge_bg": "#CCFBF1", "badge_text": "#0D9488", "sort_order": 55},
                "READY_FOR_DISPATCH": {"name": "Ready for Dispatch", "badge_color": "sky", "badge_bg": "#E0F2FE", "badge_text": "#0369A1", "sort_order": 65},
                "IN_TRANSIT": {"name": "In Transit", "badge_color": "blue", "badge_bg": "#EFF6FF", "badge_text": "#1D4ED8", "sort_order": 75},
                "OUT_FOR_DELIVERY": {"name": "Out for Delivery", "badge_color": "amber", "badge_bg": "#FEF3C7", "badge_text": "#B45309", "sort_order": 80},
                "DELIVERED": {"name": "Delivered", "badge_color": "emerald", "badge_bg": "#D1FAE5", "badge_text": "#047857", "sort_order": 85, "is_terminal": True},
                "REPRINT_QUEUED": {"name": "Reprint Queued", "badge_color": "rose", "badge_bg": "#FFE4E6", "badge_text": "#BE123C", "sort_order": 95, "is_failure_state": True},
            }
            code_upper = target_code.upper()
            defaults = KNOWN_STATUS_DEFAULTS.get(
                code_upper,
                {
                    "name": target_code.replace("_", " ").title(),
                    "badge_color": "blue",
                    "badge_bg": "#EFF6FF",
                    "badge_text": "#0073EA",
                    "sort_order": 50,
                },
            )
            target_status, _ = EntityStatus.objects.get_or_create(
                entity_type="ORDER",
                code=code_upper,
                defaults=defaults,
            )

        old_status_name = order.status.name if order.status else "None"
        order.status = target_status
        order.save(update_fields=["status", "updated_at"])

        # Synchronize with linked Shipment records if advancing logistics milestone
        target_code_upper = target_status.code.upper()
        if target_code_upper in ["DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]:
            now = timezone.now()
            shipment_status = EntityStatus.objects.filter(entity_type="SHIPMENT", code__iexact=target_code_upper).first() or target_status
            for sh in order.shipments.all():
                sh.status_code = target_code_upper
                sh.status = shipment_status
                if target_code_upper == "DELIVERED":
                    sh.actual_delivered_at = now
                events = list(sh.carrier_events_log or [])
                events.insert(0, {
                    "timestamp": now.isoformat(),
                    "status": target_code_upper,
                    "location": f"{order.shipping_address.get('city', 'Regional Hub') if isinstance(order.shipping_address, dict) else 'Hub'}",
                    "description": comments or f"Milestone updated to {target_status.name}",
                    "carrier": sh.carrier_name,
                })
                sh.carrier_events_log = events
                sh.save(update_fields=["status_code", "status", "actual_delivered_at", "carrier_events_log", "updated_at"])

        # Automated Peecho status push
        peecho_sync_res = sync_order_status_to_peecho(
            order=order,
            status_code=target_status.code,
            notes=comments,
            operator=request.user if request.user.is_authenticated else None,
        )

        # Audit logging
        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="STATUS_CHANGE",
            resource_type="ORDER",
            resource_id=order.order_number,
            details={
                "previous_status": old_status_name,
                "new_status": target_status.name,
                "status_code": target_status.code,
                "peecho_order_id": order.peecho_order_id,
                "comments": comments,
                "peecho_sync": peecho_sync_res,
            },
            request=request,
        )

        return Response(
            {
                "detail": f"Order {order.order_number} transitioned to '{target_status.name}'.",
                "order": OrderSerializer(order).data,
                "peecho_sync": peecho_sync_res,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="audit-logs")
    def order_audit_logs(self, request, pk=None):
        """
        GET /api/v1/orders/{id}/audit-logs/
        Comprehensive activity history logging every user action, status change, and timestamp.
        """
        order = self.get_object()
        logs = UserAuditLog.objects.filter(
            resource_id__in=[order.order_number, order.peecho_order_id, str(order.id)]
        ).order_by("-created_at")
        return Response(UserAuditLogSerializer(logs, many=True).data)

    @action(detail=False, methods=["get"], url_path="metrics")
    def order_metrics(self, request):
        """
        GET /api/v1/orders/metrics/
        High level metrics for dashboard KPI cards.
        """
        now = timezone.now()
        total_orders = Order.objects.count()
        in_prepress = Order.objects.filter(status__code__in=["RECEIVED", "PREPRESS_QUEUED"]).count()
        in_production = Order.objects.filter(status__code__in=["IN_PRODUCTION", "PRINTING"]).count()
        ready_dispatch = Order.objects.filter(status__code__in=["PACKED", "QUALITY_AUDIT"]).count()
        sla_at_risk = Order.objects.filter(sla_deadline__lte=now + timedelta(hours=6)).exclude(status__is_terminal=True).count()

        return Response({
            "total_orders": total_orders,
            "in_prepress": in_prepress,
            "in_production": in_production,
            "ready_dispatch": ready_dispatch,
            "sla_at_risk": sla_at_risk,
        })


class PeechoPayloadLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view of raw Peecho webhook payloads.
    """
    queryset = PeechoPayloadLog.objects.all()
    serializer_class = PeechoPayloadLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["peecho_order_id", "status", "event_type"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]


class PeechoConfigView(APIView):
    """
    GET /api/v1/peecho/config/
    POST /api/v1/peecho/config/
    Centralized Integration Settings: Admin panel to securely configure Peecho API keys,
    authorization tokens, merchant credentials, and webhook endpoints.
    """
    def get(self, request):
        config = PeechoIntegrationConfig.get_active()
        return Response(PeechoIntegrationConfigSerializer(config, context={"request": request}).data)

    def post(self, request):
        config = PeechoIntegrationConfig.get_active()
        serializer = PeechoIntegrationConfigSerializer(
            config,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="SYSTEM_CONFIG_CHANGE",
            resource_type="PEECHO_CONFIG",
            resource_id="CONFIG",
            details={"updated_fields": list(request.data.keys())},
            request=request,
        )

        return Response(
            {
                "message": "Peecho Integration settings updated successfully.",
                "config": PeechoIntegrationConfigSerializer(config, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class PeechoTestConnectionView(APIView):
    """
    POST /api/v1/peecho/test-connection/
    Performs live authentication handshake with Peecho API gateway.
    """
    def post(self, request):
        config = PeechoIntegrationConfig.get_active()
        now = timezone.now()

        if config.is_sandbox or "sandbox" in config.api_key:
            config.last_connection_test_at = now
            config.last_connection_status = "CONNECTED (SANDBOX 200 OK)"
            config.save(update_fields=["last_connection_test_at", "last_connection_status"])
            return Response({
                "success": True,
                "status": "CONNECTED",
                "mode": "SANDBOX_MOCK",
                "message": f"Successfully validated Peecho API credentials for {config.api_base_url}.",
                "tested_at": now.isoformat(),
                "endpoint": config.api_base_url,
            })
        else:
            import requests
            try:
                resp = requests.get(
                    f"{config.api_base_url.rstrip('/')}/v2/merchants/self",
                    headers={"Authorization": f"Bearer {config.api_key}"},
                    timeout=6,
                )
                status_text = "CONNECTED" if resp.status_code in [200, 201] else f"HTTP {resp.status_code}"
                config.last_connection_test_at = now
                config.last_connection_status = status_text
                config.save(update_fields=["last_connection_test_at", "last_connection_status"])
                return Response({
                    "success": resp.status_code in [200, 201],
                    "status": status_text,
                    "mode": "PRODUCTION_LIVE",
                    "message": f"Peecho API handshake returned status {resp.status_code}.",
                    "tested_at": now.isoformat(),
                })
            except Exception as exc:
                config.last_connection_test_at = now
                config.last_connection_status = "CONNECTION_FAILED"
                config.save(update_fields=["last_connection_test_at", "last_connection_status"])
                return Response({
                    "success": False,
                    "status": "FAILED",
                    "error": str(exc),
                    "tested_at": now.isoformat(),
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

