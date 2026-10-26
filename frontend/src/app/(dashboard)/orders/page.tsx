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
} from "lucide-react";
import { ordersApi, lookupsApi, Order, OrderItem, EntityStatus, UserAuditLog } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";
import { useNotifications } from "@/context/notification-context";

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
  const [sortBy, setSortBy] = useState<"sla" | "newest" | "amount" | "order_number">("sla");

  // In-App Alert Notification State for New Orders
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const [prevTotalOrders, setPrevTotalOrders] = useState<number | null>(null);

  // Modals & Detail Tabs
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalTab, setOrderModalTab] = useState<"details" | "history">("details");
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simulatePriority, setSimulatePriority] = useState<"RUSH_8H" | "EXPRESS_24H" | "STANDARD_72H">("RUSH_8H");
  const [simulateSource, setSimulateSource] = useState<"printify" | "peecho" | "custom_api" | "manual">("printify");
  const [transitionStatusCode, setTransitionStatusCode] = useState("");
  const [transitionComment, setTransitionComment] = useState("");

  // Visual auto-sync feedback alert inside modal
  const [syncAlert, setSyncAlert] = useState<{
    type: "success" | "error";
    message: string;
    timestamp: string;
  } | null>(null);

  // Queries - Real-time polling every 5 seconds for instant sync
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["orders", searchQuery, urgencyFilter, statusFilter, sourceFilter],
    queryFn: () =>
      ordersApi.getOrders({
        search: searchQuery || undefined,
        urgency: urgencyFilter || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter || undefined,
        source: sourceFilter === "ALL" ? undefined : sourceFilter,
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
      setSyncAlert(null);
    } else {
      setTransitionStatusCode("");
      setTransitionComment("");
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
    }) => ordersApi.simulateOrder(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["printify-logs"] });
      queryClient.invalidateQueries({ queryKey: ["peecho-logs"] });
      setIsSimulateModalOpen(false);
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
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, statusCode, comments }: { orderId: string; statusCode: string; comments: string }) =>
      ordersApi.updateOrderStatus(orderId, statusCode, comments),
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
        err?.message ||
        "Failed to update status and synchronize with Peecho.";
      setSyncAlert({
        type: "error",
        message: errMsg,
        timestamp: new Date().toLocaleTimeString(),
      });
      addNotification({
        title: "Status Auto-Sync Failed",
        message: errMsg,
        type: "error",
        category: "STATUS_SYNC",
      });
    },
  });

  // Client-side date and sort filtering
  const processedOrders = useMemo(() => {
    let list = [...(ordersData?.results || [])];

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

    // Sort
    list.sort((a, b) => {
      if (sortBy === "sla") {
        return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
      }
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "amount") {
        return Number(b.total_amount || 0) - Number(a.total_amount || 0);
      }
      if (sortBy === "order_number") {
        return a.order_number.localeCompare(b.order_number);
      }
      return 0;
    });

    return list;
  }, [ordersData?.results, dateFilter, sortBy]);

  // Table Column Definitions
  const orderColumns: Column<Order>[] = [
    {
      header: "Order Number",
      cell: (ord) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-[#0073EA] hover:underline">
            {ord.order_number}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {ord.peecho_order_id || ord.external_pod_order_id || "Direct Job"}
          </span>
        </div>
      ),
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
      cell: (ord) => (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Eye className="w-3.5 h-3.5 text-[#0073EA]" />}
          onClick={() => {
            setSelectedOrder(ord);
            setOrderModalTab("details");
          }}
        >
          View Order
        </Button>
      ),
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
            leftIcon={<Zap className="w-3.5 h-3.5 text-amber-300" />}
            onClick={() => setIsSimulateModalOpen(true)}
            className="bg-[#0073EA] hover:bg-[#0060B9] shadow-xs text-white"
          >
            Create Test Order
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

      {/* Unified Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
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

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[10px] flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 font-medium"
            >
              <option value="sla">Delivery Deadline (Urgent First)</option>
              <option value="newest">Date Created (Newest)</option>
              <option value="amount">Order Amount (High to Low)</option>
              <option value="order_number">Order Number</option>
            </select>
          </div>
        </div>

        {/* Origin Channel Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Origin Channel:
            </span>
            {[
              { id: "ALL", label: "All Sources" },
              { id: "printify", label: "Printify POD", icon: <Printer className="w-3 h-3 text-emerald-600" /> },
              { id: "peecho", label: "Peecho POD", icon: <Globe2 className="w-3 h-3 text-[#0073EA]" /> },
              { id: "custom_api", label: "Custom API", icon: <Cpu className="w-3 h-3 text-purple-600" /> },
              { id: "manual", label: "In-House Manual", icon: <Layers className="w-3 h-3 text-slate-500" /> },
            ].map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSourceFilter(ch.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  sourceFilter === ch.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {ch.icon}
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* SLA & Status Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* SLA Pills */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1">Deadline:</span>
            {[
              { id: "", label: "All Deadlines" },
              { id: "critical", label: "Urgent (< 4h)" },
              { id: "urgent", label: "Next 12h" },
              { id: "normal", label: "Normal" },
              { id: "breached", label: "Overdue" },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setUrgencyFilter(pill.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  urgencyFilter === pill.id
                    ? "bg-[#0073EA] text-white border-[#0073EA] shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Dynamic Status Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
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
      </div>

      {/* Main Orders Table */}
      <Card noPadding={true}>
        <Table
          data={processedOrders}
          columns={orderColumns}
          keyExtractor={(ord) => ord.id}
          isLoading={ordersLoading}
        />
      </Card>

      {/* MODAL: CREATE MULTI-CHANNEL ORDER */}
      <Modal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        title="Create Order"
        description="Select the origin channel and SLA target to simulate or ingest an inbound order."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsSimulateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={simulateMutation.isPending}
              onClick={() =>
                simulateMutation.mutate({
                  priority: simulatePriority,
                  source: simulateSource,
                })
              }
              className="bg-[#0073EA] hover:bg-[#0060B9]"
            >
              Create Order
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
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
                    className={`p-3 rounded-xl border text-left transition-all ${
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
                { id: "RUSH_8H", name: "Rush", desc: "8-Hour Target", badge: "danger" },
                { id: "EXPRESS_24H", name: "Express", desc: "24-Hour Target", badge: "warning" },
                { id: "STANDARD_72H", name: "Standard", desc: "72-Hour Target", badge: "neutral" },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSimulatePriority(tier.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
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

          {/* Dynamic Summary */}
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

                        {/* Direct File Download Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {item.pdf_artwork_url && (
                            <a
                              href={item.pdf_artwork_url}
                              target="_blank"
                              rel="noreferrer"
                              download={`${selectedOrder.order_number}_content.pdf`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0073EA] bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Book Interior (PDF)</span>
                            </a>
                          )}
                          {item.pdf_cover_url && (
                            <a
                              href={item.pdf_cover_url}
                              target="_blank"
                              rel="noreferrer"
                              download={`${selectedOrder.order_number}_cover.pdf`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Book Cover (PDF)</span>
                            </a>
                          )}
                        </div>
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

                {/* Status Update Quick Buttons */}
                {(() => {
                  const currentOrderStatusCode =
                    selectedOrder.status_details?.code ||
                    (typeof selectedOrder.status === "string" ? selectedOrder.status : "");
                  const currentOrderStatusName =
                    selectedOrder.status_details?.name || currentOrderStatusCode || "Unknown";

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
                                {syncAlert.type === "success" ? "Peecho Gateway Auto-Sync Confirmed" : "Auto-Sync Error"}
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

                      <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 block">
                            Quick Status Actions:
                          </span>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-500 font-medium">Current:</span>
                            {selectedOrder.status_details ? (
                              <Badge
                                variant="custom"
                                bgHex={selectedOrder.status_details.badge_bg}
                                textHex={selectedOrder.status_details.badge_text}
                                dot={true}
                                size="sm"
                              >
                                {selectedOrder.status_details.name}
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                {currentOrderStatusCode || "None"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-xs font-semibold ${
                              currentOrderStatusCode === "PREPRESS_PASSED"
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-300 shadow-xs"
                                : "bg-white"
                            }`}
                            isLoading={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                orderId: selectedOrder.id,
                                statusCode: "PREPRESS_PASSED",
                                comments: "Artwork verified and approved",
                              })
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                            Artwork Approved {currentOrderStatusCode === "PREPRESS_PASSED" && "✓ (Current)"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-xs font-semibold ${
                              currentOrderStatusCode === "IN_PRODUCTION"
                                ? "bg-purple-50 border-purple-300 text-purple-800 ring-1 ring-purple-300 shadow-xs"
                                : "bg-white"
                            }`}
                            isLoading={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                orderId: selectedOrder.id,
                                statusCode: "IN_PRODUCTION",
                                comments: "Sent to printing press",
                              })
                            }
                          >
                            <BookOpen className="w-3.5 h-3.5 text-purple-600 mr-1" />
                            Start Printing {currentOrderStatusCode === "IN_PRODUCTION" && "✓ (Current)"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-xs font-semibold ${
                              currentOrderStatusCode === "PACKED" || currentOrderStatusCode === "PRODUCTION_COMPLETED"
                                ? "bg-teal-50 border-teal-300 text-teal-800 ring-1 ring-teal-300 shadow-xs"
                                : "bg-white"
                            }`}
                            isLoading={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                orderId: selectedOrder.id,
                                statusCode: "PACKED",
                                comments: "Printing finished & packed",
                              })
                            }
                          >
                            <Check className="w-3.5 h-3.5 text-teal-600 mr-1" />
                            Production Done {(currentOrderStatusCode === "PACKED" || currentOrderStatusCode === "PRODUCTION_COMPLETED") && "✓ (Current)"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-xs font-semibold ${
                              currentOrderStatusCode === "OUT_FOR_DELIVERY"
                                ? "bg-amber-50 border-amber-300 text-amber-800 ring-1 ring-amber-300 shadow-xs"
                                : "bg-white"
                            }`}
                            isLoading={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                orderId: selectedOrder.id,
                                statusCode: "OUT_FOR_DELIVERY",
                                comments: "Out with delivery driver",
                              })
                            }
                          >
                            <Truck className="w-3.5 h-3.5 text-amber-600 mr-1" />
                            Out for Delivery {currentOrderStatusCode === "OUT_FOR_DELIVERY" && "✓ (Current)"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-xs font-semibold ${
                              currentOrderStatusCode === "DELIVERED"
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-300 shadow-xs"
                                : "bg-white"
                            }`}
                            isLoading={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                orderId: selectedOrder.id,
                                statusCode: "DELIVERED",
                                comments: "Handed over and delivered to customer",
                              })
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                            Mark Delivered {currentOrderStatusCode === "DELIVERED" && "✓ (Current)"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-xs font-semibold text-rose-700 ${
                              currentOrderStatusCode === "EXCEPTION_HOLD"
                                ? "bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-300 shadow-xs"
                                : "bg-white"
                            }`}
                            isLoading={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                orderId: selectedOrder.id,
                                statusCode: "EXCEPTION_HOLD",
                                comments: "Order put on hold",
                              })
                            }
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mr-1" />
                            Put on Hold {currentOrderStatusCode === "EXCEPTION_HOLD" && "✓ (Current)"}
                          </Button>
                        </div>
                      </div>

                      {/* Manual Dropdown Selector */}
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="block font-semibold text-slate-700">
                            Change Status Manually:
                          </label>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-500 font-medium">Current Status:</span>
                            {selectedOrder.status_details ? (
                              <Badge
                                variant="custom"
                                bgHex={selectedOrder.status_details.badge_bg}
                                textHex={selectedOrder.status_details.badge_text}
                                dot={true}
                                size="sm"
                              >
                                {selectedOrder.status_details.name} ({selectedOrder.status_details.code})
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                {currentOrderStatusCode || "None"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={transitionStatusCode || currentOrderStatusCode}
                            onChange={(e) => setTransitionStatusCode(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                          >
                            <option value="">Select target status...</option>
                            {statusesData?.results?.map((st) => {
                              const isCurrent = st.code === currentOrderStatusCode;
                              return (
                                <option key={st.id} value={st.code}>
                                  {st.name} ({st.code}){isCurrent ? " — (Current Status)" : ""}
                                </option>
                              );
                            })}
                          </select>

                          <Button
                            size="sm"
                            disabled={
                              !transitionStatusCode ||
                              transitionStatusCode === currentOrderStatusCode ||
                              updateStatusMutation.isPending
                            }
                            isLoading={updateStatusMutation.isPending}
                            onClick={() => {
                              if (
                                selectedOrder &&
                                transitionStatusCode &&
                                transitionStatusCode !== currentOrderStatusCode
                              ) {
                                updateStatusMutation.mutate({
                                  orderId: selectedOrder.id,
                                  statusCode: transitionStatusCode,
                                  comments: transitionComment || "Manual status change",
                                });
                              }
                            }}
                          >
                            {transitionStatusCode && transitionStatusCode !== currentOrderStatusCode
                              ? "Update Status"
                              : "Current Status Selected"}
                          </Button>
                        </div>

                        {transitionStatusCode && transitionStatusCode !== currentOrderStatusCode && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                            <span>
                              Ready to change status: from <strong>{currentOrderStatusName}</strong> to{" "}
                              <strong>
                                {statusesData?.results?.find((s) => s.code === transitionStatusCode)?.name ||
                                  transitionStatusCode}
                              </strong>
                            </span>
                          </div>
                        )}

                        <input
                          type="text"
                          placeholder="Add a note or reason for status change..."
                          value={transitionComment}
                          onChange={(e) => setTransitionComment(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                        />
                      </div>
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
    </div>
  );
}
