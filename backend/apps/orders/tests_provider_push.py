"""
Unit and Integration Tests for the Common Service Provider Push API.
Covers authentication, HMAC verification, dual provider_code validation,
idempotency (200 DUPLICATE vs 409 CONFLICT), order/item/prepress creation,
commercial/event print metadata, sandbox isolation, and status/tracking pushes.
"""
import hashlib
import hmac
import json
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models.lookups import EntityStatus
from apps.dispatch.models import Shipment
from apps.orders.models import Order, OrderItem, ProviderIngestionLog, ServiceProvider
from apps.prepress.models import ArtworkVerification


class CommonProviderPushAPITests(TestCase):
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
        EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="DISPATCHED",
            defaults={"name": "Dispatched", "sort_order": 70},
        )
        EntityStatus.objects.get_or_create(
            entity_type="ORDER",
            code="CANCELLED",
            defaults={"name": "Cancelled", "sort_order": 99},
        )

        self.provider_a = ServiceProvider.objects.create(
            provider_code="PRINTEMIRATES",
            name="PrintEmirates Commercial & Event Print",
            require_hmac=False,
            default_currency="AED",
            default_carrier="Aramex International",
        )
        self.creds_a = self.provider_a.generate_credentials()

        self.provider_b = ServiceProvider.objects.create(
            provider_code="NORDIC_BOOKS",
            name="Nordic Books POD",
            require_hmac=True,
            default_currency="EUR",
            default_carrier="DHL Express",
        )
        self.creds_b = self.provider_b.generate_credentials()

    def _base_order_payload(self, provider_code="PRINTEMIRATES", external_order_id="PE-2026-1001"):
        return {
            "provider_code": provider_code,
            "external_order_id": external_order_id,
            "priority": "EXPRESS_24H",
            "currency": "AED",
            "total_amount": "450.00",
            "carrier_preference": "Aramex International",
            "event_name": "GITEX Global 2026",
            "event_date": "2026-10-12",
            "customer": {
                "name": "Tariq Al Mansoor",
                "email": "tariq@exhibitor.ae",
                "phone": "+971501234567",
                "company": "Emirates Tech Expo LLC",
            },
            "shipping_address": {
                "recipient_name": "Tariq Al Mansoor",
                "street": "Dubai World Trade Centre, Hall 4",
                "city": "Dubai",
                "state": "Dubai",
                "postal_code": "00000",
                "country": "AE",
            },
            "items": [
                {
                    "external_item_id": "PE-ITEM-1",
                    "product_type": "Roll-Up Banner Stand 85x200cm",
                    "category": "EVENT_SIGNAGE",
                    "quantity": 4,
                    "dimensions": "850mm x 2000mm",
                    "material": "330gsm Anti-Curl PVC",
                    "finish": "Matte Lamination + Aluminum Cassette",
                    "artwork_url": "https://cdn.printemirates.ae/jobs/1001/banner_print.pdf",
                    "proof_url": "https://cdn.printemirates.ae/jobs/1001/banner_proof.pdf",
                    "proof_status": "APPROVED",
                    "custom_specs": {"grommets": False, "carry_bag": True},
                }
            ],
        }

    def _post_json(self, url, payload, token=None, extra_headers=None):
        raw_bytes = json.dumps(payload).encode("utf-8")
        headers = {}
        if token:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        if extra_headers:
            headers.update(extra_headers)
        return self.client.generic(
            "POST",
            url,
            data=raw_bytes,
            content_type="application/json",
            **headers,
        )

    def _sign(self, payload: dict, secret: str) -> str:
        raw_bytes = json.dumps(payload).encode("utf-8")
        digest = hmac.new(secret.encode("utf-8"), raw_bytes, hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    # ------------------------------------------------------------------
    # Authentication & Dual Provider Verification
    # ------------------------------------------------------------------
    def test_missing_credentials_returns_401(self):
        payload = self._base_order_payload()
        resp = self._post_json("/api/v1/providers/orders/", payload)
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data["error"], "MISSING_CREDENTIALS")
        self.assertTrue(ProviderIngestionLog.objects.filter(id=resp.data["log_id"], status="INVALID_AUTH").exists())

    def test_invalid_token_returns_401(self):
        payload = self._base_order_payload()
        resp = self._post_json("/api/v1/providers/orders/", payload, token="sp_prv_invalid_token_123")
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data["error"], "INVALID_CREDENTIALS")

    def test_inactive_provider_returns_403(self):
        self.provider_a.is_active = False
        self.provider_a.save(update_fields=["is_active"])
        payload = self._base_order_payload()
        resp = self._post_json("/api/v1/providers/orders/", payload, token=self.creds_a["api_token"])
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.data["error"], "PROVIDER_INACTIVE")

    def test_provider_code_mismatch_returns_403(self):
        payload = self._base_order_payload(provider_code="NORDIC_BOOKS")
        resp = self._post_json("/api/v1/providers/orders/", payload, token=self.creds_a["api_token"])
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.data["error"], "PROVIDER_MISMATCH")
        log = ProviderIngestionLog.objects.get(id=resp.data["log_id"])
        self.assertEqual(log.status, "PROVIDER_MISMATCH")

    def test_hmac_required_rejects_missing_or_invalid_signature_and_accepts_valid(self):
        payload = self._base_order_payload(provider_code="NORDIC_BOOKS", external_order_id="NB-9001")
        # Missing signature
        resp_missing = self._post_json("/api/v1/providers/orders/", payload, token=self.creds_b["api_token"])
        self.assertEqual(resp_missing.status_code, 401)
        self.assertEqual(resp_missing.data["error"], "INVALID_SIGNATURE")

        # Invalid signature
        resp_bad = self._post_json(
            "/api/v1/providers/orders/",
            payload,
            token=self.creds_b["api_token"],
            extra_headers={"HTTP_X_PROVIDER_SIGNATURE": "sha256=deadbeef"},
        )
        self.assertEqual(resp_bad.status_code, 401)

        # Valid signature
        sig = self._sign(payload, self.creds_b["webhook_secret"])
        resp_ok = self._post_json(
            "/api/v1/providers/orders/",
            payload,
            token=self.creds_b["api_token"],
            extra_headers={"HTTP_X_PROVIDER_SIGNATURE": sig},
        )
        self.assertEqual(resp_ok.status_code, 201)

    # ------------------------------------------------------------------
    # Payload Validation & Malformed JSON
    # ------------------------------------------------------------------
    def test_malformed_json_returns_400(self):
        resp = self.client.generic(
            "POST",
            "/api/v1/providers/orders/",
            data=b"{bad-json",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.creds_a['api_token']}",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["error"], "BAD_REQUEST")

    def test_missing_artwork_url_returns_422(self):
        payload = self._base_order_payload()
        del payload["items"][0]["artwork_url"]
        resp = self._post_json("/api/v1/providers/orders/", payload, token=self.creds_a["api_token"])
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.data["error"], "VALIDATION_ERROR")

    # ------------------------------------------------------------------
    # Order Ingestion, Prepress Seeding & Cross-Provider Isolation
    # ------------------------------------------------------------------
    def test_order_push_creates_order_item_and_artwork_verification(self):
        payload = self._base_order_payload()
        resp = self._post_json(
            "/api/v1/providers/orders/",
            payload,
            token=self.creds_a["api_token"],
            extra_headers={"HTTP_IDEMPOTENCY_KEY": "idem-pe-1001"},
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "PROCESSED")
        self.assertEqual(resp.data["provider_code"], "PRINTEMIRATES")

        order = Order.objects.get(service_provider=self.provider_a, external_pod_order_id="PE-2026-1001")
        self.assertEqual(order.order_source, "provider_api")
        self.assertFalse(order.is_external_pod)
        self.assertFalse(order.is_sandbox)
        self.assertEqual(order.status.code, "RECEIVED")
        self.assertEqual(order.total_items_count, 4)
        self.assertEqual(order.total_amount, Decimal("450.00"))
        self.assertEqual(order.peecho_metadata["event_name"], "GITEX Global 2026")

        item = OrderItem.objects.get(order=order)
        self.assertEqual(item.product_type, "Roll-Up Banner Stand 85x200cm")
        self.assertIn("330gsm Anti-Curl PVC", item.paper_stock)
        self.assertTrue(item.preflight_passed)
        self.assertEqual(item.metadata["dimensions"], "850mm x 2000mm")

        self.assertEqual(ArtworkVerification.objects.filter(order=order, order_item=item).count(), 1)

    def test_same_external_order_id_allowed_across_different_providers(self):
        payload_a = self._base_order_payload(provider_code="PRINTEMIRATES", external_order_id="SHARED-100")
        resp_a = self._post_json("/api/v1/providers/orders/", payload_a, token=self.creds_a["api_token"])
        self.assertEqual(resp_a.status_code, 201)

        payload_b = self._base_order_payload(provider_code="NORDIC_BOOKS", external_order_id="SHARED-100")
        sig_b = self._sign(payload_b, self.creds_b["webhook_secret"])
        resp_b = self._post_json(
            "/api/v1/providers/orders/",
            payload_b,
            token=self.creds_b["api_token"],
            extra_headers={"HTTP_X_PROVIDER_SIGNATURE": sig_b},
        )
        self.assertEqual(resp_b.status_code, 201)
        self.assertEqual(Order.objects.filter(external_pod_order_id="SHARED-100").count(), 2)

    # ------------------------------------------------------------------
    # Idempotency & Conflict Handling
    # ------------------------------------------------------------------
    def test_idempotency_duplicate_returns_200_and_conflict_returns_409(self):
        payload = self._base_order_payload(external_order_id="PE-IDEM-1")
        resp1 = self._post_json(
            "/api/v1/providers/orders/",
            payload,
            token=self.creds_a["api_token"],
            extra_headers={"HTTP_IDEMPOTENCY_KEY": "key-123"},
        )
        self.assertEqual(resp1.status_code, 201)

        # Exact retry -> 200 DUPLICATE
        resp2 = self._post_json(
            "/api/v1/providers/orders/",
            payload,
            token=self.creds_a["api_token"],
            extra_headers={"HTTP_IDEMPOTENCY_KEY": "key-123"},
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "DUPLICATE")
        self.assertEqual(Order.objects.filter(external_pod_order_id="PE-IDEM-1").count(), 1)

        # Different payload with same Idempotency-Key -> 409 CONFLICT
        modified_payload = dict(payload)
        modified_payload["total_amount"] = "999.00"
        resp3 = self._post_json(
            "/api/v1/providers/orders/",
            modified_payload,
            token=self.creds_a["api_token"],
            extra_headers={"HTTP_IDEMPOTENCY_KEY": "key-123"},
        )
        self.assertEqual(resp3.status_code, 409)
        self.assertEqual(resp3.data["error"], "IDEMPOTENCY_CONFLICT")

    # ------------------------------------------------------------------
    # Sandbox Mode
    # ------------------------------------------------------------------
    def test_sandbox_order_gets_test_order_status(self):
        payload = self._base_order_payload(external_order_id="PE-SANDBOX-1")
        payload["is_sandbox"] = True
        resp = self._post_json("/api/v1/providers/orders/", payload, token=self.creds_a["api_token"])
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["is_sandbox"])
        order = Order.objects.get(external_pod_order_id="PE-SANDBOX-1")
        self.assertTrue(order.is_sandbox)
        self.assertEqual(order.status.code, "TEST_ORDER")

    # ------------------------------------------------------------------
    # Status & Tracking Push
    # ------------------------------------------------------------------
    def test_status_and_tracking_push_updates_order_and_shipment(self):
        create_payload = self._base_order_payload(external_order_id="PE-TRACK-1")
        self.assertEqual(
            self._post_json("/api/v1/providers/orders/", create_payload, token=self.creds_a["api_token"]).status_code,
            201,
        )

        status_payload = {
            "provider_code": "PRINTEMIRATES",
            "status": "DISPATCHED",
            "notes": "Handed over to Aramex courier",
            "tracking": {
                "carrier": "Aramex International",
                "carrier_code": "ARAMEX",
                "tracking_number": "ARX-99887766",
                "tracking_url": "https://www.aramex.com/track/results?ShipmentNumber=ARX-99887766",
            },
        }
        resp = self._post_json(
            "/api/v1/providers/orders/PE-TRACK-1/status/",
            status_payload,
            token=self.creds_a["api_token"],
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["order_status"], "DISPATCHED")
        self.assertEqual(resp.data["tracking_number"], "ARX-99887766")

        order = Order.objects.get(service_provider=self.provider_a, external_pod_order_id="PE-TRACK-1")
        self.assertEqual(order.status.code, "DISPATCHED")
        self.assertEqual(order.tracking_number, "ARX-99887766")

        shipment = Shipment.objects.get(order=order)
        self.assertEqual(shipment.tracking_number, "ARX-99887766")
        self.assertEqual(shipment.carrier_code, "ARAMEX")

        # Cross-provider status update must be rejected with 404
        cross_payload = {"provider_code": "NORDIC_BOOKS", "status": "CANCELLED"}
        sig_b = self._sign(cross_payload, self.creds_b["webhook_secret"])
        cross_resp = self._post_json(
            "/api/v1/providers/orders/PE-TRACK-1/status/",
            cross_payload,
            token=self.creds_b["api_token"],
            extra_headers={"HTTP_X_PROVIDER_SIGNATURE": sig_b},
        )
        self.assertEqual(cross_resp.status_code, 404)
        self.assertEqual(cross_resp.data["error"], "ORDER_NOT_FOUND")

    # ------------------------------------------------------------------
    # Dual-Environment Keys (sp_test_... vs sp_live_...) & Channel Management
    # ------------------------------------------------------------------
    def test_channel_registration_and_independent_key_rotation(self):
        create_resp = self.client.post(
            "/api/v1/providers/channels/",
            {
                "name": "Gulf Print Hub",
                "provider_code": "gulf_print",
                "default_currency": "AED",
                "default_carrier": "Aramex International",
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        creds = create_resp.data["credentials"]
        channel_id = create_resp.data["channel"]["id"]
        self.assertEqual(creds["provider_code"], "GULF_PRINT")
        self.assertTrue(creds["test_api_key"].startswith("sp_test_"))
        self.assertTrue(creds["live_api_key"].startswith("sp_live_"))

        # List endpoint must only expose masked hints, never raw keys
        list_resp = self.client.get("/api/v1/providers/channels/")
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.data.get("results", list_resp.data)
        gulf = next(c for c in items if c["provider_code"] == "GULF_PRINT")
        self.assertTrue(gulf["test_api_key_masked"].startswith("sp_test_"))
        self.assertTrue(gulf["live_api_key_masked"].startswith("sp_live_"))

        # Push with sp_test_... -> automatically tagged is_sandbox=True, TEST_ORDER
        test_payload = self._base_order_payload(provider_code="GULF_PRINT", external_order_id="GP-TEST-1")
        r_test = self._post_json("/api/v1/providers/orders/", test_payload, token=creds["test_api_key"])
        self.assertEqual(r_test.status_code, 201)
        self.assertTrue(r_test.data["is_sandbox"])
        self.assertEqual(Order.objects.get(external_pod_order_id="GP-TEST-1").status.code, "TEST_ORDER")

        # Push with sp_live_... -> automatically tagged is_sandbox=False, RECEIVED
        live_payload = self._base_order_payload(provider_code="GULF_PRINT", external_order_id="GP-LIVE-1")
        r_live = self._post_json("/api/v1/providers/orders/", live_payload, token=creds["live_api_key"])
        self.assertEqual(r_live.status_code, 201)
        self.assertFalse(r_live.data["is_sandbox"])
        self.assertEqual(Order.objects.get(external_pod_order_id="GP-LIVE-1").status.code, "RECEIVED")

        # Rotate ONLY test key -> old test key fails, new test key works, live key is unaffected!
        rot_resp = self.client.post(
            f"/api/v1/providers/channels/{channel_id}/rotate-key/",
            {"environment": "test"},
            format="json",
        )
        self.assertEqual(rot_resp.status_code, 200)
        new_test_key = rot_resp.data["credentials"]["test_api_key"]
        self.assertTrue(new_test_key.startswith("sp_test_"))
        self.assertNotEqual(new_test_key, creds["test_api_key"])

        old_test_fail = self._post_json(
            "/api/v1/providers/orders/",
            self._base_order_payload(provider_code="GULF_PRINT", external_order_id="GP-TEST-2"),
            token=creds["test_api_key"],
        )
        self.assertEqual(old_test_fail.status_code, 401)

        new_test_ok = self._post_json(
            "/api/v1/providers/orders/",
            self._base_order_payload(provider_code="GULF_PRINT", external_order_id="GP-TEST-2"),
            token=new_test_key,
        )
        self.assertEqual(new_test_ok.status_code, 201)
        self.assertTrue(new_test_ok.data["is_sandbox"])

        live_still_ok = self._post_json(
            "/api/v1/providers/orders/",
            self._base_order_payload(provider_code="GULF_PRINT", external_order_id="GP-LIVE-2"),
            token=creds["live_api_key"],
        )
        self.assertEqual(live_still_ok.status_code, 201)
        self.assertFalse(live_still_ok.data["is_sandbox"])

        # Encrypted-at-rest key retrieval & per-channel PDF generation
        gulf_obj = ServiceProvider.objects.get(id=channel_id)
        self.assertEqual(gulf_obj.get_decrypted_test_key(), new_test_key)
        self.assertEqual(gulf_obj.get_decrypted_live_key(), creds["live_api_key"])

        pdf_resp_omitted = self.client.get(
            f"/api/v1/providers/channels/{channel_id}/documentation-pdf/",
            {"include_test_key": "false", "include_production_key": "false"},
        )
        self.assertEqual(pdf_resp_omitted.status_code, 200)
        self.assertEqual(pdf_resp_omitted["Content-Type"], "application/pdf")
        self.assertIn("GULF_PRINT-api-integration-guide.pdf", pdf_resp_omitted["Content-Disposition"])
        self.assertTrue(pdf_resp_omitted.content.startswith(b"%PDF-"))

        pdf_resp_both = self.client.post(
            f"/api/v1/providers/channels/{channel_id}/documentation-pdf/",
            {"include_test_key": True, "include_production_key": True},
            format="json",
        )
        self.assertEqual(pdf_resp_both.status_code, 200)
        self.assertEqual(pdf_resp_both["Content-Type"], "application/pdf")
        self.assertTrue(pdf_resp_both.content.startswith(b"%PDF-"))

