import { apiClient } from "./client";

export interface GlobalSearchOrder {
  id: string;
  order_number: string;
  peecho_order_id?: string;
  customer_name: string;
  customer_email: string;
  status_code: string;
  status_name: string;
  total_amount: number;
  currency: string;
  created_at?: string;
  link: string;
  has_access?: boolean;
  access_message?: string;
}

export interface GlobalSearchShipment {
  id: string;
  tracking_number: string;
  order_number: string;
  carrier_name: string;
  status_code: string;
  status_name: string;
  link: string;
}

export interface GlobalSearchStaff {
  id: string;
  name: string;
  email: string;
  employee_id: string;
  role_name: string;
  department: string;
  link: string;
}

export interface GlobalSearchBatch {
  id: string;
  batch_number: string;
  paper_stock: string;
  size_format: string;
  link: string;
}

export interface GlobalSearchNav {
  name: string;
  link: string;
  type: string;
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  orders: GlobalSearchOrder[];
  shipments: GlobalSearchShipment[];
  staff: GlobalSearchStaff[];
  batches: GlobalSearchBatch[];
  navigation: GlobalSearchNav[];
}

export const searchApi = {
  globalSearch: async (query: string, limit = 5): Promise<GlobalSearchResponse> => {
    if (!query || query.trim().length === 0) {
      return {
        query: "",
        total: 0,
        orders: [],
        shipments: [],
        staff: [],
        batches: [],
        navigation: [],
      };
    }
    const res = await apiClient.get<GlobalSearchResponse>("/core/search/", {
      params: { q: query.trim(), limit },
    });
    return res.data;
  },
};
