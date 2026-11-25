"""
Per-Channel Partner API & Implementation Guide PDF Generator using ReportLab.
Produces the complete, partner-ready 7-section API & Implementation Guide PDF
(matching docs/common-provider-push-api.pdf) tailored to a specific ServiceProvider channel,
with optional embedding of encrypted-at-rest Test and/or Production API keys.
"""
import io
import json
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from apps.orders.models import ServiceProvider


def generate_channel_api_pdf(
    provider: ServiceProvider,
    include_test_key: bool = False,
    include_production_key: bool = False,
    api_base_url: str = "https://orderflow.silverpointprint.com/api/v1",
) -> bytes:
    """
    Renders the complete partner-ready API & Implementation Guide PDF for `provider`
    and returns the raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Silver Point POD — {provider.name} ({provider.provider_code}) API Guide",
        author="Silver Point POD Engineering",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "PdfTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "PdfSubtitle",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13,
        textColor=colors.HexColor("#475569"),
        spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "PdfH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12.5,
        leading=16,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=11,
        spaceAfter=4,
    )
    h3_style = ParagraphStyle(
        "PdfH3",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceBefore=7,
        spaceAfter=3,
    )
    body_style = ParagraphStyle(
        "PdfBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=4,
    )
    cell_style = ParagraphStyle(
        "PdfCell",
        parent=body_style,
        fontSize=8.0,
        leading=10.8,
        spaceAfter=0,
    )
    hdr_cell_style = ParagraphStyle(
        "PdfHdrCell",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )
    code_style = ParagraphStyle(
        "PdfCode",
        fontName="Courier",
        fontSize=7.3,
        leading=9.6,
        textColor=colors.HexColor("#0F172A"),
        backColor=colors.HexColor("#F8FAFC"),
        borderColor=colors.HexColor("#CBD5E1"),
        borderWidth=0.6,
        borderPadding=6,
        spaceBefore=3,
        spaceAfter=6,
    )

    avail_w = A4[0] - 32 * mm
    generated_at = timezone.now().strftime("%Y-%m-%d %H:%M UTC")
    currency = provider.default_currency or "USD"
    carrier = provider.default_carrier or "DHL Express"

    # Resolve keys according to flags
    if include_test_key:
        test_raw = provider.get_decrypted_test_key()
        test_key_display = (
            test_raw
            if test_raw
            else (
                f"{provider.test_api_key_prefix}••••{provider.test_api_key_last4} "
                "(Rotate Test key once to embed full key)"
                if provider.test_api_key_prefix
                else "Not generated yet"
            )
        )
    else:
        test_key_display = "Omitted from this PDF export (include_test_key=false)"

    if include_production_key:
        live_raw = provider.get_decrypted_live_key()
        live_key_display = (
            live_raw
            if live_raw
            else (
                f"{provider.live_api_key_prefix}••••{provider.live_api_key_last4} "
                "(Rotate Production key once to embed full key)"
                if provider.live_api_key_prefix
                else "Not generated yet"
            )
        )
    else:
        live_key_display = "Omitted from this PDF export (include_production_key=false)"

    def make_table(rows, col_widths):
        t_data = []
        for idx, row in enumerate(rows):
            st = hdr_cell_style if idx == 0 else cell_style
            t_data.append([Paragraph(str(c), st) for c in row])
        tbl = Table(t_data, colWidths=col_widths, repeatRows=1)
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        return tbl

    story = []

    # Header
    story.append(Paragraph("Silver Point POD — Common Service Provider Push API", title_style))
    story.append(
        Paragraph(
            f"<b>Version:</b> 1.0 &bull; <b>Channel:</b> {provider.name} "
            f"(<code>{provider.provider_code}</code>) &bull; <b>Generated:</b> {generated_at}",
            subtitle_style,
        )
    )
    story.append(
        Paragraph(
            "This specification defines the standardized inbound REST API used to push orders and "
            "status/tracking updates directly into <b>Silver Point POD (ORDERFLOW)</b>.",
            body_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#CBD5E1")))

    # 0. Channel Profile & Credentials
    story.append(Paragraph("Channel Profile &amp; API Credentials", h2_style))
    cred_rows = [
        ["Setting", "Value"],
        ["Channel Name", provider.name],
        ["Provider Code (provider_code)", f"<font name='Courier'>{provider.provider_code}</font>"],
        ["Default Currency / Carrier", f"{currency} / {carrier}"],
        ["HMAC Signature Required", "Yes (X-Provider-Signature)" if provider.require_hmac else "No (Bearer / X-API-Key only)"],
        ["Test / Sandbox API Key (sp_test_...)", f"<font name='Courier' size='7.4'>{test_key_display}</font>"],
        ["Production / Live API Key (sp_live_...)", f"<font name='Courier' size='7.4'>{live_key_display}</font>"],
    ]
    story.append(make_table(cred_rows, [avail_w * 0.34, avail_w * 0.66]))

    # 1. Base URLs & Endpoints
    story.append(Paragraph("1. Base URLs &amp; Endpoints", h2_style))
    env_rows = [
        ["Environment", "Base URL"],
        ["Active / Current Gateway", f"<font name='Courier'>{api_base_url}</font>"],
        ["Production", "<font name='Courier'>https://orderflow.silverpointprint.com/api/v1</font>"],
        ["Staging / Sandbox", "<font name='Courier'>https://staging.orderflow.silverpointprint.com/api/v1</font>"],
    ]
    story.append(make_table(env_rows, [avail_w * 0.30, avail_w * 0.70]))
    story.append(Spacer(1, 5))

    ep_rows = [
        ["Method", "Path", "Purpose"],
        ["POST", "<font name='Courier'>/providers/orders/</font>", "Push a new order (POD or commercial/event print) into Silver Point POD"],
        ["POST", "<font name='Courier'>/providers/orders/status/</font>", "Push a status and/or tracking update (external_order_id in JSON body)"],
        ["POST", "<font name='Courier'>/providers/orders/{external_order_id}/status/</font>", "Push a status and/or tracking update (external_order_id in URL path)"],
    ]
    story.append(make_table(ep_rows, [avail_w * 0.10, avail_w * 0.44, avail_w * 0.46]))

    # 2. Authentication & Dual Provider Verification
    story.append(Paragraph("2. Authentication &amp; Dual Provider Verification", h2_style))
    story.append(
        Paragraph(
            "Every request MUST identify the calling service provider through <b>both</b> cryptographic credentials "
            "and an explicit <font name='Courier'>provider_code</font> in the JSON payload.",
            body_style,
        )
    )
    hdr_rows = [
        ["Header", "Required", "Description"],
        ["Content-Type", "Yes", "Must be application/json"],
        ["Authorization", "Yes (or X-API-Key)", "Bearer &lt;provider_api_token&gt; issued for your channel"],
        ["X-API-Key", "Alternative", "&lt;provider_api_token&gt;"],
        ["X-Provider-Signature", "Conditional", "Required if require_hmac=true: sha256=&lt;hex_hmac_sha256(webhook_secret, raw_body)&gt;"],
        ["X-Provider-Code", "Optional", f"Must match {provider.provider_code} if sent"],
        ["Idempotency-Key", "Recommended", "Unique UUID/key per logical request to make retries safe"],
        ["X-Sandbox-Mode", "Optional", "Set to true to force sandbox (TEST_ORDER) ingestion"],
    ]
    story.append(make_table(hdr_rows, [avail_w * 0.25, avail_w * 0.20, avail_w * 0.55]))
    story.append(Spacer(1, 4))
    story.append(Paragraph("How Identity &amp; Environment Verification Works", h3_style))
    story.append(Paragraph("1. Silver Point resolves your channel profile and environment from your Bearer / X-API-Key token (constant-time SHA-256 hash comparison):", body_style))
    story.append(Paragraph("&bull; <b>Test / Sandbox Key (sp_test_...)</b>: Automatically routes orders to <b>Sandbox Mode</b> (is_sandbox=true, status=TEST_ORDER), isolated from live press and billing queues.", body_style))
    story.append(Paragraph("&bull; <b>Production / Live Key (sp_live_...)</b>: Automatically routes orders to <b>Production Mode</b> (is_sandbox=false, status=RECEIVED).", body_style))
    story.append(Paragraph("2. If require_hmac is enabled, Silver Point verifies X-Provider-Signature against the raw UTF-8 request body using hmac.compare_digest.", body_style))
    story.append(Paragraph(f"3. Silver Point checks that <b>provider_code</b> in the JSON body exactly matches <b>{provider.provider_code}</b>. Mismatches return <b>403 Forbidden (PROVIDER_MISMATCH)</b>.", body_style))

    # 3. Endpoint 1: Push New Order
    story.append(Paragraph("3. Endpoint 1: Push New Order (POST /providers/orders/)", h2_style))
    story.append(Paragraph("Top-Level Fields", h3_style))
    top_rows = [
        ["Field", "Type", "Required", "Description"],
        ["provider_code", "string", "Yes", f"Must be {provider.provider_code}"],
        ["external_order_id", "string", "Yes", "Your unique order reference ID (unique per provider)"],
        ["priority", "string", "No", "SLA tier: RUSH_8H, EXPRESS_24H, STANDARD_72H (default)"],
        ["sla_deadline", "ISO-8601", "No", "Explicit UTC deadline; overrides priority calculation if supplied"],
        ["currency", "string", "No", f"3-letter ISO currency code (default {currency})"],
        ["total_amount", "decimal/str", "No", "Total order value (default \"0.00\")"],
        ["carrier_preference", "string", "No", f"Preferred courier (default {carrier})"],
        ["is_sandbox / environment", "bool / str", "No", "Set true or sandbox/staging/test to force TEST_ORDER"],
        ["event_name / event_date", "string", "No", "Optional event/campaign name and date (YYYY-MM-DD)"],
        ["notes / metadata", "str / object", "No", "Special instructions and arbitrary key/value metadata"],
        ["customer", "object", "Yes", "Recipient/buyer contact object"],
        ["shipping_address", "object", "Yes", "Delivery destination object"],
        ["items", "array&lt;object&gt;", "Yes", "Non-empty list of print line items"],
    ]
    story.append(make_table(top_rows, [avail_w * 0.24, avail_w * 0.14, avail_w * 0.12, avail_w * 0.50]))

    story.append(Paragraph("customer &amp; shipping_address Objects", h3_style))
    cust_rows = [
        ["Object.Field", "Type", "Required", "Description"],
        ["customer.name", "string", "Yes", "Customer full name"],
        ["customer.email / phone / company", "string", "No", "Customer contact details and company name"],
        ["shipping_address.recipient_name", "string", "No", "Defaults to customer.name if omitted"],
        ["shipping_address.street", "string", "Yes", "Street address / venue / hall"],
        ["shipping_address.city / country", "string", "Yes", "Destination city and 2-letter ISO country code"],
        ["shipping_address.state / postal_code", "string", "No", "State/Emirate/Province and ZIP/postal code"],
    ]
    story.append(make_table(cust_rows, [avail_w * 0.34, avail_w * 0.12, avail_w * 0.12, avail_w * 0.42]))

    story.append(Paragraph("items[] Object (Standard POD &amp; Commercial/Event Print)", h3_style))
    item_rows = [
        ["Field", "Type", "Required", "Description"],
        ["external_item_id", "string", "No", "Your line-item ID"],
        ["product_type", "string", "Yes", "Product title (e.g., Hardcover Photo Book A4, Roll-Up Banner)"],
        ["category", "string", "No", "Product category (e.g., PHOTOBOOK, EVENT_SIGNAGE, MARKETING_PRINT)"],
        ["quantity", "integer", "Yes", "Must be >= 1"],
        ["pdf_artwork_url / artwork_url", "string", "Yes", "Downloadable URL to print-ready artwork PDF/file"],
        ["pdf_cover_url / proof_url", "string", "No", "Cover wrap PDF URL or visual proof URL"],
        ["proof_status", "string", "No", "PENDING (default), APPROVED, REJECTED, NOT_REQUIRED"],
        ["page_count / spine_width_mm", "int / dec", "No", "Page count (default 1) and spine width in mm (default 0.00)"],
        ["paper_stock", "string", "No", "Paper/substrate spec (auto-built from material/finish/dimensions if omitted)"],
        ["dimensions / material / finish", "string", "No", "Commercial/event specs (e.g. 850mm x 2000mm, 330gsm PVC, Matte)"],
        ["custom_specs", "object", "No", "Extra item-level specifications"],
    ]
    story.append(make_table(item_rows, [avail_w * 0.30, avail_w * 0.12, avail_w * 0.12, avail_w * 0.46]))

    story.append(Paragraph(f"Sample Request A: Standard Print/POD Book Order ({provider.provider_code})", h3_style))
    sample_pod = {
        "provider_code": provider.provider_code,
        "external_order_id": f"{provider.provider_code}-2026-88412",
        "priority": "EXPRESS_24H",
        "currency": currency,
        "total_amount": "64.50",
        "carrier_preference": carrier,
        "customer": {"name": "Astrid Lindqvist", "email": "astrid@example.com", "phone": "+46 8 555 0199"},
        "shipping_address": {"recipient_name": "Astrid Lindqvist", "street": "Kungsgatan 44", "city": "Stockholm", "postal_code": "111 35", "country": "SE"},
        "items": [
            {
                "external_item_id": "ITEM-1",
                "product_type": "Hardcover Photo Book A4",
                "category": "PHOTOBOOK",
                "quantity": 2,
                "page_count": 48,
                "spine_width_mm": "12.50",
                "paper_stock": "200gsm Silk Inner + 350gsm Hardcover Gloss",
                "pdf_artwork_url": "https://cdn.example.com/orders/88412/interior.pdf",
                "pdf_cover_url": "https://cdn.example.com/orders/88412/cover.pdf",
                "proof_status": "PENDING",
            }
        ],
    }
    story.append(Preformatted(json.dumps(sample_pod, indent=2), code_style))

    story.append(Paragraph(f"Sample Request B: Commercial / Event Print Order ({provider.provider_code})", h3_style))
    sample_event = {
        "provider_code": provider.provider_code,
        "external_order_id": f"{provider.provider_code}-2026-1001",
        "priority": "RUSH_8H",
        "currency": currency,
        "total_amount": "1450.00",
        "carrier_preference": carrier,
        "event_name": "GITEX Global 2026",
        "event_date": "2026-10-12",
        "notes": "Deliver to Hall 4 loading bay before 09:00 GST.",
        "customer": {"name": "Tariq Al Mansoor", "email": "tariq@exhibitor.ae", "phone": "+971501234567", "company": "Emirates Tech Expo LLC"},
        "shipping_address": {"recipient_name": "Tariq Al Mansoor", "street": "Dubai World Trade Centre, Hall 4", "street2": "Booth H4-B12", "city": "Dubai", "state": "Dubai", "postal_code": "00000", "country": "AE"},
        "items": [
            {
                "external_item_id": "ITEM-1",
                "product_type": "Roll-Up Banner Stand 85x200cm",
                "category": "EVENT_SIGNAGE",
                "quantity": 4,
                "dimensions": "850mm x 2000mm",
                "material": "330gsm Anti-Curl PVC",
                "finish": "Matte Lamination + Aluminum Cassette",
                "artwork_url": "https://cdn.example.com/jobs/1001/banner_print.pdf",
                "proof_url": "https://cdn.example.com/jobs/1001/banner_proof.pdf",
                "proof_status": "APPROVED",
                "custom_specs": {"carry_bag": True, "double_sided": False},
            }
        ],
    }
    story.append(Preformatted(json.dumps(sample_event, indent=2), code_style))

    # 4. Endpoint 2: Status / Tracking Update
    story.append(Paragraph("4. Endpoint 2: Push Status / Tracking Update (POST /providers/orders/status/)", h2_style))
    story.append(
        Paragraph(
            "<b>Allowed Status Values:</b> RECEIVED, PREPRESS_QUEUED, PREPRESS_PASSED, BATCHED, IN_PRODUCTION, "
            "PRINTING, QUALITY_AUDIT, PRODUCTION_COMPLETED, PACKED, READY_FOR_DISPATCH, DISPATCHED (aliases: SHIPPED, FULFILLED), "
            "IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION_HOLD (alias: ON_HOLD), REPRINT_QUEUED, CANCELLED.",
            body_style,
        )
    )
    story.append(
        Paragraph(
            "<b>Allowed tracking.carrier_code Values:</b> DHL, FEDEX, ARAMEX, UPS, BLUEDART, DTDC, INDIA_POST, SELF_DELIVERY, CUSTOM.",
            body_style,
        )
    )
    sample_status = {
        "provider_code": provider.provider_code,
        "external_order_id": f"{provider.provider_code}-2026-1001",
        "status": "DISPATCHED",
        "notes": "Handed over to courier.",
        "tracking": {
            "carrier": carrier,
            "carrier_code": "ARAMEX" if "aramex" in carrier.lower() else "DHL",
            "tracking_number": "TRK-99887766",
            "tracking_url": "https://tracking.example.com/TRK-99887766",
        },
    }
    story.append(Preformatted(json.dumps(sample_status, indent=2), code_style))

    # 5. Sample Success & Error Responses
    story.append(Paragraph("5. Sample Success &amp; Error Responses", h2_style))
    sample_201 = {
        "status": "PROCESSED",
        "message": "Provider order successfully ingested.",
        "provider_code": provider.provider_code,
        "external_order_id": f"{provider.provider_code}-2026-1001",
        "order_number": "SP-2026-1042",
        "is_sandbox": False,
        "log_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    }
    story.append(Paragraph("201 Created — Order Ingested (200 OK returns status: DUPLICATE on retries)", h3_style))
    story.append(Preformatted(json.dumps(sample_201, indent=2), code_style))

    err_rows = [
        ["HTTP Status", "Error Code", "When It Occurs"],
        ["400 Bad Request", "BAD_REQUEST", "Empty or malformed JSON body"],
        ["401 Unauthorized", "MISSING_CREDENTIALS / INVALID_CREDENTIALS / INVALID_SIGNATURE", "Missing/invalid Bearer token or HMAC signature"],
        ["403 Forbidden", "PROVIDER_MISMATCH / PROVIDER_INACTIVE / IP_NOT_ALLOWED", "Payload provider_code does not match token, or channel disabled"],
        ["404 Not Found", "ORDER_NOT_FOUND", "external_order_id does not exist for your provider_code"],
        ["409 Conflict", "IDEMPOTENCY_CONFLICT", "Same Idempotency-Key reused with a different payload"],
        ["422 Unprocessable", "VALIDATION_ERROR / UNSUPPORTED_STATUS", "Missing required fields, invalid types, or unknown status"],
        ["500 Server Error", "INTERNAL_ERROR", "Unexpected server failure (share log_id with support)"],
    ]
    story.append(make_table(err_rows, [avail_w * 0.20, avail_w * 0.36, avail_w * 0.44]))

    # 6. Idempotency & Retry Rules
    story.append(Paragraph("6. Idempotency &amp; Retry Rules", h2_style))
    story.append(Paragraph("1. Always generate a unique <b>Idempotency-Key</b> (UUID v4) per order push or status event.", body_style))
    story.append(Paragraph("2. On network timeouts or 5xx responses, retry with exponential backoff (1s, 2s, 4s, 8s, 16s) using the exact same Idempotency-Key and JSON body.", body_style))
    story.append(Paragraph("3. Do <b>not</b> retry 400, 401, 403, 409, or 422 responses without fixing the request payload or credentials.", body_style))
    story.append(Paragraph("4. Silver Point enforces uniqueness on (service_provider, external_order_id), returning 200 OK (status: DUPLICATE) on duplicate pushes.", body_style))

    # 7. Onboarding & Testing Checklist
    story.append(Paragraph(f"7. Onboarding &amp; Testing Checklist ({provider.provider_code})", h2_style))
    story.append(Paragraph(f"1. <b>Sandbox Smoke Test:</b> Send POST /providers/orders/ using your <b>sp_test_...</b> key and \"provider_code\": \"{provider.provider_code}\". Confirm 201 Created with \"is_sandbox\": true (routed to TEST_ORDER).", body_style))
    story.append(Paragraph("2. <b>Idempotency &amp; Mismatch Check:</b> Resend the exact same payload + Idempotency-Key and confirm 200 OK (DUPLICATE). Confirm wrong provider_code returns 403 PROVIDER_MISMATCH.", body_style))
    story.append(Paragraph("3. <b>Go-Live:</b> Switch Authorization: Bearer to your <b>sp_live_...</b> key and target the Production Base URL.", body_style))

    def add_footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#64748B"))
        canvas.drawRightString(
            A4[0] - 16 * mm,
            9 * mm,
            f"Silver Point POD • {provider.provider_code} Partner API Guide v1.0 • Page {doc_obj.page}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    return buffer.getvalue()
