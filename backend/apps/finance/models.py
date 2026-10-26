from django.db import models
from django.conf import settings
from apps.core.models.base import BaseModel
from apps.orders.models import Order


class DynamicPricingMatrix(BaseModel):
    """
    Dynamic Cost & Pricing Matrix Rule Model.
    Configures base unit costs, paper sheet rates based on GSM, binding add-ons,
    and automated quantity tier discount multipliers for Peecho POD manufacturing.
    """
    PRODUCT_TYPE_CHOICES = [
        ("HARDCOVER_BOOK", "Hardcover Case-Bound Book"),
        ("PAPERBACK_BOOK", "Softcover PUR Perfect Bound"),
        ("SADDLE_STITCH_BOOKLET", "Saddle-Stitched Magazine/Booklet"),
        ("WIRE_O_CALENDAR", "Wire-O Wall & Desk Calendar"),
        ("CANVAS_PRINT", "Framed Canvas Art Print"),
        ("FLYER_BROCHURE", "Tri-Fold / Flat Marketing Sheet"),
    ]

    BINDING_CHOICES = [
        ("PUR_PERFECT_BOUND", "PUR Adhesive Softcover"),
        ("CASE_BOUND_HARDCOVER", "Case-Bound Rigid Board"),
        ("SADDLE_STITCH", "Dual Wire Saddle Stitch"),
        ("WIRE_O", "Twin-Loop Wire-O"),
        ("NONE_FLAT", "Flat Cut / Unbound"),
    ]

    product_type = models.CharField(max_length=60, choices=PRODUCT_TYPE_CHOICES, default="PAPERBACK_BOOK")
    binding_type = models.CharField(max_length=60, choices=BINDING_CHOICES, default="PUR_PERFECT_BOUND")
    
    paper_stock_name = models.CharField(max_length=100, default="130 GSM Silk Interior")
    paper_stock_gsm = models.IntegerField(default=130, help_text="Paper weight in Grams per Square Meter (GSM)")
    
    # Unit Cost Components
    base_fee = models.DecimalField(max_digits=10, decimal_places=4, default=3.5000, help_text="Base machine setup & cover processing fee per unit")
    rate_per_sheet = models.DecimalField(max_digits=10, decimal_places=4, default=0.0350, help_text="Printing & paper cost per 2-page sheet pass")
    binding_cost = models.DecimalField(max_digits=10, decimal_places=4, default=2.2500, help_text="Bindery machine adhesive/casing cost")
    
    # Finishing Add-ons
    lamination_cost = models.DecimalField(max_digits=10, decimal_places=4, default=0.7500, help_text="Thermal Matte/Gloss cover film cost")
    foil_stamp_cost = models.DecimalField(max_digits=10, decimal_places=4, default=1.5000, help_text="Metallic foil hot-stamp embossing cost")
    
    # Quantity Tier Multipliers (Discount Curves)
    tier_1_50_multiplier = models.DecimalField(max_digits=6, decimal_places=4, default=1.0000)
    tier_51_200_multiplier = models.DecimalField(max_digits=6, decimal_places=4, default=0.9000, help_text="10% volume discount for 51-200 units")
    tier_201_500_multiplier = models.DecimalField(max_digits=6, decimal_places=4, default=0.8200, help_text="18% volume discount for 201-500 units")
    tier_500_plus_multiplier = models.DecimalField(max_digits=6, decimal_places=4, default=0.7500, help_text="25% volume discount for 500+ units")
    
    currency = models.CharField(max_length=10, default="EUR")
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["product_type", "paper_stock_gsm"]
        verbose_name = "Dynamic Pricing Matrix"
        verbose_name_plural = "Dynamic Pricing Matrices"

    def __str__(self):
        return f"{self.get_product_type_display()} - {self.paper_stock_gsm} GSM ({self.currency})"


class PeechoInvoice(BaseModel):
    """
    Consolidated B2B Tax Invoice & Statement of Account (SOA) Model.
    Aggregates completed POD orders for periodic Peecho settlement.
    """
    STATUS_CHOICES = [
        ("DRAFT", "Draft"),
        ("ISSUED", "Issued & Pending Payment"),
        ("PAID", "Paid & Reconciled"),
        ("OVERDUE", "Overdue"),
        ("CANCELLED", "Void / Cancelled"),
    ]

    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    billing_period = models.CharField(max_length=100, default="Current Billing Cycle")
    
    # Client Legal Entity (Peecho B.V.)
    client_name = models.CharField(max_length=200, default="Peecho B.V.")
    client_tax_id = models.CharField(max_length=100, default="NL852093812B01")
    client_email = models.EmailField(default="finance@peecho.com")
    client_address = models.TextField(default="Keizersgracht 421, 1016 EK Amsterdam, Netherlands")
    
    # Financial Totals
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=21.00, help_text="Standard EU VAT rate (21%)")
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    shipping_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default="EUR")
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="ISSUED")
    
    # Documents
    invoice_pdf_url = models.CharField(max_length=500, blank=True, null=True)
    soa_pdf_url = models.CharField(max_length=500, blank=True, null=True)
    
    # Settlement & Audit
    orders_count = models.IntegerField(default=0)
    orders = models.ManyToManyField(Order, related_name="invoices", blank=True)
    
    issued_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=150, blank=True)
    
    created_by_name = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Peecho Invoice"
        verbose_name_plural = "Peecho Invoices"

    def __str__(self):
        return f"{self.invoice_number} - {self.client_name} ({self.grand_total} {self.currency})"


class InvoiceLineItem(BaseModel):
    """
    Individual Order line items on a Peecho Tax Invoice.
    """
    invoice = models.ForeignKey(PeechoInvoice, on_delete=models.CASCADE, related_name="line_items")
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoice_line_items")
    order_number = models.CharField(max_length=100)
    peecho_order_id = models.CharField(max_length=100)
    product_description = models.CharField(max_length=255)
    page_count = models.IntegerField(default=100)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        ordering = ["order_number"]

    def __str__(self):
        return f"{self.order_number}: {self.product_description} ({self.line_total})"
