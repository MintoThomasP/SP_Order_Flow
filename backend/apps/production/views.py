"""
Views for Production Batching, Shopfloor Scheduling, and Printable QR Job Tickets.
"""
from django.utils import timezone
from django.http import HttpResponse, FileResponse
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.production.models import ProductionBatch, PrintMachine, BindingMethod
from apps.production.serializers import (
    ProductionBatchSerializer,
    CreateProductionBatchSerializer,
    PrintMachineSerializer,
    BindingMethodSerializer,
)
from apps.production.services.job_ticket import generate_job_ticket_pdf
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from apps.core.models.lookups import EntityStatus
from apps.authentication.services.audit import log_staff_action


class ProductionBatchViewSet(viewsets.ModelViewSet):
    """
    Production Batching ViewSet.
    Compiles verified orders by paper stock/binding, schedules digital presses, and generates QR Job Tickets.
    """
    queryset = ProductionBatch.objects.select_related("status", "assigned_operator").prefetch_related("orders__items", "orders__status").all()
    serializer_class = ProductionBatchSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "batch_number",
        "paper_stock",
        "size_format",
        "target_press",
        "orders__order_number",
        "orders__peecho_order_id",
        "orders__customer_name",
    ]
    ordering_fields = ["created_at", "total_orders_count", "priority"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = ProductionBatch.objects.select_related("status", "assigned_operator").prefetch_related("orders__items", "orders__status").all()
        target_press = self.request.query_params.get("target_press")
        status_param = self.request.query_params.get("status")
        if target_press and target_press != "ALL":
            qs = qs.filter(target_press=target_press)
        if status_param and status_param != "ALL":
            qs = qs.filter(status__code=status_param)

        ordering_param = self.request.query_params.get("ordering")
        if ordering_param:
            fields = [f.strip() for f in ordering_param.split(",") if f.strip()]
            return qs.distinct().order_by(*fields)
        return qs.distinct().order_by("-created_at")

    def create(self, request, *args, **kwargs):
        """
        POST /api/v1/production/batches/
        Compiles a new ProductionBatch from selected order IDs and automatically builds the Job Ticket.
        """
        serializer = CreateProductionBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        order_ids = data["order_ids"]
        orders_qs = Order.objects.filter(id__in=order_ids).prefetch_related("items")

        if not orders_qs.exists():
            return Response({"error": "No matching orders found for provided IDs."}, status=status.HTTP_400_BAD_REQUEST)

        # Generate unique batch number
        batch_count = ProductionBatch.objects.count() + 101
        batch_number = f"BATCH-2026-{batch_count}"

        # Calculate totals
        total_orders = orders_qs.count()
        total_items = sum(o.total_items_count for o in orders_qs)
        
        # Calculate total sheet passes (assuming 2 pages per side of sheet = 4 pages per sheet)
        total_sheets = sum(
            sum(max(item.page_count // 4, 1) * item.quantity for item in o.items.all())
            for o in orders_qs
        )

        # Resolve initial status (PRINT_JOB: QUEUED_PRESS or ORDER: IN_PRODUCTION)
        queued_status = EntityStatus.objects.filter(entity_type="PRINT_JOB", code="QUEUED_PRESS").first()
        if not queued_status:
            queued_status = EntityStatus.objects.filter(entity_type="ORDER", code="IN_PRODUCTION").first()

        batch = ProductionBatch.objects.create(
            batch_number=batch_number,
            paper_stock=data.get("paper_stock", "200gsm Silk Inner + 350gsm Hardcover Gloss"),
            size_format=data.get("size_format", "A4 Landscape (210 x 297 mm)"),
            binding_type=data.get("binding_type", "HARDCOVER_CASEBOUND"),
            target_press=data.get("target_press", "HP_INDIGO_12000"),
            status=queued_status,
            total_orders_count=total_orders,
            total_items_count=total_items,
            total_sheets_count=max(total_sheets, 12),
            priority=data.get("priority", "STANDARD"),
            assigned_operator=request.user if request.user.is_authenticated else None,
            notes=data.get("notes", ""),
        )

        batch.orders.set(orders_qs)

        # Transition orders to IN_PRODUCTION
        in_prod_status = EntityStatus.objects.filter(entity_type="ORDER", code="IN_PRODUCTION").first()
        if in_prod_status:
            for ord_obj in orders_qs:
                ord_obj.status = in_prod_status
                ord_obj.save(update_fields=["status", "updated_at"])

        # Generate ReportLab Job Ticket PDF
        ticket_res = generate_job_ticket_pdf(batch)
        batch.job_ticket_pdf_url = ticket_res.get("relative_url", "")
        batch.save(update_fields=["job_ticket_pdf_url"])

        # Staff Audit Log
        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="STATUS_CHANGE",
            resource_type="BATCH",
            resource_id=batch.batch_number,
            details={
                "batch_number": batch.batch_number,
                "target_press": batch.target_press,
                "orders_count": total_orders,
                "sheets_count": batch.total_sheets_count,
                "job_ticket_url": batch.job_ticket_pdf_url,
            },
            request=request,
        )

        return Response(
            ProductionBatchSerializer(batch).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="generate-ticket")
    def generate_ticket(self, request, pk=None):
        """
        POST /api/v1/production/batches/{id}/generate-ticket/
        Regenerates ReportLab Job Ticket PDF.
        """
        batch = self.get_object()
        ticket_res = generate_job_ticket_pdf(batch)
        batch.job_ticket_pdf_url = ticket_res.get("relative_url", "")
        batch.save(update_fields=["job_ticket_pdf_url"])

        return Response({
            "detail": f"Generated Job Ticket for {batch.batch_number}",
            "job_ticket_pdf_url": batch.job_ticket_pdf_url,
        })

    @action(detail=True, methods=["get"], url_path="download-ticket")
    def download_ticket(self, request, pk=None):
        """
        GET /api/v1/production/batches/{id}/download-ticket/
        Streams the binary PDF Job Ticket with QR codes directly to the browser.
        """
        batch = self.get_object()
        ticket_res = generate_job_ticket_pdf(batch)
        
        response = HttpResponse(ticket_res["pdf_bytes"], content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{batch.batch_number}_job_ticket.pdf"'
        return response

    @action(detail=True, methods=["post"], url_path="status")
    def update_batch_status(self, request, pk=None):
        """
        POST /api/v1/production/batches/{id}/status/
        Updates batch shopfloor progress (e.g. PRINTING, COMPLETED).
        """
        batch = self.get_object()
        status_code = request.data.get("status_code", "PRINTING")
        
        target_status = EntityStatus.objects.filter(code=status_code).first()
        if target_status:
            batch.status = target_status

        if status_code == "PRINTING":
            if not batch.started_at:
                batch.started_at = timezone.now()
            order_st = EntityStatus.objects.filter(entity_type="ORDER", code="PRINTING").first() or \
                       EntityStatus.objects.filter(entity_type="ORDER", code="IN_PRODUCTION").first()
            if order_st:
                from apps.orders.services.peecho_sync import sync_order_status_to_peecho
                for ord_obj in batch.orders.all():
                    ord_obj.status = order_st
                    ord_obj.save(update_fields=["status", "updated_at"])
                    sync_order_status_to_peecho(
                        order=ord_obj,
                        status_code=order_st.code,
                        notes=f"Batch {batch.batch_number} started printing on press.",
                        operator=request.user if request.user.is_authenticated else None,
                    )
        elif status_code == "COMPLETED":
            batch.completed_at = timezone.now()
            # Transition bundled orders to PRODUCTION_COMPLETED or QUALITY_AUDIT
            packed_status = EntityStatus.objects.filter(entity_type="ORDER", code="PRODUCTION_COMPLETED").first() or \
                            EntityStatus.objects.filter(entity_type="ORDER", code="QUALITY_AUDIT").first()
            if packed_status:
                from apps.orders.services.peecho_sync import sync_order_status_to_peecho
                for ord_obj in batch.orders.all():
                    ord_obj.status = packed_status
                    ord_obj.save(update_fields=["status", "updated_at"])
                    sync_order_status_to_peecho(
                        order=ord_obj,
                        status_code=packed_status.code,
                        notes=f"Batch {batch.batch_number} completed production run.",
                        operator=request.user if request.user.is_authenticated else None,
                    )

        batch.save()

        # Audit log
        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="STATUS_CHANGE",
            resource_type="BATCH",
            resource_id=batch.batch_number,
            details={"new_status": status_code},
            request=request,
        )

        return Response(ProductionBatchSerializer(batch).data)

    @action(detail=False, methods=["get"], url_path="eligible-orders")
    def eligible_orders(self, request):
        """
        GET /api/v1/production/batches/eligible-orders/
        Returns verified orders ready to be grouped into production batches (excluding orders already assigned to a batch).
        """
        orders = Order.objects.filter(
            status__code__in=["PREPRESS_PASSED", "PREPRESS_QUEUED", "RECEIVED"]
        ).exclude(
            production_batches__isnull=False
        ).prefetch_related("items", "status")
        return Response(OrderSerializer(orders, many=True).data)

    @action(detail=False, methods=["get"], url_path="batched-orders")
    def batched_orders(self, request):
        """
        GET /api/v1/production/batches/batched-orders/
        Returns a flat list of all orders assigned to production batches,
        with complete batch metadata for immediate lookup.
        """
        batches = ProductionBatch.objects.select_related("status", "assigned_operator").prefetch_related("orders__items", "orders__status").all()
        search = request.query_params.get("search", "").strip().lower()
        
        results = []
        for b in batches:
            for ord_obj in b.orders.all():
                if search:
                    match = (
                        search in (ord_obj.order_number or "").lower()
                        or search in (ord_obj.peecho_order_id or "").lower()
                        or search in (ord_obj.customer_name or "").lower()
                        or search in (b.batch_number or "").lower()
                    )
                    if not match:
                        continue
                
                ord_data = OrderSerializer(ord_obj).data
                ord_data["batch"] = {
                    "id": str(b.id),
                    "batch_number": b.batch_number,
                    "target_press": b.target_press,
                    "press_label": b.get_target_press_display(),
                    "paper_stock": b.paper_stock,
                    "size_format": b.size_format,
                    "binding_type": b.binding_type,
                    "binding_label": b.get_binding_type_display(),
                    "status": b.status.code if b.status else None,
                    "status_name": b.status.name if b.status else None,
                    "status_color": b.status.badge_color if b.status else "slate",
                    "badge_bg": b.status.badge_bg if b.status else "#F1F5F9",
                    "badge_text": b.status.badge_text if b.status else "#475569",
                    "total_sheets_count": b.total_sheets_count,
                    "created_at": b.created_at,
                    "job_ticket_pdf_url": b.job_ticket_pdf_url,
                }
                results.append(ord_data)
        return Response(results)


class PrintMachineViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Target Print Machines.
    Supports listing, adding, editing, and deleting print machines.
    """
    queryset = PrintMachine.objects.all().order_by("name")
    serializer_class = PrintMachineSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "description", "sheet_format"]
    ordering_fields = ["name", "code", "created_at", "is_active", "sheet_format", "max_speed_cph"]
    ordering = ["name"]

    def paginate_queryset(self, queryset):
        if self.request.query_params.get("all") == "true":
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        qs = PrintMachine.objects.all()
        active_only = self.request.query_params.get("active_only") or self.request.query_params.get("is_active")
        if active_only is not None and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        elif active_only is not None and active_only.lower() in ("false", "0"):
            qs = qs.filter(is_active=False)
        return qs.order_by("name")


class BindingMethodViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Binding Methods.
    Supports listing, adding, editing, and deleting binding methods.
    """
    queryset = BindingMethod.objects.all().order_by("name")
    serializer_class = BindingMethodSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "description"]
    ordering_fields = ["name", "code", "created_at", "is_active", "min_pages", "max_pages"]
    ordering = ["name"]

    def paginate_queryset(self, queryset):
        if self.request.query_params.get("all") == "true":
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        qs = BindingMethod.objects.all()
        active_only = self.request.query_params.get("active_only") or self.request.query_params.get("is_active")
        if active_only is not None and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        elif active_only is not None and active_only.lower() in ("false", "0"):
            qs = qs.filter(is_active=False)
        return qs.order_by("name")

