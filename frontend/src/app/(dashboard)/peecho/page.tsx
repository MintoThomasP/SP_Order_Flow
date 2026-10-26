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
  ShoppingBag,
  Cpu,
  Server,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { ordersApi, PeechoPayloadLog, PeechoIntegrationConfig } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";

export default function PODIntegrationsPage() {
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<"peecho" | "shopify" | "custom">("peecho");
  const [selectedLog, setSelectedLog] = useState<PeechoPayloadLog | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: string;
    mode?: string;
    message: string;
    tested_at: string;
    endpoint?: string;
  } | null>(null);

  // Editable Config State
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    api_base_url: "https://api.peecho.com",
    button_key: "17903659506881470",
    api_key: "",
    secret_key: "",
    webhook_secret: "",
    is_sandbox: true,
    auto_sync_status_changes: true,
  });

  const [customPayloadText, setCustomPayloadText] = useState(
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

  // Queries
  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ["peecho-config"],
    queryFn: () => ordersApi.getPeechoConfig(),
  });

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["peecho-logs"],
    queryFn: () => ordersApi.getPeechoPayloadLogs(),
    refetchInterval: 6000,
  });

  // Sync state when config loads
  useEffect(() => {
    if (configData) {
      setConfigForm({
        api_base_url: configData.api_base_url || "https://api.peecho.com",
        button_key: configData.button_key || "17903659506881470",
        api_key: "",
        secret_key: "",
        webhook_secret: "",
        is_sandbox: configData.is_sandbox ?? true,
        auto_sync_status_changes: configData.auto_sync_status_changes ?? true,
      });
    }
  }, [configData]);

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<PeechoIntegrationConfig>) => ordersApi.updatePeechoConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peecho-config"] });
      setIsEditingConfig(false);
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: () => ordersApi.testPeechoConnection(),
    onSuccess: (data) => {
      setTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["peecho-config"] });
    },
  });

  const ingestCustomMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => ordersApi.ingestPeechoWebhook(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peecho-logs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {
      api_base_url: configForm.api_base_url.trim(),
      button_key: configForm.button_key.trim(),
      is_sandbox: configForm.is_sandbox,
      auto_sync_status_changes: configForm.auto_sync_status_changes,
    };
    if (configForm.api_key.trim()) payload.api_key = configForm.api_key.trim();
    if (configForm.secret_key.trim()) payload.secret_key = configForm.secret_key.trim();
    if (configForm.webhook_secret.trim()) payload.webhook_secret = configForm.webhook_secret.trim();

    updateConfigMutation.mutate(payload);
  };

  const handleSendCustomWebhook = () => {
    try {
      const parsed = JSON.parse(customPayloadText);
      ingestCustomMutation.mutate(parsed);
    } catch (e: any) {
      alert("Invalid JSON format: " + e.message);
    }
  };

  const liveWebhookUrl = configData?.full_webhook_url || "http://127.0.0.1:8001/api/v1/peecho/webhook/";

  const columns: Column<PeechoPayloadLog>[] = [
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
          onClick={() => setSelectedLog(log)}
        >
          View JSON
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              POD Integrations
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#0073EA] border border-blue-200">
              <Globe2 className="w-3.5 h-3.5" />
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
              refetchConfig();
              refetchLogs();
            }}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* POD Channels Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Channel 1: Peecho (Primary / Active) */}
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
                <span className="text-[11px] text-slate-500">Global Cloud Print API Gateway</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Webhook: <strong className="text-slate-700 font-mono">/api/v1/peecho/</strong></span>
            <span className="text-[#0073EA] font-semibold">{logsData?.count || 6} orders synced</span>
          </div>
        </button>

        {/* Channel 2: Shopify POD */}
        <button
          type="button"
          onClick={() => setSelectedChannel("shopify")}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            selectedChannel === "shopify"
              ? "bg-white border-[#0073EA] shadow-md shadow-[#0073EA]/10 ring-2 ring-[#0073EA]/20"
              : "bg-white/80 border-slate-200/80 hover:border-slate-300 hover:bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Shopify POD Store</h3>
                <span className="text-[11px] text-slate-500">E-Commerce Merchant Webhook</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
              Modular
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Protocol: <strong className="text-slate-700 font-mono">REST Webhook</strong></span>
            <span className="text-slate-400">Ready to Bind</span>
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
                <span className="text-[11px] text-slate-500">Cloudprinter / Custom ERP</span>
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

      {/* TAB 1: PEECHO INTEGRATION VIEW (PRIMARY) */}
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
                    Primary Production Channel
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
                  onClick={() => testConnectionMutation.mutate()}
                  isLoading={testConnectionMutation.isPending}
                  leftIcon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                >
                  Test Peecho Ping
                </Button>

                {!isEditingConfig ? (
                  <Button
                    size="sm"
                    onClick={() => setIsEditingConfig(true)}
                    leftIcon={<Sliders className="w-3.5 h-3.5" />}
                    className="bg-[#0073EA] hover:bg-[#0060B9] text-white shadow-md shadow-[#0073EA]/30 font-semibold"
                  >
                    Edit API Keys
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingConfig(false)}
                    className="bg-white/10 text-white border-white/20"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Live Handshake Feedback Banner */}
            {testResult && (
              <div
                className={`mt-4 p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                  testResult.success
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                    : "bg-rose-500/20 border-rose-400/40 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">{testResult.status}</span>: {testResult.message}
                    <span className="text-[11px] opacity-75 ml-2 font-mono">
                      [{new Date(testResult.tested_at).toLocaleTimeString()}]
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20">
                  {testResult.mode}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Peecho Ingested Webhooks"
              value={logsData?.count || 6}
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
              value={configData?.auto_sync_status_changes ? "Active" : "Paused"}
              change="Webhooks"
              trend="up"
              subtitle="Syncs production milestones"
              icon={<Zap className="w-5 h-5 text-amber-500" />}
            />
          </div>

          {/* SECTION 1: PEECHO API KEYS & CONNECTION SETTINGS */}
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

            {/* Config Form / Display */}
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Peecho API Base URL */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Peecho API Endpoint</label>
                  {isEditingConfig ? (
                    <input
                      type="url"
                      value={configForm.api_base_url}
                      onChange={(e) => setConfigForm({ ...configForm, api_base_url: e.target.value })}
                      required
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center font-mono">
                      {configData?.api_base_url || "https://api.peecho.com"}
                    </div>
                  )}
                </div>

                {/* Button Key */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Peecho Button Key</label>
                  {isEditingConfig ? (
                    <input
                      type="text"
                      value={configForm.button_key}
                      onChange={(e) => setConfigForm({ ...configForm, button_key: e.target.value })}
                      required
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{configData?.button_key || "17903659506881470"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(configData?.button_key || "17903659506881470", "button_key")}
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
                  {isEditingConfig ? (
                    <input
                      type="password"
                      placeholder="Enter API Key"
                      value={configForm.api_key}
                      onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{configData?.api_key_masked || "d26a4b••••••••23a8"}</span>
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
                  {isEditingConfig ? (
                    <input
                      type="password"
                      placeholder="Enter Secret Key"
                      value={configForm.secret_key}
                      onChange={(e) => setConfigForm({ ...configForm, secret_key: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                    />
                  ) : (
                    <div className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between font-mono">
                      <span>{configData?.secret_key_masked || "62115a••••••••996b"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy("62115a908bc3de41628dde0642f1c6590595996b", "secret_key")}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                        title="Copy Secret Key"
                      >
                        {copiedField === "secret_key" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Webhook Endpoint & Secret Bar */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 block">Peecho Webhook Endpoint</span>
                    <span className="text-[11px] text-slate-500">Provide this URL in your Peecho Dashboard & Webhook Settings:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-mono text-xs text-[#0073EA] font-semibold select-all">
                      {liveWebhookUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(liveWebhookUrl, "webhook_url")}
                      className="p-1.5 bg-white border border-blue-200 rounded-lg text-[#0073EA] hover:bg-blue-50 font-semibold flex items-center gap-1 shadow-xs"
                      title="Copy Full Webhook URL"
                    >
                      {copiedField === "webhook_url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy URL</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-blue-100/80">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configForm.auto_sync_status_changes}
                      disabled={!isEditingConfig}
                      onChange={(e) => setConfigForm({ ...configForm, auto_sync_status_changes: e.target.checked })}
                      className="w-4 h-4 rounded text-[#0073EA]"
                    />
                    <span className="text-slate-700 font-medium">
                      Automatically send status updates back to Peecho
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configForm.is_sandbox}
                      disabled={!isEditingConfig}
                      onChange={(e) => setConfigForm({ ...configForm, is_sandbox: e.target.checked })}
                      className="w-4 h-4 rounded text-[#0073EA]"
                    />
                    <span className="text-slate-700 font-medium">
                      Sandbox Test Mode (Safe test mode without billing)
                    </span>
                  </label>
                </div>
              </div>

              {isEditingConfig && (
                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={updateConfigMutation.isPending}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                    className="bg-[#0073EA] hover:bg-[#0060B9] text-white"
                  >
                    Save Peecho Settings
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* SECTION 2: WEBHOOK PAYLOAD STREAMS & TEST DISPATCHER */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Ingested Payloads Table */}
            <div className="lg:col-span-2 space-y-4">
              <Card
                title="Peecho Ingestion & Notification Logs"
                subtitle="Live record of all incoming orders and status messages from Peecho."
                noPadding={true}
              >
                <Table
                  data={logsData?.results || []}
                  columns={columns}
                  keyExtractor={(log) => log.id}
                  isLoading={logsLoading}
                />
              </Card>
            </div>

            {/* Right 1 Col: Test Webhook Sender */}
            <div className="space-y-4">
              <Card
                title="Send Test Peecho Order"
                subtitle="Simulate an incoming order.created webhook payload directly to the portal."
              >
                <div className="space-y-3 text-xs">
                  <textarea
                    value={customPayloadText}
                    onChange={(e) => setCustomPayloadText(e.target.value)}
                    rows={14}
                    className="w-full bg-slate-900 text-emerald-400 p-3 rounded-2xl font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#0073EA]/30 leading-relaxed"
                  />

                  <Button
                    className="w-full bg-[#0073EA] hover:bg-[#0060B9] text-white font-semibold"
                    isLoading={ingestCustomMutation.isPending}
                    onClick={handleSendCustomWebhook}
                    leftIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    Simulate & Ingest Peecho Order
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SHOPIFY POD INTEGRATION (EXPANSION VIEW) */}
      {selectedChannel === "shopify" && (
        <div className="p-8 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Shopify Print-On-Demand Connector</h2>
              <p className="text-xs text-slate-500">
                Direct integration with Shopify Merchant stores for automatic line-item parsing, PDF artwork routing, and tracking fulfillment.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Shopify Webhook Callback URL</label>
                <div className="h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center font-mono">
                  http://127.0.0.1:8001/api/v1/orders/webhook/shopify/
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Order Trigger Topic</label>
                <div className="h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center font-mono">
                  orders/paid, orders/fulfilled
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
              <div>
                <span className="font-bold">Ready for Store Binding:</span> Create a custom App in your Shopify Admin and paste the Webhook URL above to start forwarding print orders to Silver Point POD.
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                Connect Shopify Store
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM REST POD GATEWAY */}
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

      {/* MODAL: VIEW RAW JSON PAYLOAD */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Peecho Order Notification Details (${selectedLog?.peecho_order_id || "Event"})`}
        description={`Event: ${selectedLog?.event_type || "Payload"}`}
        footer={
          <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
            Close
          </Button>
        }
      >
        {selectedLog && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-semibold text-slate-700">Status: {selectedLog.status}</span>
              <span className="font-mono text-slate-400 text-[11px]">{selectedLog.ip_address || "Localhost"}</span>
            </div>

            <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-80">
              {JSON.stringify(selectedLog.raw_payload, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
