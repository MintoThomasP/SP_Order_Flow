from rest_framework import serializers
from apps.finance.models import DynamicPricingMatrix, PeechoInvoice, InvoiceLineItem


class DynamicPricingMatrixSerializer(serializers.ModelSerializer):
    product_type_display = serializers.CharField(source="get_product_type_display", read_only=True)
    binding_type_display = serializers.CharField(source="get_binding_type_display", read_only=True)

    class Meta:
        model = DynamicPricingMatrix
        fields = [
            "id",
            "product_type",
            "product_type_display",
            "binding_type",
            "binding_type_display",
            "paper_stock_name",
            "paper_stock_gsm",
            "base_fee",
            "rate_per_sheet",
            "binding_cost",
            "lamination_cost",
            "foil_stamp_cost",
            "tier_1_50_multiplier",
            "tier_51_200_multiplier",
            "tier_201_500_multiplier",
            "tier_500_plus_multiplier",
            "currency",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]


class QuoteCalculationRequestSerializer(serializers.Serializer):
    product_type = serializers.CharField(required=False, default="PAPERBACK_BOOK")
    page_count = serializers.IntegerField(required=False, default=120)
    paper_gsm = serializers.IntegerField(required=False, default=130)
    binding_type = serializers.CharField(required=False, default="PUR_PERFECT_BOUND")
    quantity = serializers.IntegerField(required=False, default=1)
    has_lamination = serializers.BooleanField(required=False, default=True)
    has_foil = serializers.BooleanField(required=False, default=False)
    currency = serializers.CharField(required=False, default="EUR")


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = [
            "id",
            "order",
            "order_number",
            "peecho_order_id",
            "product_description",
            "page_count",
            "quantity",
            "unit_price",
            "shipping_cost",
            "line_total",
        ]


class PeechoInvoiceSerializer(serializers.ModelSerializer):
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = PeechoInvoice
        fields = [
            "id",
            "invoice_number",
            "billing_period",
            "client_name",
            "client_tax_id",
            "client_email",
            "client_address",
            "subtotal_amount",
            "tax_rate_percent",
            "tax_amount",
            "shipping_total",
            "discount_total",
            "grand_total",
            "currency",
            "status",
            "invoice_pdf_url",
            "soa_pdf_url",
            "orders_count",
            "issued_at",
            "due_date",
            "paid_at",
            "payment_reference",
            "created_by_name",
            "notes",
            "line_items",
            "created_at",
            "updated_at",
        ]


class GenerateInvoiceRequestSerializer(serializers.Serializer):
    billing_period = serializers.CharField(required=False, default="September 2026 / W39")
    client_name = serializers.CharField(required=False, default="Peecho B.V.")
    client_tax_id = serializers.CharField(required=False, default="NL852093812B01")
    client_email = serializers.EmailField(required=False, default="finance@peecho.com")
    client_address = serializers.CharField(required=False, default="Keizersgracht 421, 1016 EK Amsterdam, Netherlands")
    order_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="List of Order UUIDs or Order Numbers to consolidate. If empty, pulls all unbilled completed orders.",
    )
    tax_rate_percent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=21.00)
    currency = serializers.CharField(required=False, default="EUR")
    notes = serializers.CharField(required=False, allow_blank=True)


class MarkInvoicePaidSerializer(serializers.Serializer):
    payment_reference = serializers.CharField(required=True)
    paid_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
