import { apiClient } from "./client";
import { ArtworkVerification, PaginatedResponse } from "./types";

export const prepressApi = {
  // Get all verifications
  getVerifications: async (params?: {
    status?: string;
    order_id?: string;
    search?: string;
  }): Promise<PaginatedResponse<ArtworkVerification>> => {
    const res = await apiClient.get<PaginatedResponse<ArtworkVerification>>(
      "/prepress/verifications/",
      { params }
    );
    return res.data;
  },

  // Get single verification
  getVerification: async (id: string): Promise<ArtworkVerification> => {
    const res = await apiClient.get<ArtworkVerification>(`/prepress/verifications/${id}/`);
    return res.data;
  },

  // Approve artwork for press
  approveArtwork: async (id: string): Promise<{ detail: string; verification: ArtworkVerification }> => {
    const res = await apiClient.post<{ detail: string; verification: ArtworkVerification }>(
      `/prepress/verifications/${id}/approve/`
    );
    return res.data;
  },

  // Flag prepress defect / error
  flagPrepressError: async (
    id: string,
    errorReason: string,
    comments?: string
  ): Promise<{ detail: string; verification: ArtworkVerification }> => {
    const res = await apiClient.post<{ detail: string; verification: ArtworkVerification }>(
      `/prepress/verifications/${id}/flag-error/`,
      {
        error_reason: errorReason,
        comments: comments || "Flagged via Prepress Inspection Workspace",
      }
    );
    return res.data;
  },

  // Re-download and stream from Peecho to S3
  redownloadArtwork: async (
    id: string
  ): Promise<{ detail: string; verification: ArtworkVerification; s3_result: any }> => {
    const res = await apiClient.post<{
      detail: string;
      verification: ArtworkVerification;
      s3_result: any;
    }>(`/prepress/verifications/${id}/redownload/`);
    return res.data;
  },

  // Analyze Order Item
  analyzeOrderItem: async (orderItemId: string): Promise<ArtworkVerification> => {
    const res = await apiClient.post<ArtworkVerification>(
      "/prepress/verifications/analyze-item/",
      { order_item_id: orderItemId }
    );
    return res.data;
  },
};
