"""
Global Unified Search API View.
Searches Orders, Shipments, Staff members, Production Batches, and System Navigation.
"""
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from apps.orders.models import Order
from apps.orders.permissions import is_status_accessible_for_role, get_user_role_code
from apps.dispatch.models import Shipment
from apps.authentication.models import User
from apps.production.models import ProductionBatch


MODULE_NAVIGATION = [
    {"name": "Overview & Live Metrics", "link": "/overview", "keywords": ["overview", "dashboard", "home", "metrics", "kpi"]},
    {"name": "POD Orders Command Center", "link": "/orders", "keywords": ["order", "orders", "list", "customer", "pod"]},
    {"name": "Prepress Automated Gate", "link": "/prepress", "keywords": ["prepress", "artwork", "pdf", "preflight", "check"]},
    {"name": "Production Batching", "link": "/production/batching", "keywords": ["batch", "batching", "imposition", "press"]},
    {"name": "Print Production Floor", "link": "/production", "keywords": ["production", "print", "printing", "hp indigo", "canon"]},
    {"name": "Shopfloor Barcode Stations", "link": "/shopfloor", "keywords": ["shopfloor", "scan", "barcode", "station", "tablet"]},
    {"name": "Dispatch & Logistics Manifests", "link": "/dispatch", "keywords": ["dispatch", "ship", "shipping", "tracking", "awb", "dhl", "fedex"]},
    {"name": "Finance & Production Billing", "link": "/finance", "keywords": ["finance", "billing", "invoice", "cost", "revenue", "rate"]},
    {"name": "Staff & Role Management", "link": "/staff", "keywords": ["staff", "users", "employee", "team", "roles", "permissions"]},
    {"name": "Peecho Webhooks & Logs", "link": "/peecho", "keywords": ["peecho", "webhook", "integration", "api", "events"]},
]


class GlobalSearchView(APIView):
    """
    GET /api/v1/core/search/?q=<term>&limit=5
    High-performance unified cross-module search with role access verification.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        limit = min(int(request.query_params.get("limit", 5)), 15)
        user_role = get_user_role_code(request)

        if not query or len(query) < 1:
            return Response({
                "query": query,
                "total": 0,
                "orders": [],
                "shipments": [],
                "staff": [],
                "batches": [],
                "navigation": [],
            })

        q_lower = query.lower()

        # 1. Navigation / Quick Module suggestions
        matched_nav = []
        for nav in MODULE_NAVIGATION:
            if any(k in q_lower or q_lower in k for k in nav["keywords"]):
                matched_nav.append({
                    "name": nav["name"],
                    "link": nav["link"],
                    "type": "MODULE",
                })
        matched_nav = matched_nav[:3]

        # 2. Search POD Orders
        orders_qs = (
            Order.objects.filter(
                Q(order_number__icontains=query)
                | Q(peecho_order_id__icontains=query)
                | Q(external_pod_order_id__icontains=query)
                | Q(customer_name__icontains=query)
                | Q(customer_email__icontains=query)
                | Q(tracking_number__icontains=query)
                | Q(shipping_address__icontains=query)
            )
            .select_related("status")
            .order_by("-created_at")[:limit]
        )

        orders = []
        for o in orders_qs:
            status_code = o.status.code if o.status else ""
            has_access = is_status_accessible_for_role(user_role, status_code)
            orders.append({
                "id": str(o.id),
                "order_number": o.order_number,
                "peecho_order_id": o.peecho_order_id,
                "customer_name": o.customer_name or "Anonymous",
                "customer_email": o.customer_email or "",
                "status_code": status_code,
                "status_name": o.status.name if o.status else "Unassigned",
                "total_amount": float(o.total_amount) if o.total_amount else 0.0,
                "currency": o.currency or "USD",
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "link": f"/orders?search={o.order_number}",
                "has_access": has_access,
                "access_message": "Access granted." if has_access else "You have no access to this job / this order",
            })

        # 3. Search Logistics Shipments & Waybills
        shipments_qs = (
            Shipment.objects.filter(
                Q(tracking_number__icontains=query)
                | Q(carrier_name__icontains=query)
                | Q(order__order_number__icontains=query)
                | Q(order__peecho_order_id__icontains=query)
            )
            .select_related("order", "status")
            .order_by("-created_at")[:limit]
        )

        shipments = [
            {
                "id": str(s.id),
                "tracking_number": s.tracking_number,
                "order_number": s.order.order_number if s.order else "",
                "carrier_name": s.carrier_name,
                "status_code": s.status.code if s.status else s.carrier_code,
                "status_name": s.status.name if s.status else s.carrier_name,
                "link": f"/dispatch?search={s.tracking_number}",
            }
            for s in shipments_qs
        ]

        # 4. Search Staff & Operators
        staff_qs = (
            User.objects.filter(
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(email__icontains=query)
                | Q(employee_id__icontains=query)
                | Q(department__icontains=query)
            )
            .select_related("role")
            .order_by("first_name")[:limit]
        )

        staff = [
            {
                "id": str(u.id),
                "name": f"{u.first_name} {u.last_name}".strip() or u.username or u.email,
                "email": u.email,
                "employee_id": u.employee_id or "",
                "role_name": u.role.name if u.role else "Staff",
                "department": u.department or "",
                "link": f"/staff?search={u.employee_id or u.first_name or u.email}",
            }
            for u in staff_qs
        ]

        # 5. Search Production Batches
        batches_qs = (
            ProductionBatch.objects.filter(
                Q(batch_number__icontains=query)
                | Q(paper_stock__icontains=query)
                | Q(size_format__icontains=query)
            )
            .order_by("-created_at")[:limit]
        )

        batches = [
            {
                "id": str(b.id),
                "batch_number": b.batch_number,
                "paper_stock": b.paper_stock,
                "size_format": b.size_format,
                "link": f"/production?batch={b.batch_number}",
            }
            for b in batches_qs
        ]

        total = len(orders) + len(shipments) + len(staff) + len(batches) + len(matched_nav)

        return Response({
            "query": query,
            "total": total,
            "orders": orders,
            "shipments": shipments,
            "staff": staff,
            "batches": batches,
            "navigation": matched_nav,
        })
