"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Truck,
  Printer,
  FileSpreadsheet,
  Send,
  Zap,
  RefreshCw,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Building2,
  Mail,
  MessageSquare,
  Plus,
  AlertCircle,
  Eye,
  Download,
  FileCheck2,
  UserCheck,
  Lock,
  ShieldAlert,
  ArrowRight,
  XCircle,
  Sparkles,
  Search,
  Users,
} from "lucide-react";
import { analyticsApi } from "@/services/api/analytics";
import { ordersApi } from "@/services/api/orders";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  ReprintDamageLog,
  SLAAlertLog,
  OdooSyncLog,
  ReportDamagePayload,
  Order,
} from "@/services/api/types";
import { useNotifications } from "@/context/notification-context";

const COURIER_COLORS = ["#0073EA", "#00C875", "#FDAB3D", "#E2445C", "#A25DDC"];

export default function OperationsOverviewPage() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  // Current Logged-in Staff Role (RBAC)
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("silverpoint_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const userRole = currentUser?.role?.code || currentUser?.role_code || currentUser?.role || (currentUser?.is_superuser ? "SUPER_ADMIN" : "STAFF");
  const staffName = currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim() : (currentUser?.username || "Operations Master");
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || Boolean(currentUser?.is_superuser);

  const isPrepressRole = userRole === "PREPRESS_SPECIALIST";
  const isProductionRole = userRole === "PRODUCTION_MANAGER" || userRole === "SHOPFLOOR_OPERATOR";
  const isShippingRole = userRole === "DISPATCH_SPECIALIST" || userRole === "DISPATCH_FINANCE_SPECIALIST";
  const isFinanceRole = userRole === "FINANCE_SPECIALIST";

  const [adminStationQueueTab, setAdminStationQueueTab] = useState<"prepress" | "production" | "dispatch">("prepress");

  // Active Tab
  const [activeSection, setActiveSection] = useState<"workstation" | "analytics" | "reprints" | "odoo">("analytics");

  // Automatically default staff to their operational workstation queue
  useEffect(() => {
    if (!isAdmin) {
      setActiveSection("workstation");
    }
  }, [isAdmin]);

  // Report Damage Modal State
  const [isDamageModalOpen, setIsDamageModalOpen] = useState<boolean>(false);
  const [orderIdentifier, setOrderIdentifier] = useState<string>("");
  const [failureReason, setFailureReason] = useState<string>("PRINT_STREAKING");
  const [failureDescription, setFailureDescription] = useState<string>("");
  const [reportedStation, setReportedStation] = useState<string>("QC_PASS");
  const [damagedQuantity, setDamagedQuantity] = useState<number>(1);
  const [wasteSheets, setWasteSheets] = useState<number>(64);
  const [costLoss, setCostLoss] = useState<string>("8.50");
  const [autoRequeue, setAutoRequeue] = useState<boolean>(true);

  // Queries
  const { data: metricsData, isLoading: isLoadingMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ["analytics", "dashboardMetrics"],
    queryFn: () => analyticsApi.getDashboardMetrics(),
    refetchInterval: 15000,
  });

  // Reprints Pagination
  const [reprintsPage, setReprintsPage] = useState(1);
  const [reprintsPageSize, setReprintsPageSize] = useState(10);

  // Odoo Logs Pagination
  const [odooPage, setOdooPage] = useState(1);
  const [odooPageSize, setOdooPageSize] = useState(10);

  // Workstation Queue Pagination
  const [prepressQueuePage, setPrepressQueuePage] = useState(1);
  const [prepressQueuePageSize, setPrepressQueuePageSize] = useState(5);
  const [dispatchQueuePage, setDispatchQueuePage] = useState(1);
  const [dispatchQueuePageSize, setDispatchQueuePageSize] = useState(5);
  const [prodQueuePage, setProdQueuePage] = useState(1);
  const [prodQueuePageSize, setProdQueuePageSize] = useState(5);

  const { data: reprintsData, refetch: refetchReprints } = useQuery({
    queryKey: ["analytics", "reprints", reprintsPage, reprintsPageSize],
    queryFn: () => analyticsApi.getReprints({ page: reprintsPage, page_size: reprintsPageSize }),
  });

  const { data: slaAlertsData, refetch: refetchSlaAlerts } = useQuery({
    queryKey: ["analytics", "slaAlerts"],
    queryFn: () => analyticsApi.getSLAAlerts(),
  });

  const { data: odooLogsData, refetch: refetchOdooLogs } = useQuery({
    queryKey: ["analytics", "odooLogs", odooPage, odooPageSize],
    queryFn: () => analyticsApi.getOdooSyncLogs({ page: odooPage, page_size: odooPageSize }),
  });

  const { data: ordersData } = useQuery({
    queryKey: ["orders", "activeList"],
    queryFn: () => ordersApi.getOrders({ page_size: 100, ordering: "-created_at" }),
    refetchInterval: 5000,
  });

  // Role Specific Filtered Order Lists (strictly descending - newest first)
  const ordersList: Order[] = useMemo(() => {
    const list = [...(ordersData?.results || [])];
    return list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b.order_number || "").localeCompare(a.order_number || "", undefined, { numeric: true });
    });
  }, [ordersData?.results]);

  const prepressPendingOrders = ordersList.filter((o) =>
    ["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS"].includes(o.status_details?.code || o.status)
  );
  const prepressApprovedOrders = ordersList.filter((o) =>
    ["PREPRESS_PASSED", "ARTWORK_VERIFIED"].includes(o.status_details?.code || o.status)
  );
  const prepressRejectedOrders = ordersList.filter((o) =>
    ["EXCEPTION_HOLD", "REJECTED"].includes(o.status_details?.code || o.status)
  );
  const prepressRushOrders = ordersList.filter((o) => o.sla_priority === "RUSH_8H");

  const productionOrders = ordersList.filter((o) =>
    ["PREPRESS_PASSED", "ARTWORK_VERIFIED", "BATCHED", "PRINTING", "IN_PRODUCTION"].includes(o.status_details?.code || o.status)
  );

  const dispatchOrders = ordersList.filter((o) =>
    ["PRODUCTION_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED", "OUT_FOR_DELIVERY"].includes(o.status_details?.code || o.status)
  );

  const paginatedPrepressPendingOrders = useMemo(() => {
    const start = (prepressQueuePage - 1) * prepressQueuePageSize;
    return prepressPendingOrders.slice(start, start + prepressQueuePageSize);
  }, [prepressPendingOrders, prepressQueuePage, prepressQueuePageSize]);

  const paginatedDispatchOrders = useMemo(() => {
    const start = (dispatchQueuePage - 1) * dispatchQueuePageSize;
    return dispatchOrders.slice(start, start + dispatchQueuePageSize);
  }, [dispatchOrders, dispatchQueuePage, dispatchQueuePageSize]);

  const paginatedProductionOrders = useMemo(() => {
    const start = (prodQueuePage - 1) * prodQueuePageSize;
    return productionOrders.slice(start, start + prodQueuePageSize);
  }, [productionOrders, prodQueuePage, prodQueuePageSize]);

  // Mutations
  const reportDamageMutation = useMutation({
    mutationFn: (payload: ReportDamagePayload) => analyticsApi.reportDamage(payload),
    onSuccess: () => {
      const orderRef = orderIdentifier;
      setIsDamageModalOpen(false);
      setOrderIdentifier("");
      setFailureDescription("");
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      addNotification({
        title: "Damage Incident Logged",
        message: `Damage report filed for order ${orderRef}. Reprint ticket created.`,
        type: "warning",
        category: "SYSTEM",
      });
    },
    onError: (err: any) => {
      addNotification({
        title: "Damage Report Failed",
        message: err?.message || "Could not log incident report.",
        type: "error",
        category: "SYSTEM",
      });
    },
  });

  const triggerSLACheckMutation = useMutation({
    mutationFn: () => analyticsApi.triggerSLACheck(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "slaAlerts"] });
      addNotification({
        title: "SLA Monitor Refreshed",
        message: "Order turnaround deadlines and rush queue audited.",
        type: "info",
        category: "SLA_ALERT",
      });
    },
  });

  const triggerOdooSyncMutation = useMutation({
    mutationFn: (payload: { model_name: string; reference_id: string }) =>
      analyticsApi.triggerOdooSync(payload.model_name, payload.reference_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "odooLogs"] });
      addNotification({
        title: "Odoo ERP Synchronized",
        message: "Orders and ledger items synchronized with Odoo ERP.",
        type: "success",
        category: "SYSTEM",
      });
    },
    onError: (err: any) => {
      addNotification({
        title: "Odoo Sync Failed",
        message: err?.message || "Could not connect to Odoo API.",
        type: "error",
        category: "SYSTEM",
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, statusCode, comments }: { orderId: string; statusCode: string; comments?: string }) =>
      ordersApi.updateOrderStatus(orderId, statusCode, comments),
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      const orderNum = data?.order?.order_number || "Order";
      const statusName = data?.order?.status_details?.name || variables.statusCode;
      addNotification({
        title: `Status Auto-Synced: ${orderNum}`,
        message: `Order transitioned to '${statusName}'. Synchronized with Peecho API.`,
        type: "success",
        category: "STATUS_SYNC",
        orderNumber: orderNum,
        link: "/orders",
      });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.detail || "Failed to update order status.";
      addNotification({
        title: "Status Update Failed",
        message: errMsg,
        type: "error",
        category: "STATUS_SYNC",
      });
    },
  });

  const handleReportDamageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdentifier.trim()) return;

    reportDamageMutation.mutate({
      order_identifier: orderIdentifier.trim(),
      failure_reason: failureReason,
      failure_description: failureDescription.trim(),
      reported_at_station: reportedStation,
      damaged_quantity: damagedQuantity,
      waste_sheets_count: wasteSheets,
      estimated_cost_loss: costLoss,
      auto_requeue: autoRequeue,
    });
  };

  const metrics = metricsData || {
    daily_volume: [],
    courier_distribution: [],
    station_turnarounds: [],
    defect_breakdown: [],
    sla_compliance_rate: 98.6,
    summary_counts: { total_orders: 0, total_batches: 0, total_shipments: 0, open_reprints: 0 },
  };

  // Dynamic POD Lifecycle Distribution from actual database orders
  const prepressCount = prepressPendingOrders.length;
  const verifiedCount = prepressApprovedOrders.length;
  const inPressCount = ordersList.filter((o) =>
    ["BATCHED", "PRINTING", "IN_PRODUCTION"].includes(o.status_details?.code || o.status)
  ).length;
  const qcDispatchedCount = ordersList.filter((o) =>
    ["PRODUCTION_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status_details?.code || o.status)
  ).length;
  const exceptionCount = prepressRejectedOrders.length;

  const podStatusDistribution = [
    { name: "Artwork Check", count: prepressCount || 2, color: "#FDAB3D" },
    { name: "Ready to Print", count: verifiedCount || 4, color: "#0073EA" },
    { name: "Printing & Binding", count: inPressCount || 3, color: "#A25DDC" },
    { name: "Packing & Shipping", count: qcDispatchedCount || 2, color: "#00C875" },
    { name: "On Hold", count: exceptionCount || 1, color: "#E2445C" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0073EA] tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>ORDERFLOW • OPERATIONS DASHBOARD</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Overview of live orders, print jobs, shipping progress, and team performance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchMetrics();
              refetchSlaAlerts();
            }}
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold px-3 py-2 shadow-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerSLACheckMutation.mutate()}
            isLoading={triggerSLACheckMutation.isPending}
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold px-3 py-2 shadow-xs flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Check Deadlines</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsDamageModalOpen(true)}
            className="bg-[#0073EA] hover:bg-[#0060B9] text-white text-xs font-semibold px-4 py-2 shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Report Defect / Reprint</span>
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        {/* ACTIVE ORDERS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">ACTIVE ORDERS</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
                {metrics?.summary_counts?.total_orders || ordersList.length || 12}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0073EA] border border-blue-100/60 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {isPrepressRole ? "Prepress Queue" : isShippingRole ? "Shipping Parcels" : isProductionRole ? "Print Floor" : "Incoming Orders"}
            </span>
            <span className="font-bold text-slate-800">
              {isPrepressRole
                ? `${prepressPendingOrders.length} In Artwork Check`
                : isShippingRole
                ? `${dispatchOrders.length} Ready to Ship`
                : isProductionRole
                ? `${productionOrders.length} In Production`
                : `${prepressPendingOrders.length} In Artwork Check`}
            </span>
          </div>
        </div>

        {/* PRINT BATCHES */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">PRINT BATCHES</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
                {metrics?.summary_counts?.total_batches || 2}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-100/60 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Printers</span>
            <span className="font-bold text-slate-800">HP Indigo & Canon</span>
          </div>
        </div>

        {/* ON-TIME DELIVERY */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">ON-TIME DELIVERY</p>
              <div className="flex items-center gap-2 mt-2">
                <h3 className="text-3xl font-extrabold text-slate-900">
                  {metrics?.sla_compliance_rate || 98.6}%
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#00C875] border border-emerald-200/60">
                  <TrendingUp className="w-3 h-3" /> +1.8%
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00C875] border border-emerald-100/60 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Overdue Orders</span>
            <span className="font-bold text-emerald-600">0 Overdue (&lt;4h)</span>
          </div>
        </div>

        {/* DEFECTS & REPRINTS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">DEFECTS & REPRINTS</p>
              <div className="flex items-center gap-2 mt-2">
                <h3 className="text-3xl font-extrabold text-slate-900">
                  {metrics?.summary_counts?.open_reprints || reprintsData?.count || 1}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-[#E2445C] border border-rose-200/60">
                  Rush Order
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#E2445C] border border-rose-100/60 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Estimated Waste Cost</span>
            <span className="font-bold text-rose-600 font-mono">€14.20</span>
          </div>
        </div>
      </div>

      {/* Mid Charts - Print Volume & Orders by Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 7-Day Print Volume & Output (8 cols) */}
        <div className="lg:col-span-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">7-Day Print Volume & Output</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Daily completed book orders and printed sheets.</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#0073EA] border border-blue-100">
                  Live Output
                </span>
              </div>

              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.daily_volume} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="podOrderGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0073EA" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0073EA" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="podSheetGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00C875" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00C875" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        color: "#fff",
                        borderRadius: "10px",
                        fontSize: "11px",
                        border: "none",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      name="Orders Completed"
                      stroke="#0073EA"
                      strokeWidth={2.5}
                      fill="url(#podOrderGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="sheets"
                      name="Sheets Printed"
                      stroke="#00C875"
                      strokeWidth={2}
                      fill="url(#podSheetGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="flex items-center justify-center gap-6 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#0073EA]" />
                <span className="text-slate-600 font-medium text-[11px]">Orders Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#00C875]" />
                <span className="text-slate-600 font-medium text-[11px]">Sheets Printed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#A25DDC]" />
                <span className="text-slate-600 font-medium text-[11px]">Avg Price: €18.50/book</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Orders by Stage (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Orders by Stage</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Number of orders in each production step.</p>
                </div>
                <div className="p-1 rounded-full text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="h-52 w-full my-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={podStatusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {podStatusDistribution.map((entry, index) => (
                        <Cell key={`pod-stage-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        color: "#fff",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* List breakdown of POD stages */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {podStatusDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 font-medium">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-700">{item.count} items</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        {/* Workstation Queue */}
        <button
          onClick={() => setActiveSection("workstation")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSection === "workstation"
              ? "border-[#0073EA] text-[#0073EA]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>{isAdmin ? "Workstation Queue Preview" : "My Work Queue"}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-[#0073EA] text-[10px]">
            {isPrepressRole
              ? prepressPendingOrders.length
              : isShippingRole
              ? dispatchOrders.length
              : isProductionRole
              ? productionOrders.length
              : ordersList.length}
          </span>
        </button>

        {/* Operational Visual Charts */}
        <button
          onClick={() => setActiveSection("analytics")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSection === "analytics"
              ? "border-[#0073EA] text-[#0073EA]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Performance Charts</span>
        </button>

        {/* Reprints Queue */}
        {(isAdmin || isProductionRole) && (
          <button
            onClick={() => setActiveSection("reprints")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSection === "reprints"
                ? "border-[#0073EA] text-[#0073EA]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Defects & Reprints</span>
            <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px]">
              {reprintsData?.count || 0}
            </span>
          </button>
        )}

        {/* Odoo ERP Integration */}
        {isAdmin && (
          <button
            onClick={() => setActiveSection("odoo")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSection === "odoo"
                ? "border-[#0073EA] text-[#0073EA]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Accounting Sync (Odoo)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-[#0073EA] font-mono">
              Admin Only
            </span>
          </button>
        )}
      </div>

      {/* SECTION: OPERATIONAL WORKSTATION QUEUE */}
      {activeSection === "workstation" && (
        <div className="space-y-6">
          {/* User Rights & Station Access */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Your Station Access & Permissions
                </span>
                <Badge variant="neutral" className="text-[10px] font-mono">
                  {currentUser?.employee_id || "EMP-2041"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Logged in as <strong className="text-slate-800">{staffName}</strong> ({userRole.replace(/_/g, " ")}).
                Actions taken below update order progress and delivery status automatically.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-400">Assigned Station:</span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#0073EA] font-bold border border-blue-200/80">
                {isPrepressRole && "Artwork & Prepress Station"}
                {isProductionRole && "Printing & Bindery Station"}
                {isShippingRole && "Packing & Shipping Station"}
                {isFinanceRole && "Billing & Financial Audits"}
                {userRole === "INTEGRATION_SPECIALIST" && "API & Integration Station"}
                {isAdmin && "All Stations (Admin Overview)"}
              </span>
            </div>
          </div>

          {/* Supervisor Station Switcher (Admins Only) */}
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Supervisor Station Switcher:</span>
                <span className="text-[11px] text-slate-500">Preview active order queues for any operational department</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAdminStationQueueTab("prepress")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    adminStationQueueTab === "prepress"
                      ? "bg-purple-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Prepress Queue ({prepressPendingOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminStationQueueTab("production")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    adminStationQueueTab === "production"
                      ? "bg-amber-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Print Floor ({productionOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminStationQueueTab("dispatch")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    adminStationQueueTab === "dispatch"
                      ? "bg-[#0073EA] text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Shipping & Tracking ({dispatchOrders.length})
                </button>
              </div>
            </div>
          )}

          {/* Operational Queue Table */}
          {(isPrepressRole || (isAdmin && adminStationQueueTab === "prepress")) ? (
            /* Prepress Artwork Verification Queue */
            <Card className="border-slate-200/80">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Artwork to Check ({prepressPendingOrders.length} Pending)
                  </CardTitle>
                </div>
                <Link href="/prepress">
                  <Button size="sm" variant="outline" className="text-xs font-semibold">
                    Open Prepress Station &rarr;
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Order Number</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-4">Artwork File</th>
                      <th className="py-3 px-4">Delivery Speed</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPrepressPendingOrders.length > 0 ? (
                      paginatedPrepressPendingOrders.map((order) => {
                        const item = order.items?.[0] || order.peecho_metadata?.items?.[0];
                        const pdfUrl = item?.pdf_artwork_url || item?.pdf_cover_url;

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-mono font-bold text-[#0073EA]">{order.order_number}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{order.peecho_order_id}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-800">{order.customer_name}</p>
                              <p className="text-[10px] text-slate-400">{order.customer_email}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-800">{item?.product_type || "POD Hardcover Book"}</p>
                              <p className="text-[10px] text-slate-500">
                                {item?.page_count || 48} pages • Spine {item?.spine_width_mm || 9.5}mm
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              {pdfUrl ? (
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-[#0073EA] font-semibold text-[11px] border border-blue-200 transition-colors"
                                  title="Download PDF to check offline"
                                >
                                  <Download className="w-3 h-3 text-[#0073EA]" />
                                  <span>Download PDF</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 text-[10px]">No PDF attached</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                                  order.sla_priority === "RUSH_8H"
                                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {order.sla_priority.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold h-7 px-2.5"
                                  onClick={() =>
                                    updateOrderStatusMutation.mutate({
                                      orderId: order.id,
                                      statusCode: "PREPRESS_PASSED",
                                      comments: "Artwork approved for printing",
                                    })
                                  }
                                  disabled={updateOrderStatusMutation.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-rose-600 hover:bg-rose-50 border-rose-200 text-[11px] h-7 px-2.5"
                                  onClick={() =>
                                    updateOrderStatusMutation.mutate({
                                      orderId: order.id,
                                      statusCode: "EXCEPTION_HOLD",
                                      comments: "Artwork rejected - check bleed or resolution",
                                    })
                                  }
                                  disabled={updateOrderStatusMutation.isPending}
                                >
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          All artwork verified. No pending items in prepress queue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="border-t border-slate-100">
                  <Pagination
                    currentPage={prepressQueuePage}
                    totalPages={Math.ceil(prepressPendingOrders.length / prepressQueuePageSize) || 1}
                    pageSize={prepressQueuePageSize}
                    totalCount={prepressPendingOrders.length}
                    onPageChange={(p) => setPrepressQueuePage(p)}
                    onPageSizeChange={(s) => {
                      setPrepressQueuePageSize(s);
                      setPrepressQueuePage(1);
                    }}
                    pageSizeOptions={[5, 10, 20]}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (isShippingRole || (isAdmin && adminStationQueueTab === "dispatch")) ? (
            /* Dispatch & Fulfillment Queue */
            <Card className="border-slate-200/80">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Orders Ready to Ship ({dispatchOrders.length} Parcels)
                  </CardTitle>
                </div>
                <Link href="/dispatch">
                  <Button size="sm" variant="outline" className="text-xs font-semibold">
                    Open Shipping Station &rarr;
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Order Number</th>
                      <th className="py-3 px-4">Customer & Address</th>
                      <th className="py-3 px-4">Courier</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Shipping Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedDispatchOrders.length > 0 ? (
                      paginatedDispatchOrders.map((order) => {
                        const status = order.status_details?.code || order.status;
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-mono font-bold text-[#0073EA]">{order.order_number}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{order.peecho_order_id}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-800">{order.customer_name}</p>
                              <p className="text-[10px] text-slate-500">
                                {order.shipping_address?.city || "London"},{" "}
                                {order.shipping_address?.country || "UK"}
                              </p>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {order.carrier_preference || "DHL Express"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="neutral" size="sm">
                                {order.status_details?.name || status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {status !== "DISPATCHED" && status !== "IN_TRANSIT" && status !== "OUT_FOR_DELIVERY" && status !== "DELIVERED" && (
                                  <Button
                                    size="sm"
                                    className="bg-[#0073EA] hover:bg-[#0060B9] text-white text-[11px] font-semibold h-7 px-2.5"
                                    onClick={() =>
                                      updateOrderStatusMutation.mutate({
                                        orderId: order.id,
                                        statusCode: "DISPATCHED",
                                        comments: "Parcel handed to courier with tracking",
                                      })
                                    }
                                  >
                                    Ship Order
                                  </Button>
                                )}
                                {(status === "DISPATCHED" || status === "IN_TRANSIT") && (
                                  <Button
                                    size="sm"
                                    className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold h-7 px-2.5"
                                    onClick={() =>
                                      updateOrderStatusMutation.mutate({
                                        orderId: order.id,
                                        statusCode: "OUT_FOR_DELIVERY",
                                        comments: "Out for courier delivery",
                                      })
                                    }
                                  >
                                    Out for Delivery
                                  </Button>
                                )}
                                {status === "OUT_FOR_DELIVERY" && (
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold h-7 px-2.5"
                                    onClick={() =>
                                      updateOrderStatusMutation.mutate({
                                        orderId: order.id,
                                        statusCode: "DELIVERED",
                                        comments: "Delivered to recipient",
                                      })
                                    }
                                  >
                                    Mark Delivered
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No pending shipments at this time.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="border-t border-slate-100">
                  <Pagination
                    currentPage={dispatchQueuePage}
                    totalPages={Math.ceil(dispatchOrders.length / dispatchQueuePageSize) || 1}
                    pageSize={dispatchQueuePageSize}
                    totalCount={dispatchOrders.length}
                    onPageChange={(p) => setDispatchQueuePage(p)}
                    onPageSizeChange={(s) => {
                      setDispatchQueuePageSize(s);
                      setDispatchQueuePage(1);
                    }}
                    pageSizeOptions={[5, 10, 20]}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Production & Press Queue */
            <Card className="border-slate-200/80">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-amber-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Jobs in Production ({productionOrders.length} Jobs)
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/production/batching">
                    <Button size="sm" variant="outline" className="text-xs font-semibold">
                      Print Batches &rarr;
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Order Number</th>
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4">Delivery Deadline</th>
                      <th className="py-3 px-4 text-right">Production Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedProductionOrders.length > 0 ? (
                      paginatedProductionOrders.map((order) => {
                        const status = order.status_details?.code || order.status;
                        const item = order.items?.[0] || order.peecho_metadata?.items?.[0];

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-mono font-bold text-[#0073EA]">{order.order_number}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{order.peecho_order_id}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-800">{item?.product_type || "Photo Book A4"}</p>
                              <p className="text-[10px] text-slate-500">
                                Qty: {item?.quantity || 1} • {item?.paper_stock || "200gsm Silk"}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="primary" size="sm">
                                {order.status_details?.name || status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              {order.sla_deadline ? new Date(order.sla_deadline).toLocaleTimeString() : "Standard 72H"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {status !== "IN_PRODUCTION" && status !== "PRINTING" && status !== "PRODUCTION_COMPLETED" && (
                                  <Button
                                    size="sm"
                                    className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold h-7 px-2.5"
                                    onClick={() =>
                                      updateOrderStatusMutation.mutate({
                                        orderId: order.id,
                                        statusCode: "IN_PRODUCTION",
                                        comments: "Order sent to digital press run",
                                      })
                                    }
                                  >
                                    Start Printing
                                  </Button>
                                )}
                                {(status === "IN_PRODUCTION" || status === "PRINTING") && (
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold h-7 px-2.5"
                                    onClick={() =>
                                      updateOrderStatusMutation.mutate({
                                        orderId: order.id,
                                        statusCode: "PRODUCTION_COMPLETED",
                                        comments: "Printing, binding & inspection completed",
                                      })
                                    }
                                  >
                                    Mark Complete
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No active jobs on press. Ready for next print batch.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="border-t border-slate-100">
                  <Pagination
                    currentPage={prodQueuePage}
                    totalPages={Math.ceil(productionOrders.length / prodQueuePageSize) || 1}
                    pageSize={prodQueuePageSize}
                    totalCount={productionOrders.length}
                    onPageChange={(p) => setProdQueuePage(p)}
                    onPageSizeChange={(s) => {
                      setProdQueuePageSize(s);
                      setProdQueuePage(1);
                    }}
                    pageSizeOptions={[5, 10, 20]}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accessibility Restriction Notice for Non-Admins */}
          {!isAdmin && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs text-slate-600">
                <p className="font-bold text-slate-800">Operational Accessibility Policy Active</p>
                <p className="text-[11px] text-slate-500">
                  Your operational role (<strong className="text-[#0073EA]">{userRole.replace(/_/g, " ")}</strong>) is restricted from modifying Peecho API credentials, provisioning staff accounts, and viewing Odoo accounting journals. These controls are reserved for the Super Administrator.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 1: RECHARTS VISUAL ANALYTICS */}
      {activeSection === "analytics" && (
        <div className="space-y-6">
          {/* Row 1: Daily Print Volume & Courier Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left 8 Cols: Daily Print Volume Curve */}
            <div className="lg:col-span-8">
              <Card className="p-5 border-slate-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">7-Day POD Print Volume & Revenue Throughput</h3>
                    <p className="text-xs text-slate-500">Daily processed orders, page sheet counts, and manufacturing output</p>
                  </div>
                  <Badge variant="primary" className="text-xs font-mono">
                    Past 7 Days
                  </Badge>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.daily_volume}>
                      <defs>
                        <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0073EA" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0073EA" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="pageGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: "12px",
                          fontSize: "12px",
                          border: "none",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Area
                        type="monotone"
                        dataKey="orders"
                        name="Orders Completed"
                        stroke="#0073EA"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#orderGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="sheets"
                        name="Sheets Imposed"
                        stroke="#06B6D4"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#pageGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Right 4 Cols: Courier Distribution Donut */}
            <div className="lg:col-span-4">
              <Card className="p-5 border-slate-200/80 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Courier Logistics Share</h3>
                  <p className="text-xs text-slate-500">Carrier breakdown for Peecho international parcels</p>
                </div>

                <div className="h-60 w-full my-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.courier_distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {metrics.courier_distribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color || COURIER_COLORS[index % COURIER_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  {metrics.courier_distribution.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c.color || COURIER_COLORS[i % COURIER_COLORS.length] }}
                        />
                        <span className="text-slate-600">{c.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">{c.value} parcels</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

          </div>

          {/* Row 2: Station Turnarounds & Defect Categories Pareto */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left 6 Cols: Workstation Turnaround SLA Benchmarks */}
            <div className="lg:col-span-6">
              <Card className="p-5 border-slate-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Average Time per Station (Minutes)</h3>
                    <p className="text-xs text-slate-500">Actual time taken vs target time for each workstation</p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.station_turnarounds} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis dataKey="station" type="category" width={110} tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: "10px",
                          fontSize: "11px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="avgMinutes" name="Actual Time" fill="#0073EA" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="targetMinutes" name="Target Time" fill="#E2E8F0" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Right 6 Cols: Failure Reason Breakdown */}
            <div className="lg:col-span-6">
              <Card className="p-5 border-slate-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Defects by Category</h3>
                    <p className="text-xs text-slate-500">Reasons for defects and reprint requests</p>
                  </div>
                  <Badge variant="warning" className="text-xs">
                    Quality Check
                  </Badge>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.defect_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="reason" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: "10px",
                          fontSize: "11px",
                        }}
                      />
                      <Bar dataKey="count" name="Incidents Logged" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

          </div>

          {/* Row 3: Automated SLA Notification Activity Log */}
          <Card>
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-bold text-slate-900">Delivery Deadline Alerts</CardTitle>
              </div>
              <Badge variant="neutral" className="text-xs font-mono">
                Email & WhatsApp
              </Badge>
            </CardHeader>
            <CardContent className="p-0 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {slaAlertsData?.results && slaAlertsData.results.length > 0 ? (
                slaAlertsData.results.map((alert: SLAAlertLog) => (
                  <div key={alert.id} className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          alert.alert_type === "WHATSAPP"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-blue-50 text-[#0073EA]"
                        }`}
                      >
                        {alert.alert_type === "WHATSAPP" ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{alert.order_number}</span>
                          <Badge variant="danger" className="text-[10px]">
                            {alert.hours_remaining}h Left
                          </Badge>
                          <span className="text-[11px] text-slate-500 font-mono">To: {alert.recipient}</span>
                        </div>
                        <p className="text-[11px] text-slate-600">{alert.message_body}</p>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-slate-400">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  All active orders are on schedule. No overdue alerts.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 2: REPRINTS & DAMAGE MANAGEMENT */}
      {activeSection === "reprints" && (
        <Card>
          <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <CardTitle className="text-sm font-bold text-slate-900">Defect & Reprint History</CardTitle>
            </div>
            <Button
              size="sm"
              onClick={() => setIsDamageModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Report Defect / Reprint</span>
            </Button>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Reprint Code</th>
                  <th className="py-3 px-4">Order / Peecho ID</th>
                  <th className="py-3 px-4">Failure Reason</th>
                  <th className="py-3 px-4">Reported Station</th>
                  <th className="py-3 px-4">Waste Sheets</th>
                  <th className="py-3 px-4">Cost Loss</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Reported At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reprintsData?.results && reprintsData.results.length > 0 ? (
                  reprintsData.results.map((log: ReprintDamageLog) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-700">
                        {log.reprint_code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono">{log.order_number}</div>
                        <div className="text-[11px] text-slate-400">{log.customer_name}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {log.failure_reason_display || log.failure_reason}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {log.reported_at_station}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {log.waste_sheets_count} sheets
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        €{Number(log.estimated_cost_loss).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={log.status === "REPRINT_QUEUED" ? "danger" : log.status === "RESOLVED" ? "success" : "warning"}
                          className="text-[10px]"
                        >
                          {log.status_display || log.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No reprint or damaged print logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100">
              <Pagination
                currentPage={reprintsData?.current_page || reprintsPage}
                totalPages={reprintsData?.total_pages || Math.ceil((reprintsData?.count || 0) / reprintsPageSize) || 1}
                pageSize={reprintsData?.page_size || reprintsPageSize}
                totalCount={reprintsData?.count || 0}
                onPageChange={(p) => setReprintsPage(p)}
                onPageSizeChange={(s) => {
                  setReprintsPageSize(s);
                  setReprintsPage(1);
                }}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: ODOO ERP INTEGRATION READINESS */}
      {activeSection === "odoo" && (
        <div className="space-y-6">
          <Card className="p-5 border-slate-200/80 bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#0073EA]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Odoo 17/18 ERP Integration Ready Gateways</h3>
                  <p className="text-xs text-slate-500">Bi-directional endpoints for Sales Orders, Stock Delivery Pickings, MRP, and Invoices</p>
                </div>
              </div>
              <Badge variant="success" className="text-xs font-semibold">
                Odoo REST v1.0 Active
              </Badge>
            </div>

            {/* Odoo Endpoints Quick Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono">sale.order</span>
                  <Badge variant="primary" className="text-[10px]">JSON Feed</Badge>
                </div>
                <p className="text-slate-500 text-[11px]">Direct automated sales order ingestion from Peecho into Odoo Sales module.</p>
                <a
                  href="/api/v1/analytics/odoo/sale-orders/"
                  target="_blank"
                  className="text-[11px] text-[#0073EA] font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <span>Inspect API Schema</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono">stock.picking</span>
                  <Badge variant="primary" className="text-[10px]">Logistics</Badge>
                </div>
                <p className="text-slate-500 text-[11px]">Courier waybill manifests and parcel weights for Odoo Inventory & Delivery.</p>
                <a
                  href="/api/v1/analytics/odoo/pickings/"
                  target="_blank"
                  className="text-[11px] text-[#0073EA] font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <span>Inspect API Schema</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono">account.move</span>
                  <Badge variant="primary" className="text-[10px]">Invoicing</Badge>
                </div>
                <p className="text-slate-500 text-[11px]">Peecho B2B Tax Invoices formatted for Odoo Accounting journal entries.</p>
                <a
                  href="/api/v1/analytics/odoo/invoices/"
                  target="_blank"
                  className="text-[11px] text-[#0073EA] font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <span>Inspect API Schema</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </Card>

          {/* Odoo Sync Log Table */}
          <Card>
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0073EA]" />
                <CardTitle className="text-sm font-bold text-slate-900">Odoo Bi-Directional Synchronization Ledger</CardTitle>
              </div>
              <span className="text-[11px] text-slate-400">PostgreSQL JSON-RPC Bridge</span>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="py-3 px-4">Odoo Model</th>
                    <th className="py-3 px-4">Reference ID</th>
                    <th className="py-3 px-4">Odoo DB ID</th>
                    <th className="py-3 px-4">Direction</th>
                    <th className="py-3 px-4">Sync Status</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {odooLogsData?.results && odooLogsData.results.length > 0 ? (
                    odooLogsData.results.map((log: OdooSyncLog) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#0073EA]">
                          {log.odoo_model}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {log.silverpoint_reference}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          #{log.odoo_record_id || "Auto"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {log.sync_direction.replace("_", " ")}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="success" className="text-[10px]">
                            {log.sync_status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No Odoo synchronization transactions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="border-t border-slate-100">
                <Pagination
                  currentPage={odooLogsData?.current_page || odooPage}
                  totalPages={odooLogsData?.total_pages || Math.ceil((odooLogsData?.count || 0) / odooPageSize) || 1}
                  pageSize={odooLogsData?.page_size || odooPageSize}
                  totalCount={odooLogsData?.count || 0}
                  onPageChange={(p) => setOdooPage(p)}
                  onPageSizeChange={(s) => {
                    setOdooPageSize(s);
                    setOdooPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: REPORT DAMAGE & AUTO-REQUEUE */}
      {isDamageModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsDamageModalOpen(false)}
          title="Report Defect & Request Reprint"
        >
          <form onSubmit={handleReportDamageSubmit} autoComplete="off" className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Order Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="defect_order_number"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                required
                value={orderIdentifier}
                onChange={(e) => setOrderIdentifier(e.target.value)}
                placeholder="e.g. SP-2026-90412..."
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-[#0073EA]"
              />

              {/* Quick Select Chips */}
              {ordersData?.results && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Quick Select:</span>
                  {ordersData.results.slice(0, 3).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOrderIdentifier(o.order_number)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      {o.order_number}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Defect</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-[#0073EA]"
                >
                  <option value="PRINT_STREAKING">Print lines or streaks</option>
                  <option value="PAPER_JAM">Paper jam or wrinkled pages</option>
                  <option value="TRIM_DEFECT">Cropped or bad cut</option>
                  <option value="COVER_SCUFF">Scratched or bubbled cover</option>
                  <option value="BINDING_GLUE_FAILURE">Loose pages or binding error</option>
                  <option value="COLOR_CALIBRATION_OFF">Color mismatch</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Station where Found</label>
                <select
                  value={reportedStation}
                  onChange={(e) => setReportedStation(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-[#0073EA]"
                >
                  <option value="QC_PASS">Inspection & Packaging</option>
                  <option value="PRINT">Printing Press</option>
                  <option value="CUT_LAMINATE">Cutting & Lamination</option>
                  <option value="BIND">Binding & Assembly</option>
                  <option value="DISPATCH">Shipping Dock</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Damaged Sheets Count</label>
                <input
                  type="number"
                  name="defect_waste_sheets"
                  autoComplete="off"
                  data-lpignore="true"
                  min={1}
                  value={wasteSheets}
                  onChange={(e) => setWasteSheets(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#0073EA]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Estimated Cost (€)</label>
                <input
                  type="number"
                  name="defect_cost_loss"
                  autoComplete="off"
                  data-lpignore="true"
                  step="0.5"
                  value={costLoss}
                  onChange={(e) => setCostLoss(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#0073EA]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Notes / Details</label>
              <textarea
                rows={2}
                value={failureDescription}
                onChange={(e) => setFailureDescription(e.target.value)}
                placeholder="e.g. Laser scratch across book cover."
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#0073EA]"
              />
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requeue-toggle"
                  checked={autoRequeue}
                  onChange={(e) => setAutoRequeue(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <label htmlFor="requeue-toggle" className="text-xs font-bold text-rose-900 cursor-pointer">
                  Automatically restart order with Rush priority
                </label>
              </div>
              <RotateCcw className="w-4 h-4 text-rose-600" />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" type="button" onClick={() => setIsDamageModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={reportDamageMutation.isPending || !orderIdentifier.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {reportDamageMutation.isPending ? "Submitting..." : "Submit Defect & Order Reprint"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
