import { apiClient } from "./client";
import {
  Order,
  OrderMetrics,
  PeechoPayloadLog,
  PeechoIntegrationConfig,
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
};

