"""
Management command to clear all operational, transactional, and mock data
while safely retaining system lookups and the Super Admin account.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.authentication.models import User, UserAuditLog
from apps.orders.models import Order, OrderItem, PeechoPayloadLog, PrintifyPayloadLog
from apps.prepress.models import ArtworkVerification
from apps.production.models import ProductionBatch
from apps.shopfloor.models import ScanEventLog
from apps.dispatch.models import Shipment
from apps.finance.models import PeechoInvoice, InvoiceLineItem


class Command(BaseCommand):
    help = "Clears all orders, logs, batches, shipments, invoices, and staff users EXCEPT the super admin."

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep-staff",
            action="store_true",
            help="Keep non-superuser staff accounts as well.",
        )

    def handle(self, *args, **options):
        keep_staff = options.get("keep_staff", False)

        self.stdout.write(self.style.WARNING("Starting system data clearance..."))

        with transaction.atomic():
            # 1. Audit and Scan Logs
            audit_count, _ = UserAuditLog.objects.all().delete()
            scan_count, _ = ScanEventLog.objects.all().delete()

            # 2. Finance
            inv_items_count, _ = InvoiceLineItem.objects.all().delete()
            invoices_count, _ = PeechoInvoice.objects.all().delete()

            # 3. Logistics & Production
            shipments_count, _ = Shipment.objects.all().delete()
            batches_count, _ = ProductionBatch.objects.all().delete()

            # 4. Prepress
            artwork_count, _ = ArtworkVerification.objects.all().delete()

            # 5. Orders & Line Items
            items_count, _ = OrderItem.objects.all().delete()
            orders_count, _ = Order.objects.all().delete()

            # 6. Webhook Payload Logs
            peecho_logs_count, _ = PeechoPayloadLog.objects.all().delete()
            printify_logs_count, _ = PrintifyPayloadLog.objects.all().delete()

            # 7. Staff users
            users_deleted_count = 0
            if not keep_staff:
                users_deleted_count, _ = User.objects.exclude(is_superuser=True).delete()

            # 8. Ensure Super Admin user exists and has active credentials
            superadmin = User.objects.filter(is_superuser=True).first()
            if not superadmin:
                superadmin = User.objects.create_superuser(
                    email="admin@silverpointpod.com",
                    password="Admin@123456",
                    first_name="Alexander",
                    last_name="Vance",
                )
                self.stdout.write(self.style.SUCCESS("Created fresh Super Admin: admin@silverpointpod.com"))
            else:
                superadmin.is_active = True
                superadmin.is_staff = True
                superadmin.set_password("Admin@123456")
                superadmin.save()

        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("SYSTEM DATA CLEARED SUCCESSFULLY"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(f"• Orders deleted: {orders_count}")
        self.stdout.write(f"• Order Items deleted: {items_count}")
        self.stdout.write(f"• Artwork Preflight Verifications deleted: {artwork_count}")
        self.stdout.write(f"• Production Batches deleted: {batches_count}")
        self.stdout.write(f"• Dispatch Shipments deleted: {shipments_count}")
        self.stdout.write(f"• Invoices deleted: {invoices_count}")
        self.stdout.write(f"• Scan Event Logs deleted: {scan_count}")
        self.stdout.write(f"• User Audit Logs deleted: {audit_count}")
        self.stdout.write(f"• Peecho Payload Logs deleted: {peecho_logs_count}")
        self.stdout.write(f"• Printify Payload Logs deleted: {printify_logs_count}")
        if not keep_staff:
            self.stdout.write(f"• Non-Admin Users deleted: {users_deleted_count}")

        self.stdout.write(self.style.SUCCESS("\nACTIVE SUPER ADMIN LOGIN RETAINED:"))
        self.stdout.write(f"  Email:    {superadmin.email}")
        self.stdout.write(f"  Password: Admin@123456")
        self.stdout.write(f"  Role:     SUPER_ADMIN (is_superuser=True, is_staff=True)")
