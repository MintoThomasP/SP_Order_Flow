from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models.lookups import EntityStatus, SystemRole
from apps.authentication.models import User
from apps.orders.models import Order
from apps.analytics.models import ReprintDamageLog, SLAAlertLog, OdooSyncLog
from apps.analytics.services.damage_reprint import report_and_requeue_damaged_print
from apps.analytics.services.sla_alerts import evaluate_sla_and_dispatch_alerts
from apps.analytics.services.odoo_sync import sync_entity_to_odoo


class AnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.role = SystemRole.objects.create(
            code="PRODUCTION_MANAGER",
            name="Production Manager",
            description="Supervisor of POD production floor",
        )
        self.user = User.objects.create_user(
            email="manager@silverpointpod.com",
            password="Password123!",
            first_name="Marcus",
            last_name="Vance",
            role=self.role,
        )

        self.status_in_prod = EntityStatus.objects.create(
            entity_type="ORDER",
            code="IN_PRODUCTION",
            name="In Production",
            sort_order=40,
        )

        self.order = Order.objects.create(
            order_number="SP-2026-77001",
            peecho_order_id="PEECHO-77001",
            customer_name="Artisanal Press Inc",
            customer_email="buyer@artisanal.io",
            status=self.status_in_prod,
            sla_deadline=timezone.now() + timedelta(hours=1.5),  # Approaching SLA breach
            total_amount=Decimal("19.50"),
        )

    def test_report_and_requeue_damaged_print(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/v1/analytics/report-damage/",
            data={
                "order_identifier": "SP-2026-77001",
                "failure_reason": "TRIM_DEFECT",
                "failure_description": "Guillotine offset trimmed 2mm into content.",
                "reported_at_station": "CUT_LAMINATE",
                "waste_sheets_count": 48,
                "estimated_cost_loss": "12.50",
                "auto_requeue": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["elevated_priority"], "RUSH_8H")

        # Verify order priority elevated
        self.order.refresh_from_db()
        self.assertEqual(self.order.sla_priority, "RUSH_8H")

        # Verify ReprintDamageLog created
        reprint_log = ReprintDamageLog.objects.filter(order=self.order).first()
        self.assertIsNotNone(reprint_log)
        self.assertEqual(reprint_log.failure_reason, "TRIM_DEFECT")
        self.assertEqual(reprint_log.status, "REPRINT_QUEUED")

    def test_evaluate_sla_alerts(self):
        result = evaluate_sla_and_dispatch_alerts(warning_hours_threshold=3.0)
        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["total_at_risk_orders"], 1)

        alert_count = SLAAlertLog.objects.filter(order=self.order).count()
        self.assertGreaterEqual(alert_count, 1)

    def test_dashboard_metrics_endpoint(self):
        response = self.client.get("/api/v1/analytics/dashboard-metrics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("daily_volume", response.data)
        self.assertIn("courier_distribution", response.data)
        self.assertIn("station_turnarounds", response.data)
        self.assertEqual(len(response.data["daily_volume"]), 7)

    def test_odoo_sync_gateway(self):
        result = sync_entity_to_odoo(model_name="sale.order", reference_id="SP-2026-77001")
        self.assertTrue(result["success"])
        self.assertEqual(result["odoo_model"], "sale.order")
        self.assertIn("client_order_ref", result["payload"])

        odoo_log = OdooSyncLog.objects.filter(silverpoint_reference="SP-2026-77001").first()
        self.assertIsNotNone(odoo_log)
        self.assertEqual(odoo_log.sync_status, "SYNCED")

    def test_odoo_feed_endpoints(self):
        # Sale orders feed
        res1 = self.client.get("/api/v1/analytics/odoo/sale-orders/")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res1.data, list)

        # Pickings feed
        res2 = self.client.get("/api/v1/analytics/odoo/pickings/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res2.data, list)

        # Invoices feed
        res3 = self.client.get("/api/v1/analytics/odoo/invoices/")
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res3.data, list)
