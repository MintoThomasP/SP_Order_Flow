import { apiClient } from "./client";
import {
  DashboardMetrics,
  ReprintDamageLog,
  ReportDamagePayload,
  ReportDamageResponse,
  SLAAlertLog,
  OdooSyncLog,
  PaginatedResponse,
} from "./types";

export const analyticsApi = {
  // Get main dashboard metrics & Recharts data series
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const res = await apiClient.get<DashboardMetrics>("/analytics/dashboard-metrics/");
    return res.data;
  },

  // List all damaged print and reprint logs
  getReprints: async (params?: { search?: string; status?: string }): Promise<PaginatedResponse<ReprintDamageLog>> => {
    const res = await apiClient.get<PaginatedResponse<ReprintDamageLog>>("/analytics/reprints/", { params });
    return res.data;
  },

  // Report damaged print and auto-requeue
  reportDamage: async (payload: ReportDamagePayload): Promise<ReportDamageResponse> => {
    const res = await apiClient.post<ReportDamageResponse>("/analytics/report-damage/", payload);
    return res.data;
  },

  // Get SLA alert logs
  getSLAAlerts: async (): Promise<PaginatedResponse<SLAAlertLog>> => {
    const res = await apiClient.get<PaginatedResponse<SLAAlertLog>>("/analytics/sla-alerts/");
    return res.data;
  },

  // Trigger manual SLA check & notification dispatch
  triggerSLACheck: async (): Promise<{ success: boolean; total_alerts_dispatched: number }> => {
    const res = await apiClient.post<{ success: boolean; total_alerts_dispatched: number }>(
      "/analytics/sla-alerts/trigger-check/"
    );
    return res.data;
  },

  // Get Odoo synchronization transaction logs
  getOdooSyncLogs: async (): Promise<PaginatedResponse<OdooSyncLog>> => {
    const res = await apiClient.get<PaginatedResponse<OdooSyncLog>>("/analytics/odoo-logs/");
    return res.data;
  },

  // Trigger manual Odoo entity sync
  triggerOdooSync: async (model_name: string, reference_id: string): Promise<any> => {
    const res = await apiClient.post("/analytics/odoo-sync/", {
      model_name,
      reference_id,
    });
    return res.data;
  },
};
