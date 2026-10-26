import { apiClient } from "./client";
import { ProductionBatch, Order, PaginatedResponse } from "./types";

export const productionApi = {
  // Get all production batches
  getBatches: async (): Promise<PaginatedResponse<ProductionBatch>> => {
    const res = await apiClient.get<PaginatedResponse<ProductionBatch>>("/production/batches/");
    return res.data;
  },

  // Get single batch
  getBatch: async (id: string): Promise<ProductionBatch> => {
    const res = await apiClient.get<ProductionBatch>(`/production/batches/${id}/`);
    return res.data;
  },

  // Compile a new batch from verified orders
  createBatch: async (batchData: {
    order_ids: string[];
    paper_stock?: string;
    size_format?: string;
    binding_type?: string;
    target_press?: string;
    priority?: string;
    notes?: string;
  }): Promise<ProductionBatch> => {
    const res = await apiClient.post<ProductionBatch>("/production/batches/", batchData);
    return res.data;
  },

  // Generate / Regenerate ReportLab Job Ticket PDF
  generateJobTicket: async (batchId: string): Promise<{ detail: string; job_ticket_pdf_url: string }> => {
    const res = await apiClient.post<{ detail: string; job_ticket_pdf_url: string }>(
      `/production/batches/${batchId}/generate-ticket/`
    );
    return res.data;
  },

  // Update batch status (PRINTING, COMPLETED)
  updateBatchStatus: async (batchId: string, statusCode: string): Promise<ProductionBatch> => {
    const res = await apiClient.post<ProductionBatch>(
      `/production/batches/${batchId}/status/`,
      { status_code: statusCode }
    );
    return res.data;
  },

  // Get eligible orders for batching
  getEligibleOrders: async (): Promise<Order[]> => {
    const res = await apiClient.get<Order[]>("/production/batches/eligible-orders/");
    return res.data;
  },
};
