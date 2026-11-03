# Silver Point Gateway - Peecho API Technical Specification

## 1. Architecture Summary
The **Silver Point Gateway** connects Peecho's cloud platform directly to Silver Point's Print-on-Demand (POD) manufacturing infrastructure:
* **Backend Core:** Python 3.12 / Django REST Framework (DRF) with OpenAPI 3.0 compliance.
* **Frontend Portal:** Next.js 16 operations, prepress, and shopfloor dispatch interface.
* **Asset Storage:** AWS S3 (`silverpoint-pod-artwork-vault`) for streaming high-resolution interior/cover PDFs and archiving courier Air Waybills (AWBs).
* **Async Task Queue:** Celery 5.4+ workers backed by a Redis 7.x broker for non-blocking file downloads, courier label generation, and tracking callback retries.

```
   [ Peecho Cloud ]
          │
          │  1. Inbound Webhook (Live or Staging Subdomain)
          ▼
[ Silver Point Gateway (DRF / AWS S3 / Redis) ] ──▶ [ Shopfloor Printing & Dispatch ]
          │                                                        │
          │  2. Outbound Tracking Callback                         │ (AWB Barcode Scan)
          ◀────────────────────────────────────────────────────────┘
             (POST /v2/orders/{id}/shipment)
```

---

## 2. Endpoint Specifications (Inbound Webhooks)

| Environment | Webhook Endpoint URL | Authentication & Security | Processing Behavior |
| :--- | :--- | :--- | :--- |
| **Live Production** | `POST https://orderflow.silverpointprint.com/api/v1/peecho/webhook/` | HMAC-SHA256 Signature (`X-Peecho-Signature`) via `PEECHO_PRODUCTION_SECRET_KEY` + TLS 1.3 | Creates live production order (`status = RECEIVED`, `is_sandbox = False`) and starts SLA timer. |
| **Staging Sandbox** | `POST https://staging.orderflow.silverpointprint.com/api/v1/peecho/webhook/` | Sandbox Secret Key Validation (`X-Peecho-Signature`) via `PEECHO_STAGING_SECRET_KEY` | Marks order as `is_sandbox = True` and `status = TEST_ORDER`. Excluded from live press queues and billing. |

### Expected HTTP Status Codes
* **`201 Created`**: Order validated, deduplicated, and queued for S3 download (< 400 ms response).
* **`200 OK`**: Duplicate payload hash detected (`status: "DUPLICATE"`); safely ignored without duplicate printing.
* **`400 Bad Request`**: Malformed JSON body or missing required schema fields.
* **`401 Unauthorized`**: Invalid or missing `X-Peecho-Signature` HMAC-SHA256 digest (`status: "INVALID_AUTH"`).

### Inbound Webhook JSON Payload Sample
```json
{
  "event": "order.created",
  "order_id": "PEECHO-881920",
  "priority": "EXPRESS_24H",
  "currency": "EUR",
  "total_amount": "45.00",
  "customer": {
    "name": "Alexander van der Meer",
    "email": "a.vandermeer@example.nl",
    "phone": "+31 20 123 4567"
  },
  "shipping_address": {
    "recipient_name": "Alexander van der Meer",
    "street": "Prinsengracht 263",
    "city": "Amsterdam",
    "postal_code": "1016 GV",
    "country": "NL",
    "carrier": "DHL Express"
  },
  "items": [
    {
      "item_id": "ITEM-101",
      "product_type": "Hardcover Photo Book A4",
      "quantity": 1,
      "page_count": 48,
      "spine_width_mm": 12.4,
      "paper_stock": "200gsm Silk Inner + 350gsm Gloss Cover",
      "pdf_artwork_url": "https://assets.peecho.com/orders/881920/content_hires.pdf",
      "pdf_cover_url": "https://assets.peecho.com/orders/881920/cover_hires.pdf"
    }
  ]
}
```

---

## 3. Outbound Tracking Callback (Silver Point to Peecho)

* **Trigger Endpoint:** `POST https://api.peecho.com/v2/orders/{id}/shipment`
* **Trigger Condition:** Dispatched automatically by Celery within **< 5 seconds** after the operator scans the courier AWB barcode at the dispatch station.
* **Headers:** `Authorization: Bearer <PEECHO_API_KEY>`, `X-Peecho-Button-Key: <BUTTON_KEY>`, `Content-Type: application/json`

### Outbound Tracking JSON Payload Sample
```json
{
  "peecho_order_id": "PEECHO-881920",
  "silverpoint_order_number": "SP-2026-10492",
  "carrier": "DHL Express",
  "carrier_code": "DHL",
  "tracking_code": "3491029410",
  "shipment_date": "2026-11-03T14:30:00Z",
  "shipped_at": "2026-11-03T14:30:00Z",
  "tracking_url": "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=3491029410",
  "awb_url": "https://silverpoint-pod-artwork-vault.s3.eu-west-1.amazonaws.com/awb/AWB-3491029410.pdf",
  "weight_in_grams": 850
}
```

---

## 4. Error Handling & Retry Logic

If Peecho's callback endpoint experiences a timeout or network interruption, Silver Point's Celery worker (`sync_shipment_to_peecho_task`) automatically retries using exponential backoff:

| Retry Attempt | Backoff Delay | Behavior & Failover Action |
| :---: | :---: | :--- |
| **Attempt 1** | **+30 seconds** | Immediate retry for transient socket or TLS resets. |
| **Attempt 2** | **+2 minutes** | Secondary retry during upstream deployment windows. |
| **Attempt 3** | **+10 minutes** | Intermediate retry; warning logged to Operations Portal. |
| **Attempt 4** | **+1 hour** | Final automated retry before Dead-Letter Queue (DLQ) escalation. |
| **DLQ Escalation** | **Manual Sync** | Flagged with `peecho_synced = False` in the Dispatch Portal for 1-click re-sync. |

* **Idempotency:** All outbound requests are keyed by `peecho_order_id`, allowing safe retries without creating duplicate shipment records.

---
*Silver Point Printing & Digital Solutions L.L.C. &bull; Engineering & Gateway Integration*
