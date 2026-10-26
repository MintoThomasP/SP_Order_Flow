import math
from decimal import Decimal, ROUND_HALF_UP
from apps.finance.models import DynamicPricingMatrix


def calculate_pod_quote(
    product_type: str = "PAPERBACK_BOOK",
    page_count: int = 120,
    paper_gsm: int = 130,
    binding_type: str = "PUR_PERFECT_BOUND",
    quantity: int = 1,
    has_lamination: bool = True,
    has_foil: bool = False,
    currency: str = "EUR",
) -> dict:
    """
    Real-time dynamic price calculation engine for Silver Point POD & Peecho orders.
    Calculates cost breakdown: base fee + (pages / 2 * paper rate) + binding + finishing * volume tier.
    """
    rule = DynamicPricingMatrix.objects.filter(
        product_type=product_type,
        binding_type=binding_type,
        paper_stock_gsm=paper_gsm,
    ).first()

    if not rule:
        # Fallback closest match by product type
        rule = DynamicPricingMatrix.objects.filter(product_type=product_type).first()

    # Defaults if no rule in DB
    base_fee = rule.base_fee if rule else Decimal("3.5000")
    rate_per_sheet = rule.rate_per_sheet if rule else Decimal("0.0350")
    binding_cost = rule.binding_cost if rule else Decimal("2.2500")
    lamination_cost = rule.lamination_cost if rule else Decimal("0.7500")
    foil_stamp_cost = rule.foil_stamp_cost if rule else Decimal("1.5000")

    sheets_count = math.ceil(max(page_count, 2) / 2)
    interior_print_cost = Decimal(str(sheets_count)) * rate_per_sheet

    finishing_cost = Decimal("0.0000")
    if has_lamination:
        finishing_cost += lamination_cost
    if has_foil:
        finishing_cost += foil_stamp_cost

    raw_unit_price = base_fee + interior_print_cost + binding_cost + finishing_cost

    # Tier Multiplier
    if quantity <= 50:
        multiplier = rule.tier_1_50_multiplier if rule else Decimal("1.0000")
        tier_label = "1 - 50 Units (Standard Rate)"
    elif quantity <= 200:
        multiplier = rule.tier_51_200_multiplier if rule else Decimal("0.9000")
        tier_label = "51 - 200 Units (10% Tier Discount)"
    elif quantity <= 500:
        multiplier = rule.tier_201_500_multiplier if rule else Decimal("0.8200")
        tier_label = "201 - 500 Units (18% Volume Discount)"
    else:
        multiplier = rule.tier_500_plus_multiplier if rule else Decimal("0.7500")
        tier_label = "500+ Units (25% Bulk Discount)"

    unit_price = (raw_unit_price * multiplier).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    subtotal = (unit_price * Decimal(str(quantity))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Tax & Shipping
    vat_rate = Decimal("0.21")
    vat_amount = (subtotal * vat_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Shipping tiered estimate
    base_shipping = Decimal("6.50")
    incremental_shipping = Decimal(str(max(quantity - 1, 0))) * Decimal("0.85")
    estimated_shipping = (base_shipping + incremental_shipping).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    grand_total = subtotal + vat_amount + estimated_shipping

    return {
        "success": True,
        "product_type": product_type,
        "binding_type": binding_type,
        "page_count": page_count,
        "sheets_count": sheets_count,
        "paper_gsm": paper_gsm,
        "quantity": quantity,
        "currency": currency or (rule.currency if rule else "EUR"),
        "tier_label": tier_label,
        "tier_discount_percent": round(float((Decimal("1.0000") - multiplier) * 100), 1),
        "cost_breakdown": {
            "base_machine_fee": float(base_fee),
            "interior_sheet_cost": float(interior_print_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "binding_finishing_cost": float(binding_cost),
            "lamination_addon": float(lamination_cost) if has_lamination else 0.0,
            "foil_stamp_addon": float(foil_stamp_cost) if has_foil else 0.0,
            "raw_unit_price": float(raw_unit_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "discounted_unit_price": float(unit_price),
        },
        "financial_summary": {
            "unit_price": float(unit_price),
            "subtotal": float(subtotal),
            "vat_rate_percent": 21.0,
            "vat_amount": float(vat_amount),
            "estimated_shipping": float(estimated_shipping),
            "grand_total": float(grand_total),
        },
    }
