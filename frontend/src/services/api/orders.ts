import { apiClient } from "./client";
import {
  Order,
  OrderMetrics,
  PeechoPayloadLog,
  PeechoIntegrationConfig,
  PrintifyPayloadLog,
  PrintifyIntegrationConfig,
  UserAuditLog,
  PaginatedResponse,
} from "./types";

export const ordersApi = {
  // Get list of orders with filters
  getOrders: async (params?: {
    status?: string;
    urgency?: "critical" | "urgent" | "normal" | "breached" | string;
    search?: string;
  }): Promise<PaginatedResponse<Order>> => {
    const res = await apiClient.get<PaginatedResponse<Order>>("/orders/", {
      params,
    });
    return res.data;
  },

  // Get single order details
  getOrder: async (id: string): Promise<Order> => {
    const res = await apiClient.get<Order>(`/orders/${id}/`);
    return res.data;
  },

  // Get order audit logs
  getOrderAuditLogs: async (orderId: string): Promise<UserAuditLog[]> => {
    const res = await apiClient.get<UserAuditLog[]>(`/orders/${orderId}/audit-logs/`);
    return res.data;
  },

  // Update order status with audit log
  updateOrderStatus: async (
    orderId: string,
    statusCode: string,
    comments?: string
  ): Promise<{ detail: string; order: Order; peecho_sync?: any }> => {
    const res = await apiClient.post<{ detail: string; order: Order; peecho_sync?: any }>(
      `/orders/${orderId}/status/`,
      {
        status_code: statusCode,
        comments: comments || "Status transitioned via Order Management Portal",
      }
    );
    return res.data;
  },

  // Get order KPI metrics
  getOrderMetrics: async (): Promise<OrderMetrics> => {
    const res = await apiClient.get<OrderMetrics>("/orders/metrics/");
    return res.data;
  },

  // Trigger simulated Peecho webhook
  simulatePeechoWebhook: async (
    priority?: "RUSH_8H" | "EXPRESS_24H" | "STANDARD_72H"
  ): Promise<{ message: string; order: Order; log_status: string }> => {
    const res = await apiClient.post<{ message: string; order: Order; log_status: string }>(
      "/peecho/simulate-webhook/",
      { priority }
    );
    return res.data;
  },

  // Ingest raw custom webhook
  ingestPeechoWebhook: async (payload: Record<string, any>): Promise<any> => {
    const res = await apiClient.post("/peecho/webhook/", payload);
    return res.data;
  },

  // Get raw Peecho payload logs
  getPeechoPayloadLogs: async (): Promise<PaginatedResponse<PeechoPayloadLog>> => {
    const res = await apiClient.get<PaginatedResponse<PeechoPayloadLog>>("/peecho/logs/");
    return res.data;
  },

  // Centralized Integration Settings
  getPeechoConfig: async (): Promise<PeechoIntegrationConfig> => {
    const res = await apiClient.get<PeechoIntegrationConfig>("/peecho/config/");
    return res.data;
  },

  updatePeechoConfig: async (
    config: Partial<PeechoIntegrationConfig>
  ): Promise<{ message: string; config: PeechoIntegrationConfig }> => {
    const res = await apiClient.post<{ message: string; config: PeechoIntegrationConfig }>(
      "/peecho/config/",
      config
    );
    return res.data;
  },

  testPeechoConnection: async (): Promise<{
    success: boolean;
    status: string;
    mode: string;
    message: string;
    tested_at: string;
    endpoint?: string;
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      status: string;
      mode: string;
      message: string;
      tested_at: string;
      endpoint?: string;
    }>("/peecho/test-connection/");
    return res.data;
  },

  // -------------------------------------------------------------
  // Printify Print-on-Demand (POD) Integration API
  // -------------------------------------------------------------
  getPrintifyConfig: async (): Promise<PrintifyIntegrationConfig> => {
    const res = await apiClient.get<PrintifyIntegrationConfig>("/printify/config/");
    return res.data;
  },

  updatePrintifyConfig: async (
    config: { api_token?: string; shop_id?: string; webhook_secret?: string }
  ): Promise<{ message: string; shop_id: string }> => {
    const res = await apiClient.post<{ message: string; shop_id: string }>(
      "/printify/config/",
      config
    );
    return res.data;
  },

  testPrintifyConnection: async (): Promise<{
    success: boolean;
    status: string;
    mode: string;
    message: string;
    tested_at: string;
    endpoint?: string;
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      status: string;
      mode: string;
      message: string;
      tested_at: string;
      endpoint?: string;
    }>("/printify/test-connection/");
    return res.data;
  },

  registerPrintifyWebhooks: async (
    callback_url?: string
  ): Promise<{
    success: boolean;
    mode: string;
    message: string;
    callback_url: string;
    topics?: any[];
    results?: any[];
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      mode: string;
      message: string;
      callback_url: string;
      topics?: any[];
      results?: any[];
    }>("/printify/register-webhooks/", { callback_url });
    return res.data;
  },

  getPrintifyPayloadLogs: async (): Promise<PaginatedResponse<PrintifyPayloadLog>> => {
    const res = await apiClient.get<PaginatedResponse<PrintifyPayloadLog>>("/printify/logs/");
    return res.data;
  },

  simulatePrintifyWebhook: async (params: {
    event_type?: string;
    order_number?: string;
    carrier?: string;
    tracking_number?: string;
    status?: string;
  }): Promise<{
    success: boolean;
    message: string;
    event_type: string;
    printify_order_id: string;
    order_number: string;
    result: any;
    log_id: string;
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      event_type: string;
      printify_order_id: string;
      order_number: string;
      result: any;
      log_id: string;
    }>("/printify/simulate-webhook/", params);
    return res.data;
  },

  ingestPrintifyWebhook: async (payload: Record<string, any>, signature?: string): Promise<any> => {
    const headers: Record<string, string> = {};
    if (signature) {
      headers["X-Printify-Signature"] = signature;
    }
    const res = await apiClient.post("/webhooks/printify/", payload, { headers });
    return res.data;
  },
};

