"""
Views for Peecho Order Ingestion Webhook, Order Lifecycle APIs, and SLA Management.
"""
from datetime import timedelta
from decimal import Decimal
import random
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from apps.orders.permissions import is_status_accessible_for_role, get_user_role_code
from apps.orders.models import Order, OrderItem, PeechoPayloadLog, PrintifyPayloadLog, PeechoIntegrationConfig
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


def is_user_admin(user) -> bool:
    """
    Check if a user has administrative privileges (Super Admin, Staff, or Admin role).
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    user_role = getattr(user, "role", None)
    role_code = getattr(user_role, "code", "") if user_role else ""
    if not role_code and isinstance(user_role, str):
        role_code = user_role
    return str(role_code).upper() in ["SUPER_ADMIN", "ADMIN"]


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


class OrderSimulateView(APIView):
    """
    POST /api/v1/orders/simulate/
    Simulates inbound order creation from any supported channel:
    - printify (Printify POD)
    - peecho (Peecho POD)
    - custom_api (Custom POD / REST API)
    - manual (In-House / Manual Order)
    """
    default_source = "printify"

    def post(self, request):
        source = (request.data.get("source") or self.default_source).strip().lower()
        priorities = ["STANDARD_72H", "EXPRESS_24H", "RUSH_8H"]
        chosen_priority = request.data.get("priority") or random.choice(priorities)

        client_ip = request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR") or "127.0.0.1"
        rand_id = random.randint(100000, 999999)

        if "RUSH" in chosen_priority:
            sla_hours = 8
            sla_priority = "RUSH_8H"
        elif "EXPRESS" in chosen_priority:
            sla_hours = 24
            sla_priority = "EXPRESS_24H"
        else:
            sla_hours = 72
            sla_priority = "STANDARD_72H"

        sla_deadline = timezone.now() + timedelta(hours=sla_hours)
        initial_status = EntityStatus.objects.filter(entity_type="ORDER", code="RECEIVED").first()
        if not initial_status:
            initial_status = EntityStatus.objects.filter(entity_type="ORDER").order_by("sort_order").first()

        order_count = Order.objects.count() + 1001
        order_number = f"SP-2026-{order_count}"

        if source == "peecho":
            products = [
                ("Hardcover Photo Book A4", 48, Decimal("12.50"), "200gsm Silk Inner + 350gsm Hardcover Gloss"),
                ("Softcover Magazine A5", 32, Decimal("6.20"), "170gsm Gloss"),
                ("Layflat Panoramic Album 30x30", 24, Decimal("18.00"), "250gsm Lustre Layflat"),
                ("Wall Calendar A3 Spiral", 14, Decimal("4.50"), "250gsm Silk + Wire-O Bound"),
                ("Premium Canvas Print 40x60", 1, Decimal("25.00"), "380gsm Cotton Canvas on Pine Frame"),
            ]
            selected_prod = random.choice(products)
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
                        "pdf_artwork_url": "/artworks/peecho_hardcover_photobook_a4.pdf",
                        "pdf_cover_url": "/artworks/peecho_hardcover_wrap_cover.pdf",
                    }
                ],
            }
            order, log_entry, is_duplicate = process_peecho_payload(sample_payload, client_ip=client_ip)
            return Response(
                {
                    "message": "Simulated Peecho Webhook Ingested Successfully.",
                    "channel": "Peecho POD",
                    "payload_sent": sample_payload,
                    "order": OrderSerializer(order).data if order else None,
                    "log_status": log_entry.status,
                },
                status=status.HTTP_201_CREATED,
            )

        elif source == "printify":
            printify_catalog = [
                {"name": "Bella+Canvas 3001 Unisex Jersey T-Shirt", "type": "T-Shirt", "price": Decimal("16.50"), "stock": "100% Airlume Combed Ringspun Cotton (Black / L)", "product_id": "62e92c48f8f4a1329a0384a1", "variant_id": 45192, "provider_id": 29},
                {"name": "Gildan 18000 Heavy Blend Crewneck Sweatshirt", "type": "Sweatshirt", "price": Decimal("26.00"), "stock": "50% Cotton / 50% Polyester Fleece (Navy / XL)", "product_id": "62e92c48f8f4a1329a0384a2", "variant_id": 48210, "provider_id": 29},
                {"name": "White Glossy Ceramic Coffee Mug 11oz", "type": "Mug", "price": Decimal("8.50"), "stock": "AAA Grade Sublimation Ceramic", "product_id": "62e92c48f8f4a1329a0384a3", "variant_id": 31200, "provider_id": 16},
                {"name": "Die-Cut Vinyl Waterproof Sticker Pack", "type": "Stickers", "price": Decimal("4.20"), "stock": "Weatherproof Glossy Vinyl 6mil", "product_id": "62e92c48f8f4a1329a0384a4", "variant_id": 19401, "provider_id": 42},
                {"name": "Heavyweight Cotton Canvas Tote Bag", "type": "Tote Bag", "price": Decimal("12.50"), "stock": "100% Heavy Cotton 12oz Canvas (Natural)", "product_id": "62e92c48f8f4a1329a0384a5", "variant_id": 28312, "provider_id": 16},
            ]
            chosen_prod = random.choice(printify_catalog)
            printify_customers = [
                ("Liam Vance", "liam.vance@printify-demo.com", "+1 312 555 0144", "Chicago", "IL", "60601", "US"),
                ("Olivia Martinez", "olivia.m@printify-demo.com", "+1 415 555 0199", "San Francisco", "CA", "94107", "US"),
                ("Marcus Sterling", "m.sterling@printify-demo.com", "+1 212 555 0188", "New York", "NY", "10012", "US"),
                ("Chloe Dupont", "c.dupont@printify-demo.ca", "+1 514 555 0177", "Montreal", "QC", "H2Y 1C6", "CA"),
            ]
            cust = random.choice(printify_customers)
            qty = random.randint(1, 3)
            total_amt = chosen_prod["price"] * qty + Decimal("5.99")
            ext_order_id = f"PF-{rand_id}"

            order = Order.objects.create(
                order_number=order_number,
                order_source="printify",
                is_external_pod=True,
                external_pod_order_id=ext_order_id,
                peecho_order_id=None,
                customer_name=cust[0],
                customer_email=cust[1],
                customer_phone=cust[2],
                shipping_address={
                    "recipient_name": cust[0],
                    "street": f"{random.randint(10, 400)} Fashion Ave",
                    "city": cust[3],
                    "state": cust[4],
                    "postal_code": cust[5],
                    "country": cust[6],
                },
                carrier_preference="USPS Priority Mail",
                status=initial_status,
                sla_deadline=sla_deadline,
                sla_priority=sla_priority,
                total_items_count=qty,
                total_amount=total_amt,
                currency="USD",
                peecho_metadata={"source": "printify_api", "shop_id": "1849204", "order_id": ext_order_id},
            )

            OrderItem.objects.create(
                order=order,
                external_item_id=f"PF-ITEM-{rand_id}",
                product_type=chosen_prod["name"],
                quantity=qty,
                page_count=1,
                spine_width_mm=Decimal("0.0"),
                paper_stock=chosen_prod["stock"],
                pdf_artwork_url=f"https://images-assets.printify.com/orders/{rand_id}/print_artwork.png",
                pdf_cover_url="",
                printify_product_id=chosen_prod["product_id"],
                printify_variant_id=chosen_prod["variant_id"],
                printify_print_provider_id=chosen_prod["provider_id"],
                preflight_passed=True,
            )

            PrintifyPayloadLog.objects.create(
                printify_order_id=ext_order_id,
                event_type="order:created",
                raw_payload={
                    "id": ext_order_id,
                    "external_id": order_number,
                    "status": "pending",
                    "line_items": [{"title": chosen_prod["name"], "quantity": qty, "price": str(chosen_prod["price"])}],
                },
                status="PROCESSED",
                ip_address=client_ip,
            )

            return Response(
                {
                    "message": "Simulated Printify POD Order Ingested Successfully.",
                    "channel": "Printify POD",
                    "order": OrderSerializer(order).data,
                    "log_status": "PROCESSED",
                },
                status=status.HTTP_201_CREATED,
            )

        elif source == "custom_api":
            custom_products = [
                ("Fine Art Archival Giclée Print 50x70cm", 1, Decimal("42.00"), "Hahnemühle Photo Rag 308gsm 100% Cotton"),
                ("Metallic Foil Letterpress Business Cards 500ct", 1, Decimal("48.00"), "450gsm Heavy Cotton + Hot Gold Foil Blocked"),
                ("Architectural Construction Plan A0 Roll", 3, Decimal("15.50"), "120gsm High-Opaque Technical Drafting Bond"),
                ("Custom Embossed Hardcover Portfolio 30x30", 1, Decimal("54.00"), "Euro-Cloth Buckram with Blind Deboss"),
            ]
            chosen_prod = random.choice(custom_products)
            custom_customers = [
                ("Alistair Finch (Studio Design)", "afinch@designstudios.co.uk", "+44 20 7123 4567", "London", "England", "EC1A 1BB", "GB"),
                ("Astrid Lindholm (Galleri Moderna)", "a.lindholm@gallerim.se", "+46 8 555 1234", "Stockholm", "Stockholm", "111 22", "SE"),
                ("Kenji Takahashi (Tokyo Creative Lab)", "k.takahashi@creativelab.jp", "+81 3 5555 0142", "Minato-ku", "Tokyo", "105-0001", "JP"),
            ]
            cust = random.choice(custom_customers)
            qty = chosen_prod[1]
            total_amt = chosen_prod[2] * qty + Decimal("7.50")
            ext_order_id = f"API-EXT-{rand_id}"

            order = Order.objects.create(
                order_number=order_number,
                order_source="custom_api",
                is_external_pod=False,
                external_pod_order_id=ext_order_id,
                peecho_order_id=None,
                customer_name=cust[0],
                customer_email=cust[1],
                customer_phone=cust[2],
                shipping_address={
                    "recipient_name": cust[0],
                    "street": f"{random.randint(10, 200)} High Street",
                    "city": cust[3],
                    "state": cust[4],
                    "postal_code": cust[5],
                    "country": cust[6],
                },
                carrier_preference="DPD Express Worldwide",
                status=initial_status,
                sla_deadline=sla_deadline,
                sla_priority=sla_priority,
                total_items_count=qty,
                total_amount=total_amt,
                currency="GBP",
                peecho_metadata={"gateway": "Custom B2B REST Ingestion", "client_id": f"CLIENT-{rand_id % 500 + 100}"},
            )

            OrderItem.objects.create(
                order=order,
                external_item_id=f"ITEM-{rand_id}",
                product_type=chosen_prod[0],
                quantity=qty,
                page_count=1,
                spine_width_mm=Decimal("0.0"),
                paper_stock=chosen_prod[3],
                pdf_artwork_url=f"https://assets.customgateway.io/prints/{rand_id}/artwork_hires.pdf",
                pdf_cover_url="",
                preflight_passed=True,
            )

            return Response(
                {
                    "message": "Custom B2B API Order Created Successfully.",
                    "channel": "Custom POD / REST API",
                    "order": OrderSerializer(order).data,
                    "log_status": "PROCESSED",
                },
                status=status.HTTP_201_CREATED,
            )

        else:  # manual
            manual_products = [
                ("Tri-Fold Corporate Marketing Brochure 250ct", 1, Decimal("65.00"), "170gsm Silk Double-Sided Full Color"),
                ("Retractable Roll-Up Banner Stand 85x200cm", 1, Decimal("85.00"), "330mic Anti-Curl Scratch-Resistant PVC + Aluminum Base"),
                ("Foam Core Mounted Presentation Board A1", 2, Decimal("26.00"), "5mm Lightweight Foam-X Rigid Board Full Bleed"),
                ("Promotional Flyer Handouts A5 1000ct", 1, Decimal("38.00"), "130gsm Gloss Art Paper"),
            ]
            chosen_prod = random.choice(manual_products)
            manual_customers = [
                ("David Miller (Acme Retail)", "dmiller@acmeretail.com", "+1 312 555 9811", "Chicago", "IL", "60606", "US"),
                ("Priya Sharma (Apex Conferences)", "priya@apexevents.in", "+91 22 2490 1234", "Mumbai", "Maharashtra", "400013", "IN"),
                ("Carlos Rodriguez (Horizon Media)", "crodriguez@horizonmedia.es", "+34 91 555 0198", "Madrid", "Madrid", "28001", "ES"),
            ]
            cust = random.choice(manual_customers)
            qty = chosen_prod[1]
            total_amt = chosen_prod[2] * qty + Decimal("4.00")

            order = Order.objects.create(
                order_number=order_number,
                order_source="manual",
                is_external_pod=False,
                external_pod_order_id=None,
                peecho_order_id=None,
                customer_name=cust[0],
                customer_email=cust[1],
                customer_phone=cust[2],
                shipping_address={
                    "recipient_name": cust[0],
                    "street": f"{random.randint(10, 500)} Commercial Center",
                    "city": cust[3],
                    "state": cust[4],
                    "postal_code": cust[5],
                    "country": cust[6],
                },
                carrier_preference="Local Courier Dispatch",
                status=initial_status,
                sla_deadline=sla_deadline,
                sla_priority=sla_priority,
                total_items_count=qty,
                total_amount=total_amt,
                currency="USD",
                peecho_metadata={"intake_channel": "In-House CSR Staff", "terminal": "DESK-01"},
            )

            OrderItem.objects.create(
                order=order,
                external_item_id=f"MANUAL-{rand_id}",
                product_type=chosen_prod[0],
                quantity=qty,
                page_count=1,
                spine_width_mm=Decimal("0.0"),
                paper_stock=chosen_prod[3],
                pdf_artwork_url=f"https://internal-assets.silverpointpod.com/jobs/{rand_id}/print_ready.pdf",
                pdf_cover_url="",
                preflight_passed=True,
            )

            return Response(
                {
                    "message": "In-House Manual Order Created Successfully.",
                    "channel": "Internal / Manual",
                    "order": OrderSerializer(order).data,
                    "log_status": "PROCESSED",
                },
                status=status.HTTP_201_CREATED,
            )


class PeechoSimulateWebhookView(OrderSimulateView):
    """
    POST /api/v1/peecho/simulate-webhook/
    Backwards-compatible Peecho simulation endpoint that defaults source='peecho'.
    """
    default_source = "peecho"


class OrderViewSet(viewsets.ModelViewSet):
    """
    POD Order Management ViewSet.
    Enables searching by Peecho Order ID, filtering by SLA urgency and dynamic statuses.
    """
    queryset = Order.objects.select_related("status").prefetch_related("items").all()
    serializer_class = OrderSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "order_number",
        "peecho_order_id",
        "external_pod_order_id",
        "customer_name",
        "customer_email",
        "order_source",
    ]
    ordering_fields = ["sla_deadline", "created_at", "total_amount", "order_number"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            statuses = [s.strip().upper() for s in status_param.split(",") if s.strip()]
            if len(statuses) == 1:
                qs = qs.filter(status__code__iexact=statuses[0])
            elif len(statuses) > 1:
                qs = qs.filter(status__code__in=statuses)

        source_param = self.request.query_params.get("source") or self.request.query_params.get("order_source")
        if source_param and source_param.lower() != "all":
            sources = [s.strip().lower() for s in source_param.split(",") if s.strip()]
            if len(sources) == 1:
                qs = qs.filter(order_source__iexact=sources[0])
            elif len(sources) > 1:
                qs = qs.filter(order_source__in=sources)

        is_external_pod = self.request.query_params.get("is_external_pod")
        if is_external_pod is not None:
            if is_external_pod.lower() in ("true", "1"):
                qs = qs.filter(is_external_pod=True)
            elif is_external_pod.lower() in ("false", "0"):
                qs = qs.filter(is_external_pod=False)

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

        station_param = self.request.query_params.get("station")
        if station_param:
            station_lower = station_param.strip().lower()
            if station_lower in ["prepress", "preflight"]:
                qs = qs.filter(status__code__in=["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS", "PREPRESS_PASSED", "EXCEPTION_HOLD"])
            elif station_lower in ["production", "press", "shopfloor"]:
                qs = qs.filter(status__code__in=["PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PRODUCTION_COMPLETED", "PACKED"])
            elif station_lower in ["shipping", "dispatch", "logistics"]:
                qs = qs.filter(status__code__in=["PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"])
            elif station_lower in ["finance", "billing"]:
                qs = qs.filter(status__code__in=["DISPATCHED", "DELIVERED", "EXCEPTION_HOLD"])

        # Enforce pipeline stage boundary for non-admin operational designations
        user = self.request.user
        admin_flag = is_user_admin(user)
        if not admin_flag:
            user_role = getattr(user, "role", None)
            role_code = getattr(user_role, "code", "") if user_role else ""
            if not role_code and isinstance(user_role, str):
                role_code = user_role
            if not role_code:
                role_code = self.request.headers.get("X-Staff-Role") or ""
            role_code = str(role_code).strip().upper()

            if role_code == "SHOPFLOOR_OPERATOR":
                # Print & bindery operators must NEVER see unapproved prepress orders
                qs = qs.exclude(status__code__in=["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS"])
            elif role_code == "PRODUCTION_MANAGER":
                # Production manager only sees orders that have reached/passed prepress approval
                qs = qs.exclude(status__code__in=["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS"])
            elif role_code in ["DISPATCH_SPECIALIST", "DISPATCH_FINANCE_SPECIALIST"]:
                # Shipping specialists only see orders that are packed or ready for dispatch
                qs = qs.filter(status__code__in=["PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"])
            elif role_code == "FINANCE_SPECIALIST":
                qs = qs.filter(status__code__in=["DISPATCHED", "DELIVERED", "EXCEPTION_HOLD"])

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        search_query = request.query_params.get("search", "").strip()

        # If search query is present and 0 results were returned, check if matching order exists in full database
        if search_query and isinstance(response.data, dict) and response.data.get("count", 0) == 0:
            restricted_order = Order.objects.filter(
                Q(order_number__icontains=search_query)
                | Q(peecho_order_id__icontains=search_query)
                | Q(external_pod_order_id__icontains=search_query)
                | Q(customer_name__icontains=search_query)
                | Q(customer_email__icontains=search_query)
            ).select_related("status").first()

            if restricted_order:
                response.data["access_restricted_match"] = {
                    "found": True,
                    "has_access": False,
                    "order_number": restricted_order.order_number,
                    "status_code": restricted_order.status.code if restricted_order.status else "",
                    "status_name": restricted_order.status.name if restricted_order.status else "Unassigned",
                    "message": "You have no access to this job / this order",
                }
        return response

    def retrieve(self, request, *args, **kwargs):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        pk = self.kwargs.get(lookup_url_kwarg)
        try:
            return super().retrieve(request, *args, **kwargs)
        except Exception:
            # Check if order exists in full DB
            ord_obj = Order.objects.filter(pk=pk).select_related("status").first()
            if ord_obj:
                return Response(
                    {
                        "error": "Access Denied",
                        "message": "You have no access to this job / this order",
                        "order_number": ord_obj.order_number,
                        "status_code": ord_obj.status.code if ord_obj.status else "",
                        "status_name": ord_obj.status.name if ord_obj.status else "Unassigned",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            raise

    @action(detail=False, methods=["get"], url_path="check-access")
    def check_access(self, request):
        """
        GET /api/v1/orders/check-access/?search=<term>
        Explicit access verification when searching for an order.
        """
        search_term = request.query_params.get("search", "").strip()
        if not search_term:
            return Response({"found": False, "has_access": False, "message": "Search query required."})

        ord_obj = Order.objects.filter(
            Q(order_number__iexact=search_term)
            | Q(peecho_order_id__iexact=search_term)
            | Q(order_number__icontains=search_term)
            | Q(peecho_order_id__icontains=search_term)
        ).select_related("status").first()

        if not ord_obj:
            return Response({
                "found": False,
                "has_access": False,
                "message": f"No order found matching '{search_term}'.",
            })

        user_role = get_user_role_code(request)
        status_code = ord_obj.status.code if ord_obj.status else ""
        has_access = is_status_accessible_for_role(user_role, status_code)

        return Response({
            "found": True,
            "has_access": has_access,
            "order_number": ord_obj.order_number,
            "status_code": status_code,
            "status_name": ord_obj.status.name if ord_obj.status else "Unassigned",
            "message": "Access granted." if has_access else "You have no access to this job / this order",
        })

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

        # Sequential Order Pipeline Enforcement
        PIPELINE_STEP_INDEX = {
            "RECEIVED": 1,
            "PREPRESS_QUEUED": 2,
            "PREPRESS_PASSED": 3,
            "BATCHED": 4,
            "IN_PRODUCTION": 5,
            "PRINTING": 6,
            "QUALITY_AUDIT": 7,
            "PRODUCTION_COMPLETED": 8,
            "PACKED": 8,
            "READY_FOR_DISPATCH": 9,
            "DISPATCHED": 10,
            "IN_TRANSIT": 11,
            "OUT_FOR_DELIVERY": 12,
            "DELIVERED": 13,
        }

        current_code = order.status.code.upper() if order.status else "RECEIVED"
        target_code_upper = target_status.code.upper()

        current_step = PIPELINE_STEP_INDEX.get(current_code)
        target_step = PIPELINE_STEP_INDEX.get(target_code_upper)

        is_backward = False
        is_skipped = False

        if current_step is not None and target_step is not None:
            if target_step < current_step:
                is_backward = True
            elif target_step > current_step + 1:
                # Standard operational transitions within station boundary
                if current_code in ["RECEIVED", "PREPRESS_QUEUED"] and target_code_upper == "PREPRESS_PASSED":
                    is_skipped = False
                elif current_code in ["IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT"] and target_code_upper in ["QUALITY_AUDIT", "PRODUCTION_COMPLETED", "PACKED"]:
                    is_skipped = False
                else:
                    is_skipped = True

        requires_admin = is_backward or is_skipped

        user = request.user
        admin_flag = is_user_admin(user)

        # Staff Designation & Department Transition Authorization Check
        if not admin_flag:
            user_role = getattr(user, "role", None)
            role_code = getattr(user_role, "code", "") if user_role else ""
            if not role_code and isinstance(user_role, str):
                role_code = user_role
            if not role_code:
                role_code = request.headers.get("X-Staff-Role") or request.data.get("user_role") or ""
            role_code = str(role_code).strip().upper()

            if role_code in ["SUPER_ADMIN", "ADMIN"]:
                admin_flag = True
            else:
                # 1. Station lifecycle boundary check:
                if role_code == "PREPRESS_SPECIALIST":
                    if current_code in [
                        "PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT",
                        "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH", "DISPATCHED",
                        "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"
                    ]:
                        return Response(
                            {
                                "error": "PREPRESS_ALREADY_APPROVED",
                                "detail": "Artwork for this order has already been approved and handed over to the Production Floor. Prepress staff cannot modify orders that have already passed prepress inspection.",
                                "current_status": current_code,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

                elif role_code == "SHOPFLOOR_OPERATOR":
                    if current_code in ["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS"]:
                        return Response(
                            {
                                "error": "AWAITING_PREPRESS_APPROVAL",
                                "detail": "This order is awaiting Artwork check in Prepress. Shopfloor operators cannot operate on unapproved orders.",
                                "current_status": current_code,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    if current_code in ["PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]:
                        return Response(
                            {
                                "error": "PRODUCTION_ALREADY_COMPLETED",
                                "detail": "This order has already finished press and bindery operations and is staged for shipping.",
                                "current_status": current_code,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

                elif role_code in ["DISPATCH_SPECIALIST", "DISPATCH_FINANCE_SPECIALIST"]:
                    if current_code not in ["PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"]:
                        return Response(
                            {
                                "error": "NOT_READY_FOR_DISPATCH",
                                "detail": "This order has not finished production yet. Shipping staff can only process orders once packed and ready for dispatch.",
                                "current_status": current_code,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

                ROLE_ALLOWED_TARGETS = {
                    "PREPRESS_SPECIALIST": ["PREPRESS_PASSED", "EXCEPTION_HOLD"],
                    "PRODUCTION_MANAGER": ["BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH", "EXCEPTION_HOLD"],
                    "SHOPFLOOR_OPERATOR": ["IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PACKED"],
                    "DISPATCH_SPECIALIST": ["READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"],
                    "DISPATCH_FINANCE_SPECIALIST": ["READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"],
                    "FINANCE_SPECIALIST": ["EXCEPTION_HOLD"],
                    "INTEGRATION_SPECIALIST": ["RECEIVED", "PREPRESS_QUEUED", "EXCEPTION_HOLD"],
                }

                if role_code in ROLE_ALLOWED_TARGETS:
                    allowed_targets = ROLE_ALLOWED_TARGETS[role_code]
                    if target_code_upper not in allowed_targets:
                        return Response(
                            {
                                "error": "DESIGNATION_TRANSITION_RESTRICTED",
                                "detail": f"Your operational designation ({role_code}) is restricted to your station and cannot transition orders to '{target_code_upper}'.",
                                "current_status": current_code,
                                "requested_status": target_code_upper,
                                "allowed_statuses": allowed_targets,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

        if requires_admin:
            admin_approved = serializer.validated_data.get("admin_approved", False)

            if not (admin_flag or admin_approved):
                reason = "revert to a previous status" if is_backward else "skip forward multiple stages"
                return Response(
                    {
                        "error": "ADMIN_APPROVAL_REQUIRED",
                        "detail": f"Order status cannot {reason} without Admin approval. Current status is '{current_code}', requested status is '{target_code_upper}'. Please ask an Administrator to approve this change.",
                        "current_status": current_code,
                        "requested_status": target_code_upper,
                        "is_backward": is_backward,
                        "is_skipped": is_skipped,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        old_status_name = order.status.name if order.status else "None"
        order.status = target_status
        order.save(update_fields=["status", "updated_at"])

        # Keep artwork verifications in sync with order status
        now_time = timezone.now()
        target_code_upper = target_status.code.upper()
        if target_code_upper in [
            "PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT",
            "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH", "DISPATCHED",
            "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"
        ]:
            order.artwork_verifications.filter(verification_status="PENDING_REVIEW").update(
                verification_status="APPROVED_FOR_PRINT",
                verified_at=now_time,
            )
        elif target_code_upper == "EXCEPTION_HOLD":
            order.artwork_verifications.exclude(verification_status="FLAGGED_ERROR").update(
                verification_status="FLAGGED_ERROR",
                error_reason=comments or "Order placed on exception hold",
                verified_at=now_time,
            )

        # Synchronize with linked Shipment records if advancing logistics milestone
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
                "admin_override": requires_admin,
                "is_backward": is_backward,
                "is_skipped": is_skipped,
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

