# Silver Point - Peecho Production & Staging Workflow Manual

## 1. Executive Overview & Operational Goals
**Silver Point Printing & Digital Solutions** operates as the authorized regional Print-on-Demand (POD) production partner for **Peecho (Netherlands)** across the UAE, GCC, and India.

Using the **ORDERFLOW** manufacturing portal, Peecho orders are ingested via real-time webhooks, verified against ISO/FOGRA prepress standards, batched for HP Indigo digital presses, tracked on the shopfloor via mobile/barcode scanning, and dispatched with automated tracking callbacks.

---

## 2. Production & Staging Environment Matrix

| Environment | Portal Domain | Inbound Webhook URL | Security & Order Isolation |
| :--- | :--- | :--- | :--- |
| **Production (Live)** | `https://orderflow.silverpointprint.com` | `https://orderflow.silverpointprint.com/api/v1/peecho/webhook/` | HMAC-SHA256 (`X-Peecho-Signature`) + TLS 1.3. Orders enter live press queues (`is_sandbox = False`, `status = RECEIVED`) and B2B billing. |
| **Staging (Sandbox)** | `https://staging.orderflow.silverpointprint.com` | `https://staging.orderflow.silverpointprint.com/api/v1/peecho/webhook/` | Sandbox Secret Key validation (`PEECHO_STAGING_SECRET_KEY`). Orders are tagged with `is_sandbox = True` and `status = TEST_ORDER`, strictly isolated from live print queues and invoicing. |

---

## 3. 6-Step End-to-End Workflow Breakdown

```
[1. Order Ingestion] ──▶ [2. Prepress PDF Check] ──▶ [3. Batching & QR Ticket]
                                                               │
[6. Peecho Callback] ◀── [5. Dispatch AWB Scan]  ◀── [4. Mobile Press Scan]
```

### Step 1: Order Ingestion
* Peecho pushes JSON order payloads to the Production or Staging webhook endpoint (`POST /api/v1/peecho/webhook/`).
* The gateway verifies the `X-Peecho-Signature` HMAC-SHA256 digest, deduplicates via SHA-256 payload hashing, and assigns internal tracker `SP-2026-XXXXX`.
* Staging requests are automatically flagged with `is_sandbox = True` (`TEST_ORDER`) so test runs never enter physical production.

### Step 2: Prepress PDF Inspection
* High-resolution interior and cover PDFs are streamed to AWS S3 (`silverpoint-pod-artwork-vault`).
* Automated preflight and prepress specialists verify **300 DPI** image resolution, **3.0 mm** trim bleed, CMYK color profiles, and spine caliper thickness (`PREPRESS_PASSED`).

### Step 3: Grouping Batching & Job Ticket Printing
* Live approved orders (`is_sandbox = False`) are grouped into optimized batches (`ProductionBatch`) by paper GSM (130gsm, 170gsm, 200gsm), trim format (A4, A5, Square), and binding method (Hardcover Casebound, Softcover PUR, Saddle Stitch).
* ReportLab compiles a printable A4 Job Ticket containing a 2D QR code (`SP-POD-BATCH:<id>|PRESS:<machine>`) and 1D item barcodes (`BATCHED`).

### Step 4: Mobile Camera Scanning at Press Stations
* Shopfloor operators scan the QR Job Ticket using mobile phone cameras or wireless 2D barcode scanners as the job moves across stations:
  * **Queued** (`BATCHED`) $\rightarrow$ **Printing** on HP Indigo (`PRINTING`) $\rightarrow$ **Cutting** on Polar Guillotine (`IN_PRODUCTION`) $\rightarrow$ **Binding** on Horizon PUR / Kolbus (`IN_PRODUCTION`) $\rightarrow$ **QC Passed** after 10-point physical inspection (`PACKED`).

### Step 5: Dispatch AWB Scanning
* Packed books are sealed in moisture-barrier wrap and corrugated mailers.
* The dispatch operator scans the parcel barcode and courier Air Waybill (AWB) for **DHL Express**, **Aramex**, or **FedEx**, archiving the waybill PDF to AWS S3 (`READY_FOR_DISPATCH`).

### Step 6: Outbound Peecho Tracking Callback
* Within **< 5 seconds** of the dispatch scan, Celery workers trigger `POST /v2/orders/{id}/shipment` back to Peecho with `tracking_code`, `carrier`, `shipment_date`, and `tracking_url` (`DISPATCHED`).

---

## 4. SLA Lead Time Commitments

| Operational Metric | Production Commitment (`orderflow`) | Staging Behavior (`staging.orderflow`) |
| :--- | :--- | :--- |
| **Inbound Webhook ACK** | **< 2.0 Seconds** (typical < 400 ms) | **< 2.0 Seconds** (typical < 400 ms) |
| **Standard Production SLA** | **24 to 48 Hours** (Ingest to Dispatch) | Isolated sandbox state simulation |
| **Express / Rush SLA** | **8 to 24 Hours** priority lane | Simulated priority timers |
| **Outbound Tracking Callback** | **< 5.0 Seconds** post AWB barcode scan | Sandbox mock callback (`200 OK`) |
| **First-Time QC Pass Rate** | **$\ge 99.2\%$** (ISO 12647-2 / FOGRA 39) | N/A (No physical paper consumed) |
