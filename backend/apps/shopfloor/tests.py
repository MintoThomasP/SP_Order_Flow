from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models.lookups import EntityStatus, SystemRole
from apps.authentication.models import User, UserAuditLog
from apps.orders.models import Order
from apps.production.models import ProductionBatch
from apps.shopfloor.models import ShopfloorStation, ScanEventLog


class ShopfloorScanTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed roles and statuses
        self.role = SystemRole.objects.create(
            code="SHOPFLOOR_OPERATOR",
            name="Shopfloor Operator",
            description="Operator on POD press floor",
        )
        self.user = User.objects.create_user(
            email="operator@silverpointpod.com",
            password="Password123!",
            first_name="Marcus",
            last_name="Vance",
            role=self.role,
        )

        self.status_queued = EntityStatus.objects.create(
            entity_type="ORDER",
            code="QUEUED",
            name="Queued",
            sort_order=10,
        )
        self.status_printing = EntityStatus.objects.create(
            entity_type="ORDER",
            code="PRINTING",
            name="Printing",
            sort_order=20,
        )
        self.status_in_prod = EntityStatus.objects.create(
            entity_type="ORDER",
            code="IN_PRODUCTION",
            name="In Production",
            sort_order=30,
        )
        self.status_packed = EntityStatus.objects.create(
            entity_type="ORDER",
            code="PACKED",
            name="Packed / QC Passed",
            sort_order=40,
        )

        # Create test order
        self.order = Order.objects.create(
            order_number="SP-2026-90412",
            peecho_order_id="PEECHO-881920",
            customer_name="Artisanal Press Inc",
            customer_email="buyer@artisanal.io",
            status=self.status_queued,
            sla_deadline=timezone.now() + timedelta(hours=24),
        )

        # Create test station
        self.station = ShopfloorStation.objects.create(
            code="PRINT",
            name="Digital Press",
            hardware_device_name="HP Indigo 12000",
            target_status_code="PRINTING",
        )

    def test_scan_order_barcode_instant_transition(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            "/api/v1/shopfloor/update-status/",
            data={
                "barcode": "SP-2026-90412",
                "station": "PRINT",
                "status_code": "PRINTING",
                "notes": "Color calibration passed",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["reference"], "SP-2026-90412")
        self.assertEqual(response.data["new_status"], "Printing")

        # Verify Order state changed
        self.order.refresh_from_db()
        self.assertEqual(self.order.status.code, "PRINTING")

        # Verify ScanEventLog created
        scan_log = ScanEventLog.objects.filter(entity_reference="SP-2026-90412").first()
        self.assertIsNotNone(scan_log)
        self.assertEqual(scan_log.station, "PRINT")
        self.assertEqual(scan_log.new_status, "Printing")

        # Verify UserAuditLog
        audit_log = UserAuditLog.objects.filter(resource_id="SP-2026-90412").first()
        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.action, "STATUS_CHANGE")

    def test_scan_peecho_order_id(self):
        response = self.client.patch(
            "/api/v1/shopfloor/update-status/",
            data={
                "barcode": "PEECHO-881920",
                "station": "QC_PASS",
                "status_code": "PACKED",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status.code, "PACKED")

    def test_scan_invalid_barcode_returns_404(self):
        response = self.client.patch(
            "/api/v1/shopfloor/update-status/",
            data={
                "barcode": "NON-EXISTENT-BARCODE-999",
                "station": "PRINT",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(response.data["success"])
