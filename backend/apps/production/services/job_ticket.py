"""
Job Ticket PDF Generation Service using ReportLab and QR Code Generator.
Produces high-precision shopfloor job tickets with scannable barcodes, S3 links, and print specs.
"""
import os
import io
import qrcode
from pathlib import Path
from datetime import datetime
from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm


def generate_qr_image_stream(qr_data: str) -> io.BytesIO:
    """
    Generates a high-contrast QR Code PNG stream.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=1,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0F172A", back_color="white")
    img_stream = io.BytesIO()
    img.save(img_stream, format="PNG")
    img_stream.seek(0)
    return img_stream


def generate_job_ticket_pdf(batch) -> dict:
    """
    Builds a printable A4 PDF Job Ticket for the given ProductionBatch.
    Returns: {"pdf_bytes": bytes, "file_path": str, "relative_url": str}
    """
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "JobTicketTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0F172A"),
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "JobTicketSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
        fontName="Helvetica",
    )
    badge_style = ParagraphStyle(
        "JobTicketBadge",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#4F46E5"),
        fontName="Helvetica-Bold",
        alignment=2, # right
    )
    header_cell_style = ParagraphStyle(
        "HeaderCellStyle",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#334155"),
        fontName="Helvetica-Bold",
    )
    body_cell_style = ParagraphStyle(
        "BodyCellStyle",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
        fontName="Helvetica",
    )
    mono_style = ParagraphStyle(
        "MonoCellStyle",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#4F46E5"),
        fontName="Helvetica",
    )

    elements = []

    # 1. Header with QR Code & Metadata
    qr_data = f"SP-POD-BATCH:{batch.batch_number}|PRESS:{batch.target_press}|ORDERS:{batch.total_orders_count}"
    qr_stream = generate_qr_image_stream(qr_data)
    qr_img = Image(qr_stream, width=28 * mm, height=28 * mm)

    header_text = [
        Paragraph(f"PRODUCTION JOB TICKET • {batch.batch_number}", title_style),
        Spacer(1, 2 * mm),
        Paragraph(
            f"Silver Point POD Operations Portal • Peecho Gateway Batch<br/>"
            f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} • Priority: <b>{batch.priority}</b>",
            subtitle_style,
        ),
    ]

    header_table_data = [
        [header_text, qr_img],
    ]
    header_table = Table(header_table_data, colWidths=[140 * mm, 35 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceBefore=2, spaceAfter=8))

    # 2. Key Specifications Summary Box
    specs_data = [
        [
            Paragraph("<b>Target Digital Press:</b>", body_cell_style),
            Paragraph(batch.get_target_press_display() if hasattr(batch, "get_target_press_display") else batch.target_press, body_cell_style),
            Paragraph("<b>Paper Stock:</b>", body_cell_style),
            Paragraph(batch.paper_stock, body_cell_style),
        ],
        [
            Paragraph("<b>Imposition Size:</b>", body_cell_style),
            Paragraph(batch.size_format, body_cell_style),
            Paragraph("<b>Binding Method:</b>", body_cell_style),
            Paragraph(batch.get_binding_type_display() if hasattr(batch, "get_binding_type_display") else batch.binding_type, body_cell_style),
        ],
        [
            Paragraph("<b>Total Orders / Books:</b>", body_cell_style),
            Paragraph(f"<b>{batch.total_orders_count} orders</b> ({batch.total_items_count} units)", body_cell_style),
            Paragraph("<b>Estimated Sheet Passes:</b>", body_cell_style),
            Paragraph(f"<b>{batch.total_sheets_count} Sheets</b>", body_cell_style),
        ],
    ]

    specs_table = Table(specs_data, colWidths=[40 * mm, 50 * mm, 38 * mm, 47 * mm])
    specs_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(specs_table)
    elements.append(Spacer(1, 5 * mm))

    # 3. Bundled Orders Manifest Table
    elements.append(Paragraph("<b>BUNDLED ORDERS MANIFEST & ASSET SPECIFICATIONS</b>", header_cell_style))
    elements.append(Spacer(1, 2 * mm))

    manifest_headers = [
        Paragraph("Order #", header_cell_style),
        Paragraph("Peecho Ref", header_cell_style),
        Paragraph("Product & Format", header_cell_style),
        Paragraph("Qty", header_cell_style),
        Paragraph("Pages", header_cell_style),
        Paragraph("Spine", header_cell_style),
        Paragraph("Destination", header_cell_style),
        Paragraph("Artwork S3 Asset URI", header_cell_style),
    ]

    manifest_rows = [manifest_headers]

    for ord_obj in batch.orders.all():
        for item in ord_obj.items.all():
            dest = f"{ord_obj.shipping_address.get('city', '')}, {ord_obj.shipping_address.get('country', '')}"
            s3_link = f"s3://silverpoint-vault/orders/{ord_obj.peecho_order_id}/interior.pdf"

            manifest_rows.append([
                Paragraph(ord_obj.order_number, body_cell_style),
                Paragraph(ord_obj.peecho_order_id, body_cell_style),
                Paragraph(item.product_type, body_cell_style),
                Paragraph(str(item.quantity), body_cell_style),
                Paragraph(f"{item.page_count}pp", body_cell_style),
                Paragraph(f"{item.spine_width_mm}mm", body_cell_style),
                Paragraph(dest, body_cell_style),
                Paragraph(s3_link, mono_style),
            ])

    manifest_table = Table(manifest_rows, colWidths=[24 * mm, 24 * mm, 38 * mm, 10 * mm, 12 * mm, 13 * mm, 20 * mm, 34 * mm])
    manifest_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(manifest_table)
    elements.append(Spacer(1, 6 * mm))

    # 4. Quality Assurance & Sign-off Checklist
    qa_data = [
        [
            Paragraph("<b>Operator Sign-off & Quality Assurance Checks:</b>", header_cell_style),
            Paragraph("<b>Press Operator:</b> ____________________", body_cell_style),
            Paragraph("<b>Quality Audit:</b> [  ] PASS  [  ] FAIL", body_cell_style),
        ],
        [
            Paragraph("• RIP Output Resolution Verified (>= 300 DPI)<br/>• Spine Caliper Gauge Confirmed<br/>• CMYK Fogra39 Density & Color Calibration Approved", subtitle_style),
            Paragraph("<b>Bindery Operator:</b> __________________", body_cell_style),
            Paragraph("<b>Waste Count:</b> _____ sheets", body_cell_style),
        ],
    ]
    qa_table = Table(qa_data, colWidths=[85 * mm, 50 * mm, 40 * mm])
    qa_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94A3B8")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(KeepTogether(qa_table))

    # Build Document
    doc.build(elements)
    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()

    # Save to local media directory
    ticket_dir = Path(settings.MEDIA_ROOT) / "job_tickets"
    ticket_dir.mkdir(parents=True, exist_ok=True)
    ticket_filename = f"{batch.batch_number}_job_ticket.pdf"
    ticket_file_path = ticket_dir / ticket_filename

    with open(ticket_file_path, "wb") as f:
        f.write(pdf_bytes)

    relative_url = f"/media/job_tickets/{ticket_filename}"

    return {
        "pdf_bytes": pdf_bytes,
        "file_path": str(ticket_file_path),
        "relative_url": relative_url,
    }
