# Silver Point POD — Common Service Provider Push API

**Version:** `1.0`  
**Audience:** External Print & Service Providers (Commercial Print, Event Signage, Book/POD Partners)

This specification defines the **single, standardized inbound REST API** that external service providers use to push orders and status/tracking updates directly into **Silver Point POD (ORDERFLOW)**.

---

## 1. Base URLs & Endpoints

| Environment | Base URL |
| :--- | :--- |
| **Production** | `https://orderflow.silverpointprint.com/api/v1` |
| **Staging / Sandbox** | `https://staging.orderflow.silverpointprint.com/api/v1` |
| **Local Development** | `http://127.0.0.1:8000/api/v1` |

### Available Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/providers/orders/` | Push a new order (POD or commercial/event print) into Silver Point POD |
| `POST` | `/providers/orders/status/` | Push a status and/or tracking update (`external_order_id` in JSON body) |
| `POST` | `/providers/orders/{external_order_id}/status/` | Push a status and/or tracking update (`external_order_id` in URL path) |

---

## 2. Authentication & Dual Provider Verification

Every request MUST identify the calling service provider through **both** cryptographic credentials and an explicit provider identifier in the payload.

### Required Headers

| Header | Required | Description |
| :--- | :--- | :--- |
| `Content-Type` | **Yes** | Must be `application/json` |
| `Authorization` | **Yes** *(or `X-API-Key`)* | `Bearer <provider_api_token>` issued during onboarding |
| `X-API-Key` | Alternative to `Authorization` | `<provider_api_token>` |
| `X-Provider-Signature` | Conditional | Required if `require_hmac` is enabled for your account: `sha256=<hex_hmac_sha256(webhook_secret, raw_request_body)>` |
| `X-Provider-Code` | Optional | Must match your assigned `provider_code` if sent |
| `Idempotency-Key` | Recommended | Unique UUID/key per logical request to make retries safe |
| `X-Sandbox-Mode` | Optional | Set to `true` to force sandbox (`TEST_ORDER`) ingestion |

### How Identity & Environment Verification Works
1. Silver Point resolves your `ServiceProvider` profile and environment from your `Bearer` / `X-API-Key` token (constant-time SHA-256 hash comparison):
   - **Test / Sandbox Key (`sp_test_...`)**: Automatically routes the order to **Sandbox Mode** (`is_sandbox=true`, `status=TEST_ORDER`), isolated from live press and billing queues.
   - **Production / Live Key (`sp_live_...`)**: Automatically routes the order to **Production Mode** (`is_sandbox=false`, `status=RECEIVED`).
2. If `require_hmac` is enabled on your profile, Silver Point verifies `X-Provider-Signature` against the raw UTF-8 request body using `hmac.compare_digest`.
3. Silver Point checks that `provider_code` in the JSON body (and `X-Provider-Code`, if present) **exactly matches** the authenticated provider's `provider_code`. Any mismatch is rejected with **`403 Forbidden` (`PROVIDER_MISMATCH`)**.

---

## 3. Endpoint 1: Push New Order (`POST /providers/orders/`)

### Top-Level Fields

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `provider_code` | `string` | **Yes** | Your assigned uppercase provider code (e.g. `PRINTEMIRATES`) |
| `external_order_id` | `string` | **Yes** | Your unique order reference ID (unique per provider) |
| `priority` | `string` | No | SLA tier: `RUSH_8H`, `EXPRESS_24H`, `STANDARD_72H` (default) |
| `sla_deadline` | `ISO-8601 datetime` | No | Explicit UTC deadline; overrides `priority` calculation if supplied |
| `currency` | `string` | No | 3-letter ISO currency code (e.g. `AED`, `EUR`, `USD`) |
| `total_amount` | `decimal/string` | No | Total order value (default `"0.00"`) |
| `carrier_preference` | `string` | No | Preferred courier (e.g. `DHL Express`, `Aramex International`) |
| `is_sandbox` | `boolean` | No | Set `true` to mark as test order (`TEST_ORDER`) |
| `environment` | `string` | No | `production`, `sandbox`, `staging`, or `test` |
| `event_name` | `string` | No | Event/campaign name for commercial/event print jobs |
| `event_date` | `string` | No | Event date (`YYYY-MM-DD`) |
| `notes` | `string` | No | Special production or delivery instructions |
| `metadata` | `object` | No | Arbitrary key/value metadata preserved on the order |
| `customer` | `object` | **Yes** | Recipient/buyer contact object |
| `shipping_address` | `object` | **Yes** | Delivery destination object |
| `items` | `array<object>` | **Yes** | Non-empty list of print line items |

### `customer` Object

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | **Yes** | Customer full name |
| `email` | `string` | No | Customer email address |
| `phone` | `string` | No | Customer phone number |
| `company` | `string` | No | Company or organization name |

### `shipping_address` Object

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `recipient_name` | `string` | No | Defaults to `customer.name` if omitted |
| `street` | `string` | **Yes** | Street address / venue / hall |
| `street2` | `string` | No | Apartment, suite, or booth number |
| `city` | `string` | **Yes** | City |
| `state` | `string` | No | State / Emirate / Province |
| `postal_code` | `string` | No | Postal / ZIP code |
| `country` | `string` | **Yes** | 2-letter ISO country code or country name |
| `phone` | `string` | No | Delivery contact phone |

### `items[]` Object

Supports both **Standard POD / Book** specs and **Commercial / Event Print** specs:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `external_item_id` | `string` | No | Your line-item ID |
| `product_type` | `string` | **Yes** | Product title (e.g. `Hardcover Photo Book A4`, `Roll-Up Banner Stand 85x200cm`) |
| `category` | `string` | No | Product category (e.g. `PHOTOBOOK`, `EVENT_SIGNAGE`, `MARKETING_PRINT`) |
| `quantity` | `integer` | **Yes** | Must be `>= 1` |
| `pdf_artwork_url` *(or `artwork_url`)* | `string` | **Yes** | Downloadable URL to print-ready artwork PDF/file |
| `pdf_cover_url` | `string` | No | Cover wrap PDF URL (for bound books) |
| `proof_url` | `string` | No | Visual proof PDF/image URL |
| `proof_status` | `string` | No | `PENDING` (default), `APPROVED`, `REJECTED`, `NOT_REQUIRED` |
| `page_count` | `integer` | No | Page count for multi-page documents (default `1`) |
| `spine_width_mm` | `decimal` | No | Spine width in mm (default `0.00`) |
| `paper_stock` | `string` | No | Paper/substrate spec (if omitted, built from `material`, `finish`, `dimensions`) |
| `dimensions` | `string` | No | Finished size (e.g. `850mm x 2000mm`, `A4`) |
| `material` | `string` | No | Substrate/material (e.g. `330gsm Anti-Curl PVC`) |
| `finish` | `string` | No | Finishing (e.g. `Matte Lamination + Aluminum Cassette`) |
| `custom_specs` | `object` | No | Extra item-level specifications |

### Sample Request A: Standard Print/POD Book Order

```json
{
  "provider_code": "NORDIC_BOOKS",
  "external_order_id": "NB-2026-88412",
  "priority": "EXPRESS_24H",
  "currency": "EUR",
  "total_amount": "64.50",
  "carrier_preference": "DHL Express",
  "customer": {
    "name": "Astrid Lindqvist",
    "email": "astrid@nordicbooks.se",
    "phone": "+46 8 555 0199"
  },
  "shipping_address": {
    "recipient_name": "Astrid Lindqvist",
    "street": "Kungsgatan 44",
    "city": "Stockholm",
    "postal_code": "111 35",
    "country": "SE"
  },
  "items": [
    {
      "external_item_id": "NB-ITEM-1",
      "product_type": "Hardcover Photo Book A4",
      "category": "PHOTOBOOK",
      "quantity": 2,
      "page_count": 48,
      "spine_width_mm": "12.50",
      "paper_stock": "200gsm Silk Inner + 350gsm Hardcover Gloss",
      "pdf_artwork_url": "https://cdn.nordicbooks.se/orders/88412/interior.pdf",
      "pdf_cover_url": "https://cdn.nordicbooks.se/orders/88412/cover.pdf",
      "proof_status": "PENDING"
    }
  ]
}
```

### Sample Request B: Commercial / Event Print Order (PrintEmirates-Style)

```json
{
  "provider_code": "PRINTEMIRATES",
  "external_order_id": "PE-2026-1001",
  "priority": "RUSH_8H",
  "currency": "AED",
  "total_amount": "1450.00",
  "carrier_preference": "Aramex International",
  "event_name": "GITEX Global 2026",
  "event_date": "2026-10-12",
  "notes": "Deliver to Hall 4 loading bay before 09:00 GST.",
  "customer": {
    "name": "Tariq Al Mansoor",
    "email": "tariq@exhibitor.ae",
    "phone": "+971501234567",
    "company": "Emirates Tech Expo LLC"
  },
  "shipping_address": {
    "recipient_name": "Tariq Al Mansoor",
    "street": "Dubai World Trade Centre, Hall 4",
    "street2": "Booth H4-B12",
    "city": "Dubai",
    "state": "Dubai",
    "postal_code": "00000",
    "country": "AE"
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
      "custom_specs": {
        "carry_bag": true,
        "double_sided": false
      }
    }
  ]
}
```

---

## 4. Endpoint 2: Push Status / Tracking Update (`POST /providers/orders/status/`)

Use this endpoint to push status transitions (such as `CANCELLED`, `EXCEPTION_HOLD`, or fulfillment/tracking updates) for an order belonging to your `provider_code`.

### Allowed Status Values
`RECEIVED`, `PREPRESS_QUEUED`, `PREPRESS_PASSED`, `BATCHED`, `IN_PRODUCTION`, `PRINTING`, `QUALITY_AUDIT`, `PRODUCTION_COMPLETED`, `PACKED`, `READY_FOR_DISPATCH`, `DISPATCHED` (aliases: `SHIPPED`, `FULFILLED`), `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `EXCEPTION_HOLD` (alias: `ON_HOLD`), `REPRINT_QUEUED`, `CANCELLED`.

### Allowed `tracking.carrier_code` Values
`DHL`, `FEDEX`, `ARAMEX`, `UPS`, `BLUEDART`, `DTDC`, `INDIA_POST`, `SELF_DELIVERY`, `CUSTOM` (default).

### Sample Status & Tracking Update Request

```json
{
  "provider_code": "PRINTEMIRATES",
  "external_order_id": "PE-2026-1001",
  "status": "DISPATCHED",
  "notes": "Handed over to Aramex courier at Dubai hub.",
  "tracking": {
    "carrier": "Aramex International",
    "carrier_code": "ARAMEX",
    "tracking_number": "ARX-99887766",
    "tracking_url": "https://www.aramex.com/track/results?ShipmentNumber=ARX-99887766"
  }
}
```

---

## 5. Sample Success & Error Responses

### `201 Created` — Order Ingested
```json
{
  "status": "PROCESSED",
  "message": "Provider order successfully ingested.",
  "provider_code": "PRINTEMIRATES",
  "external_order_id": "PE-2026-1001",
  "order_number": "SP-2026-1042",
  "is_sandbox": false,
  "log_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "order": {
    "id": "8c1b2e44-1234-4a11-9b88-112233445566",
    "order_number": "SP-2026-1042",
    "order_source": "provider_api",
    "external_pod_order_id": "PE-2026-1001"
  }
}
```

### `200 OK` — Duplicate Order (Idempotent Retry)
```json
{
  "status": "DUPLICATE",
  "message": "Order already ingested; returning existing record.",
  "provider_code": "PRINTEMIRATES",
  "external_order_id": "PE-2026-1001",
  "order_number": "SP-2026-1042",
  "order_id": "8c1b2e44-1234-4a11-9b88-112233445566",
  "is_sandbox": false,
  "log_id": "7a9c1234-5717-4562-b3fc-2c963f66afa6"
}
```

### `200 OK` — Status Updated
```json
{
  "status": "PROCESSED",
  "message": "Order status updated successfully.",
  "provider_code": "PRINTEMIRATES",
  "external_order_id": "PE-2026-1001",
  "order_number": "SP-2026-1042",
  "order_status": "DISPATCHED",
  "tracking_number": "ARX-99887766",
  "log_id": "9b2d4567-5717-4562-b3fc-2c963f66afa6"
}
```

### Error Responses

| HTTP Status | Error Code | When It Occurs |
| :--- | :--- | :--- |
| `400 Bad Request` | `BAD_REQUEST` | Empty or malformed JSON body |
| `401 Unauthorized` | `MISSING_CREDENTIALS` / `INVALID_CREDENTIALS` / `INVALID_SIGNATURE` | Missing/invalid Bearer token or HMAC signature |
| `403 Forbidden` | `PROVIDER_MISMATCH` / `PROVIDER_INACTIVE` / `IP_NOT_ALLOWED` | Payload `provider_code` does not match authenticated token, or provider is disabled |
| `404 Not Found` | `ORDER_NOT_FOUND` | `external_order_id` does not exist for your `provider_code` |
| `409 Conflict` | `IDEMPOTENCY_CONFLICT` | Same `Idempotency-Key` reused with a different payload |
| `422 Unprocessable Entity` | `VALIDATION_ERROR` / `UNSUPPORTED_STATUS` | Missing required fields, invalid types, or unknown status |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected server failure (include `log_id` when contacting support) |

Sample `403` (`PROVIDER_MISMATCH`):
```json
{
  "error": "PROVIDER_MISMATCH",
  "message": "Payload provider_code 'OTHER_VENDOR' does not match authenticated provider 'PRINTEMIRATES'.",
  "log_id": "b12e8899-5717-4562-b3fc-2c963f66afa6"
}
```

Sample `422` (`VALIDATION_ERROR`):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Payload validation failed.",
  "details": {
    "items": [
      {
        "pdf_artwork_url": [
          "Either 'pdf_artwork_url' or 'artwork_url' is required for each item."
        ]
      }
    ]
  },
  "log_id": "c45f0011-5717-4562-b3fc-2c963f66afa6"
}
```

---

## 6. Idempotency & Retry Rules

1. Always generate a unique **`Idempotency-Key`** (e.g., UUID v4) per order push or status event.
2. On network timeouts or `5xx` responses, retry with **exponential backoff** (e.g. `1s`, `2s`, `4s`, `8s`, `16s`) using the **exact same** `Idempotency-Key` and JSON body.
3. Do **not** retry `400`, `401`, `403`, `409`, or `422` responses without fixing the request payload or credentials.
4. Silver Point also enforces uniqueness on `(service_provider, external_order_id)`, so duplicate order pushes return `200 OK` (`"status": "DUPLICATE"`) instead of creating duplicate jobs.

---

## 7. Onboarding & Testing Checklist for New Providers

1. **Provision Channel & Dual Keys**: Silver Point Operations registers your channel (via **POD Integration → Custom API** or `POST /api/v1/providers/channels/`), issuing two independent keys:
   - **Test / Sandbox Key (`sp_test_...`)**
   - **Production / Live Key (`sp_live_...`)**
2. **Sandbox Smoke Test**: Send a test `POST /providers/orders/` authenticated with your `sp_test_...` key and confirm `201 Created` with `"is_sandbox": true` (routed to `TEST_ORDER`, excluded from live press & billing).
3. **Idempotency & Mismatch Verification**:
   - Resend the exact same payload + `Idempotency-Key` and confirm `200 OK` (`"status": "DUPLICATE"`).
   - Confirm invalid `provider_code` returns `403 PROVIDER_MISMATCH`.
4. **Go-Live**: Switch your `Authorization: Bearer` header to your `sp_live_...` key (and target the Production Base URL). Test and Production keys can be rotated independently at any time via `POST /api/v1/providers/channels/{id}/rotate-key/`.

