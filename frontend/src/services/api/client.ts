import axios from "axios";

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    // If explicitly configured with a non-localhost domain, use it
    if (envUrl && !envUrl.includes("127.0.0.1") && !envUrl.includes("localhost")) {
      return envUrl;
    }
    // In production browser (e.g. orderflow.silverpointprint.com), use relative path so Nginx handles proxying
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "/api/v1";
    }
    return envUrl || "http://127.0.0.1:8000/api/v1";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
};

export const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor to attach JWT Bearer token and staff role
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("silverpoint_access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const userStr = localStorage.getItem("silverpoint_user");
    if (userStr && config.headers) {
      try {
        const u = JSON.parse(userStr);
        const r = u?.role?.code || u?.role_code || u?.role || "";
        if (r) {
          config.headers["X-Staff-Role"] = r;
        }
      } catch (e) {}
    }
  }
  return config;
});

// Response interceptor with auto-refresh and graceful fallback
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if 401 Unauthorized and not already retried
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/token/")
    ) {
      originalRequest._retry = true;

      if (typeof window !== "undefined") {
        const refreshToken = localStorage.getItem("silverpoint_refresh_token");

        if (refreshToken) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return apiClient(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          isRefreshing = true;

          try {
            const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
              refresh: refreshToken,
            });
            const newAccessToken = res.data.access;
            localStorage.setItem("silverpoint_access_token", newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

            processQueue(null, newAccessToken);
            return apiClient(originalRequest);
          } catch (refreshErr) {
            processQueue(refreshErr, null);
            localStorage.removeItem("silverpoint_access_token");
            localStorage.removeItem("silverpoint_refresh_token");
            localStorage.removeItem("silverpoint_user");
            delete originalRequest.headers.Authorization;
            return apiClient(originalRequest);
          } finally {
            isRefreshing = false;
          }
        } else {
          // No refresh token available, clean up stale access token and retry
          localStorage.removeItem("silverpoint_access_token");
          delete originalRequest.headers.Authorization;
          return apiClient(originalRequest);
        }
      }
    }

    const customError = {
      message:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "An unexpected API error occurred",
      status: error.response?.status,
      data: error.response?.data,
    };
    return Promise.reject(customError);
  }
);
