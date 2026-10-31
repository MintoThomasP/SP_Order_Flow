"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackageCheck,
  Globe2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Download,
  ExternalLink,
  Layers,
  FileText,
  FileCheck2,
  Truck,
  CheckCircle2,
  Eye,
  Send,
  Zap,
  BookOpen,
  Calendar,
  ArrowUpDown,
  History,
  X,
  Bell,
  Check,
  Printer,
  Cpu,
  Lock,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  Plus,
  User,
  Mail,
  Phone,
  ShoppingBag,
  DollarSign,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { ordersApi, lookupsApi, Order, OrderItem, EntityStatus, UserAuditLog, ArtworkDocument, StaffUser } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";
import { useNotifications } from "@/context/notification-context";
import {
  ROLE_ACCESS_PROFILES,
  RoleAccessProfile,
  getRoleOrderPermission,
  isStatusAllowedForRole,
  isOrderRelevantForRole,
  RoleOrderPermission,
  getWorkstationQueue,
  WorkstationQueueDefinition,
  WORKSTATION_QUEUES,
} from "@/components/layout/navigation-config";

// Sequential Pipeline Definition
export const PIPELINE_SEQUENCE = [
  { code: "RECEIVED", name: "Order Received", step: 1 },
  { code: "PREPRESS_QUEUED", name: "Prepress Queued", step: 2 },
  { code: "PREPRESS_PASSED", name: "Prepress Approved", step: 3 },
  { code: "BATCHED", name: "Batched for Press", step: 4 },
  { code: "IN_PRODUCTION", name: "In Production", step: 5 },
  { code: "PRINTING", name: "Printing Press", step: 6 },
  { code: "QUALITY_AUDIT", name: "Quality Audit", step: 7 },
  { code: "PACKED", name: "Packed", step: 8 },
  { code: "READY_FOR_DISPATCH", name: "Ready for Dispatch", step: 9 },
  { code: "DISPATCHED", name: "Dispatched", step: 10 },
  { code: "IN_TRANSIT", name: "In Transit", step: 11 },
  { code: "OUT_FOR_DELIVERY", name: "Out for Delivery", step: 12 },
  { code: "DELIVERED", name: "Delivered", step: 13 },
];

export const PIPELINE_STEP_MAP: Record<string, number> = {
  RECEIVED: 1,
  PREPRESS_QUEUED: 2,
  PREPRESS_PASSED: 3,
  BATCHED: 4,
  IN_PRODUCTION: 5,
  PRINTING: 6,
  QUALITY_AUDIT: 7,
  PRODUCTION_COMPLETED: 8,
  PACKED: 8,
  READY_FOR_DISPATCH: 9,
  DISPATCHED: 10,
  IN_TRANSIT: 11,
  OUT_FOR_DELIVERY: 12,
  DELIVERED: 13,
};

// Helper component for Live SLA Countdown Clock
function SlaCountdownClock({ deadlineStr }: { deadlineStr: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isBreached: boolean;
    totalMinutes: number;
  }>({ hours: 0, minutes: 0, seconds: 0, isBreached: false, totalMinutes: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const target = new Date(deadlineStr).getTime();
      const diff = target - now;

      const isBreached = diff < 0;
      const absDiff = Math.abs(diff);

      const hours = Math.floor(absDiff / (1000 * 60 * 60));
      const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

      setTimeLeft({
        hours,
        minutes,
        seconds,
        isBreached,
        totalMinutes: Math.floor(diff / (1000 * 60)),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [deadlineStr]);

  if (timeLeft.isBreached) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-100/80 text-rose-800 border border-rose-200 text-xs font-mono font-bold animate-pulse">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        <span>Overdue by {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m</span>
      </div>
    );
  }

  if (timeLeft.totalMinutes <= 240) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300/80 text-xs font-mono font-semibold animate-pulse-subtle">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        <span>{String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s</span>
      </div>
    );
  }

  if (timeLeft.totalMinutes <= 720) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-[#0073EA] border border-blue-200 text-xs font-mono font-medium">
        <Clock className="w-3.5 h-3.5 text-[#0073EA]" />
        <span>{String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono">
      <Clock className="w-3.5 h-3.5 text-slate-400" />
      <span>{String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m</span>
    </div>
  );
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  const [searchQuery, setSearchQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"sla" | "newest" | "amount" | "order_number">("newest");

  // In-App Alert Notification State for New Orders
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const [prevTotalOrders, setPrevTotalOrders] = useState<number | null>(null);

  // Modals & Detail Tabs
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalTab, setOrderModalTab] = useState<"details" | "history">("details");
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [createOrderMode, setCreateOrderMode] = useState<"quick" | "custom">("quick");
  const [simulatePriority, setSimulatePriority] = useState<"RUSH_8H" | "EXPRESS_24H" | "STANDARD_72H">("RUSH_8H");
  const [simulateSource, setSimulateSource] = useState<"printify" | "peecho" | "custom_api" | "manual">("manual");

  // Custom Order Fields
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [customCustomerEmail, setCustomCustomerEmail] = useState("");
  const [customCustomerPhone, setCustomCustomerPhone] = useState("");
  const [customProductType, setCustomProductType] = useState("");
  const [customPaperStock, setCustomPaperStock] = useState("");
  const [customQuantity, setCustomQuantity] = useState<number>(1);
  const [customTotalAmount, setCustomTotalAmount] = useState<string>("");
  const [customCity, setCustomCity] = useState("");
  const [customCountry, setCustomCountry] = useState("India");

  const [transitionStatusCode, setTransitionStatusCode] = useState("");
  const [transitionComment, setTransitionComment] = useState("");
  const [adminOverrideApproved, setAdminOverrideApproved] = useState(false);

  // Multi-Document PDF Preview Modal State
  const [documentPreviewModal, setDocumentPreviewModal] = useState<{
    isOpen: boolean;
    orderNumber: string;
    productType: string;
    documents: ArtworkDocument[];
    activeDocId: string;
  } | null>(null);

  // Current User & Admin role detection
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("silverpoint_user");
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch (e) {}
      }
    }
  }, []);

  const userRole = useMemo(() => {
    if (!currentUser) return "SUPER_ADMIN";
    return (
      currentUser.role_details?.code ||
      (typeof currentUser.role === "string" ? currentUser.role : null) ||
      (currentUser.is_superuser ? "SUPER_ADMIN" : "STAFF")
    );
  }, [currentUser]);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return Boolean(
      currentUser.is_superuser ||
      currentUser.is_staff ||
      userRole === "SUPER_ADMIN" ||
      userRole === "ADMIN"
    );
  }, [currentUser, userRole]);

  // Workstation Queue Tabs: "all" (All Orders, default) vs "pending" (Action Required) vs "processed" (Completed/Archive)
  const [orderQueueTab, setOrderQueueTab] = useState<"all" | "pending" | "processed">("all");
  const [adminStationView, setAdminStationView] = useState<string>("ALL");

  const effectiveRole = useMemo(() => {
    if (isAdmin && adminStationView !== "ALL") {
      return adminStationView;
    }
    return userRole;
  }, [isAdmin, adminStationView, userRole]);

  const rolePerm = useMemo(() => {
    return getRoleOrderPermission(effectiveRole);
  }, [effectiveRole]);

  const wsQueue = useMemo(() => {
    return getWorkstationQueue(effectiveRole);
  }, [effectiveRole]);

  const roleProfile = useMemo(() => {
    return ROLE_ACCESS_PROFILES[effectiveRole] || null;
  }, [effectiveRole]);

  // Default to Station View for non-admins, All for admins
  const [stationScope, setStationScope] = useState<"STATION" | "ALL">("STATION");
  const [isStationScopeInitialized, setIsStationScopeInitialized] = useState(false);

  useEffect(() => {
    if (currentUser && !isStationScopeInitialized) {
      setStationScope(isAdmin ? "ALL" : "STATION");
      setIsStationScopeInitialized(true);
    }
  }, [currentUser, isAdmin, isStationScopeInitialized]);

  // Sync URL search query into searchQuery state
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get("search") || params.get("q");
      if (urlQuery && urlQuery.trim()) {
        setSearchQuery(urlQuery.trim());
      }
    }
  }, []);

  // Visual auto-sync feedback alert inside modal
  const [syncAlert, setSyncAlert] = useState<{
    type: "success" | "error";
    message: string;
    timestamp: string;
  } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 on filter changes or tab switches
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, urgencyFilter, statusFilter, sourceFilter, dateFilter, orderQueueTab, adminStationView]);

  // Queries - Real-time polling every 5 seconds for instant sync
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["orders", searchQuery, urgencyFilter, statusFilter, sourceFilter, adminStationView],
    queryFn: () =>
      ordersApi.getOrders({
        search: searchQuery || undefined,
        urgency: urgencyFilter || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter || undefined,
        source: sourceFilter === "ALL" ? undefined : sourceFilter,
        page_size: 100,
        ordering: "-created_at",
      }),
    refetchInterval: 5000,
  });

  const { data: metricsData } = useQuery({
    queryKey: ["orders-metrics"],
    queryFn: () => ordersApi.getOrderMetrics(),
    refetchInterval: 10000,
  });

  const { data: statusesData } = useQuery({
    queryKey: ["order-statuses"],
    queryFn: () => lookupsApi.getStatuses("ORDER", true),
  });

  // Query audit logs when an order is selected
  const { data: orderAuditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["order-audit-logs", selectedOrder?.id],
    queryFn: () => (selectedOrder ? ordersApi.getOrderAuditLogs(selectedOrder.id) : Promise.resolve([])),
    enabled: !!selectedOrder && orderModalTab === "history",
  });

  // Detect newly arrived order and show in-app notification banner
  useEffect(() => {
    if (ordersData?.count !== undefined) {
      if (prevTotalOrders !== null && ordersData.count > prevTotalOrders) {
        const latestOrder = ordersData.results?.[0];
        if (latestOrder) {
          setNewOrderAlert(latestOrder);
        }
      }
      setPrevTotalOrders(ordersData.count);
    }
  }, [ordersData?.count, prevTotalOrders, ordersData?.results]);

  // Synchronize manual status transition selector with selected order's current status
  useEffect(() => {
    if (selectedOrder) {
      const code =
        selectedOrder.status_details?.code ||
        (typeof selectedOrder.status === "string" ? selectedOrder.status : "");
      setTransitionStatusCode(code);
      setTransitionComment("");
      setAdminOverrideApproved(false);
      setSyncAlert(null);
    } else {
      setTransitionStatusCode("");
      setTransitionComment("");
      setAdminOverrideApproved(false);
      setSyncAlert(null);
    }
  }, [selectedOrder?.id, selectedOrder?.status_details?.code, selectedOrder?.status]);

  // Keep modal in sync with real-time background updates
  useEffect(() => {
    if (selectedOrder && ordersData?.results) {
      const fresh = ordersData.results.find((o) => o.id === selectedOrder.id);
      if (fresh && fresh.status !== selectedOrder.status) {
        setSelectedOrder(fresh);
      }
    }
  }, [ordersData?.results, selectedOrder?.id, selectedOrder?.status]);

  // Mutations
  const simulateMutation = useMutation({
    mutationFn: (params: {
      priority: "RUSH_8H" | "EXPRESS_24H" | "STANDARD_72H";
      source: "printify" | "peecho" | "custom_api" | "manual";
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      product_type?: string;
      paper_stock?: string;
      quantity?: number;
      total_amount?: number;
      city?: string;
      country?: string;
    }) => ordersApi.simulateOrder(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["printify-logs"] });
      queryClient.invalidateQueries({ queryKey: ["peecho-logs"] });
      setIsSimulateModalOpen(false);
      setCustomCustomerName("");
      setCustomCustomerEmail("");
      setCustomCustomerPhone("");
      setCustomProductType("");
      setCustomPaperStock("");
      setCustomQuantity(1);
      setCustomTotalAmount("");
      setCustomCity("");
      setCustomCountry("India");
      setCreateOrderMode("quick");
      if (data.order) {
        setNewOrderAlert(data.order);
        const sourceLabel =
          data.order.order_source === "printify"
            ? "Printify POD"
            : data.order.order_source === "peecho"
            ? "Peecho POD"
            : data.order.order_source === "custom_api"
            ? "Custom API"
            : "In-House Manual";
        addNotification({
          title: `New ${sourceLabel} Order: ${data.order.order_number}`,
          message: `Customer: ${data.order.customer_name}. SLA: ${data.order.sla_priority?.replace(/_/g, " ") || "Standard"}.`,
          type: "info",
          category: "ORDER_INCOMING",
          orderNumber: data.order.order_number,
          link: "/orders",
        });
      }
    },
    onError: (err: any) => {
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to simulate incoming order.";
      addNotification({
        title: "Order Creation Failed",
        message: errMsg,
        type: "error",
        category: "ORDER_INCOMING",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      statusCode,
      comments,
      adminApproved,
    }: {
      orderId: string;
      statusCode: string;
      comments: string;
      adminApproved?: boolean;
    }) => ordersApi.updateOrderStatus(orderId, statusCode, comments, adminApproved),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["order-audit-logs"] });
      setSelectedOrder(data.order);
      const newCode =
        data.order?.status_details?.code ||
        (typeof data.order?.status === "string" ? data.order.status : "");
      setTransitionStatusCode(newCode);
      setTransitionComment("");
      setAdminOverrideApproved(false);

      const targetStatusName =
        data.order?.status_details?.name ||
        statusesData?.results?.find((s) => s.code === newCode)?.name ||
        newCode;
      const orderNum = data.order?.order_number || "Order";
      const successMsg = `Order ${orderNum} transitioned to "${targetStatusName}". Auto-synced with Peecho API.`;

      setSyncAlert({
        type: "success",
        message: successMsg,
        timestamp: new Date().toLocaleTimeString(),
      });

      addNotification({
        title: `Status Auto-Synced: ${orderNum}`,
        message: successMsg,
        type: "success",
        category: "STATUS_SYNC",
        orderNumber: orderNum,
        link: "/orders",
      });
    },
    onError: (err: any) => {
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update status and synchronize with Peecho.";
      setSyncAlert({
        type: "error",
        message: errMsg,
        timestamp: new Date().toLocaleTimeString(),
      });
      addNotification({
        title: "Status Update Denied",
        message: errMsg,
        type: "error",
        category: "STATUS_SYNC",
      });
    },
  });

  // Count of orders strictly relevant to user's station
  const stationOrdersCount = useMemo(() => {
    const list = ordersData?.results || [];
    return list.filter((order) => {
      const statusCode = (order.status_details?.code || order.status || "").toUpperCase();
      return isOrderRelevantForRole(effectiveRole, statusCode);
    }).length;
  }, [ordersData?.results, effectiveRole]);

  // Client-side date, station scope, and sort filtering
  const processedOrders = useMemo(() => {
    let list = [...(ordersData?.results || [])];

    // Station Scope filter (only filter when in STATION scope or admin filtered to a station)
    if (stationScope === "STATION" || (isAdmin && adminStationView !== "ALL")) {
      list = list.filter((ord) => {
        const statusCode = (ord.status_details?.code || ord.status || "").toUpperCase();
        return isOrderRelevantForRole(effectiveRole, statusCode);
      });
    }

    // Date filter
    if (dateFilter !== "ALL") {
      const now = new Date();
      list = list.filter((ord) => {
        const created = new Date(ord.created_at);
        if (dateFilter === "TODAY") {
          return created.toDateString() === now.toDateString();
        }
        if (dateFilter === "7DAYS") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return created >= sevenDaysAgo;
        }
        return true;
      });
    }

    // Sort - strictly descending by created_at (newest created first) by default
    list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (sortBy === "newest") {
        if (timeB !== timeA) return timeB - timeA;
        return (b.order_number || "").localeCompare(a.order_number || "", undefined, { numeric: true });
      }
      if (sortBy === "sla") {
        const slaA = a.sla_deadline ? new Date(a.sla_deadline).getTime() : Infinity;
        const slaB = b.sla_deadline ? new Date(b.sla_deadline).getTime() : Infinity;
        if (slaA !== slaB) return slaA - slaB;
        return timeB - timeA;
      }
      if (sortBy === "amount") {
        const diff = Number(b.total_amount || 0) - Number(a.total_amount || 0);
        if (diff !== 0) return diff;
        return timeB - timeA;
      }
      if (sortBy === "order_number") {
        return (b.order_number || "").localeCompare(a.order_number || "", undefined, { numeric: true });
      }
      if (timeB !== timeA) return timeB - timeA;
      return (b.order_number || "").localeCompare(a.order_number || "", undefined, { numeric: true });
    });

    return list;
  }, [ordersData?.results, isAdmin, adminStationView, stationScope, effectiveRole, dateFilter, sortBy]);

  // Partition into Pending (Action Required, highlighted) and Processed (Completed / Approved / Rejected)
  const { pendingOrdersList, processedOrdersList } = useMemo(() => {
    const pending: Order[] = [];
    const processed: Order[] = [];

    processedOrders.forEach((ord) => {
      const code = (ord.status_details?.code || ord.status || "").toUpperCase();
      if (wsQueue.pendingStatuses.includes(code)) {
        pending.push(ord);
      } else {
        processed.push(ord);
      }
    });

    return { pendingOrdersList: pending, processedOrdersList: processed };
  }, [processedOrders, wsQueue.pendingStatuses]);

  const activeDisplayOrders = useMemo(() => {
    if (orderQueueTab === "pending") return pendingOrdersList;
    if (orderQueueTab === "processed") return processedOrdersList;
    return processedOrders;
  }, [orderQueueTab, pendingOrdersList, processedOrdersList, processedOrders]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeDisplayOrders.slice(start, start + pageSize);
  }, [activeDisplayOrders, currentPage, pageSize]);

  // Check if an order exists in the system that the user does not have permission to view
  const restrictedSearchMatch = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) return null;

    // 1. Check if backend returned an access_restricted_match in the response
    if (ordersData?.access_restricted_match && !ordersData.access_restricted_match.has_access) {
      return ordersData.access_restricted_match;
    }

    // 2. Check if an order was returned in raw ordersData.results but filtered out by role station scope
    const rawList = ordersData?.results || [];
    const term = searchQuery.trim().toLowerCase();
    const foundInRaw = rawList.find((ord) => {
      const matchNumber = (ord.order_number || "").toLowerCase().includes(term);
      const matchPeecho = (ord.peecho_order_id || "").toLowerCase().includes(term);
      const matchCustomer = (ord.customer_name || "").toLowerCase().includes(term);
      return matchNumber || matchPeecho || matchCustomer;
    });

    if (foundInRaw) {
      const statusCode = (foundInRaw.status_details?.code || foundInRaw.status || "").toUpperCase();
      const isAllowed = isOrderRelevantForRole(effectiveRole, statusCode);
      if (!isAllowed) {
        return {
          found: true,
          has_access: false,
          order_number: foundInRaw.order_number,
          status_code: statusCode,
          status_name: foundInRaw.status_details?.name || foundInRaw.status || "Unassigned",
          message: "You have no access to this job / this order",
        };
      }
    }

    return null;
  }, [searchQuery, ordersData, effectiveRole]);

  // Fast asynchronous access verification if local filter returned 0 results
  const [asyncAccessMatch, setAsyncAccessMatch] = useState<{
    found: boolean;
    has_access: boolean;
    order_number?: string;
    status_code?: string;
    status_name?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2 || activeDisplayOrders.length > 0) {
      setAsyncAccessMatch(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const check = await ordersApi.checkAccess(searchQuery.trim());
        if (check.found && !check.has_access) {
          setAsyncAccessMatch(check);
        } else {
          setAsyncAccessMatch(null);
        }
      } catch {
        setAsyncAccessMatch(null);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeDisplayOrders.length]);

  const effectiveRestrictedMatch = restrictedSearchMatch || asyncAccessMatch;

  // Table Column Definitions
  const orderColumns: Column<Order>[] = [
    {
      header: "Order Number",
      cell: (ord) => {
        const createdDate = ord.created_at
          ? new Date(ord.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : "";
        return (
          <div className="flex flex-col">
            <span className="font-mono font-bold text-xs text-[#0073EA] hover:underline">
              {ord.order_number}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="font-mono">{ord.peecho_order_id || ord.external_pod_order_id || "Direct Job"}</span>
              {createdDate && (
                <>
                  <span>•</span>
                  <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{createdDate}</span>
                </>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Channel",
      cell: (ord) => {
        const src = (ord.order_source || "peecho").toLowerCase();
        if (src === "printify") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Printer className="w-3 h-3 text-emerald-600" />
              Printify
            </span>
          );
        }
        if (src === "custom_api" || src === "custom") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <Cpu className="w-3 h-3 text-purple-600" />
              Custom API
            </span>
          );
        }
        if (src === "manual" || src === "internal") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
              <Layers className="w-3 h-3 text-slate-500" />
              In-House
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#0073EA] border border-blue-200">
            <Globe2 className="w-3 h-3 text-[#0073EA]" />
            Peecho
          </span>
        );
      },
    },
    {
      header: "Customer & Address",
      cell: (ord) => (
        <div className="flex flex-col">
          <span className="font-medium text-xs text-slate-800">{ord.customer_name}</span>
          <span className="text-[11px] text-slate-400">
            {ord.shipping_address?.city || "Unknown"}, {ord.shipping_address?.country || ""}
          </span>
        </div>
      ),
    },
    {
      header: "Product Details",
      cell: (ord) => {
        const firstItem = ord.items?.[0];
        return (
          <div className="flex flex-col max-w-[220px]">
            <span className="text-xs text-slate-800 font-medium truncate">
              {firstItem?.product_type || `${ord.total_items_count} items`}
            </span>
            <span className="text-[11px] text-slate-400">
              Qty: {ord.total_items_count} | {firstItem ? `${firstItem.page_count} pages • Spine: ${firstItem.spine_width_mm}mm` : ""}
            </span>
          </div>
        );
      },
    },
    {
      header: "Status",
      cell: (ord) => {
        const st = ord.status_details;
        return st ? (
          <Badge
            variant="custom"
            bgHex={st.badge_bg}
            textHex={st.badge_text}
            dot={true}
          >
            {st.name}
          </Badge>
        ) : (
          <Badge variant="neutral">{ord.status}</Badge>
        );
      },
    },
    {
      header: "Delivery Speed",
      cell: (ord) => {
        let variant: "danger" | "warning" | "neutral" = "neutral";
        if (ord.sla_priority === "RUSH_8H") variant = "danger";
        if (ord.sla_priority === "EXPRESS_24H") variant = "warning";

        return (
          <Badge variant={variant} size="sm">
            {ord.sla_priority.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      header: "Time Remaining",
      cell: (ord) => <SlaCountdownClock deadlineStr={ord.sla_deadline} />,
    },
    {
      header: "Action",
      cell: (ord) => {
        const statusCode = (ord.status_details?.code || ord.status || "").toUpperCase();
        const isPrepress = effectiveRole === "PREPRESS_SPECIALIST";
        const isPendingPrepress = isPrepress && ["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS"].includes(statusCode);

        if (isPendingPrepress && orderQueueTab === "pending") {
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-7 px-2.5 shadow-2xs"
                isLoading={updateStatusMutation.isPending && selectedOrder?.id === ord.id}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedOrder(ord);
                  updateStatusMutation.mutate({
                    orderId: ord.id,
                    statusCode: "PREPRESS_PASSED",
                    comments: "Artwork verified and approved for production floor.",
                  });
                }}
                title="Approve digital proof and forward to Production Floor"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 px-2 text-rose-700 border-rose-200 hover:bg-rose-50 font-semibold"
                onClick={() => {
                  setSelectedOrder(ord);
                  updateStatusMutation.mutate({
                    orderId: ord.id,
                    statusCode: "EXCEPTION_HOLD",
                    comments: "Artwork rejected or placed on exception hold",
                  });
                }}
                title="Reject proof or flag on exception hold"
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Eye className="w-3.5 h-3.5 text-[#0073EA]" />}
                className="text-xs h-7 px-2"
                onClick={() => {
                  setSelectedOrder(ord);
                  setOrderModalTab("details");
                }}
                title="Inspect order details and PDF proof"
              >
                Inspect
              </Button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Eye className="w-3.5 h-3.5 text-[#0073EA]" />}
              className="text-xs h-7 px-2.5"
              onClick={() => {
                setSelectedOrder(ord);
                setOrderModalTab("details");
              }}
            >
              View Order
            </Button>
            {orderQueueTab === "processed" && (
              <span className="text-[10px] text-slate-400 font-medium px-1">
                Completed
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Real-time New Order Ingestion Alert Banner */}
      {newOrderAlert && (
        <div className="p-4 rounded-xl bg-[#0073EA] text-white shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-bold flex items-center gap-2">
                <span>New Customer Order Received!</span>
                <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-mono">
                  {newOrderAlert.order_number}
                </span>
              </p>
              <p className="text-[11px] text-white/90 mt-0.5">
                {newOrderAlert.customer_name} • {newOrderAlert.items?.[0]?.product_type || "POD Book"} •{" "}
                <span className="font-semibold underline">{newOrderAlert.sla_priority.replace("_", " ")}</span> • Queued for artwork check
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedOrder(newOrderAlert);
                setOrderModalTab("details");
                setNewOrderAlert(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-white text-[#0073EA] font-bold text-xs hover:bg-slate-100 transition-colors shadow-xs"
            >
              View Order
            </button>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header & Simulation Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Orders
            </h1>
            <Badge variant="primary" size="sm">Live Sync</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            View and track customer print orders, monitor delivery deadlines, and update status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => refetchOrders()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
            onClick={() => setIsSimulateModalOpen(true)}
            className="bg-[#0073EA] hover:bg-[#0060B9] shadow-xs text-white"
          >
            Create Order
          </Button>
        </div>
      </div>

      {/* Top SLA & Production KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Active Orders"
          value={metricsData?.total_orders ?? ordersData?.count ?? 6}
          change="Incoming"
          trend="up"
          subtitle="Live Orders"
          icon={<PackageCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Artwork Review"
          value={metricsData?.in_prepress ?? 2}
          change="Pending Review"
          trend="neutral"
          subtitle="Checking bleed & size"
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          title="In Production"
          value={metricsData?.in_production ?? 2}
          change="On Press"
          trend="up"
          subtitle="Printing & binding"
          icon={<BookOpen className="w-5 h-5" />}
        />
        <StatCard
          title="Urgent Deadlines (< 4h)"
          value={metricsData?.sla_at_risk ?? 1}
          change="Needs Attention"
          trend="down"
          subtitle="Rush Orders"
          icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
        />
      </div>

      {/* Station Scope & Designation Banner */}
      <div className="bg-white p-4 rounded-xl border border-blue-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 via-white to-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#0073EA] border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">
                {rolePerm.stationName}
              </span>
              <Badge variant={roleProfile?.badgeVariant || "primary"} size="sm" dot={true}>
                {roleProfile?.designation || userRole}
              </Badge>
              <span className="text-[10px] text-slate-400 font-mono">
                ({rolePerm.department})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin
                ? "Full administrative platform access. Viewing all production and fulfillment pipelines."
                : `Station View Active: ${rolePerm.description}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-semibold text-slate-500">View Scope:</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs font-medium">
            <button
              onClick={() => {
                setStationScope("STATION");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                stationScope === "STATION"
                  ? "bg-[#0073EA] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>My Station Orders</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                stationScope === "STATION" ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"
              }`}>
                {stationOrdersCount}
              </span>
            </button>
            <button
              onClick={() => {
                setStationScope("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                stationScope === "ALL"
                  ? "bg-[#0073EA] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>All Orders</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                stationScope === "ALL" ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"
              }`}>
                {ordersData?.count || 0}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Unified Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="orders_search_filter"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order number, customer name, city..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[10px] flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Date:
            </span>
            {[
              { id: "ALL", label: "All" },
              { id: "TODAY", label: "Today" },
              { id: "7DAYS", label: "Last 7 Days" },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateFilter(d.id)}
                className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                  dateFilter === d.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Sort Selector & Quick Create */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px] flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 font-medium"
              >
                <option value="newest">Date Created (Newest First)</option>
                <option value="sla">Delivery Deadline (Urgent First)</option>
                <option value="amount">Order Amount (High to Low)</option>
                <option value="order_number">Order Number (Desc)</option>
              </select>
            </div>
            <Button
              size="sm"
              onClick={() => setIsSimulateModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              className="bg-[#0073EA] hover:bg-[#0060B9] text-white text-xs font-semibold shadow-xs"
            >
              Create Order
            </Button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Origin Channel Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold uppercase text-[10px] flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" /> Origin Channel:
              </span>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all cursor-pointer"
              >
                <option value="ALL">All Channels</option>
                <option value="printify">Printify POD</option>
                <option value="peecho">Peecho POD</option>
                <option value="custom_api">Custom B2B API</option>
                <option value="manual">In-House Manual</option>
              </select>
            </div>

            {/* Deadline Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold uppercase text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Deadline:
              </span>
              <select
                value={urgencyFilter}
                onChange={(e) => {
                  setUrgencyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all cursor-pointer"
              >
                <option value="">All Deadlines</option>
                <option value="critical">Urgent (&lt; 4h remaining)</option>
                <option value="urgent">Next 12h</option>
                <option value="normal">Normal (&gt; 12h)</option>
                <option value="breached">Overdue</option>
              </select>
            </div>

            {/* Dynamic Status Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold uppercase text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-slate-400" /> Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                {statusesData?.results?.map((st) => (
                  <option key={st.id} value={st.code}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filter Reset */}
          {(sourceFilter !== "ALL" || urgencyFilter !== "" || statusFilter !== "ALL" || dateFilter !== "ALL" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSourceFilter("ALL");
                setUrgencyFilter("");
                setStatusFilter("ALL");
                setDateFilter("ALL");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="text-xs text-slate-500 hover:text-[#0073EA] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Station Queue Header & Two Main Action Tabs */}
      <div className="space-y-3">
        {/* Workstation Identification & Quick Role Preview for Admins */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0073EA]/10 to-indigo-100 text-[#0073EA] flex items-center justify-center font-bold shadow-2xs shrink-0">
              {effectiveRole === "PREPRESS_SPECIALIST" ? (
                <Layers className="w-5 h-5 text-[#0073EA]" />
              ) : effectiveRole === "SHOPFLOOR_OPERATOR" ? (
                <Printer className="w-5 h-5 text-emerald-600" />
              ) : effectiveRole === "PRODUCTION_MANAGER" ? (
                <Sparkles className="w-5 h-5 text-purple-600" />
              ) : effectiveRole === "DISPATCH_SPECIALIST" || effectiveRole === "DISPATCH_FINANCE_SPECIALIST" ? (
                <Truck className="w-5 h-5 text-sky-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-slate-800" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  {wsQueue.stationName}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                  {wsQueue.department}
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200">
                    Admin Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {orderQueueTab === "pending" ? wsQueue.pendingSubtitle : wsQueue.processedSubtitle}
              </p>
            </div>
          </div>

          {/* Admin Station Switcher: Enables admin to preview the factory from the eyes of any operator */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200/80 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 px-2">Workstation Queue View:</span>
              {[
                { id: "ALL", label: "Master Flow" },
                { id: "PREPRESS_SPECIALIST", label: "🎨 Prepress (Artwork)" },
                { id: "SHOPFLOOR_OPERATOR", label: "🖨️ Press Floor" },
                { id: "DISPATCH_SPECIALIST", label: "📦 Shipping" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setAdminStationView(st.id);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    adminStationView === st.id
                      ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The Three Queue Tabs: All Pipeline (Default), Pending Action, and Processed History */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tab 0: ALL PIPELINE ORDERS (Default) */}
          <button
            type="button"
            onClick={() => {
              setOrderQueueTab("all");
              setCurrentPage(1);
            }}
            className={`group relative text-left p-4 rounded-xl border transition-all cursor-pointer ${
              orderQueueTab === "all"
                ? "bg-gradient-to-r from-blue-50/90 via-white to-blue-50/60 border-[#0073EA] ring-2 ring-[#0073EA]/20 shadow-xs"
                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className={`w-3.5 h-3.5 ${orderQueueTab === "all" ? "text-[#0073EA]" : "text-slate-400"}`} />
                <span
                  className={`text-xs uppercase tracking-wider font-bold ${
                    orderQueueTab === "all" ? "text-[#0073EA]" : "text-slate-600"
                  }`}
                >
                  All Orders
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                  orderQueueTab === "all"
                    ? "bg-[#0073EA] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {processedOrders.length} {processedOrders.length === 1 ? "Order" : "Orders"}
              </span>
            </div>

            <h4 className="mt-2 text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>All Pipeline Orders</span>
              {orderQueueTab === "all" && (
                <span className="text-[10px] font-bold text-[#0073EA] bg-blue-100/80 px-2 py-0.5 rounded-md">
                  Active
                </span>
              )}
            </h4>
            <p className="mt-1 text-xs text-slate-500 line-clamp-1">
              Every active customer order across all stations and production phases
            </p>
          </button>

          {/* Tab 1: PENDING ACTION */}
          <button
            type="button"
            onClick={() => {
              setOrderQueueTab("pending");
              setCurrentPage(1);
            }}
            className={`group relative text-left p-4 rounded-xl border transition-all cursor-pointer ${
              orderQueueTab === "pending"
                ? "bg-gradient-to-r from-blue-50/90 via-white to-indigo-50/60 border-[#0073EA] ring-2 ring-[#0073EA]/20 shadow-xs"
                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    pendingOrdersList.length > 0
                      ? "bg-amber-500 animate-pulse ring-4 ring-amber-100"
                      : "bg-emerald-500"
                  }`}
                />
                <span
                  className={`text-xs uppercase tracking-wider font-bold ${
                    orderQueueTab === "pending" ? "text-[#0073EA]" : "text-slate-600"
                  }`}
                >
                  Action Required
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                  orderQueueTab === "pending"
                    ? "bg-[#0073EA] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {pendingOrdersList.length} {pendingOrdersList.length === 1 ? "Order" : "Orders"}
              </span>
            </div>

            <h4 className="mt-2 text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>{wsQueue.pendingLabel}</span>
              {orderQueueTab === "pending" && (
                <span className="text-[10px] font-bold text-[#0073EA] bg-blue-100/80 px-2 py-0.5 rounded-md">
                  Active
                </span>
              )}
            </h4>
            <p className="mt-1 text-xs text-slate-500 line-clamp-1">
              {wsQueue.pendingSubtitle}
            </p>
          </button>

          {/* Tab 2: PROCESSED / COMPLETED (Archived & Handed Over) */}
          <button
            type="button"
            onClick={() => {
              setOrderQueueTab("processed");
              setCurrentPage(1);
            }}
            className={`group relative text-left p-4 rounded-xl border transition-all cursor-pointer ${
              orderQueueTab === "processed"
                ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    orderQueueTab === "processed" ? "text-emerald-400" : "text-slate-400"
                  }`}
                />
                <span
                  className={`text-xs uppercase tracking-wider font-bold ${
                    orderQueueTab === "processed" ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  Processed History
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                  orderQueueTab === "processed"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {processedOrdersList.length} {processedOrdersList.length === 1 ? "Order" : "Orders"}
              </span>
            </div>

            <h4
              className={`mt-2 text-sm font-bold flex items-center gap-1.5 ${
                orderQueueTab === "processed" ? "text-white" : "text-slate-900"
              }`}
            >
              <span>{wsQueue.processedLabel}</span>
              {orderQueueTab === "processed" && (
                <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                  Active
                </span>
              )}
            </h4>
            <p
              className={`mt-1 text-xs line-clamp-1 ${
                orderQueueTab === "processed" ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {wsQueue.processedSubtitle}
            </p>
          </button>
        </div>
      </div>

      {/* ACCESS RESTRICTION BANNER WHEN SEARCHING RESTRICTED JOB */}
      {searchQuery && effectiveRestrictedMatch && (
        <div className="mb-4 p-5 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in zoom-in-95">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300 shadow-2xs">
              <Lock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900">
                  You have no access to this job / this order
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  Access Restricted
                </span>
                {effectiveRestrictedMatch.order_number && (
                  <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {effectiveRestrictedMatch.order_number}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                This job exists in the order database, but it is currently in the{" "}
                <strong className="text-slate-900 font-bold">
                  {effectiveRestrictedMatch.status_name}
                </strong>{" "}
                stage. Your current role (
                <strong className="text-slate-800 font-bold">{roleProfile?.title || userRole}</strong>
                ) does not have authorization to view or manage orders in this workstation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-xs border-amber-300 text-slate-700 hover:bg-amber-100/60 font-semibold cursor-pointer"
            >
              Clear Search
            </Button>
          </div>
        </div>
      )}

      {/* Order Listing Table Action Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 px-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-[#0073EA]" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {orderQueueTab === "pending"
                ? "Pending Station Queue"
                : orderQueueTab === "processed"
                ? "Processed Orders Archive"
                : "All Orders Listing"}
            </h3>
          </div>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] font-mono font-bold text-[#0073EA] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            {activeDisplayOrders.length} {activeDisplayOrders.length === 1 ? "Record" : "Records"}
          </span>
          {ordersLoading && (
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-[#0073EA]" /> Live Updating...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOrders()}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin text-[#0073EA]" : ""}`} />}
            className="text-xs"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsSimulateModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
            className="bg-[#0073EA] hover:bg-[#0060B9] text-white text-xs font-semibold shadow-xs"
          >
            Create Order
          </Button>
        </div>
      </div>

      {/* Main Orders Table */}
      <Card noPadding={true}>
        <Table
          data={paginatedOrders}
          columns={orderColumns}
          keyExtractor={(ord) => ord.id}
          isLoading={ordersLoading}
          emptyMessage={
            effectiveRestrictedMatch ? (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <Lock className="w-8 h-8 text-amber-500 mb-2" />
                <p className="text-sm font-bold text-slate-800">
                  Access Restricted ({effectiveRestrictedMatch.order_number})
                </p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Current stage is {effectiveRestrictedMatch.status_name}, which is restricted for your role.
                </p>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <PackageCheck className="w-10 h-10 text-slate-300 mb-2.5" />
                <p className="text-sm font-bold text-slate-800">
                  {orderQueueTab === "pending"
                    ? `No Pending Orders Awaiting Action`
                    : orderQueueTab === "processed"
                    ? `No Processed Orders in Station Archive`
                    : `No Orders Found`}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                  {orderQueueTab === "pending"
                    ? `All caught up! No incoming jobs currently waiting in ${wsQueue.stationName}.`
                    : orderQueueTab === "processed"
                    ? `No historical jobs found for this station filter.`
                    : `No orders match your active search or filter criteria.`}
                </p>
                <div className="flex items-center gap-2">
                  {(sourceFilter !== "ALL" || urgencyFilter !== "" || statusFilter !== "ALL" || dateFilter !== "ALL" || searchQuery) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSourceFilter("ALL");
                        setUrgencyFilter("");
                        setStatusFilter("ALL");
                        setDateFilter("ALL");
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className="text-xs"
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setIsSimulateModalOpen(true)}
                    leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                    className="bg-[#0073EA] hover:bg-[#0060B9] text-white text-xs font-semibold shadow-xs"
                  >
                    Create Order
                  </Button>
                </div>
              </div>
            )
          }
          pagination={{
            currentPage,
            totalPages: Math.ceil(activeDisplayOrders.length / pageSize) || 1,
            totalCount: activeDisplayOrders.length,
            pageSize,
            onPageChange: (p) => setCurrentPage(p),
            onPageSizeChange: (s) => {
              setPageSize(s);
              setCurrentPage(1);
            },
          }}
        />
      </Card>

      {/* MODAL: CREATE MULTI-CHANNEL OR CUSTOM ORDER */}
      <Modal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        title="Create New Order"
        description="Ingest an inbound POD order via preset channels or enter custom customer & print specifications."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsSimulateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={simulateMutation.isPending}
              onClick={() => {
                if (createOrderMode === "custom") {
                  simulateMutation.mutate({
                    priority: simulatePriority,
                    source: simulateSource,
                    customer_name: customCustomerName.trim() || undefined,
                    customer_email: customCustomerEmail.trim() || undefined,
                    customer_phone: customCustomerPhone.trim() || undefined,
                    product_type: customProductType.trim() || undefined,
                    paper_stock: customPaperStock.trim() || undefined,
                    quantity: customQuantity > 0 ? Number(customQuantity) : 1,
                    total_amount: customTotalAmount ? parseFloat(customTotalAmount) : undefined,
                    city: customCity.trim() || undefined,
                    country: customCountry.trim() || undefined,
                  });
                } else {
                  simulateMutation.mutate({
                    priority: simulatePriority,
                    source: simulateSource,
                  });
                }
              }}
              className="bg-[#0073EA] hover:bg-[#0060B9]"
              leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
            >
              {createOrderMode === "custom" ? "Submit Custom Order" : "Ingest Preset Order"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setCreateOrderMode("quick")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                createOrderMode === "quick"
                  ? "bg-white text-[#0073EA] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Channel Preset</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOrderMode("custom")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                createOrderMode === "custom"
                  ? "bg-white text-[#0073EA] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>Custom Order Details</span>
            </button>
          </div>

          {/* Channel Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select Origin Channel:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  id: "printify",
                  name: "Printify POD",
                  desc: "Apparel, mugs & merchandise via Printify REST API",
                  icon: Printer,
                  colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200",
                  activeBorder: "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500",
                },
                {
                  id: "peecho",
                  name: "Peecho POD",
                  desc: "Hardcover photobooks & magazines via Peecho webhook",
                  icon: Globe2,
                  colorClass: "text-[#0073EA] bg-blue-50 border-blue-200",
                  activeBorder: "border-[#0073EA] bg-blue-50/60 ring-1 ring-[#0073EA]",
                },
                {
                  id: "custom_api",
                  name: "Custom POD / API",
                  desc: "B2B client gateway & fine art giclée prints",
                  icon: Cpu,
                  colorClass: "text-purple-600 bg-purple-50 border-purple-200",
                  activeBorder: "border-purple-500 bg-purple-50/60 ring-1 ring-purple-500",
                },
                {
                  id: "manual",
                  name: "In-House / Manual",
                  desc: "Shop-floor CSR jobs, brochures & roll-up banners",
                  icon: Layers,
                  colorClass: "text-slate-600 bg-slate-100 border-slate-300",
                  activeBorder: "border-slate-700 bg-slate-100 ring-1 ring-slate-700",
                },
              ].map((channel) => {
                const IconComponent = channel.icon;
                const isSelected = simulateSource === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSimulateSource(channel.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? channel.activeBorder
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1 rounded-md border ${channel.colorClass}`}>
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <p className="font-bold text-slate-900 text-xs">{channel.name}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">{channel.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delivery Speed / SLA */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select Delivery Speed & SLA:
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "RUSH_8H", name: "Rush", desc: "8-Hour Target" },
                { id: "EXPRESS_24H", name: "Express", desc: "24-Hour Target" },
                { id: "STANDARD_72H", name: "Standard", desc: "72-Hour Target" },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSimulatePriority(tier.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    simulatePriority === tier.id
                      ? "border-[#0073EA] bg-blue-50/60 ring-1 ring-[#0073EA]"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-bold text-slate-900 text-xs">{tier.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{tier.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* If Custom Mode: Display form fields for customer & product specifications */}
          {createOrderMode === "custom" ? (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#0073EA]" />
                <span>Customer & Delivery Information</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Customer Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={customCustomerName}
                      onChange={(e) => setCustomCustomerName(e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Customer Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={customCustomerEmail}
                      onChange={(e) => setCustomCustomerEmail(e.target.value)}
                      placeholder="e.g. ramesh@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={customCustomerPhone}
                      onChange={(e) => setCustomCustomerPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Shipping City
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      placeholder="e.g. Mumbai / Bangalore"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pt-2 border-t border-slate-100">
                <ShoppingBag className="w-3.5 h-3.5 text-[#0073EA]" />
                <span>Product & Print Specifications</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Product Title / Type
                  </label>
                  <input
                    type="text"
                    value={customProductType}
                    onChange={(e) => setCustomProductType(e.target.value)}
                    placeholder="e.g. Hardcover Photobook A4 / Cotton Tee"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Paper Stock / Material
                  </label>
                  <input
                    type="text"
                    value={customPaperStock}
                    onChange={(e) => setCustomPaperStock(e.target.value)}
                    placeholder="e.g. 300 GSM Silk Matte / 170 GSM Gloss"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Total Amount (₹)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      value={customTotalAmount}
                      onChange={(e) => setCustomTotalAmount(e.target.value)}
                      placeholder="e.g. 1499.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Dynamic Summary for Quick Preset Mode */
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px] text-slate-600">
              <p className="font-semibold text-slate-700 font-sans">Automated Steps on Order Creation:</p>
              {simulateSource === "printify" && (
                <>
                  <p>✓ Generates Printify external order ID (e.g. PF-928174)</p>
                  <p>✓ Assigns Printify catalog product & variant mappings</p>
                  <p>✓ Creates Printify Payload Log entry for audit</p>
                  <p>✓ Sets SLA deadline and initial Received status</p>
                </>
              )}
              {simulateSource === "peecho" && (
                <>
                  <p>✓ Simulates inbound Peecho webhook payload</p>
                  <p>✓ Ingests photobook / magazine line items & artwork URLs</p>
                  <p>✓ Records SHA-256 payload log in Peecho Ingestion Logs</p>
                  <p>✓ Sets SLA deadline and initial Received status</p>
                </>
              )}
              {simulateSource === "custom_api" && (
                <>
                  <p>✓ Simulates B2B REST client payload ingestion</p>
                  <p>✓ Attaches external API reference ID & custom artwork specs</p>
                  <p>✓ Sets SLA deadline and initial Received status</p>
                </>
              )}
              {simulateSource === "manual" && (
                <>
                  <p>✓ Simulates shop-floor walk-in / CSR internal order ticket</p>
                  <p>✓ Provisions in-house printing & finishing specifications</p>
                  <p>✓ Sets SLA deadline and initial Received status</p>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: VIEW ORDER DETAILS, DOWNLOADS & ACTIVITY */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={
          <div className="flex items-center gap-2">
            <span>{selectedOrder?.order_number}</span>
            <span className="text-xs text-slate-400 font-mono">
              [{selectedOrder?.peecho_order_id || selectedOrder?.external_pod_order_id || "Direct Order"}]
            </span>
          </div>
        }
        description="Customer information, book specifications, artwork files, and complete order history."
        maxWidth="5xl"
        footer={
          <Button size="sm" variant="outline" onClick={() => setSelectedOrder(null)}>
            Close
          </Button>
        }
      >
        {selectedOrder && (
          <div className="space-y-4 text-xs">
            {/* Modal Sub-Tabs */}
            <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
              <button
                onClick={() => setOrderModalTab("details")}
                className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
                  orderModalTab === "details"
                    ? "border-[#0073EA] text-[#0073EA]"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Order Details & Files</span>
              </button>

              <button
                onClick={() => setOrderModalTab("history")}
                className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
                  orderModalTab === "history"
                    ? "border-[#0073EA] text-[#0073EA]"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Activity History</span>
              </button>
            </div>

            {/* TAB 1: DETAILS & ARTWORK */}
            {orderModalTab === "details" && (
              <div className="space-y-4">
                {/* Top Status & SLA Banner */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Order Status:</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {selectedOrder.status_details ? (
                        <Badge
                          variant="custom"
                          bgHex={selectedOrder.status_details.badge_bg}
                          textHex={selectedOrder.status_details.badge_text}
                          dot={true}
                        >
                          {selectedOrder.status_details.name}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">{selectedOrder.status}</Badge>
                      )}
                      {selectedOrder.peecho_metadata?.last_peecho_sync?.success && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                          Peecho Synced
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Origin Channel:</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800 capitalize">
                        {selectedOrder.order_source || "Peecho"}
                      </span>
                      {selectedOrder.is_external_pod && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                          External POD
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Delivery Deadline:</p>
                    <div className="mt-1">
                      <SlaCountdownClock deadlineStr={selectedOrder.sla_deadline} />
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Courier & Tracking:</p>
                    <p className="font-semibold text-slate-800 mt-1">
                      {selectedOrder.carrier_preference}
                      {selectedOrder.tracking_number && (
                        <span className="ml-1 text-[11px] font-mono text-emerald-600">
                          ({selectedOrder.tracking_number})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Line Items List with Direct Downloads */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#0073EA]" />
                    <span>Products & Print Specs ({selectedOrder.items?.length || 0})</span>
                  </h4>

                  <div className="space-y-2.5">
                    {selectedOrder.items?.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">{item.product_type}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            Qty: {item.quantity}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg">
                          <div>
                            <span className="text-slate-400 block">Page Count:</span>
                            <span className="font-semibold text-slate-700">{item.page_count} pages</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Spine Width:</span>
                            <span className="font-semibold text-slate-700">{item.spine_width_mm} mm</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Paper Stock:</span>
                            <span className="font-semibold text-slate-700 truncate">{item.paper_stock}</span>
                          </div>
                        </div>

                        {/* Artwork & Prepress Documents (Multiple Documents Support) */}
                        {(() => {
                          const itemDocs: ArtworkDocument[] = (item.documents && item.documents.length > 0)
                            ? item.documents
                            : [
                                {
                                  id: `${item.id}-interior`,
                                  name: `${item.product_type} - Interior Pages (PDF)`,
                                  file_type: "CONTENT_INTERIOR",
                                  file_url: (item.pdf_artwork_url && !item.pdf_artwork_url.includes("assets.peecho.com") ? item.pdf_artwork_url : "/artworks/peecho_hardcover_photobook_a4.pdf"),
                                  page_count: item.page_count,
                                  is_primary: true,
                                },
                                {
                                  id: `${item.id}-cover`,
                                  name: `${item.product_type} - Cover Wrap (PDF)`,
                                  file_type: "COVER_WRAP",
                                  file_url: (item.pdf_cover_url && !item.pdf_cover_url.includes("assets.peecho.com") ? item.pdf_cover_url : "/artworks/peecho_hardcover_wrap_cover.pdf"),
                                  page_count: 1,
                                  is_primary: false,
                                },
                              ];

                          return (
                            <div className="space-y-2 pt-1 border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                  <FileText className="w-3.5 h-3.5 text-[#0073EA]" />
                                  <span>Artwork Documents ({itemDocs.length}):</span>
                                </span>
                                <Link
                                  href={`/prepress?orderId=${selectedOrder.id}`}
                                  className="text-[11px] font-semibold text-[#0073EA] hover:text-[#005fb8] inline-flex items-center gap-1 hover:underline"
                                >
                                  <span>Open in Prepress Studio</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {itemDocs.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-slate-800 truncate" title={doc.name}>
                                        {doc.name}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                          {doc.file_type === "COVER_WRAP" ? "Cover Wrap" : "Interior Content"}
                                        </span>
                                        {doc.page_count && (
                                          <span>{doc.page_count} {doc.page_count === 1 ? "page" : "pages"}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px] font-semibold text-[#0073EA] bg-white border-blue-200 hover:bg-blue-50"
                                        onClick={() => {
                                          setDocumentPreviewModal({
                                            isOpen: true,
                                            orderNumber: selectedOrder.order_number,
                                            productType: item.product_type,
                                            documents: itemDocs,
                                            activeDocId: doc.id,
                                          });
                                        }}
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        <span>Preview</span>
                                      </Button>

                                      <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        download={`${selectedOrder.order_number}_${doc.id}.pdf`}
                                        className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors"
                                        title="Download PDF"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer & Shipping Details */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-slate-400 text-[11px]">Customer Info:</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedOrder.customer_name}</p>
                    <p className="text-slate-500 text-[11px]">{selectedOrder.customer_email}</p>
                    <p className="text-slate-500 text-[11px]">{selectedOrder.customer_phone}</p>
                  </div>

                  <div>
                    <p className="text-slate-400 text-[11px]">Shipping Address:</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedOrder.shipping_address?.street || "Address provided"}</p>
                    <p className="text-slate-500 text-[11px]">
                      {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.postal_code}
                    </p>
                    <p className="text-slate-500 text-[11px] font-bold">{selectedOrder.shipping_address?.country}</p>
                  </div>
                </div>

                {/* Sequential Order Pipeline & Status Management */}
                {(() => {
                  const currentOrderStatusCode =
                    selectedOrder.status_details?.code?.toUpperCase() ||
                    (typeof selectedOrder.status === "string" ? selectedOrder.status.toUpperCase() : "RECEIVED");
                  const currentOrderStatusName =
                    selectedOrder.status_details?.name || currentOrderStatusCode || "Unknown";

                  const currentStepNumber = PIPELINE_STEP_MAP[currentOrderStatusCode] ?? 1;
                  const nextSequentialStep = PIPELINE_SEQUENCE.find((item) => item.step === currentStepNumber + 1);

                  const targetStatusCodeUpper = (transitionStatusCode || "").toUpperCase();
                  const targetStepNumber = PIPELINE_STEP_MAP[targetStatusCodeUpper];

                  const isBackward = currentStepNumber !== undefined && targetStepNumber !== undefined && targetStepNumber < currentStepNumber;
                  let isSkipped = currentStepNumber !== undefined && targetStepNumber !== undefined && targetStepNumber > currentStepNumber + 1;
                  if (["RECEIVED", "PREPRESS_QUEUED"].includes(currentOrderStatusCode) && targetStatusCodeUpper === "PREPRESS_PASSED") {
                    isSkipped = false;
                  }
                  if (["IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT"].includes(currentOrderStatusCode) && ["QUALITY_AUDIT", "PRODUCTION_COMPLETED", "PACKED"].includes(targetStatusCodeUpper)) {
                    isSkipped = false;
                  }
                  const requiresAdminApproval = isBackward || isSkipped;

                  const isPrepressRole = effectiveRole === "PREPRESS_SPECIALIST";
                  const isPendingPrepress = ["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS"].includes(currentOrderStatusCode);
                  const isApprovedPrepress = [
                    "PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT",
                    "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH", "DISPATCHED",
                    "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"
                  ].includes(currentOrderStatusCode);
                  const canAdvanceToNext = isAdmin || (nextSequentialStep ? isStatusAllowedForRole(effectiveRole, nextSequentialStep.code) : false);
                  const canPutOnHold = isAdmin || isStatusAllowedForRole(effectiveRole, "EXCEPTION_HOLD");

                  return (
                    <>
                      {/* Live Auto-Sync Feedback Alert */}
                      {syncAlert && (
                        <div
                          className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs animate-in fade-in slide-in-from-top-1 ${
                            syncAlert.type === "success"
                              ? "bg-emerald-50/90 border-emerald-300 text-emerald-900"
                              : "bg-rose-50/90 border-rose-300 text-rose-900"
                          }`}
                        >
                          {syncAlert.type === "success" ? (
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <Zap className="w-3.5 h-3.5 fill-current" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs">
                                {syncAlert.type === "success" ? "Pipeline Status Synchronized" : "Status Transition Blocked"}
                              </span>
                              <span className="text-[10px] opacity-75 font-mono">{syncAlert.timestamp}</span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed">{syncAlert.message}</p>
                          </div>
                          <button
                            onClick={() => setSyncAlert(null)}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Sequential Pipeline Stepper Box */}
                      <div className="p-4 bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/50 rounded-xl border border-blue-200 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#0073EA] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              {currentStepNumber}
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700">
                                Sequential Pipeline Stage
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-sm">
                                  {currentOrderStatusName}
                                </span>
                                <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                                  Step {currentStepNumber} of 13
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200">
                                <ShieldCheck className="w-3 h-3 text-purple-600" />
                                <span>Admin Privileges Active</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Interactive Visual Stepper Bar */}
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-13 gap-1 py-1">
                            {PIPELINE_SEQUENCE.map((stage) => {
                              const isPast = stage.step < currentStepNumber;
                              const isCurrent = stage.step === currentStepNumber;
                              return (
                                <div
                                  key={stage.code}
                                  className="flex flex-col items-center group relative"
                                  title={`Step ${stage.step}: ${stage.name}`}
                                >
                                  <div
                                    className={`w-full h-2 rounded-full transition-all ${
                                      isPast
                                        ? "bg-emerald-500"
                                        : isCurrent
                                        ? "bg-[#0073EA] ring-2 ring-blue-300 ring-offset-1"
                                        : "bg-slate-200"
                                    }`}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-0.5">
                            <span className="text-emerald-700 font-semibold">1. Received</span>
                            <span className={currentStepNumber >= 5 ? "text-purple-700 font-semibold" : ""}>5. Production</span>
                            <span className={currentStepNumber >= 8 ? "text-teal-700 font-semibold" : ""}>8. Packed</span>
                            <span className={currentStepNumber >= 13 ? "text-emerald-700 font-bold" : ""}>13. Delivered</span>
                          </div>
                        </div>

                        {/* Sequential Step Advancement / Station-Specific Provision */}
                        <div className="pt-1">
                          {isPrepressRole && !isAdmin ? (
                            <div className="space-y-3">
                              {isPendingPrepress ? (
                                <div className="p-3.5 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0073EA] flex items-center justify-center font-bold text-xs shrink-0">
                                      <Layers className="w-4 h-4 text-[#0073EA]" />
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-slate-900 text-xs">Artwork Proof Verification Decision</h5>
                                      <p className="text-[11px] text-slate-500">
                                        Inspect customer bleeds, spine width, and high-resolution PDF proof. Either approve to release to the print floor or reject with an exception hold.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 shadow-xs flex items-center justify-center gap-2"
                                      isLoading={updateStatusMutation.isPending}
                                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                                      onClick={() => {
                                        updateStatusMutation.mutate({
                                          orderId: selectedOrder.id,
                                          statusCode: "PREPRESS_PASSED",
                                          comments: transitionComment || "Artwork verified & proof approved by Prepress. Ready for print floor.",
                                        });
                                      }}
                                    >
                                      Approve Artwork Proof & Release to Print Floor
                                    </Button>

                                    <Button
                                      variant="outline"
                                      className="text-xs py-2.5 text-rose-700 border-rose-200 hover:bg-rose-50 font-bold"
                                      isLoading={updateStatusMutation.isPending}
                                      leftIcon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
                                      onClick={() => {
                                        updateStatusMutation.mutate({
                                          orderId: selectedOrder.id,
                                          statusCode: "EXCEPTION_HOLD",
                                          comments: transitionComment || "Artwork proof rejected or flagged on exception hold by Prepress.",
                                        });
                                      }}
                                    >
                                      Reject Proof / Exception Hold
                                    </Button>
                                  </div>

                                  <input
                                    type="text"
                                    name="prepress_note_input"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    data-lpignore="true"
                                    placeholder="Optional note for print floor operators..."
                                    value={transitionComment}
                                    onChange={(e) => setTransitionComment(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                                  />
                                </div>
                              ) : isApprovedPrepress ? (
                                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-xs text-emerald-950 block">
                                      Artwork Approved & Forwarded to Production Floor
                                    </span>
                                    <p className="text-[11px] text-emerald-800 mt-0.5">
                                      This order has passed Prepress verification. It is active in digital press & bindery production. Per factory workflow policy, Prepress modifications are locked.
                                    </p>
                                  </div>
                                </div>
                              ) : currentOrderStatusCode === "EXCEPTION_HOLD" ? (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                                    <div>
                                      <span className="font-bold text-xs text-rose-950 block">Artwork On Exception Hold</span>
                                      <p className="text-[11px] text-rose-800">Flagged for artwork correction. Once resolved, you can re-approve for production.</p>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                    isLoading={updateStatusMutation.isPending}
                                    onClick={() => {
                                      updateStatusMutation.mutate({
                                        orderId: selectedOrder.id,
                                        statusCode: "PREPRESS_PASSED",
                                        comments: "Artwork issue resolved. Approved for print floor.",
                                      });
                                    }}
                                  >
                                    Re-approve Artwork
                                  </Button>
                                </div>
                              ) : (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                                  Current Status: <strong>{currentOrderStatusName}</strong> (Prepress View Only)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Quick Prepress Approve shortcut for Admins inspecting unapproved proofs */}
                              {isAdmin && isPendingPrepress && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-amber-700 shrink-0" />
                                    <span className="text-xs font-semibold text-amber-900">
                                      Prepress Proof Decision Pending
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 shadow-2xs font-bold"
                                      isLoading={updateStatusMutation.isPending}
                                      onClick={() => {
                                        updateStatusMutation.mutate({
                                          orderId: selectedOrder.id,
                                          statusCode: "PREPRESS_PASSED",
                                          comments: "Admin approved artwork proof on behalf of Prepress.",
                                        });
                                      }}
                                    >
                                      Approve Proof (Prepress)
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7 px-2 text-rose-700 border-rose-200 hover:bg-rose-50 font-bold"
                                      isLoading={updateStatusMutation.isPending}
                                      onClick={() => {
                                        updateStatusMutation.mutate({
                                          orderId: selectedOrder.id,
                                          statusCode: "EXCEPTION_HOLD",
                                          comments: "Admin flagged artwork exception hold.",
                                        });
                                      }}
                                    >
                                      Reject Proof
                                    </Button>
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-2">
                                {nextSequentialStep ? (
                                  canAdvanceToNext ? (
                                    <Button
                                      className="flex-1 bg-[#0073EA] hover:bg-[#0060c4] text-white font-bold text-xs py-2 shadow-xs flex items-center justify-center gap-2"
                                      isLoading={updateStatusMutation.isPending}
                                      onClick={() => {
                                        updateStatusMutation.mutate({
                                          orderId: selectedOrder.id,
                                          statusCode: nextSequentialStep.code,
                                          comments: transitionComment || `Sequential advancement: Step ${currentStepNumber} (${currentOrderStatusCode}) -> Step ${nextSequentialStep.step} (${nextSequentialStep.code})`,
                                        });
                                      }}
                                    >
                                      <span>
                                        Advance to Step {nextSequentialStep.step}: {nextSequentialStep.name}
                                      </span>
                                      <ArrowRight className="w-4 h-4 ml-0.5" />
                                    </Button>
                                  ) : (
                                    <div className="flex-1 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-900">
                                      <div className="flex items-center gap-2">
                                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                                        <div>
                                          <span className="font-semibold block">
                                            Step {nextSequentialStep.step} ({nextSequentialStep.name}) Locked for {rolePerm.roleName || effectiveRole}
                                          </span>
                                          <span className="text-[11px] text-amber-700">
                                            {rolePerm.disallowedNotice || "This stage is assigned to another operational department."}
                                          </span>
                                        </div>
                                      </div>
                                      <Badge variant="warning" size="sm" dot={true}>
                                        Restricted
                                      </Badge>
                                    </div>
                                  )
                                ) : (
                                  <div className="flex-1 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Order has successfully completed all pipeline steps (Delivered).</span>
                                  </div>
                                )}

                                {currentOrderStatusCode !== "EXCEPTION_HOLD" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                                    disabled={!canPutOnHold || updateStatusMutation.isPending}
                                    isLoading={updateStatusMutation.isPending}
                                    onClick={() => {
                                      if (!canPutOnHold) {
                                        addNotification({
                                          title: "Action Restricted",
                                          message: rolePerm.disallowedNotice || "Your designation cannot place orders on hold.",
                                          type: "warning",
                                          category: "SECURITY",
                                        });
                                        return;
                                      }
                                      updateStatusMutation.mutate({
                                        orderId: selectedOrder.id,
                                        statusCode: "EXCEPTION_HOLD",
                                        comments: transitionComment || "Order placed on exception hold",
                                      });
                                    }}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                                    <span>Put on Hold</span>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                    disabled={!isStatusAllowedForRole(effectiveRole, "PREPRESS_QUEUED") || updateStatusMutation.isPending}
                                    isLoading={updateStatusMutation.isPending}
                                    onClick={() => {
                                      updateStatusMutation.mutate({
                                        orderId: selectedOrder.id,
                                        statusCode: "PREPRESS_QUEUED",
                                        comments: transitionComment || "Resuming order from hold into prepress queue",
                                      });
                                    }}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                    <span>Resume Order</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manual Transition & Designation Authorization Section (Hidden for Prepress non-admin) */}
                      {(!isPrepressRole || isAdmin) && (
                        <div className="pt-3 border-t border-slate-200 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="block font-semibold text-slate-800 text-xs">
                              Manual Pipeline Adjustment:
                            </label>
                            <span className="text-[11px] text-slate-500">
                              {isAdmin
                                ? "Admins can authorize backward rollbacks or stage skips"
                                : `Designation Scope: Only ${rolePerm.department} stages authorized`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={transitionStatusCode || currentOrderStatusCode}
                              onChange={(e) => {
                                setTransitionStatusCode(e.target.value);
                                setAdminOverrideApproved(false);
                              }}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                            >
                              <option value="">Select target status...</option>
                              {/* Authorized Statuses for User's Designation */}
                              <optgroup label={`Authorized for ${rolePerm.roleName || "Your Designation"}`}>
                                {statusesData?.results
                                  ?.filter((st) => isAdmin || isStatusAllowedForRole(effectiveRole, st.code))
                                  ?.map((st) => {
                                    const isCurrent = st.code.toUpperCase() === currentOrderStatusCode;
                                    const targetStep = PIPELINE_STEP_MAP[st.code.toUpperCase()];
                                    const optBackward = currentStepNumber !== undefined && targetStep !== undefined && targetStep < currentStepNumber;
                                    const optSkipped = currentStepNumber !== undefined && targetStep !== undefined && targetStep > currentStepNumber + 1;
                                    const optRequiresAdmin = optBackward || optSkipped;

                                    return (
                                      <option
                                        key={st.id}
                                        value={st.code}
                                        disabled={!isAdmin && optRequiresAdmin}
                                      >
                                        {st.name} ({st.code})
                                        {isCurrent
                                          ? " — (Current Status)"
                                          : optBackward
                                          ? ` — ⚠️ Rollback${!isAdmin ? " [Locked: Admin Only]" : " [Admin Override]"}`
                                          : optSkipped
                                          ? ` — ⚠️ Skip${!isAdmin ? " [Locked: Admin Only]" : " [Admin Override]"}`
                                          : targetStep
                                          ? ` — (Step ${targetStep})`
                                          : ""}
                                      </option>
                                    );
                                  })}
                              </optgroup>

                              {/* Locked Statuses for Other Departments */}
                              {!isAdmin && (
                                <optgroup label="Locked for Other Departments (Restricted)">
                                  {statusesData?.results
                                    ?.filter((st) => !isStatusAllowedForRole(effectiveRole, st.code))
                                    ?.map((st) => (
                                      <option key={st.id} value={st.code} disabled={true}>
                                        🔒 {st.name} ({st.code}) — [Restricted Department]
                                      </option>
                                    ))}
                                </optgroup>
                              )}
                            </select>

                            {(() => {
                              const isSelectedStatusPermitted = isAdmin || (transitionStatusCode ? isStatusAllowedForRole(effectiveRole, transitionStatusCode) : false);

                              return (
                                <Button
                                  size="sm"
                                  disabled={
                                    !transitionStatusCode ||
                                    transitionStatusCode.toUpperCase() === currentOrderStatusCode ||
                                    !isSelectedStatusPermitted ||
                                    (requiresAdminApproval && (!isAdmin || !adminOverrideApproved)) ||
                                    updateStatusMutation.isPending
                                  }
                                  isLoading={updateStatusMutation.isPending}
                                  className={
                                    requiresAdminApproval
                                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                                      : ""
                                  }
                                  onClick={() => {
                                    if (
                                      selectedOrder &&
                                      transitionStatusCode &&
                                      transitionStatusCode.toUpperCase() !== currentOrderStatusCode
                                    ) {
                                      if (!isSelectedStatusPermitted) {
                                        addNotification({
                                          title: "Designation Status Change Blocked",
                                          message: rolePerm.disallowedNotice || "Your staff designation is not permitted to transition to this stage.",
                                          type: "error",
                                          category: "SECURITY",
                                        });
                                        return;
                                      }

                                      if (requiresAdminApproval && (!isAdmin || !adminOverrideApproved)) {
                                        addNotification({
                                          title: "Administrator Approval Required",
                                          message: !isAdmin
                                            ? "Only Administrators can approve order status rollbacks or non-sequential jumps."
                                            : "Please check the 'I authorize this status rollback' confirmation box before applying.",
                                          type: "warning",
                                          category: "SECURITY",
                                        });
                                        return;
                                      }

                                      updateStatusMutation.mutate({
                                        orderId: selectedOrder.id,
                                        statusCode: transitionStatusCode,
                                        comments: transitionComment || (requiresAdminApproval ? "Admin approved status override" : "Manual status change"),
                                        adminApproved: requiresAdminApproval && isAdmin && adminOverrideApproved,
                                      });
                                    }
                                  }}
                                >
                                  {requiresAdminApproval
                                    ? "Apply Admin Override"
                                    : !isSelectedStatusPermitted
                                    ? "Status Locked"
                                    : transitionStatusCode && transitionStatusCode.toUpperCase() !== currentOrderStatusCode
                                    ? "Update Status"
                                    : "Current Status Selected"}
                                </Button>
                              );
                            })()}
                          </div>

                          {/* Admin Approval Notice for Rollback / Skipping */}
                          {requiresAdminApproval && transitionStatusCode && transitionStatusCode.toUpperCase() !== currentOrderStatusCode && (
                            <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 space-y-2 text-xs animate-in fade-in">
                              <div className="flex items-center gap-1.5 font-bold">
                                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>
                                  {isBackward ? "Pipeline Rollback Warning" : "Non-Sequential Stage Skip Warning"}
                                </span>
                              </div>
                              <p className="leading-relaxed">
                                You selected to move from <strong>{currentOrderStatusName}</strong> (Step {currentStepNumber}) to{" "}
                                <strong>
                                  {statusesData?.results?.find((s) => s.code.toUpperCase() === targetStatusCodeUpper)?.name ||
                                    transitionStatusCode}
                                </strong>{" "}
                                (Step {targetStepNumber || "N/A"}). This {isBackward ? "reverts to an earlier stage" : "skips operational stages"} and requires explicit Admin authorization.
                              </p>

                              {isAdmin ? (
                                <label className="flex items-center gap-2 pt-1 font-semibold text-amber-950 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={adminOverrideApproved}
                                    onChange={(e) => setAdminOverrideApproved(e.target.checked)}
                                    className="w-4 h-4 rounded border-amber-400 text-[#0073EA] focus:ring-[#0073EA]"
                                  />
                                  <span>I am an Administrator and approve this status override</span>
                                </label>
                              ) : (
                                <div className="flex items-center gap-1.5 text-rose-700 font-semibold pt-1">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Order status cannot be moved backward or skipped without Admin approval.</span>
                                </div>
                              )}
                            </div>
                          )}

                          <input
                            type="text"
                            name="transition_reason_note"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            placeholder="Add an audit note or reason for this status change..."
                            value={transitionComment}
                            onChange={(e) => setTransitionComment(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: CHRONOLOGICAL HISTORY & AUDIT LOGS */}
            {orderModalTab === "history" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900">
                    Audit Trail for {selectedOrder.order_number} [{selectedOrder.peecho_order_id}]
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Immutable Log</span>
                </div>

                {logsLoading ? (
                  <div className="py-8 text-center text-slate-400">Loading audit history...</div>
                ) : orderAuditLogs && orderAuditLogs.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {orderAuditLogs.map((log: UserAuditLog) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#0073EA] bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                            {log.action}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                          <span>Operator: {log.user_name || "Automated Peecho Gateway"}</span>
                          {log.ip_address && (
                            <span className="text-slate-400 text-[10px] font-mono">({log.ip_address})</span>
                          )}
                        </div>

                        {log.details && (
                          <pre className="p-2 bg-slate-50 rounded-lg font-mono text-[10px] text-slate-600 overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No dedicated audit records found for this order. Status changes will appear here automatically.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Interactive Multi-Document PDF Preview Modal */}
      {documentPreviewModal && (
        <Modal
          isOpen={documentPreviewModal.isOpen}
          onClose={() => setDocumentPreviewModal(null)}
          title={`Artwork Prepress Document Preview — Order ${documentPreviewModal.orderNumber}`}
          maxWidth="5xl"
        >
          <div className="space-y-4">
            {/* Document Selector Tabs if multiple documents exist */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Available Documents:</span>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  {documentPreviewModal.documents.map((doc) => {
                    const isActive = doc.id === documentPreviewModal.activeDocId;
                    return (
                      <button
                        key={doc.id}
                        onClick={() =>
                          setDocumentPreviewModal({
                            ...documentPreviewModal,
                            activeDocId: doc.id,
                          })
                        }
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isActive
                            ? "bg-white text-[#0073EA] shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{doc.name}</span>
                        {doc.page_count && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                            {doc.page_count}p
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons: Direct download & Open in Prepress */}
              <div className="flex items-center gap-2">
                {selectedOrder && (
                  <Link
                    href={`/prepress?orderId=${selectedOrder.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Prepress Studio</span>
                  </Link>
                )}
                {(() => {
                  const activeDoc =
                    documentPreviewModal.documents.find(
                      (d) => d.id === documentPreviewModal.activeDocId
                    ) || documentPreviewModal.documents[0];
                  return (
                    <a
                      href={activeDoc?.file_url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#0073EA] hover:bg-blue-100 transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </a>
                  );
                })()}
              </div>
            </div>

            {/* Live PDF Viewer Iframe */}
            {(() => {
              const activeDoc =
                documentPreviewModal.documents.find(
                  (d) => d.id === documentPreviewModal.activeDocId
                ) || documentPreviewModal.documents[0];

              return (
                <div className="space-y-3">
                  <div className="w-full h-[620px] rounded-xl border border-slate-300 bg-slate-900 overflow-hidden shadow-inner relative">
                    <iframe
                      src={`${activeDoc?.file_url}#toolbar=1&navpanes=1`}
                      className="w-full h-full border-0 rounded-xl"
                      title={activeDoc?.name || "Document Preview"}
                    />
                  </div>

                  {/* Production & Prepress Specs Bar */}
                  <div className="grid grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Document Name:</span>
                      <span className="font-semibold text-slate-800 truncate block">{activeDoc?.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Preflight Color Space:</span>
                      <span className="font-semibold text-slate-800">CMYK FOGRA39 (ISO 12647-2)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Print Resolution:</span>
                      <span className="font-semibold text-emerald-700">300 DPI (High-Res Approved)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Bleed & Trim Box:</span>
                      <span className="font-semibold text-slate-800">3.0 mm Standard Bleed</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}
