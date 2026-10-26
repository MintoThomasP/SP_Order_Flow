from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.core.management.base import BaseCommand
from apps.core.models.lookups import SystemRole, EntityStatus
from apps.authentication.models import User, UserAuditLog
from apps.orders.models import Order, OrderItem, PeechoPayloadLog
from apps.prepress.models import ArtworkVerification
from apps.prepress.services.s3_storage import calculate_spine_width_mm
from apps.production.models import ProductionBatch
from apps.production.services.job_ticket import generate_job_ticket_pdf
from apps.shopfloor.models import ShopfloorStation, ScanEventLog


class Command(BaseCommand):
    help = "Seeds system roles, entity statuses, staff users, Peecho orders, production batches, and shopfloor workstations."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding dynamic System Roles..."))
        
        roles_data = [
            {"code": "SUPER_ADMIN", "name": "Super Admin", "description": "Full access to system configurations, billing, staff RBAC, dynamic lookups, and security audit logs.", "permissions_matrix": {"all": True, "rbac": ["create", "read", "update", "delete"], "override": True}, "is_system_default": True},
            {"code": "PREPRESS_SPECIALIST", "name": "Prepress Specialist", "description": "Artwork preflight validation, PDF trim/bleed inspection, color profiling, and file proof approval.", "permissions_matrix": {"prepress": ["review", "approve", "reject", "download_artwork", "replace_asset"]}, "is_system_default": True},
            {"code": "PRODUCTION_MANAGER", "name": "Production Manager", "description": "Supervises press scheduling, shopfloor batching, SLA expedites, and reprint authorization.", "permissions_matrix": {"orders": ["read", "write", "reassign"], "production": ["schedule", "reprint", "manage_batches"]}, "is_system_default": True},
            {"code": "SHOPFLOOR_OPERATOR", "name": "Shopfloor Operator", "description": "Operates digital presses and finishing/bindery stations, logs job progress and waste counts.", "permissions_matrix": {"press": ["start_print", "complete_print", "flag_jam"], "bindery": ["start", "finish"]}, "is_system_default": True},
            {"code": "DISPATCH_FINANCE_SPECIALIST", "name": "Dispatch / Finance Specialist", "description": "Packaging scan verification, waybill/tracking code generation, courier manifests, and invoice reconciliations.", "permissions_matrix": {"dispatch": ["generate_label", "manifest_pickup", "enter_tracking", "track"], "finance": ["invoices", "reconcile"]}, "is_system_default": True},
            {"code": "PEECHO_SERVICE", "name": "Peecho API Service Worker", "description": "Automated system daemon handling incoming Peecho webhooks and status sync.", "permissions_matrix": {"peecho_gateway": ["sync", "webhook_post", "status_callback"]}, "is_system_default": True},
        ]

        roles_dict = {}
        for r in roles_data:
            role_obj, created = SystemRole.objects.update_or_create(code=r["code"], defaults=r)
            roles_dict[r["code"]] = role_obj

        self.stdout.write(self.style.NOTICE("Seeding dynamic Entity Statuses..."))

        statuses_data = [
            # ORDER statuses
            {"entity_type": "ORDER", "code": "RECEIVED", "name": "Order Received", "badge_color": "slate", "badge_bg": "#F1F5F9", "badge_text": "#475569", "sort_order": 10, "allowed_transitions": ["PREPRESS_QUEUED", "CANCELLED"]},
            {"entity_type": "ORDER", "code": "PREPRESS_QUEUED", "name": "Prepress Queued", "badge_color": "amber", "badge_bg": "#FEF3C7", "badge_text": "#D97706", "sort_order": 20, "allowed_transitions": ["PREPRESS_PASSED", "EXCEPTION_HOLD", "CANCELLED"]},
            {"entity_type": "ORDER", "code": "PREPRESS_PASSED", "name": "Prepress Approved", "badge_color": "indigo", "badge_bg": "#EEF2FF", "badge_text": "#4F46E5", "sort_order": 30, "allowed_transitions": ["BATCHED", "IN_PRODUCTION", "CANCELLED"]},
            {"entity_type": "ORDER", "code": "BATCHED", "name": "Batched for Production", "badge_color": "amber", "badge_bg": "#FEF3C7", "badge_text": "#D97706", "sort_order": 35, "allowed_transitions": ["PRINTING", "IN_PRODUCTION"]},
            {"entity_type": "ORDER", "code": "IN_PRODUCTION", "name": "In Production", "badge_color": "purple", "badge_bg": "#F3E8FF", "badge_text": "#9333EA", "sort_order": 40, "allowed_transitions": ["PRINTING", "QUALITY_AUDIT", "EXCEPTION_HOLD"]},
            {"entity_type": "ORDER", "code": "PRINTING", "name": "Printing on Press", "badge_color": "purple", "badge_bg": "#F3E8FF", "badge_text": "#7E22CE", "sort_order": 45, "allowed_transitions": ["PRODUCTION_COMPLETED", "QUALITY_AUDIT", "EXCEPTION_HOLD"]},
            {"entity_type": "ORDER", "code": "QUALITY_AUDIT", "name": "Quality Audit", "badge_color": "sky", "badge_bg": "#E0F2FE", "badge_text": "#0284C7", "sort_order": 50, "allowed_transitions": ["PRODUCTION_COMPLETED", "PACKED", "IN_PRODUCTION"]},
            {"entity_type": "ORDER", "code": "PRODUCTION_COMPLETED", "name": "Production Completed", "badge_color": "teal", "badge_bg": "#CCFBF1", "badge_text": "#0D9488", "sort_order": 55, "allowed_transitions": ["PACKED", "READY_FOR_DISPATCH", "DISPATCHED"]},
            {"entity_type": "ORDER", "code": "PACKED", "name": "Packed & Labelled", "badge_color": "teal", "badge_bg": "#CCFBF1", "badge_text": "#0F766E", "sort_order": 60, "allowed_transitions": ["READY_FOR_DISPATCH", "DISPATCHED"]},
            {"entity_type": "ORDER", "code": "READY_FOR_DISPATCH", "name": "Ready for Dispatch", "badge_color": "sky", "badge_bg": "#E0F2FE", "badge_text": "#0369A1", "sort_order": 65, "allowed_transitions": ["DISPATCHED"]},
            {"entity_type": "ORDER", "code": "DISPATCHED", "name": "Dispatched", "badge_color": "blue", "badge_bg": "#EFF6FF", "badge_text": "#0073EA", "sort_order": 70, "is_terminal": False, "allowed_transitions": ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]},
            {"entity_type": "ORDER", "code": "IN_TRANSIT", "name": "In Transit", "badge_color": "blue", "badge_bg": "#EFF6FF", "badge_text": "#1D4ED8", "sort_order": 75, "is_terminal": False, "allowed_transitions": ["OUT_FOR_DELIVERY", "DELIVERED"]},
            {"entity_type": "ORDER", "code": "OUT_FOR_DELIVERY", "name": "Out for Delivery", "badge_color": "amber", "badge_bg": "#FEF3C7", "badge_text": "#B45309", "sort_order": 80, "is_terminal": False, "allowed_transitions": ["DELIVERED"]},
            {"entity_type": "ORDER", "code": "DELIVERED", "name": "Delivered", "badge_color": "emerald", "badge_bg": "#D1FAE5", "badge_text": "#047857", "sort_order": 85, "is_terminal": True, "allowed_transitions": []},
            {"entity_type": "ORDER", "code": "EXCEPTION_HOLD", "name": "Exception Hold", "badge_color": "rose", "badge_bg": "#FFE4E6", "badge_text": "#E11D48", "sort_order": 90, "is_failure_state": True, "allowed_transitions": ["PREPRESS_QUEUED", "IN_PRODUCTION", "CANCELLED"]},
            {"entity_type": "ORDER", "code": "REPRINT_QUEUED", "name": "Reprint Queued", "badge_color": "rose", "badge_bg": "#FFE4E6", "badge_text": "#BE123C", "sort_order": 95, "is_failure_state": True, "allowed_transitions": ["IN_PRODUCTION", "CANCELLED"]},
            {"entity_type": "ORDER", "code": "CANCELLED", "name": "Cancelled", "badge_color": "gray", "badge_bg": "#F3F4F6", "badge_text": "#6B7280", "sort_order": 100, "is_terminal": True, "allowed_transitions": []},
            # PRINT_JOB statuses
            {"entity_type": "PRINT_JOB", "code": "QUEUED_PRESS", "name": "Queued to Press", "badge_color": "indigo", "badge_bg": "#EEF2FF", "badge_text": "#4F46E5", "sort_order": 20},
            {"entity_type": "PRINT_JOB", "code": "PRINTING", "name": "Printing", "badge_color": "purple", "badge_bg": "#F3E8FF", "badge_text": "#9333EA", "sort_order": 30},
            {"entity_type": "PRINT_JOB", "code": "COMPLETED", "name": "Print Complete", "badge_color": "emerald", "badge_bg": "#D1FAE5", "badge_text": "#059669", "sort_order": 40, "is_terminal": True},
            {"entity_type": "PRINT_JOB", "code": "REPRINT_HOLD", "name": "Reprint Required", "badge_color": "rose", "badge_bg": "#FFE4E6", "badge_text": "#E11D48", "sort_order": 90, "is_failure_state": True},
            # SHIPMENT statuses
            {"entity_type": "SHIPMENT", "code": "LABEL_CREATED", "name": "Label Created / Packed", "badge_color": "slate", "badge_bg": "#F1F5F9", "badge_text": "#475569", "sort_order": 10},
            {"entity_type": "SHIPMENT", "code": "READY_FOR_DISPATCH", "name": "Ready for Dispatch", "badge_color": "sky", "badge_bg": "#E0F2FE", "badge_text": "#0369A1", "sort_order": 20},
            {"entity_type": "SHIPMENT", "code": "DISPATCHED", "name": "Dispatched / Carrier Handover", "badge_color": "blue", "badge_bg": "#EFF6FF", "badge_text": "#0073EA", "sort_order": 30},
            {"entity_type": "SHIPMENT", "code": "IN_TRANSIT", "name": "In Transit", "badge_color": "blue", "badge_bg": "#EFF6FF", "badge_text": "#1D4ED8", "sort_order": 40},
            {"entity_type": "SHIPMENT", "code": "OUT_FOR_DELIVERY", "name": "Out for Delivery", "badge_color": "amber", "badge_bg": "#FEF3C7", "badge_text": "#B45309", "sort_order": 50},
            {"entity_type": "SHIPMENT", "code": "DELIVERED", "name": "Delivered", "badge_color": "emerald", "badge_bg": "#D1FAE5", "badge_text": "#047857", "sort_order": 60, "is_terminal": True},
            {"entity_type": "SHIPMENT", "code": "EXCEPTION", "name": "Delivery Exception", "badge_color": "rose", "badge_bg": "#FFE4E6", "badge_text": "#E11D48", "sort_order": 90, "is_failure_state": True},
            # BATCH statuses
            {"entity_type": "BATCH", "code": "QUEUED_PRESS", "name": "Queued to Press", "badge_color": "indigo", "badge_bg": "#EEF2FF", "badge_text": "#4F46E5", "sort_order": 10},
            {"entity_type": "BATCH", "code": "PRINTING", "name": "Printing", "badge_color": "purple", "badge_bg": "#F3E8FF", "badge_text": "#9333EA", "sort_order": 20},
            {"entity_type": "BATCH", "code": "COMPLETED", "name": "Print Complete", "badge_color": "emerald", "badge_bg": "#D1FAE5", "badge_text": "#059669", "sort_order": 30, "is_terminal": True},
            {"entity_type": "BATCH", "code": "REPRINT_HOLD", "name": "Reprint Required", "badge_color": "rose", "badge_bg": "#FFE4E6", "badge_text": "#E11D48", "sort_order": 90, "is_failure_state": True},
        ]

        status_dict = {}
        for s in statuses_data:
            st_obj, created = EntityStatus.objects.update_or_create(entity_type=s["entity_type"], code=s["code"], defaults=s)
            status_dict[(s["entity_type"], s["code"])] = st_obj

        self.stdout.write(self.style.NOTICE("Seeding Staff Users..."))
        staff_data = [
            {"email": "admin@silverpointpod.com", "first_name": "Alexander", "last_name": "Vance", "employee_id": "EMP-1001", "department": "Executive Management", "phone_number": "+1 (555) 019-2834", "role_code": "SUPER_ADMIN", "is_staff": True, "is_superuser": True},
            {"email": "elena.prepress@silverpointpod.com", "first_name": "Elena", "last_name": "Rostova", "employee_id": "EMP-2041", "department": "Prepress & Preflight", "phone_number": "+1 (555) 014-9921", "role_code": "PREPRESS_SPECIALIST", "is_staff": True, "is_superuser": False},
            {"email": "marcus.prod@silverpointpod.com", "first_name": "Marcus", "last_name": "Sterling", "employee_id": "EMP-3012", "department": "Production Shopfloor", "phone_number": "+1 (555) 018-7734", "role_code": "PRODUCTION_MANAGER", "is_staff": True, "is_superuser": False},
            {"email": "dave.press@silverpointpod.com", "first_name": "David", "last_name": "Kowalski", "employee_id": "EMP-4109", "department": "Digital Press & Bindery", "phone_number": "+1 (555) 017-3320", "role_code": "SHOPFLOOR_OPERATOR", "is_staff": False, "is_superuser": False},
            {"email": "sarah.dispatch@silverpointpod.com", "first_name": "Sarah", "last_name": "Jenkins", "employee_id": "EMP-5088", "department": "Logistics & Finance", "phone_number": "+1 (555) 012-6645", "role_code": "DISPATCH_FINANCE_SPECIALIST", "is_staff": True, "is_superuser": False},
        ]

        created_users = []
        for staff in staff_data:
            role_code = staff.pop("role_code")
            role_obj = roles_dict.get(role_code)
            user, created = User.objects.update_or_create(email=staff["email"], defaults={**staff, "role": role_obj, "is_active": True})
            user.set_password("Admin@123456")
            user.save()
            created_users.append(user)

        self.stdout.write(self.style.NOTICE("Seeding Sample Peecho POD Orders..."))
        now = timezone.now()

        orders_mock = [
            {
                "order_number": "SP-2026-90412",
                "peecho_order_id": "PEECHO-881920",
                "customer_name": "Claire Dupont",
                "customer_email": "claire.dupont@artbooks.fr",
                "customer_phone": "+33 6 12 34 56 78",
                "shipping_address": {"recipient_name": "Claire Dupont", "street": "24 Rue de Rivoli", "city": "Paris", "postal_code": "75004", "country": "FR"},
                "carrier_preference": "DHL Express Worldwide",
                "status": status_dict[("ORDER", "PREPRESS_PASSED")],
                "sla_priority": "RUSH_8H",
                "sla_deadline": now + timedelta(hours=3, minutes=15),
                "total_items_count": 1,
                "total_amount": Decimal("48.50"),
                "currency": "EUR",
                "items": [
                    {
                        "peecho_item_id": "PEECHO-ITEM-101",
                        "product_type": "Hardcover Photo Book A4 (Landscape)",
                        "quantity": 1,
                        "page_count": 64,
                        "spine_width_mm": Decimal("14.20"),
                        "paper_stock": "200gsm Silk Inner + Matte Laminated Hardcover",
                        "pdf_artwork_url": "https://assets.peecho.com/orders/881920/content_hires.pdf",
                        "pdf_cover_url": "https://assets.peecho.com/orders/881920/cover_hires.pdf",
                        "preflight_passed": True,
                    }
                ],
            },
            {
                "order_number": "SP-2026-90413",
                "peecho_order_id": "PEECHO-881921",
                "customer_name": "Oliver Hoffmann",
                "customer_email": "oliver.h@berlinprint.de",
                "customer_phone": "+49 30 987654",
                "shipping_address": {"recipient_name": "Oliver Hoffmann", "street": "Friedrichstraße 140", "city": "Berlin", "postal_code": "10117", "country": "DE"},
                "carrier_preference": "FedEx International Priority",
                "status": status_dict[("ORDER", "IN_PRODUCTION")],
                "sla_priority": "EXPRESS_24H",
                "sla_deadline": now + timedelta(hours=8, minutes=45),
                "total_items_count": 2,
                "total_amount": Decimal("72.00"),
                "currency": "EUR",
                "items": [
                    {
                        "peecho_item_id": "PEECHO-ITEM-201",
                        "product_type": "Softcover Magazine A5 (Wire-O)",
                        "quantity": 2,
                        "page_count": 32,
                        "spine_width_mm": Decimal("6.00"),
                        "paper_stock": "170gsm Gloss Text + 300gsm Softcover",
                        "pdf_artwork_url": "https://assets.peecho.com/orders/881921/mag_hires.pdf",
                        "pdf_cover_url": "https://assets.peecho.com/orders/881921/cover.pdf",
                        "preflight_passed": True,
                    }
                ],
            },
        ]

        saved_orders = []
        for ord_data in orders_mock:
            items = ord_data.pop("items")
            order_obj, created = Order.objects.update_or_create(peecho_order_id=ord_data["peecho_order_id"], defaults=ord_data)
            saved_orders.append(order_obj)
            for item in items:
                OrderItem.objects.update_or_create(order=order_obj, peecho_item_id=item["peecho_item_id"], defaults=item)

        self.stdout.write(self.style.NOTICE("Seeding Sample Production Batch with QR Job Ticket..."))
        
        batch_obj, created = ProductionBatch.objects.update_or_create(
            batch_number="BATCH-2026-0819",
            defaults={
                "paper_stock": "200gsm Silk Inner + 350gsm Hardcover Gloss",
                "size_format": "A4 Landscape (210 x 297 mm)",
                "binding_type": "HARDCOVER_CASEBOUND",
                "target_press": "HP_INDIGO_12000",
                "status": status_dict[("PRINT_JOB", "QUEUED_PRESS")],
                "total_orders_count": len(saved_orders),
                "total_items_count": sum(o.total_items_count for o in saved_orders),
                "total_sheets_count": 48,
                "priority": "RUSH",
                "assigned_operator": created_users[3],
                "notes": "HP Indigo Pallet 4 • Imposition 4-up Work & Turn",
            }
        )
        batch_obj.orders.set(saved_orders)
        ticket_res = generate_job_ticket_pdf(batch_obj)
        batch_obj.job_ticket_pdf_url = ticket_res["relative_url"]
        batch_obj.save(update_fields=["job_ticket_pdf_url"])

        self.stdout.write(self.style.NOTICE("Seeding Shopfloor Workstations..."))
        
        stations_data = [
            {
                "code": "PRINT",
                "name": "Digital Press & RIP Station",
                "category": "PRINT",
                "hardware_device_name": "HP Indigo 12000 Press Console",
                "target_status_code": "PRINTING",
                "icon": "Printer",
                "sort_order": 1,
            },
            {
                "code": "CUT_LAMINATE",
                "name": "Guillotine Cut & Lamination",
                "category": "CUT_LAMINATE",
                "hardware_device_name": "Polar 78 High-Speed Cutter + Komfi Amiga 52",
                "target_status_code": "IN_PRODUCTION",
                "icon": "Scissors",
                "sort_order": 2,
            },
            {
                "code": "BIND",
                "name": "Case-Making & Bindery Station",
                "category": "BIND",
                "hardware_device_name": "Horizon BQ-480 Perfect Binder & Kolbus Case Maker",
                "target_status_code": "IN_PRODUCTION",
                "icon": "BookOpen",
                "sort_order": 3,
            },
            {
                "code": "QC_PASS",
                "name": "Final Quality Control & Packing",
                "category": "QC_PASS",
                "hardware_device_name": "Scan-to-Pack Weight Station & Zebra ZT411",
                "target_status_code": "PACKED",
                "icon": "CheckCheck",
                "sort_order": 4,
            },
        ]

        for st in stations_data:
            st_obj, created = ShopfloorStation.objects.update_or_create(code=st["code"], defaults=st)
            action = "Created" if created else "Updated"
            self.stdout.write(f" - {action} Station: {st_obj.name}")

        self.stdout.write(self.style.SUCCESS("Successfully seeded Shopfloor Workstations."))

        self.stdout.write(self.style.NOTICE("Seeding Sample Shipments & Dispatch Manifests..."))
        from apps.dispatch.models import Shipment
        
        dispatched_order = Order.objects.filter(order_number="SP-2026-88193").first()
        if not dispatched_order:
            dispatched_order = Order.objects.first()

        if dispatched_order:
            Shipment.objects.update_or_create(
                order=dispatched_order,
                defaults={
                    "carrier_name": "DHL Express Worldwide",
                    "carrier_code": "DHL",
                    "tracking_number": "DHL-9920194812",
                    "tracking_url": "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=DHL-9920194812",
                    "awb_document_url": "https://s3.amazonaws.com/silverpoint-pod-awb-store/DHL-9920194812-label.pdf",
                    "weight_kg": Decimal("0.850"),
                    "package_type": "BUBBLE_MAILER",
                    "shipping_cost": Decimal("14.50"),
                    "currency": "USD",
                    "status_code": "IN_TRANSIT",
                    "peecho_synced": True,
                    "peecho_synced_at": timezone.now() - timedelta(hours=3),
                    "peecho_sync_attempts": 1,
                    "peecho_sync_response": {"status": "success", "code": 200, "peecho_order_id": dispatched_order.peecho_order_id, "gateway_mode": "SANDBOX_MOCK_SUCCESS"},
                    "dispatched_by_name": "Elena Rostova",
                    "dispatched_at": timezone.now() - timedelta(hours=4),
                    "carrier_events_log": [
                        {
                            "timestamp": (timezone.now() - timedelta(hours=1)).isoformat(),
                            "status": "IN_TRANSIT",
                            "location": "Leipzig Hub, Germany",
                            "description": "Processed Through Sort Facility & In Transit to Destination",
                            "carrier": "DHL Express Worldwide",
                        },
                        {
                            "timestamp": (timezone.now() - timedelta(hours=4)).isoformat(),
                            "status": "DISPATCHED",
                            "location": "Silver Point POD Hub, London, UK",
                            "description": "Shipment picked up from origin facility",
                            "carrier": "DHL Express Worldwide",
                        },
                    ],
                    "notes": "Express courier priority dispatch for Peecho SLA compliance.",
                },
            )
            self.stdout.write(f" - Seeded Shipment for order: {dispatched_order.order_number}")

        self.stdout.write(self.style.NOTICE("Seeding Dynamic Pricing Matrices & Peecho Invoices..."))
        from apps.finance.models import DynamicPricingMatrix, PeechoInvoice, InvoiceLineItem

        matrices = [
            {
                "product_type": "PAPERBACK_BOOK",
                "binding_type": "PUR_PERFECT_BOUND",
                "paper_stock_name": "130 GSM Silk Interior",
                "paper_stock_gsm": 130,
                "base_fee": Decimal("3.5000"),
                "rate_per_sheet": Decimal("0.0350"),
                "binding_cost": Decimal("2.2500"),
                "lamination_cost": Decimal("0.7500"),
                "foil_stamp_cost": Decimal("1.5000"),
                "currency": "EUR",
                "description": "Standard softcover book with thermal matte lamination.",
            },
            {
                "product_type": "HARDCOVER_BOOK",
                "binding_type": "CASE_BOUND_HARDCOVER",
                "paper_stock_name": "170 GSM Matte Art Paper",
                "paper_stock_gsm": 170,
                "base_fee": Decimal("6.8000"),
                "rate_per_sheet": Decimal("0.0480"),
                "binding_cost": Decimal("5.5000"),
                "lamination_cost": Decimal("1.1000"),
                "foil_stamp_cost": Decimal("2.0000"),
                "currency": "EUR",
                "description": "Premium 2.5mm greyboard case-bound hardcover with head/tail bands.",
            },
            {
                "product_type": "SADDLE_STITCH_BOOKLET",
                "binding_type": "SADDLE_STITCH",
                "paper_stock_name": "115 GSM Gloss",
                "paper_stock_gsm": 115,
                "base_fee": Decimal("1.8000"),
                "rate_per_sheet": Decimal("0.0240"),
                "binding_cost": Decimal("0.9500"),
                "lamination_cost": Decimal("0.4500"),
                "foil_stamp_cost": Decimal("1.2000"),
                "currency": "EUR",
                "description": "Dual wire saddle-stitched magazine / program booklet.",
            },
            {
                "product_type": "WIRE_O_CALENDAR",
                "binding_type": "WIRE_O",
                "paper_stock_name": "250 GSM Heavy Cardstock",
                "paper_stock_gsm": 250,
                "base_fee": Decimal("4.2000"),
                "rate_per_sheet": Decimal("0.0650"),
                "binding_cost": Decimal("2.1000"),
                "lamination_cost": Decimal("0.8000"),
                "foil_stamp_cost": Decimal("1.5000"),
                "currency": "EUR",
                "description": "Twin-loop wire-o desk & wall calendar with thumb cut hanger.",
            },
        ]

        for m in matrices:
            m_obj, created = DynamicPricingMatrix.objects.update_or_create(
                product_type=m["product_type"],
                binding_type=m["binding_type"],
                paper_stock_gsm=m["paper_stock_gsm"],
                defaults=m,
            )
            self.stdout.write(f" - Seeded Pricing Matrix: {m_obj}")

        # Seed sample Peecho invoice
        inv_orders = Order.objects.all()[:4]
        if inv_orders.exists():
            inv, inv_created = PeechoInvoice.objects.update_or_create(
                invoice_number="INV-2026-0001",
                defaults={
                    "billing_period": "September 2026 / W39",
                    "client_name": "Peecho B.V.",
                    "client_tax_id": "NL852093812B01",
                    "client_email": "finance@peecho.com",
                    "client_address": "Keizersgracht 421, 1016 EK Amsterdam, Netherlands",
                    "subtotal_amount": Decimal("142.50"),
                    "tax_rate_percent": Decimal("21.00"),
                    "tax_amount": Decimal("29.93"),
                    "shipping_total": Decimal("24.00"),
                    "grand_total": Decimal("196.43"),
                    "currency": "EUR",
                    "status": "ISSUED",
                    "orders_count": inv_orders.count(),
                    "issued_at": timezone.now() - timedelta(days=2),
                    "due_date": timezone.now() + timedelta(days=28),
                    "invoice_pdf_url": "/api/v1/finance/invoices/",
                    "soa_pdf_url": "/api/v1/finance/invoices/",
                    "created_by_name": "Alexander Vance",
                    "notes": "Bi-weekly consolidated statement for Peecho EU fulfillment.",
                },
            )
            inv.orders.set(inv_orders)
            self.stdout.write(f" - Seeded Invoice: {inv.invoice_number} ({inv.grand_total} EUR)")

        self.stdout.write(self.style.NOTICE("Seeding Reprint Logs, SLA Alerts, and Odoo Integration Ledgers..."))
        from apps.analytics.models import ReprintDamageLog, SLAAlertLog, OdooSyncLog

        sample_order = Order.objects.first()
        if sample_order:
            # Seed Reprint
            ReprintDamageLog.objects.update_or_create(
                reprint_code="RPR-2026-0001",
                defaults={
                    "order": sample_order,
                    "failure_reason": "PRINT_STREAKING",
                    "failure_description": "Yellow toner cartridge line streaking on pages 45-60.",
                    "reported_at_station": "QC_PASS",
                    "damaged_quantity": 1,
                    "waste_sheets_count": 64,
                    "estimated_cost_loss": Decimal("8.75"),
                    "status": "REPRINT_QUEUED",
                    "reported_by_name": "Elena Rostova",
                    "notes": "Fast-tracked with 8H rush SLA reprint batch.",
                },
            )
            self.stdout.write(" - Seeded Reprint / Damage Log: RPR-2026-0001")

            # Seed SLA Alert
            SLAAlertLog.objects.update_or_create(
                order=sample_order,
                alert_type="WHATSAPP",
                defaults={
                    "recipient": "+31681928392",
                    "hours_remaining": Decimal("1.75"),
                    "message_body": f"[SLA WARNING] Order {sample_order.order_number} for {sample_order.customer_name} is nearing SLA deadline in 1.75h.",
                    "dispatched_successfully": True,
                    "response_payload": {"status": "delivered_meta_api", "id": f"wa-{sample_order.order_number}"},
                },
            )
            self.stdout.write(" - Seeded SLA Alert: WhatsApp warning")

            # Seed Odoo Sync
            OdooSyncLog.objects.update_or_create(
                silverpoint_reference=sample_order.order_number,
                odoo_model="sale.order",
                defaults={
                    "odoo_record_id": 4819,
                    "sync_direction": "OUTBOUND_TO_ODOO",
                    "sync_status": "SYNCED",
                    "request_payload": {"client_order_ref": sample_order.peecho_order_id, "name": sample_order.order_number},
                    "response_payload": {"status": "success", "odoo_id": 4819, "model": "sale.order"},
                },
            )
            self.stdout.write(f" - Seeded Odoo Sync Log for: {sample_order.order_number}")

        self.stdout.write(self.style.SUCCESS("Database seeding completed successfully!"))
