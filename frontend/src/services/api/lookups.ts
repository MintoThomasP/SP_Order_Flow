import { apiClient } from "./client";
import { SystemRole, EntityStatus, PaginatedResponse } from "./types";

export const lookupsApi = {
  // Roles
  getRoles: async (activeOnly = false): Promise<PaginatedResponse<SystemRole>> => {
    const res = await apiClient.get<PaginatedResponse<SystemRole>>("/core/roles/", {
      params: { active_only: activeOnly },
    });
    return res.data;
  },

  createRole: async (role: Partial<SystemRole>): Promise<SystemRole> => {
    const res = await apiClient.post<SystemRole>("/core/roles/", role);
    return res.data;
  },

  updateRole: async (id: string, role: Partial<SystemRole>): Promise<SystemRole> => {
    const res = await apiClient.patch<SystemRole>(`/core/roles/${id}/`, role);
    return res.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await apiClient.delete(`/core/roles/${id}/`);
  },

  // Statuses
  getStatuses: async (entityType?: string, activeOnly = false): Promise<PaginatedResponse<EntityStatus>> => {
    const res = await apiClient.get<PaginatedResponse<EntityStatus>>("/core/statuses/", {
      params: {
        entity_type: entityType,
        active_only: activeOnly,
      },
    });
    return res.data;
  },

  createStatus: async (status: Partial<EntityStatus>): Promise<EntityStatus> => {
    const res = await apiClient.post<EntityStatus>("/core/statuses/", status);
    return res.data;
  },

  updateStatus: async (id: string, status: Partial<EntityStatus>): Promise<EntityStatus> => {
    const res = await apiClient.patch<EntityStatus>(`/core/statuses/${id}/`, status);
    return res.data;
  },

  deleteStatus: async (id: string): Promise<void> => {
    await apiClient.delete(`/core/statuses/${id}/`);
  },
};
