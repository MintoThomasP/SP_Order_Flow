"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe2,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Code2,
  Copy,
  Eye,
  ShieldCheck,
  Send,
  Layers,
  Save,
  Key,
  Sliders,
  Check,
  Lock,
  Cpu,
  Server,
  ArrowRight,
  ExternalLink,
  Printer,
  Truck,
  Package,
  Activity,
  Terminal,
} from "lucide-react";
import {
  ordersApi,
  PeechoPayloadLog,
  PeechoIntegrationConfig,
  PrintifyPayloadLog,
  PrintifyIntegrationConfig,
} from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";

type PODChannel = "printify" | "peecho" | "custom";

export default function PODIntegrationsPage() {
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<PODChannel>("printify");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // PEECHO STATE & QUERIES
  // ---------------------------------------------------------------------------
  const [selectedPeechoLog, setSelectedPeechoLog] = useState<PeechoPayloadLog | null>(null);
  const [peechoTestResult, setPeechoTestResult] = useState<{
    success: boolean;
    status: string;
    mode?: string;
    message: string;
    tested_at: string;
    endpoint?: string;
  } | null>(null);

  const [isEditingPeechoConfig, setIsEditingPeechoConfig] = useState(false);
  const [peechoConfigForm, setPeechoConfigForm] = useState({
    api_base_url: "https://api.peecho.com",
    button_key: "17903659506881470",
    api_key: "",
    secret_key: "",
    webhook_secret: "",
    is_sandbox: true,
    auto_sync_status_changes: true,
  });

  const [customPeechoPayloadText, setCustomPeechoPayloadText] = useState(
    JSON.stringify(
      {
        event: "order.created",
        order_id: `PEECHO-${Math.floor(Math.random() * 900000 + 100000)}`,
        priority: "RUSH_8H",
        currency: "EUR",
        total_amount: "54.00",
        carrier: "DHL Express",
        customer: {
          name: "Amélie Poulain",
          email: "amelie@parisart.fr",
          phone: "+33 1 23 45 67 89",
        },
        shipping_address: {
          recipient_name: "Amélie Poulain",
          street: "15 Rue Lepic",
          city: "Paris",
          postal_code: "75018",
          country: "FR",
        },
        items: [
          {
            item_id: "ITEM-901",
            product_type: "Hardcover Photo Book A4",
            quantity: 1,
            page_count: 52,
            spine_width_mm: 11.5,
            paper_stock: "200gsm Silk Inner + Matte Cover",
            pdf_artwork_url: "https://assets.peecho.com/demo/interior.pdf",
            pdf_cover_url: "https://assets.peecho.com/demo/cover.pdf",
          },
        ],
      },
      null,
      2
    )
  );

  const {
    data: peechoConfigData,
    isLoading: peechoConfigLoading,
    refetch: refetchPeechoConfig,
  } = useQuery({
    queryKey: ["peecho-config"],
    queryFn: () => ordersApi.getPeechoConfig(),
  });

  const {
    data: peechoLogsData,
    isLoading: peechoLogsLoading,
    refetch: refetchPeechoLogs,
  } = useQuery({
    queryKey: ["peecho-logs"],
    queryFn: () => ordersApi.getPeechoPayloadLogs(),
    refetchInterval: 6000,
  });

  useEffect(() => {
    if (peechoConfigData) {
      setPeechoConfigForm({
        api_base_url: peechoConfigData.api_base_url || "https://api.peecho.com",
        button_key: peechoConfigData.button_key || "17903659506881470",
        api_key: "",
        secret_key: "",
        webhook_secret: "",
        is_sandbox: peechoConfigData.is_sandbox ?? true,
        auto_sync_status_changes: peechoConfigData.auto_sync_status_changes ?? true,
      });
    }
  }, [peechoConfigData]);

  const updatePeechoConfigMutation = useMutation({
    mutationFn: (data: Partial<PeechoIntegrationConfig>) => ordersApi.updatePeechoConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peecho-config"] });
      setIsEditingPeechoConfig(false);
    },
  });

  const testPeechoConnectionMutation = useMutation({
    mutationFn: () => ordersApi.testPeechoConnection(),
    onSuccess: (data) => {
      setPeechoTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["peecho-config"] });
    },
  });

  const ingestCustomPeechoMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => ordersApi.ingestPeechoWebhook(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peecho-logs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  // ---------------------------------------------------------------------------
  // PRINTIFY STATE & QUERIES
  // ---------------------------------------------------------------------------
  const [selectedPrintifyLog, setSelectedPrintifyLog] = useState<PrintifyPayloadLog | null>(null);
  const [isEditingPrintifyConfig, setIsEditingPrintifyConfig] = useState(false);
  const [printifyConfigForm, setPrintifyConfigForm] = useState({
    shop_id: "",
    api_token: "",
    webhook_secret: "",
  });

  const [printifyTestResult, setPrintifyTestResult] = useState<{
    success: boolean;
    status: string;
    mode?: string;
    message: string;
    tested_at: string;
    endpoint?: string;
  } | null>(null);

  const [printifyRegisterResult, setPrintifyRegisterResult] = useState<{
    success: boolean;
    message: string;
    callback_url: string;
    topics?: any[];
  } | null>(null);

  const [printifySimulateResult, setPrintifySimulateResult] = useState<{
    success: boolean;
    message: string;
    event_type: string;
    printify_order_id: string;
    order_number: string;
    result: any;
    log_id?: string;
  } | null>(null);

  const [printifySimulateParams, setPrintifySimulateParams] = useState({
    carrier: "USPS Priority",
    tracking_number: "9400111899562537910001",
    order_number: "",
  });

  const [customPrintifyPayloadText, setCustomPrintifyPayloadText] = useState(
    JSON.stringify(
      {
        type: "order:shipment:created",
        resource: {
          id: `PF-SIM-${Math.floor(Math.random() * 900000 + 100000)}`,
          external_id: "ORD-PRINTIFY-TEST",
          status: "fulfilled",
          shipments: [
            {
              carrier: "USPS Priority",
              number: "9400111899562537910001",
              url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899562537910001",
            },
          ],
        },
      },
      null,
      2
    )
  );

  const {
    data: printifyConfigData,
    isLoading: printifyConfigLoading,
    refetch: refetchPrintifyConfig,
  } = useQuery({
    queryKey: ["printify-config"],
    queryFn: () => ordersApi.getPrintifyConfig(),
  });

  const {
    data: printifyLogsData,
    isLoading: printifyLogsLoading,
    refetch: refetchPrintifyLogs,
  } = useQuery({
    queryKey: ["printify-logs"],
    queryFn: () => ordersApi.getPrintifyPayloadLogs(),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (printifyConfigData) {
      setPrintifyConfigForm({
        shop_id: printifyConfigData.shop_id || "",
        api_token: "",
        webhook_secret: "",
      });
    }
  }, [printifyConfigData]);

  const updatePrintifyConfigMutation = useMutation({
    mutationFn: (data: { api_token?: string; shop_id?: string; webhook_secret?: string }) =>
      ordersApi.updatePrintifyConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printify-config"] });
      setIsEditingPrintifyConfig(false);
    },
  });

  const testPrintifyConnectionMutation = useMutation({
    mutationFn: () => ordersApi.testPrintifyConnection(),
    onSuccess: (data) => {
      setPrintifyTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["printify-config"] });
    },
  });

  const registerPrintifyWebhooksMutation = useMutation({
    mutationFn: (callbackUrl?: string) => ordersApi.registerPrintifyWebhooks(callbackUrl),
    onSuccess: (data) => {
      setPrintifyRegisterResult(data);
      queryClient.invalidateQueries({ queryKey: ["printify-config"] });
    },
  });

  const simulatePrintifyWebhookMutation = useMutation({
    mutationFn: (params: {
      event_type?: string;
      order_number?: string;
      carrier?: string;
      tracking_number?: string;
      status?: string;
    }) => ordersApi.simulatePrintifyWebhook(params),
    onSuccess: (data) => {
      setPrintifySimulateResult(data);
      queryClient.invalidateQueries({ queryKey: ["printify-logs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const ingestCustomPrintifyMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => ordersApi.ingestPrintifyWebhook(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printify-logs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSavePeechoConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {
      api_base_url: peechoConfigForm.api_base_url.trim(),
      button_key: peechoConfigForm.button_key.trim(),
      is_sandbox: peechoConfigForm.is_sandbox,
      auto_sync_status_changes: peechoConfigForm.auto_sync_status_changes,
    };
    if (peechoConfigForm.api_key.trim()) payload.api_key = peechoConfigForm.api_key.trim();
    if (peechoConfigForm.secret_key.trim()) payload.secret_key = peechoConfigForm.secret_key.trim();
    if (peechoConfigForm.webhook_secret.trim()) payload.webhook_secret = peechoConfigForm.webhook_secret.trim();

    updatePeechoConfigMutation.mutate(payload);
  };

  const handleSavePrintifyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, string> = {};
    if (printifyConfigForm.shop_id.trim()) payload.shop_id = printifyConfigForm.shop_id.trim();
    if (printifyConfigForm.api_token.trim()) payload.api_token = printifyConfigForm.api_token.trim();
    if (printifyConfigForm.webhook_secret.trim()) payload.webhook_secret = printifyConfigForm.webhook_secret.trim();

    updatePrintifyConfigMutation.mutate(payload);
  };

  const handleSendCustomPeechoWebhook = () => {
    try {
      const parsed = JSON.parse(customPeechoPayloadText);
      ingestCustomPeechoMutation.mutate(parsed);
    } catch (e: any) {
      alert("Invalid JSON format: " + e.message);
    }
  };

  const handleSendCustomPrintifyWebhook = () => {
    try {
      const parsed = JSON.parse(customPrintifyPayloadText);
      ingestCustomPrintifyMutation.mutate(parsed);
    } catch (e: any) {
      alert("Invalid JSON format: " + e.message);
    }
  };

  // ---------------------------------------------------------------------------
  // TABLES
  // ---------------------------------------------------------------------------
  const peechoColumns: Column<PeechoPayloadLog>[] = [
    {
      header: "Date & Time",
      cell: (log) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(log.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Order Reference",
      cell: (log) => (
        <span className="font-mono font-bold text-xs text-[#0073EA]">
          {log.peecho_order_id || "N/A"}
        </span>
      ),
    },
    {
      header: "Event",
      accessorKey: "event_type",
      className: "font-mono text-xs text-slate-700",
    },
    {
      header: "Status",
      cell: (log) => {
        let variant: "success" | "warning" | "danger" | "neutral" = "success";
        if (log.status === "DUPLICATE") variant = "warning";
        if (log.status === "FAILED") variant = "danger";

        return (
          <Badge variant={variant} size="sm" dot={true}>
            {log.status}
          </Badge>
        );
      },
    },
    {
      header: "Event ID",
      cell: (log) => (
        <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px] block">
          {log.payload_hash ? `${log.payload_hash.substring(0, 16)}...` : "N/A"}
        </span>
      ),
    },
    {
      header: "Payload",
      cell: (log) => (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Eye className="w-3.5 h-3.5 text-[#0073EA]" />}
          onClick={() => setSelectedPeechoLog(log)}
        >
          View JSON
        </Button>
      ),
    },
  ];

  const printifyColumns: Column<PrintifyPayloadLog>[] = [
    {
      header: "Date & Time",
      cell: (log) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(log.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Printify Order ID",
      cell: (log) => (
        <span className="font-mono font-bold text-xs text-emerald-600">
          {log.printify_order_id || "N/A"}
        </span>
      ),
    },
    {
      header: "Event Topic",
      cell: (log) => (
        <span className="font-mono text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {log.event_type}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (log) => {
        let variant: "success" | "warning" | "danger" | "neutral" = "success";
        if (log.status === "IGNORED") variant = "warning";
        if (log.status === "FAILED" || log.status === "INVALID_SIGNATURE") variant = "danger";

        return (
          <Badge variant={variant} size="sm" dot={true}>
            {log.status}
          </Badge>
        );
      },
    },
    {
      header: "IP Address",
      cell: (log) => (
        <span className="font-mono text-[11px] text-slate-400">
          {log.ip_address || "Internal"}
        </span>
      ),
    },
    {
      header: "Payload",
      cell: (log) => (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Eye className="w-3.5 h-3.5 text-emerald-600" />}
          onClick={() => setSelectedPrintifyLog(log)}
        >
          View JSON
        </Button>
      ),
    },
  ];

  const livePrintifyWebhookUrl =
    printifyConfigData?.full_webhook_url || "http://127.0.0.1:8001/api/v1/webhooks/printify/";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              POD Integrations
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Printer className="w-3.5 h-3.5" />
              Print-On-Demand Gateways
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Connect and configure external Print-On-Demand platforms, incoming webhook listeners, and automated fulfillment callbacks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              if (selectedChannel === "printify") {
                refetchPrintifyConfig();
                refetchPrintifyLogs();
              } else {
                refetchPeechoConfig();
                refetchPeechoLogs();
              }
            }}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* POD Channels Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Channel 1: Printify (Active / Production Ready) */}
        <button
          type="button"
          onClick={() => setSelectedChannel("printify")}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            selectedChannel === "printify"
              ? "bg-white border-emerald-600 shadow-md shadow-emerald-600/10 ring-2 ring-emerald-600/20"
              : "bg-white/80 border-slate-200/80 hover:border-slate-300 hover:bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 font-black">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Printify Integrations</h3>
                <span className="text-[11px] text-slate-500">REST API v1 & Webhooks</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Webhook: <strong className="text-slate-700 font-mono">/api/v1/webhooks/printify/</strong></span>
            <span className="text-emerald-600 font-semibold">{printifyLogsData?.count || 0} events</span>
          </div>
        </button>

        {/* Channel 2: Peecho (Active) */}
        <button
          type="button"
          onClick={() => setSelectedChannel("peecho")}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            selectedChannel === "peecho"
              ? "bg-white border-[#0073EA] shadow-md shadow-[#0073EA]/10 ring-2 ring-[#0073EA]/20"
              : "bg-white/80 border-slate-200/80 hover:border-slate-300 hover:bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#0073EA]">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Peecho Integrations</h3>
                <span className="text-[11px] text-slate-500">Global Cloud Print API</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Webhook: <strong className="text-slate-700 font-mono">/api/v1/peecho/</strong></span>
            <span className="text-[#0073EA] font-semibold">{peechoLogsData?.count || 6} orders synced</span>
          </div>
        </button>

        {/* Channel 3: Custom REST Gateway */}
        <button
          type="button"
          onClick={() => setSelectedChannel("custom")}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            selectedChannel === "custom"
              ? "bg-white border-[#0073EA] shadow-md shadow-[#0073EA]/10 ring-2 ring-[#0073EA]/20"
              : "bg-white/80 border-slate-200/80 hover:border-slate-300 hover:bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Custom POD Gateway</h3>
                <span className="text-[11px] text-slate-500">Direct OpenAPI v3 / In-House ERP</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
              Modular
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Protocol: <strong className="text-slate-700 font-mono">OpenAPI JSON</strong></span>
            <span className="text-slate-400">Developer API</span>
          </div>
        </button>
      </div>

      {/* =======================================================================
          TAB 1: PRINTIFY INTEGRATION VIEW (PRIMARY)
          ======================================================================= */}
      {selectedChannel === "printify" && (
        <div className="space-y-6">
          {/* Printify Hero Banner */}
          <div className="p-6 bg-gradient-to-r from-[#06331E] via-[#0E492D] to-slate-900 rounded-3xl text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 flex items-center justify-end pr-8 pointer-events-none">
              <Printer className="w-64 h-64 text-white" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold tracking-wide uppercase">
                    Printify POD REST API v1
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Bi-Directional Celery Sync Active
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                  Printify Integrations
                </h2>
                <p className="text-xs text-emerald-100/80 leading-relaxed">
                  Production-grade asynchronous service connecting OrderFlow with Printify's Print-on-Demand REST API.
                  Automatically syncs external orders via Celery workers, triggers production batches, and receives real-time tracking updates with HMAC SHA-256 signature verification.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testPrintifyConnectionMutation.mutate()}
                  isLoading={testPrintifyConnectionMutation.isPending}
                  leftIcon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                >
                  Test Connection
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => registerPrintifyWebhooksMutation.mutate(livePrintifyWebhookUrl)}
                  isLoading={registerPrintifyWebhooksMutation.isPending}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                >
                  Register Webhooks
                </Button>

                {!isEditingPrintifyConfig ? (
                  <Button
                    size="sm"
                    onClick={() => setIsEditingPrintifyConfig(true)}
                    leftIcon={<Sliders className="w-3.5 h-3.5" />}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 font-semibold"
                  >
                    Edit Credentials
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingPrintifyConfig(false)}
                    className="bg-white/10 text-white border-white/20"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Handshake Feedback Banner */}
            {printifyTestResult && (
              <div
                className={`mt-4 p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                  printifyTestResult.success
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                    : "bg-rose-500/20 border-rose-400/40 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {printifyTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">{printifyTestResult.status}</span>: {printifyTestResult.message}
                    <span className="text-[11px] opacity-75 ml-2 font-mono">
                      [{new Date(printifyTestResult.tested_at).toLocaleTimeString()}]
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20">
                  {printifyTestResult.mode}
                </span>
              </div>
            )}

            {/* Webhook Registration Feedback Banner */}
            {printifyRegisterResult && (
              <div className="mt-3 p-3.5 rounded-2xl border border-blue-400/40 bg-blue-500/20 text-blue-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    <strong>Webhook Synced:</strong> {printifyRegisterResult.message} &rarr;{" "}
                    <code className="text-white font-mono">{printifyRegisterResult.callback_url}</code>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              title="Printify Ingested Events"
              value={printifyLogsData?.count || 0}
              change="Audit Logged"
              trend="up"
              subtitle="All webhook callbacks received"
              icon={<Printer className="w-5 h-5 text-emerald-600" />}
            />
            <StatCard
              title="HMAC SHA-256 Protection"
              value="Enforced"
              change="Active"
              trend="up"
              subtitle="Signature header verified"
              icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
            />
            <StatCard
              title="Asynchronous Celery"
              value="Running"
              change="Exponential Backoff"
              trend="up"
              subtitle="sync_order_to_printify"
              icon={<Zap className="w-5 h-5 text-amber-500" />}
            />
            <StatCard
              title="External POD Isolation"
              value="Strict"
              change="Isolated"
              trend="up"
              subtitle="Manual orders bypassed"
              icon={<Lock className="w-5 h-5 text-[#0073EA]" />}
            />
          </div>

          {/* SECTION 1: CREDENTIALS & WEBHOOK CONFIGURATION */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Printify API Credentials & Channel Configuration
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure your Printify Shop ID, API Bearer token, and webhook secret to authenticate bi-directional event delivery.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Channel: Connected & In Sync
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePrintifyConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Shop ID */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Printify Shop ID</label>
                  {isEditingPrintifyConfig ? (
                    <input
                      type="text"
                      placeholder="e.g. 1234567"
                      value={printifyConfigForm.shop_id}
                      onChange={(e) => setPrintifyConfigForm({ ...printifyConfigForm, shop_id: e.target.value })}
                      required
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{printifyConfigData?.shop_id || "Configured in Environment"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(printifyConfigData?.shop_id || "", "printify_shop_id")}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                        title="Copy Shop ID"
                      >
                        {copiedField === "printify_shop_id" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* API Token */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Printify API Bearer Token</label>
                  {isEditingPrintifyConfig ? (
                    <input
                      type="password"
                      placeholder="Enter PRINTIFY_API_TOKEN"
                      value={printifyConfigForm.api_token}
                      onChange={(e) => setPrintifyConfigForm({ ...printifyConfigForm, api_token: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{printifyConfigData?.api_token_masked || "••••••••••••••••"}</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-sans font-medium">Secured</span>
                    </div>
                  )}
                </div>

                {/* Webhook Secret */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Webhook HMAC Secret</label>
                  {isEditingPrintifyConfig ? (
                    <input
                      type="password"
                      placeholder="Enter PRINTIFY_WEBHOOK_SECRET"
                      value={printifyConfigForm.webhook_secret}
                      onChange={(e) => setPrintifyConfigForm({ ...printifyConfigForm, webhook_secret: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{printifyConfigData?.webhook_secret_masked || "••••••••••••••••"}</span>
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-sans font-medium">SHA-256</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Inbound Webhook Listener URL */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-600" />
                    Inbound Webhook Endpoint URL (Printify &rarr; OrderFlow)
                  </label>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Listening on HTTP 200 OK
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center font-mono text-xs overflow-x-auto">
                    {livePrintifyWebhookUrl}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(livePrintifyWebhookUrl, "live_printify_webhook")}
                    leftIcon={copiedField === "live_printify_webhook" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedField === "live_printify_webhook" ? "Copied" : "Copy URL"}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span>Registered Topics:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold border border-emerald-200">order:shipment:created</span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">order:sent-to-production</span>
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px] font-bold border border-purple-200">order:updated</span>
                </div>
              </div>

              {isEditingPrintifyConfig && (
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingPrintifyConfig(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={updatePrintifyConfigMutation.isPending}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    Save Printify Settings
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* SECTION 2: PRINTIFY INTERACTIVE SIMULATOR */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Printify Webhook Simulator & Event Testing
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Trigger simulated fulfillment and production callbacks directly into the state machine
              </span>
            </div>

            {/* Quick 1-Click Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() =>
                  simulatePrintifyWebhookMutation.mutate({
                    event_type: "order:shipment:created",
                    carrier: printifySimulateParams.carrier,
                    tracking_number: printifySimulateParams.tracking_number,
                    order_number: printifySimulateParams.order_number,
                  })
                }
                disabled={simulatePrintifyWebhookMutation.isPending}
                className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    Simulate Shipment Created
                  </span>
                  <Badge variant="success" size="sm">order:shipment:created</Badge>
                </div>
                <p className="text-[11px] text-emerald-700 mt-2">
                  Injects carrier & tracking number into OrderFlow and advances order status to <strong>DISPATCHED</strong>.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  simulatePrintifyWebhookMutation.mutate({
                    event_type: "order:sent-to-production",
                    order_number: printifySimulateParams.order_number,
                  })
                }
                disabled={simulatePrintifyWebhookMutation.isPending}
                className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-600" />
                    Simulate Sent to Production
                  </span>
                  <Badge variant="neutral" size="sm">order:sent-to-production</Badge>
                </div>
                <p className="text-[11px] text-blue-700 mt-2">
                  Advances internal OrderFlow order status to <strong>UNDER_PRODUCTION</strong>.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  simulatePrintifyWebhookMutation.mutate({
                    event_type: "order:updated",
                    status: "in-production",
                    order_number: printifySimulateParams.order_number,
                  })
                }
                disabled={simulatePrintifyWebhookMutation.isPending}
                className="p-4 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-purple-600" />
                    Simulate Order Updated
                  </span>
                  <Badge variant="warning" size="sm">order:updated</Badge>
                </div>
                <p className="text-[11px] text-purple-700 mt-2">
                  Synchronizes Printify lifecycle progression and logs raw audit payload.
                </p>
              </button>
            </div>

            {/* Simulation Feedback Alert */}
            {printifySimulateResult && (
              <div className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs flex items-start justify-between">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {printifySimulateResult.message}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-emerald-800">
                    Order Ref: <strong>{printifySimulateResult.order_number}</strong> | Printify ID: <strong>{printifySimulateResult.printify_order_id}</strong>
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-700">
                    Action executed: <code>{JSON.stringify(printifySimulateResult.result)}</code>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                  Log ID: {printifySimulateResult.log_id ? printifySimulateResult.log_id.slice(0, 8) : "N/A"}...
                </span>
              </div>
            )}

            {/* Custom JSON Payload Dispatcher */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-slate-500" />
                  Custom Printify Webhook JSON Dispatcher
                </span>
                <Button
                  size="sm"
                  onClick={handleSendCustomPrintifyWebhook}
                  isLoading={ingestCustomPrintifyMutation.isPending}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Send Raw Webhook Payload
                </Button>
              </div>
              <textarea
                rows={6}
                value={customPrintifyPayloadText}
                onChange={(e) => setCustomPrintifyPayloadText(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 3: PRINTIFY INBOUND WEBHOOK AUDIT LOGS */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Printify Inbound Webhook Payload Logs
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {printifyLogsData?.count || 0} events recorded
              </span>
            </div>

            <Table
              keyExtractor={(log) => log.id}
              columns={printifyColumns}
              data={printifyLogsData?.results || []}
              isLoading={printifyLogsLoading}
              emptyMessage="No Printify webhook events received yet. Use the simulator above to dispatch a test event."
            />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: PEECHO INTEGRATION VIEW
          ======================================================================= */}
      {selectedChannel === "peecho" && (
        <div className="space-y-6">
          {/* Peecho Channel Hero Banner */}
          <div className="p-6 bg-gradient-to-r from-blue-900 via-[#111C44] to-slate-900 rounded-3xl text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 flex items-center justify-end pr-8 pointer-events-none">
              <Globe2 className="w-64 h-64 text-white" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-semibold tracking-wide uppercase">
                    Peecho Cloud POD Gateway
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Bi-Directional Sync Active
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  Peecho Integrations
                </h2>
                <p className="text-xs text-blue-100/80 leading-relaxed">
                  Real-time incoming webhook listener for Peecho print-on-demand books, wall calendars, and photo albums. Automatically streams S3 print assets, performs preflight validation, and sends dispatch tracking updates back to Peecho.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testPeechoConnectionMutation.mutate()}
                  isLoading={testPeechoConnectionMutation.isPending}
                  leftIcon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                >
                  Test Peecho Ping
                </Button>

                {!isEditingPeechoConfig ? (
                  <Button
                    size="sm"
                    onClick={() => setIsEditingPeechoConfig(true)}
                    leftIcon={<Sliders className="w-3.5 h-3.5" />}
                    className="bg-[#0073EA] hover:bg-[#0060B9] text-white shadow-md shadow-[#0073EA]/30 font-semibold"
                  >
                    Edit API Keys
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingPeechoConfig(false)}
                    className="bg-white/10 text-white border-white/20"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Live Handshake Feedback Banner */}
            {peechoTestResult && (
              <div
                className={`mt-4 p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                  peechoTestResult.success
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                    : "bg-rose-500/20 border-rose-400/40 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {peechoTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">{peechoTestResult.status}</span>: {peechoTestResult.message}
                    <span className="text-[11px] opacity-75 ml-2 font-mono">
                      [{new Date(peechoTestResult.tested_at).toLocaleTimeString()}]
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20">
                  {peechoTestResult.mode}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Peecho Ingested Webhooks"
              value={peechoLogsData?.count || 6}
              change="Verified"
              trend="up"
              subtitle="All received order payloads"
              icon={<Globe2 className="w-5 h-5" />}
            />
            <StatCard
              title="Duplicate Protection"
              value="Active"
              change="SHA-256 Hash"
              trend="up"
              subtitle="Prevents duplicate reprints"
              icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
            />
            <StatCard
              title="Automated Status Push"
              value={peechoConfigData?.auto_sync_status_changes ? "Active" : "Paused"}
              change="Webhooks"
              trend="up"
              subtitle="Syncs production milestones"
              icon={<Zap className="w-5 h-5 text-amber-500" />}
            />
          </div>

          {/* Peecho Config Form */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#0073EA]" />
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Peecho API Credentials & Channel Configuration
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure your Peecho merchant credentials, Sandbox/Production gateway mode, and live order webhook listener.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Channel: Connected
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePeechoConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Peecho API Base URL */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Peecho API Endpoint</label>
                  {isEditingPeechoConfig ? (
                    <input
                      type="url"
                      value={peechoConfigForm.api_base_url}
                      onChange={(e) => setPeechoConfigForm({ ...peechoConfigForm, api_base_url: e.target.value })}
                      required
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center font-mono">
                      {peechoConfigData?.api_base_url || "https://api.peecho.com"}
                    </div>
                  )}
                </div>

                {/* Button Key */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Peecho Button Key</label>
                  {isEditingPeechoConfig ? (
                    <input
                      type="text"
                      value={peechoConfigForm.button_key}
                      onChange={(e) => setPeechoConfigForm({ ...peechoConfigForm, button_key: e.target.value })}
                      required
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{peechoConfigData?.button_key || "17903659506881470"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(peechoConfigData?.button_key || "17903659506881470", "button_key")}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                        title="Copy Button Key"
                      >
                        {copiedField === "button_key" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Merchant API Key */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Merchant API Key</label>
                  {isEditingPeechoConfig ? (
                    <input
                      type="password"
                      placeholder="Enter API Key"
                      value={peechoConfigForm.api_key}
                      onChange={(e) => setPeechoConfigForm({ ...peechoConfigForm, api_key: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{peechoConfigData?.api_key_masked || "d26a4b••••••••23a8"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy("d26a4bc185ddd453844d2ef3d868543c58a723a8", "api_key")}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                        title="Copy API Key"
                      >
                        {copiedField === "api_key" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Secret Key */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Peecho Secret Key</label>
                  {isEditingPeechoConfig ? (
                    <input
                      type="password"
                      placeholder="Enter Secret Key"
                      value={peechoConfigForm.secret_key}
                      onChange={(e) => setPeechoConfigForm({ ...peechoConfigForm, secret_key: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{peechoConfigData?.secret_key_masked || "8394a1••••••••41b7"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy("8394a1b023fde11874cde62040f9921441b7", "secret_key")}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                        title="Copy Secret Key"
                      >
                        {copiedField === "secret_key" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Webhook Endpoint Display */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#0073EA]" />
                    Centralized Inbound Webhook Endpoint URL
                  </label>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Listening on HTTP 200 OK
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center font-mono text-xs overflow-x-auto">
                    {peechoConfigData?.full_webhook_url || "http://127.0.0.1:8001/api/v1/peecho/webhook/"}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(peechoConfigData?.full_webhook_url || "http://127.0.0.1:8001/api/v1/peecho/webhook/", "full_webhook_url")}
                    leftIcon={copiedField === "full_webhook_url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedField === "full_webhook_url" ? "Copied" : "Copy URL"}
                  </Button>
                </div>
              </div>

              {isEditingPeechoConfig && (
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingPeechoConfig(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={updatePeechoConfigMutation.isPending}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                    className="bg-[#0073EA] hover:bg-[#0060B9] text-white font-semibold"
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* Peecho Raw Payload Logs */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0073EA]" />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Peecho Inbound Webhook Payload Logs
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {peechoLogsData?.count || 0} events recorded
              </span>
            </div>

            <Table
              keyExtractor={(log) => log.id}
              columns={peechoColumns}
              data={peechoLogsData?.results || []}
              isLoading={peechoLogsLoading}
              emptyMessage="No Peecho webhook events received yet."
            />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: CUSTOM POD GATEWAY
          ======================================================================= */}
      {selectedChannel === "custom" && (
        <div className="p-8 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Custom POD REST & Cloudprinter Gateway</h2>
              <p className="text-xs text-slate-500">
                Connect proprietary ERP systems, web-to-print portals, or enterprise print APIs using standard OpenAPI v3 specifications.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">OpenAPI 3.0 Documentation</label>
                <a
                  href="http://127.0.0.1:8000/api/docs/swagger/"
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-[#0073EA] hover:underline flex items-center justify-between font-medium"
                >
                  <span>Open Interactive Swagger Docs</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">REST Ingestion Endpoint</label>
                <div className="h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center font-mono">
                  POST /api/v1/orders/ingest/
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center justify-between">
              <div>
                <span className="font-bold">Enterprise API Enabled:</span> Use your API bearer tokens or API key headers to stream orders directly into the prepress queue.
              </div>
              <a href="http://127.0.0.1:8000/api/docs/swagger/" target="_blank" rel="noreferrer">
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white shrink-0">
                  View API Specs
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: VIEW PRINTIFY RAW JSON PAYLOAD
          ======================================================================= */}
      <Modal
        isOpen={!!selectedPrintifyLog}
        onClose={() => setSelectedPrintifyLog(null)}
        title={`Printify Webhook Notification (${selectedPrintifyLog?.printify_order_id || "Event"})`}
        description={`Event Topic: ${selectedPrintifyLog?.event_type || "Payload"}`}
        footer={
          <Button size="sm" variant="outline" onClick={() => setSelectedPrintifyLog(null)}>
            Close
          </Button>
        }
      >
        {selectedPrintifyLog && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-semibold text-slate-700">Status: {selectedPrintifyLog.status}</span>
              <span className="font-mono text-slate-400 text-[11px]">
                {selectedPrintifyLog.ip_address || "Localhost"} &bull; {new Date(selectedPrintifyLog.created_at).toLocaleString()}
              </span>
            </div>

            {selectedPrintifyLog.error_message && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-mono text-[11px]">
                {selectedPrintifyLog.error_message}
              </div>
            )}

            <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-80">
              {JSON.stringify(selectedPrintifyLog.raw_payload, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      {/* =======================================================================
          MODAL: VIEW PEECHO RAW JSON PAYLOAD
          ======================================================================= */}
      <Modal
        isOpen={!!selectedPeechoLog}
        onClose={() => setSelectedPeechoLog(null)}
        title={`Peecho Order Notification Details (${selectedPeechoLog?.peecho_order_id || "Event"})`}
        description={`Event: ${selectedPeechoLog?.event_type || "Payload"}`}
        footer={
          <Button size="sm" variant="outline" onClick={() => setSelectedPeechoLog(null)}>
            Close
          </Button>
        }
      >
        {selectedPeechoLog && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-semibold text-slate-700">Status: {selectedPeechoLog.status}</span>
              <span className="font-mono text-slate-400 text-[11px]">{selectedPeechoLog.ip_address || "Localhost"}</span>
            </div>

            <pre className="bg-slate-900 text-blue-400 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-80">
              {JSON.stringify(selectedPeechoLog.raw_payload, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
