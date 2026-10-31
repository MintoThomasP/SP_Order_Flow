import { apiClient } from "./client";
import { ProductionBatch, Order, PaginatedResponse, PrintMachine, BindingMethod } from "./types";

export interface BatchedOrder extends Order {
  batch?: {
    id: string;
    batch_number: string;
    target_press: string;
    press_label: string;
    paper_stock: string;
    size_format: string;
    binding_type: string;
    binding_label: string;
    status: string | null;
    status_name: string | null;
    status_color: string;
    total_sheets_count: number;
    created_at: string;
    job_ticket_pdf_url: string;
  };
}

export const productionApi = {
  // Get all production batches
  getBatches: async (params?: {
    search?: string;
    status?: string;
    target_press?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
  }): Promise<PaginatedResponse<ProductionBatch>> => {
    const mergedParams = {
      ordering: "-created_at",
      ...params,
    };
    const res = await apiClient.get<PaginatedResponse<ProductionBatch>>("/production/batches/", {
      params: mergedParams,
    });
    return res.data;
  },

  // Get single batch
  getBatch: async (id: string): Promise<ProductionBatch> => {
    const res = await apiClient.get<ProductionBatch>(`/production/batches/${id}/`);
    return res.data;
  },

  // Get flat list of all batched orders with batch context
  getBatchedOrders: async (params?: { search?: string }): Promise<BatchedOrder[]> => {
    const res = await apiClient.get<BatchedOrder[]>("/production/batches/batched-orders/", {
      params,
    });
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

  // --- Print Machines API ---
  getMachines: async (params?: {
    search?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<PrintMachine>> => {
    const res = await apiClient.get<PaginatedResponse<PrintMachine>>("/production/machines/", {
      params,
    });
    return res.data;
  },

  getAllMachines: async (activeOnly = false): Promise<PrintMachine[]> => {
    const res = await apiClient.get<PrintMachine[]>("/production/machines/", {
      params: { all: "true", active_only: activeOnly ? "true" : undefined },
    });
    return res.data;
  },

  createMachine: async (data: {
    code: string;
    name: string;
    description?: string;
    sheet_format?: string;
    max_speed_cph?: number;
    is_active?: boolean;
  }): Promise<PrintMachine> => {
    const res = await apiClient.post<PrintMachine>("/production/machines/", data);
    return res.data;
  },

  updateMachine: async (id: string, data: Partial<PrintMachine>): Promise<PrintMachine> => {
    const res = await apiClient.patch<PrintMachine>(`/production/machines/${id}/`, data);
    return res.data;
  },

  deleteMachine: async (id: string): Promise<void> => {
    await apiClient.delete(`/production/machines/${id}/`);
  },

  // --- Binding Methods API ---
  getBindingMethods: async (params?: {
    search?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<BindingMethod>> => {
    const res = await apiClient.get<PaginatedResponse<BindingMethod>>("/production/binding-methods/", {
      params,
    });
    return res.data;
  },

  getAllBindingMethods: async (activeOnly = false): Promise<BindingMethod[]> => {
    const res = await apiClient.get<BindingMethod[]>("/production/binding-methods/", {
      params: { all: "true", active_only: activeOnly ? "true" : undefined },
    });
    return res.data;
  },

  createBindingMethod: async (data: {
    code: string;
    name: string;
    description?: string;
    min_pages?: number;
    max_pages?: number;
    default_caliper_mm?: number | string;
    is_active?: boolean;
  }): Promise<BindingMethod> => {
    const res = await apiClient.post<BindingMethod>("/production/binding-methods/", data);
    return res.data;
  },

  updateBindingMethod: async (id: string, data: Partial<BindingMethod>): Promise<BindingMethod> => {
    const res = await apiClient.patch<BindingMethod>(`/production/binding-methods/${id}/`, data);
    return res.data;
  },

  deleteBindingMethod: async (id: string): Promise<void> => {
    await apiClient.delete(`/production/binding-methods/${id}/`);
  },
};


