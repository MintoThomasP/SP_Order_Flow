import { apiClient } from "./client";
import { ShopfloorStation, ScanEventLog, ScanResult, PaginatedResponse } from "./types";

export const shopfloorApi = {
  // Get all shopfloor workstations
  getStations: async (): Promise<PaginatedResponse<ShopfloorStation>> => {
    const res = await apiClient.get<PaginatedResponse<ShopfloorStation>>("/shopfloor/stations/");
    return res.data;
  },

  // Get recent scan events
  getRecentScans: async (params?: {
    station?: string;
    page?: number;
    page_size?: number;
  } | string): Promise<PaginatedResponse<ScanEventLog>> => {
    const queryParams = typeof params === "string" ? { station: params } : params;
    const res = await apiClient.get<PaginatedResponse<ScanEventLog>>("/shopfloor/recent-scans/", {
      params: queryParams,
    });
    return res.data;
  },

  // Instant status update via Barcode / QR scan
  updateStatusByScan: async (payload: {
    barcode: string;
    station: string;
    status_code?: string;
    notes?: string;
  }): Promise<ScanResult> => {
    const res = await apiClient.patch<ScanResult>("/shopfloor/update-status/", payload);
    return res.data;
  },
};
