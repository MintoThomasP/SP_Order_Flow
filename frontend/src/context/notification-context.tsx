"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Info, X, Zap, Truck, Layers, Globe2 } from "lucide-react";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
  category?: "STATUS_SYNC" | "SLA_ALERT" | "DISPATCH" | "ORDER_INCOMING" | "SYSTEM";
  timestamp: string;
  read: boolean;
  link?: string;
  orderNumber?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Initial realistic notifications so the notification center is alive and informative from the first click
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "init-1",
    title: "Status Auto-Sync Active",
    message: "Bi-directional Peecho status synchronization is connected and operational in Sandbox mode.",
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
  {
    id: "init-4",
    title: "New Peecho Order Ingested",
    message: "Order SP-2026-90413 (PEECHO-881921) received: Softcover Magazine A5 (Wire-O).",
    type: "info",
    category: "ORDER_INCOMING",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    read: true,
    link: "/orders",
    orderNumber: "SP-2026-90413",
  },
];

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("silverpoint_notifications");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        // fallback to initial
      }
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [toasts, setToasts] = useState<AppNotification[]>([]);

  // Persist notifications
  useEffect(() => {
    try {
      localStorage.setItem("silverpoint_notifications", JSON.stringify(notifications.slice(0, 30)));
    } catch (e) {
      // ignore
    }
  }, [notifications]);

  const addNotification = useCallback(
    (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      const newNotif: AppNotification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => [newNotif, ...prev]);

      // Add to visible floating toasts
      setToasts((prev) => [newNotif, ...prev.slice(0, 2)]);

      // Auto dismiss toast after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newNotif.id));
      }, 5000);
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setToasts([]);
  }, []);

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
      }}
    >
      {children}

      {/* Floating Toast Alerts Stack (Top-Right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border text-xs flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-300 ${
              toast.type === "success"
                ? "bg-white/95 border-emerald-300 text-slate-800 ring-1 ring-emerald-500/10"
                : toast.type === "warning"
                ? "bg-white/95 border-amber-300 text-slate-800 ring-1 ring-amber-500/10"
                : toast.type === "error"
                ? "bg-white/95 border-rose-300 text-slate-800 ring-1 ring-rose-500/10"
                : "bg-white/95 border-blue-200 text-slate-800 ring-1 ring-blue-500/10"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-600" />}
              {toast.type === "info" && <Zap className="w-5 h-5 text-[#0073EA]" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-slate-900 leading-tight">{toast.title}</p>
                <span className="text-[10px] text-slate-400 font-mono">Just now</span>
              </div>
              <p className="text-slate-600 mt-1 leading-snug">{toast.message}</p>
              {toast.link && (
                <Link
                  href={toast.link}
                  onClick={() => clearNotification(toast.id)}
                  className="inline-block mt-2 font-semibold text-[#0073EA] hover:underline text-[11px]"
                >
                  View Order &rarr;
                </Link>
              )}
            </div>

            <button
              onClick={() => clearNotification(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
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
