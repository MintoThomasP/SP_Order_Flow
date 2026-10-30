"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, Zap } from "lucide-react";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
  category?: "STATUS_SYNC" | "SLA_ALERT" | "DISPATCH" | "ORDER_INCOMING" | "SYSTEM" | "FORM" | "SECURITY";
  timestamp: string;
  read: boolean;
  link?: string;
  orderNumber?: string;
  durationMs?: number;
}

export interface ToastMethods {
  success: (title: string, message?: string, options?: Partial<AppNotification>) => void;
  error: (title: string, message?: string, options?: Partial<AppNotification>) => void;
  warning: (title: string, message?: string, options?: Partial<AppNotification>) => void;
  info: (title: string, message?: string, options?: Partial<AppNotification>) => void;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  toast: ToastMethods;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Initial notifications for notification drawer
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "init-1",
    title: "Status Auto-Sync Active",
    message: "Bi-directional Peecho status synchronization is connected and operational.",
    type: "success",
    category: "STATUS_SYNC",
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    read: false,
    link: "/pod-integration",
  },
  {
    id: "init-2",
    title: "Order SP-2026-90412 Dispatched",
    message: "Assigned to Own Delivery Person (In-House Driver). Tracking reference: DELIVERY-SP-2026-90412.",
    type: "info",
    category: "DISPATCH",
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    read: false,
    link: "/dispatch",
    orderNumber: "SP-2026-90412",
  },
  {
    id: "init-3",
    title: "Rush SLA Warning",
    message: "Order SP-2026-1014 for client Amélie Poulain has delivery deadline approaching in under 4 hours.",
    type: "warning",
    category: "SLA_ALERT",
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    read: false,
    link: "/orders",
    orderNumber: "SP-2026-1014",
  },
];

// Custom event for standalone toast dispatch
const TOAST_EVENT_NAME = "silverpoint_app_toast";

export const showToast = (toastData: Omit<AppNotification, "id" | "timestamp" | "read">) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, { detail: toastData }));
  }
};

export const showSuccessToast = (title: string, message: string = "", options?: Partial<AppNotification>) => {
  showToast({ title, message, type: "success", ...options });
};

export const showErrorToast = (title: string, message: string = "", options?: Partial<AppNotification>) => {
  showToast({ title, message, type: "error", ...options });
};

export const showWarningToast = (title: string, message: string = "", options?: Partial<AppNotification>) => {
  showToast({ title, message, type: "warning", ...options });
};

export const showInfoToast = (title: string, message: string = "", options?: Partial<AppNotification>) => {
  showToast({ title, message, type: "info", ...options });
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("silverpoint_notifications");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [toasts, setToasts] = useState<AppNotification[]>([]);

  // Persist notifications
  useEffect(() => {
    try {
      localStorage.setItem("silverpoint_notifications", JSON.stringify(notifications.slice(0, 30)));
    } catch {
      // ignore
    }
  }, [notifications]);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNotification = useCallback(
    (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      const newNotif: AppNotification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        read: false,
        durationMs: notification.durationMs || 5000,
      };

      setNotifications((prev) => [newNotif, ...prev]);

      // Add to visible floating toasts stack (keep up to 4 concurrent toasts)
      setToasts((prev) => [newNotif, ...prev.slice(0, 3)]);

      // Auto dismiss toast after duration
      const duration = newNotif.durationMs || 5000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newNotif.id));
      }, duration);
    },
    []
  );

  // Listen for standalone toast events
  useEffect(() => {
    const handleCustomToast = (event: Event) => {
      const customEvent = event as CustomEvent<Omit<AppNotification, "id" | "timestamp" | "read">>;
      if (customEvent.detail) {
        addNotification(customEvent.detail);
      }
    };

    window.addEventListener(TOAST_EVENT_NAME, handleCustomToast);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handleCustomToast);
  }, [addNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setToasts([]);
  }, []);

  const toast: ToastMethods = {
    success: useCallback((title: string, message: string = "", options?: Partial<AppNotification>) => {
      addNotification({ title, message, type: "success", ...options });
    }, [addNotification]),
    error: useCallback((title: string, message: string = "", options?: Partial<AppNotification>) => {
      addNotification({ title, message, type: "error", ...options });
    }, [addNotification]),
    warning: useCallback((title: string, message: string = "", options?: Partial<AppNotification>) => {
      addNotification({ title, message, type: "warning", ...options });
    }, [addNotification]),
    info: useCallback((title: string, message: string = "", options?: Partial<AppNotification>) => {
      addNotification({ title, message, type: "info", ...options });
    }, [addNotification]),
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        toast,
      }}
    >
      {children}

      {/* Floating Popup Stack (Top-Right, Highest Z-Index) */}
      <div
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const isSuccess = item.type === "success";
          const isError = item.type === "error";
          const isWarning = item.type === "warning";
          const isInfo = item.type === "info";

          return (
            <div
              key={item.id}
              className={`pointer-events-auto w-full bg-white rounded-2xl shadow-2xl border transition-all duration-300 overflow-hidden transform animate-in slide-in-from-top-4 fade-in-50 duration-200 ${
                isSuccess
                  ? "border-emerald-300/90 ring-1 ring-emerald-500/20 shadow-emerald-500/10"
                  : isError
                  ? "border-rose-300/90 ring-1 ring-rose-500/20 shadow-rose-500/10"
                  : isWarning
                  ? "border-amber-300/90 ring-1 ring-amber-500/20 shadow-amber-500/10"
                  : "border-blue-300/90 ring-1 ring-blue-500/20 shadow-blue-500/10"
              }`}
            >
              <div
                className={`p-4 flex items-start gap-3.5 ${
                  isSuccess
                    ? "bg-gradient-to-r from-emerald-50/60 via-white to-white"
                    : isError
                    ? "bg-gradient-to-r from-rose-50/60 via-white to-white"
                    : isWarning
                    ? "bg-gradient-to-r from-amber-50/60 via-white to-white"
                    : "bg-gradient-to-r from-blue-50/60 via-white to-white"
                }`}
              >
                {/* Type Icon */}
                <div className="shrink-0 mt-0.5">
                  {isSuccess && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                  {isError && (
                    <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  )}
                  {isWarning && (
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-xs">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  )}
                  {isInfo && (
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-[#0073EA] shadow-xs">
                      <Info className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                          isSuccess
                            ? "bg-emerald-100 text-emerald-800"
                            : isError
                            ? "bg-rose-100 text-rose-800"
                            : isWarning
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isSuccess ? "Success" : isError ? "Failure / Error" : isWarning ? "Warning" : "Notification"}
                      </span>
                      {item.orderNumber && (
                        <span className="font-mono text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded">
                          {item.orderNumber}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Just now</span>
                  </div>

                  <p className="font-bold text-slate-900 text-xs mt-1.5 leading-snug">
                    {item.title}
                  </p>

                  {item.message && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                  )}

                  {item.link && (
                    <Link
                      href={item.link}
                      onClick={() => clearNotification(item.id)}
                      className="inline-flex items-center gap-1 mt-2.5 font-semibold text-[#0073EA] hover:text-blue-700 hover:underline text-[11px]"
                    >
                      <span>View item</span>
                      <span>&rarr;</span>
                    </Link>
                  )}
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={() => clearNotification(item.id)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100/80 transition-colors shrink-0 cursor-pointer"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Countdown Progress Bar */}
              <div className="h-1 w-full bg-slate-100/80 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isSuccess
                      ? "bg-emerald-500"
                      : isError
                      ? "bg-rose-500"
                      : isWarning
                      ? "bg-amber-500"
                      : "bg-[#0073EA]"
                  }`}
                  style={{
                    animation: `shrinkWidth ${item.durationMs || 5000}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

export const useToast = () => {
  const { toast } = useNotifications();
  return toast;
};
