import { apiClient } from "./client";
import {
  Shipment,
  CarrierChoice,
  ConfirmDispatchPayload,
  ConfirmDispatchResponse,
  PaginatedResponse,
} from "./types";

export const dispatchApi = {
  // Get all registered shipments
  getShipments: async (params?: {
    search?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Shipment>> => {
    const res = await apiClient.get<PaginatedResponse<Shipment>>("/dispatch/shipments/", { params });
    return res.data;
  },

  // Get specific shipment details
  getShipmentById: async (id: string): Promise<Shipment> => {
    const res = await apiClient.get<Shipment>(`/dispatch/shipments/${id}/`);
    return res.data;
  },

  // Get supported carrier choices
  getCarriers: async (): Promise<CarrierChoice[]> => {
    const res = await apiClient.get<CarrierChoice[]>("/dispatch/carriers/");
    return res.data;
  },

  // Confirm order packaging & dispatch with automatic Peecho callback
  confirmDispatch: async (payload: ConfirmDispatchPayload): Promise<ConfirmDispatchResponse> => {
    const res = await apiClient.post<ConfirmDispatchResponse>("/dispatch/confirm-shipment/", payload);
    return res.data;
  },

  // Retry failed or pending Peecho tracking callback
  retryPeechoSync: async (shipmentId: string): Promise<{ success: boolean; message?: string; shipment: Shipment }> => {
    const res = await apiClient.post<{ success: boolean; message?: string; shipment: Shipment }>(
      `/dispatch/shipments/${shipmentId}/retry-peecho-sync/`
    );
    return res.data;
  },

  // Poll carrier status update for a shipment
  pollTracking: async (shipmentId: string): Promise<{ success: boolean; shipment: Shipment; result: any }> => {
    const res = await apiClient.post<{ success: boolean; shipment: Shipment; result: any }>(
      `/dispatch/shipments/${shipmentId}/poll-tracking/`
    );
    return res.data;
  },

  // Update shipment delivery milestone (OUT_FOR_DELIVERY, DELIVERED, etc.) with Peecho sync
  updateMilestone: async (
    shipmentId: string,
    milestoneCode: string,
    notes?: string
  ): Promise<{ success: boolean; milestone: string; shipment: Shipment; peecho_sync: any }> => {
    const res = await apiClient.post<{ success: boolean; milestone: string; shipment: Shipment; peecho_sync: any }>(
      `/dispatch/shipments/${shipmentId}/update-milestone/`,
      { milestone_code: milestoneCode, notes }
    );
    return res.data;
  },
};

