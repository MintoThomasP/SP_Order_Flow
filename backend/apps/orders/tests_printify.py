"""
Comprehensive Integration Test Suite for Printify POD Service, Celery Tasks,
Inbound Webhooks, Status State Machine, and Strict Isolation.
"""
import json
import hmac
import hashlib
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models.lookups import EntityStatus
from apps.orders.models import Order, OrderItem, PrintifyPayloadLog
from apps.orders.services.printify import PrintifyService, PrintifyAPIError, PrintifyConfigError
from apps.orders.services.printify_status import (
    map_printify_to_canonical_status,
    resolve_orderflow_entity_status,
    map_and_resolve_status,
)
from apps.orders.tasks import sync_order_to_printify, send_order_to_printify_production


class PrintifyIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed realistic EntityStatuses for testing
        self.status_received, _ = EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="RECEIVED",
            defaults={"name": "Order Received", "sort_order": 10},
        )
        self.status_in_prod, _ = EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="IN_PRODUCTION",
            defaults={"name": "In Production", "sort_order": 40},
        )
        self.status_dispatched, _ = EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="DISPATCHED",
            defaults={"name": "Dispatched", "sort_order": 70},
        )

        # 1. External Printify Order
        self.printify_order = Order.objects.create(
            order_number="SP-PRINTIFY-1001",
            order_source="printify",
            is_external_pod=True,
            external_pod_order_id="printify_ext_778899",
            customer_name="John Doe",
            customer_email="john@example.com",
            customer_phone="+1 555 987 6543",
            shipping_address={
                "recipient_name": "John Doe",
                "street": "123 Main Street",
                "city": "Austin",
                "state": "TX",
                "postal_code": "78701",
                "country": "US",
            },
            carrier_preference="Standard Shipping",
            status=self.status_received,
            sla_deadline=timezone.now() + timezone.timedelta(hours=24),
            total_items_count=1,
            total_amount=Decimal("35.00"),
        )
        self.order_item = OrderItem.objects.create(
            order=self.printify_order,
            product_type="Unisex Heavy Cotton Tee",
            printify_product_id="prod_tee_123",
            printify_variant_id=4567,
            printify_print_provider_id=10,
            printify_blueprint_id=384,
            quantity=1,
        )

        # 2. Internal Manual Order (Strict Isolation Test)
        self.manual_order = Order.objects.create(
            order_number="SP-INTERNAL-2002",
            order_source="manual",
            is_external_pod=False,
            customer_name="Internal Press Dept",
            status=self.status_received,
            sla_deadline=timezone.now() + timezone.timedelta(hours=48),
        )

    # -------------------------------------------------------------------------
    # Test Group 1: Status State Machine Mapping
    # -------------------------------------------------------------------------
    def test_status_mapping_canonical_codes(self):
        self.assertEqual(map_printify_to_canonical_status("draft"), "PENDING")
        self.assertEqual(map_printify_to_canonical_status("pending"), "PENDING")
        self.assertEqual(map_printify_to_canonical_status("sent-to-production"), "UNDER_PRODUCTION")
        self.assertEqual(map_printify_to_canonical_status("in-production"), "UNDER_PRODUCTION")
        self.assertEqual(map_printify_to_canonical_status("shipped"), "DISPATCHED")
        self.assertEqual(map_printify_to_canonical_status("fulfilled"), "DISPATCHED")
        self.assertEqual(map_printify_to_canonical_status("canceled"), "CANCELLED")

    def test_status_mapping_entity_status_resolution(self):
        code, status_obj = map_and_resolve_status("in-production")
        self.assertEqual(code, "UNDER_PRODUCTION")
        self.assertIsNotNone(status_obj)
        self.assertEqual(status_obj.code, "IN_PRODUCTION")

        code, status_obj = map_and_resolve_status("fulfilled")
        self.assertEqual(code, "DISPATCHED")
        self.assertIsNotNone(status_obj)
        self.assertEqual(status_obj.code, "DISPATCHED")

    # -------------------------------------------------------------------------
    # Test Group 2: PrintifyService API Client
    # -------------------------------------------------------------------------
    @patch("requests.Session.request")
    def test_service_submit_order(self, mock_request):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.content = b'{"id": "pf_order_9988", "status": "pending"}'
        mock_resp.json.return_value = {"id": "pf_order_9988", "status": "pending"}
        mock_request.return_value = mock_resp

        service = PrintifyService(api_token="test_token_123", shop_id="shop_999")
        payload = service.build_order_payload(self.printify_order)

        self.assertEqual(payload["external_id"], "SP-PRINTIFY-1001")
        self.assertEqual(payload["address_to"]["first_name"], "John")
        self.assertEqual(payload["address_to"]["last_name"], "Doe")

        result = service.submit_order(payload)
        self.assertEqual(result["id"], "pf_order_9988")
        mock_request.assert_called_once()

    @patch("requests.Session.request")
    def test_service_send_to_production(self, mock_request):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.content = b'{"id": "pf_order_9988", "status": "in-production"}'
        mock_resp.json.return_value = {"id": "pf_order_9988", "status": "in-production"}
        mock_request.return_value = mock_resp

        service = PrintifyService(api_token="test_token_123", shop_id="shop_999")
        result = service.send_to_production("pf_order_9988")
        self.assertEqual(result["status"], "in-production")

    @patch("requests.Session.request")
    def test_service_register_webhooks(self, mock_request):
        # First call lists existing webhooks (empty), subsequent calls create each topic
        mock_list_resp = MagicMock()
        mock_list_resp.ok = True
        mock_list_resp.content = b"[]"
        mock_list_resp.json.return_value = []

        mock_post_resp = MagicMock()
        mock_post_resp.ok = True
        mock_post_resp.content = b'{"id": "wh_123"}'
        mock_post_resp.json.return_value = {"id": "wh_123"}

        mock_request.side_effect = [mock_list_resp, mock_post_resp, mock_post_resp, mock_post_resp]

        service = PrintifyService(api_token="test_token_123", shop_id="shop_999")
        res = service.register_webhooks("https://example.com/api/v1/webhooks/printify/")
        self.assertEqual(len(res), 3)
        topics = [r["topic"] for r in res]
        self.assertIn("order:shipment:created", topics)
        self.assertIn("order:sent-to-production", topics)
        self.assertIn("order:updated", topics)

    # -------------------------------------------------------------------------
    # Test Group 3: Strict Isolation Guard in Celery Tasks
    # -------------------------------------------------------------------------
    @patch("apps.orders.services.printify.PrintifyService.submit_order")
    def test_strict_isolation_bypasses_manual_orders(self, mock_submit):
        # Call Celery task synchronously for internal manual order
        result = sync_order_to_printify(str(self.manual_order.id))
        self.assertEqual(result["status"], "bypassed")
        self.assertIn("isolated", result["reason"].lower())
        mock_submit.assert_not_called()

    # -------------------------------------------------------------------------
    # Test Group 4: Inbound Webhook: order:shipment:created
    # -------------------------------------------------------------------------
    def test_webhook_order_shipment_created_updates_tracking_and_status(self):
        webhook_payload = {
            "id": "evt_shipment_001",
            "type": "order:shipment:created",
            "shop_id": 999,
            "created_at": "2026-10-26T12:00:00.000Z",
            "resource": {
                "id": "printify_ext_778899",
                "external_id": "SP-PRINTIFY-1001",
                "status": "fulfilled",
                "shipments": [
                    {
                        "carrier": "FedEx Priority",
                        "number": "FEDEX-TRACK-991283",
                        "url": "https://fedex.com/track?num=FEDEX-TRACK-991283",
                        "delivered_at": None,
                    }
                ],
            },
        }

        url = "/api/v1/webhooks/printify/"
        response = self.client.post(
            url,
            data=json.dumps(webhook_payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "success")

        # Verify internal Order database record was updated
        self.printify_order.refresh_from_db()
        self.assertEqual(self.printify_order.tracking_number, "FEDEX-TRACK-991283")
        self.assertEqual(self.printify_order.carrier_preference, "FedEx Priority")
        self.assertEqual(self.printify_order.status.code, "DISPATCHED")

        # Verify audit log created
        log = PrintifyPayloadLog.objects.filter(printify_order_id="printify_ext_778899").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, "PROCESSED")
        self.assertEqual(log.event_type, "order:shipment:created")

    # -------------------------------------------------------------------------
    # Test Group 5: Webhook Signature Verification & Invalid Payloads
    # -------------------------------------------------------------------------
    def test_webhook_signature_verification_enforcement(self):
        secret = "test_webhook_secret_key"
        raw_body = json.dumps({"type": "test_event"}).encode("utf-8")
        valid_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

        with self.settings(PRINTIFY_WEBHOOK_SECRET=secret):
            # 1. Invalid signature should be rejected with 401
            bad_response = self.client.post(
                "/api/v1/webhooks/printify/",
                data=raw_body,
                content_type="application/json",
                HTTP_X_PRINTIFY_SIGNATURE="bad_signature_abc",
            )
            self.assertEqual(bad_response.status_code, 401)
            self.assertIn("Invalid webhook signature", bad_response.json()["error"])

            # 2. Valid signature should be accepted with 200
            good_response = self.client.post(
                "/api/v1/webhooks/printify/",
                data=raw_body,
                content_type="application/json",
                HTTP_X_PRINTIFY_SIGNATURE=valid_signature,
            )
            self.assertEqual(good_response.status_code, 200)

    def test_webhook_malformed_json_graceful_handling(self):
        response = self.client.post(
            "/api/v1/webhooks/printify/",
            data="broken_non_json_string",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid JSON format", response.json()["error"])

    # -------------------------------------------------------------------------
    # Test Group 6: Multi-Channel Order Simulation Endpoint
    # -------------------------------------------------------------------------
    def test_simulate_printify_order(self):
        response = self.client.post(
            "/api/v1/orders/simulate/",
            data={"source": "printify", "priority": "RUSH_8H"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["channel"], "Printify POD")
        self.assertEqual(data["order"]["order_source"], "printify")
        self.assertTrue(data["order"]["is_external_pod"])
        self.assertTrue(data["order"]["external_pod_order_id"].startswith("PF-"))
        self.assertEqual(data["order"]["sla_priority"], "RUSH_8H")

    def test_simulate_custom_api_order(self):
        response = self.client.post(
            "/api/v1/orders/simulate/",
            data={"source": "custom_api", "priority": "EXPRESS_24H"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["channel"], "Custom POD / REST API")
        self.assertEqual(data["order"]["order_source"], "custom_api")
        self.assertFalse(data["order"]["is_external_pod"])
        self.assertTrue(data["order"]["external_pod_order_id"].startswith("API-EXT-"))

    def test_simulate_manual_order(self):
        response = self.client.post(
            "/api/v1/orders/simulate/",
            data={"source": "manual", "priority": "STANDARD_72H"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["channel"], "Internal / Manual")
        self.assertEqual(data["order"]["order_source"], "manual")
        self.assertFalse(data["order"]["is_external_pod"])
        self.assertIsNone(data["order"]["external_pod_order_id"])
