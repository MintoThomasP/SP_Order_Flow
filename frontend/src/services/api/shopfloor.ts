import { apiClient } from "./client";
import { ShopfloorStation, ScanEventLog, ScanResult, PaginatedResponse } from "./types";

export const shopfloorApi = {
  // Get all shopfloor workstations
  getStations: async (): Promise<PaginatedResponse<ShopfloorStation>> => {
    const res = await apiClient.get<PaginatedResponse<ShopfloorStation>>("/shopfloor/stations/");
    return res.data;
  },

  // Get recent scan events
  getRecentScans: async (station?: string): Promise<PaginatedResponse<ScanEventLog>> => {
    const res = await apiClient.get<PaginatedResponse<ScanEventLog>>("/shopfloor/recent-scans/", {
      params: { station },
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
