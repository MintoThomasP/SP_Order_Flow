# Silver Point - Peecho Integration & Workflow Guide

**Partner**: Silver Point Print-on-Demand (UAE / India Region)  
**Client**: Peecho B.V. (Netherlands)  
**Fulfillment SLA**: 24 to 48 Hours (Production)

---

## 1. Architecture & Domains

- **Platform Stack**: Django REST Framework (Backend) & Next.js (Frontend) — Single Domain Architecture hosted on AWS with S3 storage.

| Environment | Webhook Endpoint URL | Security & Key Routing |
| :--- | :--- | :--- |
| **Production (Live)** | `https://orderflow.silverpointprint.com/api/v1/peecho/webhook/` | Signed with `PEECHO_PRODUCTION_SECRET_KEY` in `X-Peecho-Signature` (`is_sandbox = False`) |
| **Staging (Sandbox)** | `https://orderflow.silverpointprint.com/api/v1/peecho/webhook/` | Signed with `PEECHO_STAGING_SECRET_KEY` in `X-Peecho-Signature` (`is_sandbox = True`, isolated from live press & billing) |

---

## 2. Simple Workflow Overview (5 Steps)

1. **Step 1: Ingestion**
   - Peecho sends orders in real time via the single Inbound Webhook (`https://orderflow.silverpointprint.com/api/v1/peecho/webhook/`).
   - Orders authenticated with `PEECHO_STAGING_SECRET_KEY` are automatically tagged with `is_sandbox = True` (`TEST_ORDER`) to keep them isolated from live production queues and financial billing, while orders authenticated with `PEECHO_PRODUCTION_SECRET_KEY` enter live production (`is_sandbox = False`).
2. **Step 2: Prepress**
   - Print-ready interior and cover PDFs are downloaded from AWS S3 and checked for DPI resolution, trim size, spine width, and bleed margins.
3. **Step 3: Batching & Job Tickets**
   - Approved orders are grouped by paper stock (GSM), size format, and binding method, and printable **QR Job Tickets** are generated.
4. **Step 4: Shopfloor Printing**
   - Press operators scan the QR Job Ticket using a mobile phone camera or barcode scanner to update live shopfloor status:
     `Printing` → `Binding` → `QC`.
5. **Step 5: Dispatch & Callback**
   - Shipping staff scan the courier AWB barcode label, pack the parcel, and the system automatically pushes the shipment tracking details back to Peecho.

---

## 3. API Integration Specs

### A. Inbound Webhook (Peecho → Silver Point)
- **Endpoint**: `POST /api/v1/peecho/webhook/`
- **Authentication**: `X-Peecho-Signature: sha256=<hmac_hex>` (HMAC-SHA256)
- **Purpose**: Receives customer order details, shipping address, line items, and print PDF links.

**Sample Request Payload:**
```json
{
  "event": "order.created",
  "order_id": "PEECHO-904120",
  "priority": "EXPRESS_24H",
  "currency": "EUR",
  "total_amount": "48.50",
  "carrier": "DHL Express",
  "customer": {
    "name": "Jan de Vries",
    "email": "jan@example.nl",
    "phone": "+31 20 794 0100"
  },
  "shipping_address": {
    "recipient_name": "Jan de Vries",
    "street": "Keizersgracht 241",
    "city": "Amsterdam",
    "postal_code": "1016 EA",
    "country": "NL"
  },
  "items": [
    {
      "item_id": "ITEM-01",
      "product_type": "Hardcover Photo Book A4",
      "quantity": 1,
      "page_count": 64,
      "spine_width_mm": 9.5,
      "paper_stock": "200gsm Silk Inner + 350gsm Matte Cover",
      "pdf_artwork_url": "https://s3.eu-west-1.amazonaws.com/peecho-print/904120/interior.pdf",
      "pdf_cover_url": "https://s3.eu-west-1.amazonaws.com/peecho-print/904120/cover.pdf"
    }
  ]
}
```

**Response (`201 Created`):**
```json
{
  "status": "success",
  "order_number": "ORD-2026-1001",
  "peecho_order_id": "PEECHO-904120",
  "environment": "PRODUCTION",
  "is_sandbox": false
}
```

---

### B. Outbound Shipment Callback (Silver Point → Peecho)
- **Endpoint**: `POST /v2/orders/{id}/shipment`
- **Trigger**: Automatically fired when the courier AWB barcode is scanned at the Dispatch station.
- **Purpose**: Sends the tracking number, courier name, tracking link, and dispatch timestamp back to Peecho.

**Sample Callback Payload:**
```json
{
  "peecho_order_id": "PEECHO-904120",
  "carrier": "DHL Express",
  "tracking_code": "1234567890",
  "shipment_date": "2026-11-04T14:30:00Z",
  "tracking_url": "https://www.dhl.com/en/express/tracking.html?AWB=1234567890"
}
```

