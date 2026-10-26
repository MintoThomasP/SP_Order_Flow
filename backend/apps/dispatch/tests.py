from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models.lookups import EntityStatus, SystemRole
from apps.authentication.models import User, UserAuditLog
from apps.orders.models import Order
from apps.dispatch.models import Shipment
from apps.dispatch.services.peecho_callback import sync_shipment_to_peecho
from apps.dispatch.services.courier_poller import poll_carrier_status


class DispatchTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.role = SystemRole.objects.create(
            code="DISPATCH_SPECIALIST",
            name="Dispatch Specialist",
            description="Specialist handling courier logistics",
        )
        self.user = User.objects.create_user(
            email="dispatch@silverpointpod.com",
            password="Password123!",
            first_name="Elena",
            last_name="Rostova",
            role=self.role,
        )

        self.status_packed = EntityStatus.objects.create(
            entity_type="ORDER",
            code="PACKED",
            name="Packed & Labelled",
            sort_order=60,
        )
        self.status_dispatched = EntityStatus.objects.create(
            entity_type="ORDER",
            code="DISPATCHED",
            name="Dispatched",
            sort_order=70,
        )
        self.status_delivered = EntityStatus.objects.create(
            entity_type="ORDER",
            code="DELIVERED",
            name="Delivered",
            sort_order=80,
        )

        self.order = Order.objects.create(
            order_number="SP-2026-90412",
            peecho_order_id="PEECHO-881920",
            customer_name="Artisanal Press Inc",
            customer_email="buyer@artisanal.io",
            shipping_address={"city": "Amsterdam", "country": "NL", "street": "Keizersgracht 42"},
            status=self.status_packed,
            sla_deadline=timezone.now() + timedelta(hours=24),
        )

    def test_confirm_dispatch_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/v1/dispatch/confirm-shipment/",
            data={
                "order_identifier": "SP-2026-90412",
                "carrier_code": "DHL",
                "carrier_name": "DHL Express Worldwide",
                "tracking_number": "DHL-8891029310",
                "weight_kg": "0.750",
                "package_type": "BUBBLE_MAILER",
                "notes": "Verified fragile packaging",
                "trigger_peecho_sync": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["shipment"]["tracking_number"], "DHL-8891029310")

        # Verify Shipment created and Order transitioned
        self.order.refresh_from_db()
        self.assertEqual(self.order.status.code, "DISPATCHED")

        shipment = Shipment.objects.filter(tracking_number="DHL-8891029310").first()
        self.assertIsNotNone(shipment)
        self.assertTrue(shipment.peecho_synced)
        self.assertEqual(shipment.peecho_sync_attempts, 1)

    def test_peecho_callback_sync_and_retry(self):
        shipment = Shipment.objects.create(
            order=self.order,
            carrier_name="FedEx Priority",
            carrier_code="FEDEX",
            tracking_number="FDX-11223344",
            weight_kg=1.200,
            status_code="DISPATCHED",
        )

        result = sync_shipment_to_peecho(str(shipment.id))
        self.assertTrue(result["success"])
        self.assertEqual(result["peecho_order_id"], "PEECHO-881920")

        shipment.refresh_from_db()
        self.assertTrue(shipment.peecho_synced)
        self.assertIsNotNone(shipment.peecho_synced_at)

    def test_courier_poller_milestone_progression(self):
        shipment = Shipment.objects.create(
            order=self.order,
            carrier_name="DHL Express Worldwide",
            carrier_code="DHL",
            tracking_number="DHL-99887766",
            status_code="DISPATCHED",
        )

        # Polling advances DISPATCHED -> IN_TRANSIT
        poll_res = poll_carrier_status(str(shipment.id))
        self.assertTrue(poll_res["success"])
        self.assertEqual(poll_res["current_status"], "IN_TRANSIT")

        shipment.refresh_from_db()
        self.assertEqual(shipment.status_code, "IN_TRANSIT")
        self.assertEqual(len(shipment.carrier_events_log), 1)
