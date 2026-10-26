import uuid
import random
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.http import HttpResponse
from django.db import transaction
from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.orders.models import Order
from apps.authentication.services.audit import log_staff_action
from apps.finance.models import DynamicPricingMatrix, PeechoInvoice, InvoiceLineItem
from apps.finance.serializers import (
    DynamicPricingMatrixSerializer,
    QuoteCalculationRequestSerializer,
    PeechoInvoiceSerializer,
    GenerateInvoiceRequestSerializer,
    MarkInvoicePaidSerializer,
)
from apps.finance.services.pricing import calculate_pod_quote
from apps.finance.services.invoice_generator import generate_tax_invoice_pdf, generate_soa_pdf


class DynamicPricingMatrixViewSet(viewsets.ModelViewSet):
    """
    CRUD API for dynamic POD cost and pricing rules.
    """
    queryset = DynamicPricingMatrix.objects.all()
    serializer_class = DynamicPricingMatrixSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["product_type", "paper_stock_name", "binding_type"]
    ordering_fields = ["paper_stock_gsm", "base_fee", "rate_per_sheet", "created_at"]
    ordering = ["product_type", "paper_stock_gsm"]


class CalculateQuoteView(APIView):
    """
    POST /api/v1/finance/calculate-quote/
    Real-time dynamic pricing simulation API.
    """
    def post(self, request):
        serializer = QuoteCalculationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        quote = calculate_pod_quote(
            product_type=data.get("product_type", "PAPERBACK_BOOK"),
            page_count=data.get("page_count", 120),
            paper_gsm=data.get("paper_gsm", 130),
            binding_type=data.get("binding_type", "PUR_PERFECT_BOUND"),
            quantity=data.get("quantity", 1),
            has_lamination=data.get("has_lamination", True),
            has_foil=data.get("has_foil", False),
            currency=data.get("currency", "EUR"),
        )
        return Response(quote, status=status.HTTP_200_OK)


class GenerateInvoiceView(APIView):
    """
    POST /api/v1/finance/generate-invoice/
    Consolidates completed and dispatched POD orders into an official B2B Tax Invoice.
    """
    def post(self, request):
        serializer = GenerateInvoiceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        order_ids = data.get("order_ids", [])
        if order_ids:
            uuid_list = []
            code_list = []
            for item in order_ids:
                try:
                    uuid.UUID(str(item))
                    uuid_list.append(item)
                except (ValueError, TypeError, AttributeError):
                    code_list.append(str(item))

            query = Order.objects.none()
            if uuid_list:
                query = query | Order.objects.filter(id__in=uuid_list)
            if code_list:
                query = query | Order.objects.filter(order_number__in=code_list) | Order.objects.filter(peecho_order_id__in=code_list)
            orders = query.distinct()
        else:
            # Default: pull all recent orders
            orders = Order.objects.all()[:20]

        if not orders.exists():
            return Response(
                {"success": False, "error": "No valid orders found to generate invoice."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Generate unique invoice sequence
            inv_count = PeechoInvoice.objects.count() + 1
            invoice_num = f"INV-2026-{inv_count:04d}"

            tax_rate = Decimal(str(data.get("tax_rate_percent", 21.00)))

            invoice = PeechoInvoice.objects.create(
                invoice_number=invoice_num,
                billing_period=data.get("billing_period", f"{timezone.now().strftime('%B %Y')} / W{timezone.now().isocalendar()[1]}"),
                client_name=data.get("client_name", "Peecho B.V."),
                client_tax_id=data.get("client_tax_id", "NL852093812B01"),
                client_email=data.get("client_email", "finance@peecho.com"),
                client_address=data.get("client_address", "Keizersgracht 421, 1016 EK Amsterdam, Netherlands"),
                tax_rate_percent=tax_rate,
                currency=data.get("currency", "EUR"),
                status="ISSUED",
                issued_at=timezone.now(),
                due_date=timezone.now() + timedelta(days=30),
                created_by_name=(request.user.get_full_name() or request.user.email) if (request.user and request.user.is_authenticated) else "Finance Specialist",
                notes=data.get("notes", "Consolidated POD Production & Fulfillment Statement."),
            )

            invoice.orders.set(orders)
            invoice.orders_count = orders.count()

            # Aggregate line items
            subtotal = Decimal("0.00")
            shipping_total = Decimal("0.00")

            for ord_obj in orders:
                line_qty = ord_obj.total_items_count or 1
                unit_val = Decimal(str(ord_obj.total_amount or "14.50"))
                line_tot = unit_val * Decimal(str(line_qty))
                ship_cost = Decimal("4.50")

                InvoiceLineItem.objects.create(
                    invoice=invoice,
                    order=ord_obj,
                    order_number=ord_obj.order_number,
                    peecho_order_id=ord_obj.peecho_order_id,
                    product_description=f"POD Book (130 GSM Silk / PUR Adhesive Bound) - {ord_obj.customer_name}",
                    page_count=128,
                    quantity=line_qty,
                    unit_price=unit_val,
                    shipping_cost=ship_cost,
                    line_total=line_tot,
                )

                subtotal += line_tot
                shipping_total += ship_cost

            tax_amount = (subtotal * (tax_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            grand_total = subtotal + tax_amount + shipping_total

            invoice.subtotal_amount = subtotal
            invoice.tax_amount = tax_amount
            invoice.shipping_total = shipping_total
            invoice.grand_total = grand_total
            invoice.invoice_pdf_url = f"/api/v1/finance/invoices/{invoice.id}/download-pdf/"
            invoice.soa_pdf_url = f"/api/v1/finance/invoices/{invoice.id}/download-soa/"
            invoice.save()

            log_staff_action(
                user=request.user if (request.user and request.user.is_authenticated) else None,
                action="GENERATE_INVOICE",
                resource_type="INVOICE",
                resource_id=invoice.invoice_number,
                details={
                    "orders_billed": invoice.orders_count,
                    "grand_total": str(grand_total),
                    "currency": invoice.currency,
                },
            )

        return Response(
            {
                "success": True,
                "message": f"Tax Invoice {invoice.invoice_number} successfully compiled for Peecho B.V.",
                "invoice": PeechoInvoiceSerializer(invoice).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PeechoInvoiceViewSet(viewsets.ModelViewSet):
    """
    CRUD and actions for Peecho Invoices & Statement of Accounts.
    """
    queryset = PeechoInvoice.objects.prefetch_related("orders", "line_items").all()
    serializer_class = PeechoInvoiceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["invoice_number", "billing_period", "client_name", "status"]
    ordering_fields = ["created_at", "grand_total", "due_date", "issued_at"]
    ordering = ["-created_at"]

    @action(detail=True, methods=["get"], url_path="download-pdf")
    def download_pdf(self, request, pk=None):
        """
        GET /api/v1/finance/invoices/{id}/download-pdf/
        Streams binary Tax Invoice PDF.
        """
        invoice = self.get_object()
        pdf_bytes = generate_tax_invoice_pdf(invoice)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="SilverPoint_Invoice_{invoice.invoice_number}.pdf"'
        return response

    @action(detail=True, methods=["get"], url_path="download-soa")
    def download_soa(self, request, pk=None):
        """
        GET /api/v1/finance/invoices/{id}/download-soa/
        Streams Statement of Account (SOA) PDF.
        """
        invoice = self.get_object()
        pdf_bytes = generate_soa_pdf(invoice)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="SilverPoint_SOA_{invoice.invoice_number}.pdf"'
        return response

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        """
        POST /api/v1/finance/invoices/{id}/mark-paid/
        Records payment reference and settles invoice balance.
        """
        invoice = self.get_object()
        serializer = MarkInvoicePaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invoice.status = "PAID"
        invoice.payment_reference = data["payment_reference"]
        invoice.paid_at = data.get("paid_at") or timezone.now()
        if data.get("notes"):
            invoice.notes = f"{invoice.notes}\nSettlement: {data['notes']}".strip()
        invoice.save(update_fields=["status", "payment_reference", "paid_at", "notes", "updated_at"])

        log_staff_action(
            user=request.user if (request.user and request.user.is_authenticated) else None,
            action="MARK_INVOICE_PAID",
            resource_type="INVOICE",
            resource_id=invoice.invoice_number,
            details={
                "payment_reference": invoice.payment_reference,
                "grand_total": str(invoice.grand_total),
            },
        )

        return Response({
            "success": True,
            "message": f"Invoice {invoice.invoice_number} marked as Paid.",
            "invoice": PeechoInvoiceSerializer(invoice).data,
        }, status=status.HTTP_200_OK)
