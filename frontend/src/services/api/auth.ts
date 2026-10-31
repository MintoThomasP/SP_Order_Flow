import { apiClient } from "./client";
import { StaffUser, UserAuditLog, AuthTokens, PaginatedResponse } from "./types";

export const authApi = {
  // Login with email & password
  login: async (credentials: { email: string; password: string }): Promise<AuthTokens> => {
    const res = await apiClient.post<AuthTokens>("/auth/token/", credentials);
    if (typeof window !== "undefined") {
      localStorage.setItem("silverpoint_access_token", res.data.access);
      localStorage.setItem("silverpoint_refresh_token", res.data.refresh);
      localStorage.setItem("silverpoint_user", JSON.stringify(res.data.user));
      localStorage.setItem("silverpoint_last_activity", Date.now().toString());
    }
    return res.data;
  },

  // Refresh token
  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const res = await apiClient.post<{ access: string }>("/auth/token/refresh/", { refresh });
    if (typeof window !== "undefined") {
      localStorage.setItem("silverpoint_access_token", res.data.access);
      localStorage.setItem("silverpoint_last_activity", Date.now().toString());
    }
    return res.data;
  },

  // Logout
  logout: async (): Promise<void> => {
    if (typeof window !== "undefined") {
      const refresh = localStorage.getItem("silverpoint_refresh_token");
      try {
        if (refresh) {
          await apiClient.post("/auth/logout/", { refresh });
        }
      } catch (err) {
        // Continue cleanup
      }
      localStorage.removeItem("silverpoint_access_token");
      localStorage.removeItem("silverpoint_refresh_token");
      localStorage.removeItem("silverpoint_user");
      localStorage.removeItem("silverpoint_last_activity");
    }
  },

  // Current User
  getMe: async (): Promise<StaffUser> => {
    const res = await apiClient.get<StaffUser>("/auth/me/");
    return res.data;
  },

  // Staff Users CRUD
  getUsers: async (params?: {
    search?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
  } | string): Promise<PaginatedResponse<StaffUser>> => {
    const baseParams = typeof params === "string" ? { search: params } : params;
    const queryParams = {
      ordering: "-created_at",
      ...baseParams,
    };
    const res = await apiClient.get<PaginatedResponse<StaffUser>>("/auth/users/", {
      params: queryParams,
    });
    return res.data;
  },

  createUser: async (userData: Partial<StaffUser> & { password?: string }): Promise<StaffUser> => {
    const res = await apiClient.post<StaffUser>("/auth/users/", userData);
    return res.data;
  },

  updateUser: async (id: string, userData: Partial<StaffUser>): Promise<StaffUser> => {
    const res = await apiClient.patch<StaffUser>(`/auth/users/${id}/`, userData);
    return res.data;
  },

  assignRole: async (userId: string, roleId: string, reason?: string): Promise<{ detail: string; user: StaffUser }> => {
    const res = await apiClient.post<{ detail: string; user: StaffUser }>(`/auth/users/${userId}/assign-role/`, {
      role_id: roleId,
      reason: reason || "Role updated via Portal Staff Management",
    });
    return res.data;
  },

  toggleUserStatus: async (userId: string): Promise<{ detail: string; is_active: boolean }> => {
    const res = await apiClient.post<{ detail: string; is_active: boolean }>(`/auth/users/${userId}/toggle-status/`);
    return res.data;
  },

  changePassword: async (userId: string, password: string): Promise<{ detail: string }> => {
    const res = await apiClient.post<{ detail: string }>(`/auth/users/${userId}/change-password/`, {
      password,
    });
    return res.data;
  },

  // User Audit Logs
  getAuditLogs: async (params?: {
    action?: string;
    resource_type?: string;
    user_id?: string;
    search?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
  }): Promise<PaginatedResponse<UserAuditLog>> => {
    const mergedParams = {
      ordering: "-created_at",
      ...params,
    };
    const res = await apiClient.get<PaginatedResponse<UserAuditLog>>("/auth/audit-logs/", {
      params: mergedParams,
    });
    return res.data;
  },
};
