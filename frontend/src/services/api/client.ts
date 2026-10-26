import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor to attach JWT Bearer token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("silverpoint_access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
