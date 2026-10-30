import { apiClient } from "./client";
import {
  DynamicPricingMatrix,
  QuoteRequest,
  QuoteResponse,
  PeechoInvoice,
  GenerateInvoicePayload,
  GenerateInvoiceResponse,
  MarkInvoicePaidPayload,
  PaginatedResponse,
} from "./types";

export const financeApi = {
  // Get dynamic pricing matrices
  getPricingMatrix: async (params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<DynamicPricingMatrix>> => {
    const res = await apiClient.get<PaginatedResponse<DynamicPricingMatrix>>("/finance/pricing-matrix/", { params });
    return res.data;
  },

  // Calculate real-time instant quote
  calculateQuote: async (payload: QuoteRequest): Promise<QuoteResponse> => {
    const res = await apiClient.post<QuoteResponse>("/finance/calculate-quote/", payload);
    return res.data;
  },

  // List all Peecho invoices
  getInvoices: async (params?: {
    search?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<PeechoInvoice>> => {
    const res = await apiClient.get<PaginatedResponse<PeechoInvoice>>("/finance/invoices/", { params });
    return res.data;
  },

  // Get invoice details by ID
  getInvoiceById: async (id: string): Promise<PeechoInvoice> => {
    const res = await apiClient.get<PeechoInvoice>(`/finance/invoices/${id}/`);
    return res.data;
  },

  // Generate / aggregate completed orders into a formal Tax Invoice
  generateInvoice: async (payload: GenerateInvoicePayload): Promise<GenerateInvoiceResponse> => {
    const res = await apiClient.post<GenerateInvoiceResponse>("/finance/generate-invoice/", payload);
    return res.data;
  },

  // Mark invoice as Paid
  markInvoicePaid: async (id: string, payload: MarkInvoicePaidPayload): Promise<{ success: boolean; invoice: PeechoInvoice }> => {
    const res = await apiClient.post<{ success: boolean; invoice: PeechoInvoice }>(
      `/finance/invoices/${id}/mark-paid/`,
      payload
    );
    return res.data;
  },

  // Helper for binary PDF URL
  getInvoicePdfUrl: (invoiceId: string) => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    return `${baseURL}/finance/invoices/${invoiceId}/download-pdf/`;
  },

  // Helper for Statement of Account PDF URL
  getSoaPdfUrl: (invoiceId: string) => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    return `${baseURL}/finance/invoices/${invoiceId}/download-soa/`;
  },
};
