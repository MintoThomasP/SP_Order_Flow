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
} from "lucide-react";
import { ordersApi, PeechoPayloadLog, PeechoIntegrationConfig } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";

export default function PeechoGatewayPage() {
  const queryClient = useQueryClient();
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Peecho Connection & Settings
            </h1>
            <Badge variant="primary" size="sm">Integration</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Peecho API keys, test connection settings, and view incoming order notifications.
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
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Notifications"
          value={logsData?.count || 6}
          change="Captured"
          trend="up"
          subtitle="All received webhooks"
          icon={<Globe2 className="w-5 h-5" />}
        />
        <StatCard
          title="Duplicate Protection"
          value="Active"
          change="Safe Ingestion"
          trend="up"
          subtitle="Prevents duplicate orders"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Status Sync"
          value={configData?.auto_sync_status_changes ? "Active" : "Paused"}
          change="Auto Push"
          trend="up"
          subtitle="Sends status to Peecho"
          icon={<Zap className="w-5 h-5 text-amber-500" />}
        />
      </div>

      {/* SECTION 1: CENTRALIZED INTEGRATION SETTINGS ADMIN PANEL */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#0073EA]" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                API Keys & Connection Settings
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your Peecho API credentials and webhook address.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => testConnectionMutation.mutate()}
              isLoading={testConnectionMutation.isPending}
              leftIcon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
            >
              Test Connection
            </Button>

            {!isEditingConfig ? (
              <Button
                size="sm"
                onClick={() => setIsEditingConfig(true)}
                leftIcon={<Sliders className="w-3.5 h-3.5" />}
              >
                Edit Keys
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingConfig(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Live Handshake Feedback Banner */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
              testResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div>
                <span className="font-bold">{testResult.status}</span>: {testResult.message}
                <span className="text-[11px] opacity-75 ml-2 font-mono">
                  [{new Date(testResult.tested_at).toLocaleTimeString()}]
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/70 border border-current">
              {testResult.mode}
            </span>
          </div>
        )}

        {/* Config Form / Display */}
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Peecho API Base URL */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Peecho API URL</label>
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
              <label className="font-semibold text-slate-700">Button Key</label>
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
              <label className="font-semibold text-slate-700">API Key</label>
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
              <label className="font-semibold text-slate-700">Secret Key</label>
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
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 block">Webhook URL</span>
                <span className="text-[11px] text-slate-500">Paste this URL in your Peecho dashboard to receive order events:</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-mono text-xs text-[#0073EA] font-semibold select-all">
                  {liveWebhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(liveWebhookUrl, "webhook_url")}
                  className="p-1.5 bg-white border border-blue-200 rounded-lg text-[#0073EA] hover:bg-blue-50 font-semibold flex items-center gap-1"
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
                  Sandbox Test Mode (Safe test mode without real charges)
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
                Save Settings
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
            title="Order Notification Logs"
            subtitle="Live record of all incoming orders and messages from Peecho."
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
            title="Send Test Order"
            subtitle="Send a sample order payload to test the connection."
          >
            <div className="space-y-3 text-xs">
              <textarea
                value={customPayloadText}
                onChange={(e) => setCustomPayloadText(e.target.value)}
                rows={14}
                className="w-full bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#0073EA]/30"
              />

              <Button
                className="w-full"
                isLoading={ingestCustomMutation.isPending}
                onClick={handleSendCustomWebhook}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Send Test Order
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* MODAL: VIEW RAW JSON PAYLOAD */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Order Notification Details (${selectedLog?.peecho_order_id || "Event"})`}
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
