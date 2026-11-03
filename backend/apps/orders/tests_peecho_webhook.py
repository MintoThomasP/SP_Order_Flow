import hashlib
import hmac
import json
from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient
from apps.orders.models import Order, PeechoPayloadLog
from apps.core.models.lookups import EntityStatus


class PeechoStagingAndProductionWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="RECEIVED",
            defaults={"name": "Order Received", "sort_order": 10},
        )
        EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="TEST_ORDER",
            defaults={"name": "Test Order (Sandbox)", "sort_order": 5},
        )

    def _sign_payload(self, payload: dict, secret: str) -> tuple[bytes, str]:
        raw_bytes = json.dumps(payload).encode("utf-8")
        digest = hmac.new(secret.encode("utf-8"), raw_bytes, hashlib.sha256).hexdigest()
        return raw_bytes, f"sha256={digest}"

    def test_production_webhook_creates_live_order(self):
        payload = {
            "event": "order.created",
            "order_id": "PEECHO-PROD-1001",
            "priority": "EXPRESS_24H",
            "total_amount": "55.00",
            "currency": "EUR",
            "customer": {"name": "Production Customer", "email": "prod@example.nl"},
        }
        raw_bytes, signature = self._sign_payload(payload, settings.PEECHO_PRODUCTION_SECRET_KEY)

        response = self.client.generic(
            "POST",
            "/api/v1/peecho/webhook/",
            data=raw_bytes,
            content_type="application/json",
            HTTP_HOST="orderflow.silverpointprint.com",
            HTTP_X_PEECHO_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["environment"], "PRODUCTION")
        self.assertFalse(response.data["is_sandbox"])

        order = Order.objects.get(peecho_order_id="PEECHO-PROD-1001")
        self.assertFalse(order.is_sandbox)
        self.assertEqual(order.status.code, "RECEIVED")

    def test_staging_subdomain_marks_test_order_and_excludes_from_press_and_invoice(self):
        payload = {
            "event": "order.created",
            "order_id": "PEECHO-STAGING-2001",
            "priority": "STANDARD_72H",
            "total_amount": "35.00",
            "currency": "EUR",
            "customer": {"name": "Staging Tester", "email": "staging@example.nl"},
        }
        raw_bytes, signature = self._sign_payload(payload, settings.PEECHO_STAGING_SECRET_KEY)

        response = self.client.generic(
            "POST",
            "/api/v1/peecho/webhook/",
            data=raw_bytes,
            content_type="application/json",
            HTTP_HOST="staging-orderflow.silverpointprint.com",
            HTTP_X_PEECHO_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["environment"], "STAGING_SANDBOX")
        self.assertTrue(response.data["is_sandbox"])

        test_order = Order.objects.get(peecho_order_id="PEECHO-STAGING-2001")
        self.assertTrue(test_order.is_sandbox)
        self.assertEqual(test_order.status.code, "TEST_ORDER")

        # Verify excluded from eligible production batch orders
        eligible_resp = self.client.get("/api/v1/production/batches/eligible-orders/")
        self.assertEqual(eligible_resp.status_code, 200)
        eligible_ids = [o["id"] for o in eligible_resp.data]
        self.assertNotIn(str(test_order.id), eligible_ids)

        # Verify blocked from batch creation
        batch_resp = self.client.post(
            "/api/v1/production/batches/",
            {"order_ids": [str(test_order.id)], "target_press": "HP_INDIGO_12000"},
            format="json",
        )
        self.assertEqual(batch_resp.status_code, 400)

        # Verify blocked from real invoice generation
        invoice_resp = self.client.post(
            "/api/v1/finance/generate-invoice/",
            {"order_ids": [str(test_order.id)]},
            format="json",
        )
        self.assertEqual(invoice_resp.status_code, 400)

    def test_invalid_hmac_signature_returns_401(self):
        payload = {"event": "order.created", "order_id": "PEECHO-HACK-999"}
        raw_bytes = json.dumps(payload).encode("utf-8")

        response = self.client.generic(
            "POST",
            "/api/v1/peecho/webhook/",
            data=raw_bytes,
            content_type="application/json",
            HTTP_HOST="orderflow.silverpointprint.com",
            HTTP_X_PEECHO_SIGNATURE="sha256=invalid_signature_digest_0000",
        )

        self.assertEqual(response.status_code, 401)
        log = PeechoPayloadLog.objects.get(peecho_order_id="PEECHO-HACK-999")
        self.assertEqual(log.status, "INVALID_AUTH")

    def test_env_secret_keys_are_read_only_from_admin(self):
        # Verify GET returns the .env secret keys
        get_resp = self.client.get("/api/v1/peecho/config/")
        self.assertEqual(get_resp.status_code, 200)
        orig_prod_key = get_resp.data["production_secret_key"]
        orig_stg_key = get_resp.data["staging_secret_key"]
        self.assertTrue(len(orig_prod_key) > 0)
        self.assertTrue(len(orig_stg_key) > 0)

        # Attempting to overwrite production_secret_key / staging_secret_key from Admin is ignored
        save_resp = self.client.post(
            "/api/v1/peecho/config/",
            {
                "production_secret_key": "attempted_admin_override_prod",
                "staging_secret_key": "attempted_admin_override_stg",
            },
            format="json",
        )
        self.assertEqual(save_resp.status_code, 200)
        self.assertEqual(save_resp.data["config"]["production_secret_key"], orig_prod_key)
        self.assertEqual(save_resp.data["config"]["staging_secret_key"], orig_stg_key)


