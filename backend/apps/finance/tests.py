from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models.lookups import EntityStatus, SystemRole
from apps.authentication.models import User
from apps.orders.models import Order
from apps.finance.models import DynamicPricingMatrix, PeechoInvoice, InvoiceLineItem
from apps.finance.services.pricing import calculate_pod_quote


class FinanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.role = SystemRole.objects.create(
            code="FINANCE_SPECIALIST",
            name="Finance Specialist",
            description="Specialist handling invoicing and billing",
        )
        self.user = User.objects.create_user(
            email="finance@silverpointpod.com",
            password="Password123!",
            first_name="Alexander",
            last_name="Vance",
            role=self.role,
        )

        self.pricing_rule = DynamicPricingMatrix.objects.create(
            product_type="PAPERBACK_BOOK",
            binding_type="PUR_PERFECT_BOUND",
            paper_stock_gsm=130,
            base_fee=Decimal("3.5000"),
            rate_per_sheet=Decimal("0.0350"),
            binding_cost=Decimal("2.2500"),
            lamination_cost=Decimal("0.7500"),
            tier_1_50_multiplier=Decimal("1.0000"),
            tier_51_200_multiplier=Decimal("0.9000"),
            currency="EUR",
        )

        self.order1 = Order.objects.create(
            order_number="SP-2026-11001",
            peecho_order_id="PEECHO-9901",
            customer_name="Artisanal Press Inc",
            customer_email="buyer@artisanal.io",
            sla_deadline=timezone.now() + timedelta(hours=24),
            total_amount=Decimal("18.50"),
            total_items_count=1,
        )
        self.order2 = Order.objects.create(
            order_number="SP-2026-11002",
            peecho_order_id="PEECHO-9902",
            customer_name="Nordic Literary",
            customer_email="buyer@nordic.io",
            sla_deadline=timezone.now() + timedelta(hours=24),
            total_amount=Decimal("24.00"),
            total_items_count=2,
        )

    def test_pricing_calculation_engine(self):
        # 120 pages = 60 sheets * 0.035 = 2.10
        # Base 3.50 + Print 2.10 + Binding 2.25 + Lam 0.75 = 8.60 unit
        quote = calculate_pod_quote(
            product_type="PAPERBACK_BOOK",
            page_count=120,
            paper_gsm=130,
            binding_type="PUR_PERFECT_BOUND",
            quantity=10,
            has_lamination=True,
            has_foil=False,
            currency="EUR",
        )

        self.assertTrue(quote["success"])
        self.assertEqual(quote["cost_breakdown"]["raw_unit_price"], 8.60)
        self.assertEqual(quote["financial_summary"]["subtotal"], 86.00)
        self.assertGreater(quote["financial_summary"]["grand_total"], 86.00)

    def test_calculate_quote_api_endpoint(self):
        response = self.client.post(
            "/api/v1/finance/calculate-quote/",
            data={
                "product_type": "PAPERBACK_BOOK",
                "page_count": 120,
                "paper_gsm": 130,
                "quantity": 100,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        # Tier 51-200 gives 10% discount
        self.assertEqual(response.data["tier_discount_percent"], 10.0)

    def test_generate_invoice_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/v1/finance/generate-invoice/",
            data={
                "billing_period": "September 2026 / W39",
                "client_name": "Peecho B.V.",
                "order_ids": ["SP-2026-11001", "SP-2026-11002"],
                "tax_rate_percent": "21.00",
                "currency": "EUR",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["invoice"]["orders_count"], 2)

        invoice_id = response.data["invoice"]["id"]
        invoice = PeechoInvoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.line_items.count(), 2)
        self.assertGreater(invoice.grand_total, Decimal("0.00"))

    def test_download_tax_invoice_pdf_stream(self):
        invoice = PeechoInvoice.objects.create(
            invoice_number="INV-2026-TEST",
            subtotal_amount=Decimal("100.00"),
            tax_rate_percent=Decimal("21.00"),
            tax_amount=Decimal("21.00"),
            grand_total=Decimal("121.00"),
            currency="EUR",
        )

        response = self.client.get(f"/api/v1/finance/invoices/{invoice.id}/download-pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_mark_invoice_paid(self):
        invoice = PeechoInvoice.objects.create(
            invoice_number="INV-2026-TEST2",
            subtotal_amount=Decimal("100.00"),
            grand_total=Decimal("121.00"),
            status="ISSUED",
        )

        response = self.client.post(
            f"/api/v1/finance/invoices/{invoice.id}/mark-paid/",
            data={"payment_reference": "WIRE-EUR-9988129"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "PAID")
        self.assertEqual(invoice.payment_reference, "WIRE-EUR-9988129")
