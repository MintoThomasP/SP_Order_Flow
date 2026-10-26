/**
 * Enterprise Data Types for Silver Point POD Operations Portal & Peecho API Gateway.
 */

export interface BaseModel {
  id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface SystemRole extends BaseModel {
  code: string;
  name: string;
  description: string;
  permissions_matrix: Record<string, any>;
  is_system_default: boolean;
}

export interface EntityStatus extends BaseModel {
  entity_type: "ORDER" | "PRINT_JOB" | "PEECHO_SYNC" | "SHIPMENT" | "BATCH" | string;
  code: string;
  name: string;
  badge_color: string;
  badge_bg: string;
  badge_text: string;
  sort_order: number;
  is_terminal: boolean;
  is_failure_state: boolean;
  description: string;
  allowed_transitions: string[];
}

export interface StaffUser extends BaseModel {
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  employee_id: string | null;
  department: string;
  phone_number: string;
  avatar_url: string | null;
  role: string | null;
  role_details: SystemRole | null;
  is_staff: boolean;
  is_superuser: boolean;
  last_activity_at: string | null;
  last_login: string | null;
}

export interface UserAuditLog {
  id: string;
  user: string | null;
  user_name: string;
  user_email_snapshot: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export interface OrderItem extends BaseModel {
  peecho_item_id: string;
  product_type: string;
  quantity: number;
  page_count: number;
  spine_width_mm: string | number;
  paper_stock: string;
  pdf_artwork_url: string;
  pdf_cover_url: string;
  preflight_passed: boolean;
  metadata: Record<string, any>;
}

export interface Order extends BaseModel {
  order_number: string;
  peecho_order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: {
    recipient_name?: string;
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    carrier?: string;
  };
  carrier_preference: string;
  status: string;
  status_details: EntityStatus | null;
  sla_deadline: string;
  sla_priority: "RUSH_8H" | "EXPRESS_24H" | "STANDARD_72H" | string;
  time_remaining_minutes: number;
  total_items_count: number;
  total_amount: string | number;
  currency: string;
  peecho_metadata: Record<string, any>;
  items: OrderItem[];
}

export interface ArtworkVerification extends BaseModel {
  order: string;
  order_number: string;
  peecho_order_id: string;
  order_item: string;
  product_type: string;
  paper_stock: string;
  file_type: "CONTENT_INTERIOR" | "COVER_WRAP" | "DUST_JACKET" | "SINGLE_SHEET" | string;
  file_url: string;
  s3_bucket: string;
  s3_key: string;
  file_size_bytes: number;
  page_count: number;
  calculated_spine_width_mm: string | number;
  resolution_dpi: number;
  resolution_check_passed: boolean;
  bleed_check_passed: boolean;
  color_space: string;
  verification_status: "PENDING_REVIEW" | "APPROVED_FOR_PRINT" | "FLAGGED_ERROR" | "STREAMING_S3" | string;
  error_reason: string;
  verified_by: string | null;
  verified_by_name: string;
  verified_at: string | null;
  preflight_metadata: Record<string, any>;
}

export interface ProductionBatch extends BaseModel {
  batch_number: string;
  paper_stock: string;
  size_format: string;
  binding_type: string;
  binding_label: string;
  target_press: string;
  press_label: string;
  status: string;
  status_details: EntityStatus | null;
  total_orders_count: number;
  total_items_count: number;
  total_sheets_count: number;
  priority: "RUSH" | "EXPRESS" | "STANDARD" | string;
  job_ticket_pdf_url: string;
  assigned_operator: string | null;
  assigned_operator_name: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string;
  orders: Order[];
}

export interface ShopfloorStation extends BaseModel {
  code: string;
  name: string;
  category: "PRINT" | "CUT_LAMINATE" | "BIND" | "QC_PASS" | string;
  hardware_device_name: string;
  target_status_code: string;
  icon: string;
  sort_order: number;
}

export interface ScanEventLog extends BaseModel {
  station: string;
  barcode_scanned: string;
  entity_type: string;
  entity_reference: string;
  previous_status: string;
  new_status: string;
  operator_name_snapshot: string;
  ip_address: string | null;
  notes: string;
}

export interface ScanResult {
  success: boolean;
  entity_type?: string;
  reference?: string;
  peecho_order_id?: string;
  customer_name?: string;
  previous_status?: string;
  new_status?: string;
  station?: string;
  message?: string;
  error?: string;
}

export interface PeechoPayloadLog {
  id: string;
  peecho_order_id: string;
  event_type: string;
  payload_hash: string;
  raw_payload: Record<string, any>;
  status: "RECEIVED" | "PROCESSED" | "DUPLICATE" | "FAILED";
  error_message: string;
  ip_address: string | null;
  created_at: string;
}

export interface OrderMetrics {
  total_orders: number;
  in_prepress: number;
  in_production: number;
  ready_dispatch: number;
  sla_at_risk: number;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: StaffUser;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CarrierChoice {
  code: string;
  name: string;
  transit_days: string;
  logo: string;
}

export interface CarrierEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
  carrier: string;
}

export interface Shipment extends BaseModel {
  order: string;
  order_number: string;
  peecho_order_id: string;
  customer_name: string;
  shipping_address: {
    recipient_name?: string;
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    carrier?: string;
  };
  carrier_name: string;
  carrier_code: string;
  carrier_display?: string;
  tracking_number: string;
  tracking_url: string;
  awb_document_url: string | null;
  awb_file_key: string | null;
  weight_kg: number | string;
  package_type: string;
  shipping_cost: number | string;
  currency: string;
  status: string | null;
  status_code: "LABEL_CREATED" | "DISPATCHED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "EXCEPTION" | string;
  status_display?: string;
  peecho_synced: boolean;
  peecho_synced_at: string | null;
  peecho_sync_attempts: number;
  peecho_sync_response: Record<string, any>;
  peecho_sync_error: string;
  dispatched_by: string | null;
  dispatched_by_name: string;
  dispatched_at: string | null;
  estimated_delivery_at: string | null;
  actual_delivered_at: string | null;
  carrier_events_log: CarrierEvent[];
  notes: string;
}

export interface ConfirmDispatchPayload {
  order_identifier: string;
  carrier_code: string;
  carrier_name?: string;
  tracking_number: string;
  tracking_url?: string;
  weight_kg?: number | string;
  package_type?: string;
  shipping_cost?: number | string;
  currency?: string;
  awb_document_url?: string;
  notes?: string;
  trigger_peecho_sync?: boolean;
}

export interface ConfirmDispatchResponse {
  success: boolean;
  message: string;
  shipment: Shipment;
  peecho_sync?: Record<string, any>;
  error?: string;
}

export interface DynamicPricingMatrix extends BaseModel {
  product_type: string;
  product_type_display?: string;
  binding_type: string;
  binding_type_display?: string;
  paper_stock_name: string;
  paper_stock_gsm: number;
  base_fee: number | string;
  rate_per_sheet: number | string;
  binding_cost: number | string;
  lamination_cost: number | string;
  foil_stamp_cost: number | string;
  tier_1_50_multiplier: number | string;
  tier_51_200_multiplier: number | string;
  tier_201_500_multiplier: number | string;
  tier_500_plus_multiplier: number | string;
  currency: string;
  description: string;
}

export interface QuoteRequest {
  product_type?: string;
  page_count?: number;
  paper_gsm?: number;
  binding_type?: string;
  quantity?: number;
  has_lamination?: boolean;
  has_foil?: boolean;
  currency?: string;
}

export interface QuoteResponse {
  success: boolean;
  product_type: string;
  binding_type: string;
  page_count: number;
  sheets_count: number;
  paper_gsm: number;
  quantity: number;
  currency: string;
  tier_label: string;
  tier_discount_percent: number;
  cost_breakdown: {
    base_machine_fee: number;
    interior_sheet_cost: number;
    binding_finishing_cost: number;
    lamination_addon: number;
    foil_stamp_addon: number;
    raw_unit_price: number;
    discounted_unit_price: number;
  };
  financial_summary: {
    unit_price: number;
    subtotal: number;
    vat_rate_percent: number;
    vat_amount: number;
    estimated_shipping: number;
    grand_total: number;
  };
}

export interface InvoiceLineItem {
  id: string;
  order: string | null;
  order_number: string;
  peecho_order_id: string;
  product_description: string;
  page_count: number;
  quantity: number;
  unit_price: number | string;
  shipping_cost: number | string;
  line_total: number | string;
}

export interface PeechoInvoice extends BaseModel {
  invoice_number: string;
  billing_period: string;
  client_name: string;
  client_tax_id: string;
  client_email: string;
  client_address: string;
  subtotal_amount: number | string;
  tax_rate_percent: number | string;
  tax_amount: number | string;
  shipping_total: number | string;
  discount_total: number | string;
  grand_total: number | string;
  currency: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "CANCELLED" | string;
  invoice_pdf_url: string | null;
  soa_pdf_url: string | null;
  orders_count: number;
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  payment_reference: string;
  created_by_name: string;
  notes: string;
  line_items: InvoiceLineItem[];
}

export interface GenerateInvoicePayload {
  billing_period?: string;
  client_name?: string;
  client_tax_id?: string;
  client_email?: string;
  client_address?: string;
  order_ids?: string[];
  tax_rate_percent?: number | string;
  currency?: string;
  notes?: string;
}

export interface GenerateInvoiceResponse {
  success: boolean;
  message: string;
  invoice: PeechoInvoice;
  error?: string;
}

export interface MarkInvoicePaidPayload {
  payment_reference: string;
  paid_at?: string;
  notes?: string;
}

export interface ReprintDamageLog extends BaseModel {
  reprint_code: string;
  order: string;
  order_number: string;
  peecho_order_id: string;
  customer_name: string;
  order_item: string | null;
  failure_reason: string;
  failure_reason_display?: string;
  failure_description: string;
  reported_at_station: string;
  damaged_quantity: number;
  waste_sheets_count: number;
  estimated_cost_loss: number | string;
  currency: string;
  status: string;
  status_display?: string;
  reported_by: string | null;
  reported_by_name: string;
  reprinted_batch_number: string;
  resolved_at: string | null;
  notes: string;
}

export interface ReportDamagePayload {
  order_identifier: string;
  failure_reason?: string;
  failure_description?: string;
  reported_at_station?: string;
  damaged_quantity?: number;
  waste_sheets_count?: number;
  estimated_cost_loss?: number | string;
  auto_requeue?: boolean;
}

export interface ReportDamageResponse {
  success: boolean;
  reprint_code: string;
  order_number: string;
  peecho_order_id: string;
  status: string;
  elevated_priority: string;
  message: string;
  error?: string;
}

export interface SLAAlertLog extends BaseModel {
  order: string;
  order_number: string;
  alert_type: string;
  recipient: string;
  hours_remaining: number;
  message_body: string;
  dispatched_successfully: boolean;
  response_payload: Record<string, any>;
}

export interface OdooSyncLog extends BaseModel {
  odoo_model: string;
  odoo_record_id: number | null;
  silverpoint_reference: string;
  sync_direction: string;
  sync_status: string;
  request_payload: Record<string, any>;
  response_payload: Record<string, any>;
  error_message: string;
}

export interface DashboardMetrics {
  daily_volume: Array<{
    date: string;
    orders: number;
    pages: number;
    revenue: number;
    sheets: number;
  }>;
  courier_distribution: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  station_turnarounds: Array<{
    station: string;
    avgMinutes: number;
    targetMinutes: number;
    benchmark: string;
  }>;
  defect_breakdown: Array<{
    reason: string;
    count: number;
  }>;
  sla_compliance_rate: number;
  summary_counts: {
    total_orders: number;
    total_batches: number;
    total_shipments: number;
    open_reprints: number;
  };
}

export interface NavItem {
  name: string;
  slug: string;
  icon: string;
  badgeCount?: number;
  description: string;
  group: "Operations" | "Integrations" | "Administration";
}

export interface PeechoIntegrationConfig {
  id: string;
  api_base_url: string;
  button_key: string;
  api_key?: string;
  api_key_masked: string;
  secret_key?: string;
  secret_key_masked: string;
  webhook_secret?: string;
  webhook_secret_masked: string;
  webhook_endpoint_path: string;
  full_webhook_url: string;
  is_sandbox: boolean;
  auto_sync_status_changes: boolean;
  last_connection_test_at: string | null;
  last_connection_status: string;
  updated_at: string;
}

export interface PrintifyPayloadLog {
  id: string;
  printify_order_id: string;
  event_type: string;
  raw_payload: Record<string, any>;
  status: "RECEIVED" | "PROCESSED" | "IGNORED" | "INVALID_SIGNATURE" | "FAILED";
  error_message: string;
  ip_address: string | null;
  created_at: string;
}

export interface PrintifyIntegrationConfig {
  shop_id: string;
  api_token?: string;
  api_token_masked: string;
  webhook_secret?: string;
  webhook_secret_masked: string;
  base_url: string;
  webhook_endpoint_path: string;
  full_webhook_url: string;
  is_configured: boolean;
  total_orders_synced: number;
  registered_events: string[];
  last_connection_status: string;
}


