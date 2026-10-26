import io
from decimal import Decimal
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from apps.finance.models import PeechoInvoice


def generate_tax_invoice_pdf(invoice: PeechoInvoice) -> bytes:
    """
    Generates dynamic enterprise B2B Tax Invoice PDF for Peecho B.V. using ReportLab.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#4F46E5")
    dark_slate = colors.HexColor("#0F172A")
    muted_slate = colors.HexColor("#64748B")
    border_slate = colors.HexColor("#E2E8F0")

    header_title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=primary_color,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=dark_slate,
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=dark_slate,
    )
    cell_normal = ParagraphStyle(
        "CellNormal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=dark_slate,
    )
    cell_muted = ParagraphStyle(
        "CellMuted",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=muted_slate,
    )

    story = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>SILVER POINT POD</b><br/><font size=8 color='#64748B'>Print-on-Demand Manufacturing & Peecho Gateway</font>", section_heading),
            Paragraph(f"<b>TAX INVOICE</b><br/><font size=10 color='#4F46E5'><b>{invoice.invoice_number}</b></font>", header_title_style),
        ]
    ]
    header_table = Table(header_data, colWidths=[300, 220])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=15))

    # 2. Issuer vs Client Information
    billing_data = [
        [
            Paragraph("<b>ISSUER (SUPPLIER)</b>", cell_bold),
            Paragraph("<b>BILLED TO (CLIENT)</b>", cell_bold),
        ],
        [
            Paragraph(
                "<b>Silver Point Print Solutions Ltd.</b><br/>"
                "VAT ID: GB992819482<br/>"
                "12 Millbank Industrial Estate, Docklands<br/>"
                "London, E14 2BE, United Kingdom<br/>"
                "Email: billing@silverpointpod.com",
                cell_normal,
            ),
            Paragraph(
                f"<b>{invoice.client_name}</b><br/>"
                f"VAT ID: {invoice.client_tax_id}<br/>"
                f"{invoice.client_address}<br/>"
                f"Email: {invoice.client_email}<br/>"
                f"Billing Cycle: <b>{invoice.billing_period}</b>",
                cell_normal,
            ),
        ],
    ]
    billing_table = Table(billing_data, colWidths=[260, 260])
    billing_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, border_slate),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, border_slate),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(billing_table)
    story.append(Spacer(1, 15))

    # 3. Invoice Summary Details Bar
    summary_bar = [
        [
            Paragraph(f"<b>Invoice Date:</b> {invoice.issued_at.strftime('%d %b %Y') if invoice.issued_at else timezone.now().strftime('%d %b %Y')}", cell_normal),
            Paragraph(f"<b>Payment Due:</b> {invoice.due_date.strftime('%d %b %Y') if invoice.due_date else 'Net 30'}", cell_normal),
            Paragraph(f"<b>Status:</b> <font color='#059669'><b>{invoice.status}</b></font>", cell_normal),
            Paragraph(f"<b>Orders Billed:</b> {invoice.orders_count}", cell_normal),
        ]
    ]
    summary_table = Table(summary_bar, colWidths=[130, 130, 130, 130])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EEF2FF")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#C7D2FE")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 15))

    # 4. Itemized Orders Table
    table_headers = [
        Paragraph("<b>#</b>", cell_bold),
        Paragraph("<b>Order No / Peecho ID</b>", cell_bold),
        Paragraph("<b>Product & Specifications</b>", cell_bold),
        Paragraph("<b>Qty</b>", cell_bold),
        Paragraph(f"<b>Unit Price ({invoice.currency})</b>", cell_bold),
        Paragraph(f"<b>Line Total ({invoice.currency})</b>", cell_bold),
    ]
    line_rows = [table_headers]

    line_items = invoice.line_items.all()
    if not line_items.exists():
        # Build dynamic row from linked orders if lines not yet persisted
        orders = invoice.orders.all()
        for idx, ord_obj in enumerate(orders[:20], 1):
            line_rows.append([
                Paragraph(str(idx), cell_muted),
                Paragraph(f"<b>{ord_obj.order_number}</b><br/><font color='#64748B'>{ord_obj.peecho_order_id}</font>", cell_normal),
                Paragraph(f"POD Book (130 GSM Silk / PUR Bound) • {ord_obj.customer_name}", cell_normal),
                Paragraph(str(ord_obj.total_items_count or 1), cell_normal),
                Paragraph(f"{ord_obj.total_amount:.2f}", cell_normal),
                Paragraph(f"{ord_obj.total_amount:.2f}", cell_bold),
            ])
    else:
        for idx, item in enumerate(line_items, 1):
            line_rows.append([
                Paragraph(str(idx), cell_muted),
                Paragraph(f"<b>{item.order_number}</b><br/><font color='#64748B'>{item.peecho_order_id}</font>", cell_normal),
                Paragraph(f"{item.product_description} ({item.page_count}p)", cell_normal),
                Paragraph(str(item.quantity), cell_normal),
                Paragraph(f"{item.unit_price:.2f}", cell_normal),
                Paragraph(f"{item.line_total:.2f}", cell_bold),
            ])

    items_table = Table(line_rows, colWidths=[25, 120, 205, 35, 65, 70])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, border_slate),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 15))

    # 5. Financial Totals & Bank Payment Details
    totals_data = [
        [
            Paragraph("<b>PAYMENT SETTLEMENT INSTRUCTIONS (IBAN/SWIFT)</b><br/>"
                      "Bank: Barclays Bank Commercial London<br/>"
                      "Account Name: Silver Point Print Solutions Ltd<br/>"
                      "IBAN: GB29BARC20000088192839<br/>"
                      "SWIFT/BIC: BARCGB22<br/>"
                      f"Reference: <b>{invoice.invoice_number}</b>", cell_muted),
            Table([
                [Paragraph("Subtotal Excl. Tax:", cell_normal), Paragraph(f"<b>{invoice.subtotal_amount:.2f} {invoice.currency}</b>", cell_normal)],
                [Paragraph(f"VAT ({invoice.tax_rate_percent:.0f}%):", cell_normal), Paragraph(f"<b>{invoice.tax_amount:.2f} {invoice.currency}</b>", cell_normal)],
                [Paragraph("Courier Shipping:", cell_normal), Paragraph(f"<b>{invoice.shipping_total:.2f} {invoice.currency}</b>", cell_normal)],
                [Paragraph("<b>GRAND TOTAL DUE:</b>", cell_bold), Paragraph(f"<font size=11 color='#4F46E5'><b>{invoice.grand_total:.2f} {invoice.currency}</b></font>", cell_bold)],
            ], colWidths=[120, 110]),
        ]
    ]
    totals_table = Table(totals_data, colWidths=[280, 240])
    totals_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 1, border_slate),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(totals_table)

    doc.build(story)
    return buffer.getvalue()


def generate_soa_pdf(invoice: PeechoInvoice) -> bytes:
    """
    Generates Statement of Account (SOA) PDF showing account balance,
    order reconciliation ledger, and settlement status.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#4F46E5")
    dark_slate = colors.HexColor("#0F172A")
    muted_slate = colors.HexColor("#64748B")
    border_slate = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        "SOATitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=primary_color,
    )
    cell_bold = ParagraphStyle("CellBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, textColor=dark_slate)
    cell_normal = ParagraphStyle("CellNormal", parent=styles["Normal"], fontName="Helvetica", fontSize=8, textColor=dark_slate)
    cell_muted = ParagraphStyle("CellMuted", parent=styles["Normal"], fontName="Helvetica", fontSize=7.5, textColor=muted_slate)

    story = []

    # Header
    story.append(Table([
        [
            Paragraph("<b>SILVER POINT POD LOGISTICS</b><br/><font size=8 color='#64748B'>Accounts Receivable & Ledger Department</font>", cell_bold),
            Paragraph(f"<b>STATEMENT OF ACCOUNT</b><br/><font size=9 color='#64748B'>Ref: SOA-{invoice.invoice_number}</font>", title_style),
        ]
    ], colWidths=[300, 220]))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=15))

    # Client Balance Box
    balance_table = Table([
        [
            Paragraph(f"<b>Client Account:</b> {invoice.client_name} ({invoice.client_tax_id})<br/><b>Statement Period:</b> {invoice.billing_period}", cell_normal),
            Paragraph(f"<b>Total Ledger Balance:</b><br/><font size=13 color='#4F46E5'><b>{invoice.grand_total:.2f} {invoice.currency}</b></font><br/><b>Status:</b> {invoice.status}", cell_bold),
        ]
    ], colWidths=[320, 200])
    balance_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, border_slate),
        ("PADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(balance_table)
    story.append(Spacer(1, 15))

    # Aged Analysis Summary
    aged_data = [
        [Paragraph("<b>Current (0-30 Days)</b>", cell_bold), Paragraph("<b>31 - 60 Days</b>", cell_bold), Paragraph("<b>61 - 90 Days</b>", cell_bold), Paragraph("<b>90+ Days (Overdue)</b>", cell_bold)],
        [Paragraph(f"{invoice.grand_total:.2f} {invoice.currency}", cell_normal), Paragraph("0.00", cell_normal), Paragraph("0.00", cell_normal), Paragraph("0.00", cell_normal)],
    ]
    aged_table = Table(aged_data, colWidths=[130, 130, 130, 130])
    aged_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, border_slate),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(aged_table)

    doc.build(story)
    return buffer.getvalue()
