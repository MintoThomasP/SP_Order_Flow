"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Key,
  Plus,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Activity,
  Power,
  FileDown,
} from "lucide-react";
import { ordersApi, ServiceProviderChannel } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/context/notification-context";

export function ProviderChannelsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({
    name: "",
    provider_code: "",
    default_currency: "USD",
    default_carrier: "DHL Express",
    require_hmac: false,
  });

  const [revealedCreds, setRevealedCreds] = useState<{
    title: string;
    provider_code: string;
    test_api_key?: string;
    live_api_key?: string;
    webhook_secret?: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pdfTargetChannel, setPdfTargetChannel] = useState<ServiceProviderChannel | null>(null);
  const [pdfIncludeTestKey, setPdfIncludeTestKey] = useState(true);
  const [pdfIncludeLiveKey, setPdfIncludeLiveKey] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const { data: channelsRaw, isLoading: loadingChannels, refetch: refetchChannels } = useQuery({
    queryKey: ["provider-channels"],
    queryFn: () => ordersApi.getProviderChannels(),
  });

  const channels: ServiceProviderChannel[] = Array.isArray(channelsRaw)
    ? channelsRaw
    : channelsRaw?.results || [];

  const { data: logsRaw, refetch: refetchLogs } = useQuery({
    queryKey: ["provider-ingestion-logs"],
    queryFn: () => ordersApi.getProviderIngestionLogs({ page: 1, page_size: 10 }),
  });

  const logs: any[] = Array.isArray(logsRaw) ? logsRaw : logsRaw?.results || [];

  const createMutation = useMutation({
    mutationFn: () =>
      ordersApi.createProviderChannel({
        ...newChannelForm,
        provider_code: newChannelForm.provider_code.trim().toUpperCase(),
      }),
    onSuccess: (res) => {
      setIsCreateOpen(false);
      setNewChannelForm({
        name: "",
        provider_code: "",
        default_currency: "USD",
        default_carrier: "DHL Express",
        require_hmac: false,
      });
      setRevealedCreds({
        title: `Channel "${res.channel.name}" Created`,
        provider_code: res.credentials.provider_code,
        test_api_key: res.credentials.test_api_key,
        live_api_key: res.credentials.live_api_key,
        webhook_secret: res.credentials.webhook_secret,
      });
      queryClient.invalidateQueries({ queryKey: ["provider-channels"] });
      toast.success("Channel Registered", `${res.channel.provider_code} is ready with Test & Production keys.`);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.provider_code?.[0] ||
        err?.response?.data?.message ||
        "Failed to create channel.";
      toast.error("Create Failed", msg);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      ordersApi.updateProviderChannel(id, { is_active }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["provider-channels"] });
      toast.success(
        updated.is_active ? "Channel Enabled" : "Channel Disabled",
        `${updated.provider_code} is now ${updated.is_active ? "active" : "inactive"}.`
      );
    },
  });

  const toggleHmacMutation = useMutation({
    mutationFn: ({ id, require_hmac }: { id: string; require_hmac: boolean }) =>
      ordersApi.updateProviderChannel(id, { require_hmac }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["provider-channels"] });
      toast.success(
        updated.require_hmac ? "HMAC Enabled" : "HMAC Disabled",
        `${updated.provider_code} ${updated.require_hmac ? "now requires" : "no longer requires"} X-Provider-Signature.`
      );
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: ({ id, environment }: { id: string; environment: "test" | "live" }) =>
      ordersApi.rotateProviderKey(id, environment),
    onSuccess: (res) => {
      setRevealedCreds({
        title: `${res.environment === "test" ? "Test / Sandbox" : "Production / Live"} Key Rotated`,
        provider_code: res.channel.provider_code,
        test_api_key: res.credentials.test_api_key,
        live_api_key: res.credentials.live_api_key,
      });
      queryClient.invalidateQueries({ queryKey: ["provider-channels"] });
      toast.success("API Key Rotated", `New ${res.environment} key generated for ${res.channel.provider_code}.`);
    },
  });

  const copyValue = (label: string, value?: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadPdf = async () => {
    if (!pdfTargetChannel) return;
    try {
      setIsDownloadingPdf(true);
      const blob = await ordersApi.downloadProviderDocumentationPdf(pdfTargetChannel.id, {
        include_test_key: pdfIncludeTestKey,
        include_production_key: pdfIncludeLiveKey,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfTargetChannel.provider_code}-api-integration-guide.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setPdfTargetChannel(null);
      toast.success("PDF Downloaded", `${pdfTargetChannel.provider_code}-api-integration-guide.pdf is ready.`);
    } catch {
      toast.error("Download Failed", "Could not generate the channel API guide PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Common Service Provider &amp; Channel Push API
              </h2>
              <p className="text-xs text-slate-500">
                Register external print partners with independent Test (<code>sp_test_...</code>) and Production (<code>sp_live_...</code>) API keys.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refetchChannels();
                refetchLogs();
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Register Channel
            </Button>
          </div>
        </div>

        {/* Endpoint Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-400 block">Inbound Order Push</span>
              <code className="font-mono text-slate-800 font-semibold">POST /api/v1/providers/orders/</code>
            </div>
            <Badge variant="info">Dual-Key Auth</Badge>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-400 block">Status &amp; Tracking Push</span>
              <code className="font-mono text-slate-800 font-semibold">POST /api/v1/providers/orders/status/</code>
            </div>
            <Badge variant="neutral">Idempotent</Badge>
          </div>
        </div>

        {/* Registered Channels List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Registered Channels ({channels.length})
          </h3>

          {loadingChannels ? (
            <div className="p-6 text-center text-xs text-slate-400">Loading channels...</div>
          ) : channels.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-700">No external channels registered yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Click &ldquo;Register Channel&rdquo; to create a partner profile and generate Test &amp; Production API keys.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{ch.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono text-[11px] font-bold">
                        {ch.provider_code}
                      </span>
                      <Badge variant={ch.is_active ? "success" : "danger"}>
                        {ch.is_active ? "Active" : "Disabled"}
                      </Badge>
                      {ch.require_hmac && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                          <ShieldCheck className="w-3 h-3" /> HMAC Required
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                      <span>Currency: <strong>{ch.default_currency}</strong></span>
                      <span>Carrier: <strong>{ch.default_carrier}</strong></span>
                      <span>Live Orders: <strong>{ch.live_orders_count}</strong></span>
                      <span>Test Orders: <strong>{ch.test_orders_count}</strong></span>
                    </div>
                  </div>

                  {/* Dual Key Status & Independent Rotation */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs">
                    <div className="px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-700 block">Test / Sandbox Key</span>
                        <code className="font-mono text-[11px] text-slate-700">
                          {ch.test_api_key_masked || "Not generated"}
                        </code>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rotateKeyMutation.mutate({ id: ch.id, environment: "test" })}
                        disabled={rotateKeyMutation.isPending}
                      >
                        <Key className="w-3 h-3 mr-1" />
                        Rotate
                      </Button>
                    </div>

                    <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-700 block">Production / Live Key</span>
                        <code className="font-mono text-[11px] text-slate-700">
                          {ch.live_api_key_masked || "Not generated"}
                        </code>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rotateKeyMutation.mutate({ id: ch.id, environment: "live" })}
                        disabled={rotateKeyMutation.isPending}
                      >
                        <Key className="w-3 h-3 mr-1" />
                        Rotate
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPdfIncludeTestKey(true);
                        setPdfIncludeLiveKey(false);
                        setPdfTargetChannel(ch);
                      }}
                    >
                      <FileDown className="w-3.5 h-3.5 mr-1" />
                      PDF Guide
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleHmacMutation.mutate({ id: ch.id, require_hmac: !ch.require_hmac })}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      {ch.require_hmac ? "Disable HMAC" : "Enable HMAC"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActiveMutation.mutate({ id: ch.id, is_active: !ch.is_active })}
                    >
                      <Power className="w-3.5 h-3.5 mr-1" />
                      {ch.is_active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Provider Ingestion Logs */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Recent Channel Ingestion Logs
          </h3>
          <span className="text-[11px] text-slate-400">Latest 10 push events</span>
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">No provider push logs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">External Order ID</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Env</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">HTTP</th>
                  <th className="py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono font-semibold text-slate-800">{log.provider_code || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-slate-700">{log.external_order_id || "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{log.event_type}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={log.is_sandbox ? "warning" : "success"}>
                        {log.is_sandbox ? "SANDBOX" : "LIVE"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 font-semibold">{log.status}</td>
                    <td className="py-2 pr-3 font-mono">{log.http_status}</td>
                    <td className="py-2 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Register New Channel */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register External Channel"
        description="Creates a new service provider profile and generates Test (sp_test_...) and Production (sp_live_...) API keys."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newChannelForm.name.trim() || !newChannelForm.provider_code.trim()}
            >
              {createMutation.isPending ? "Creating..." : "Create & Generate Keys"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Channel Name</label>
            <input
              type="text"
              placeholder="e.g. PrintEmirates"
              value={newChannelForm.name}
              onChange={(e) => setNewChannelForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Provider Code (uppercase slug)</label>
            <input
              type="text"
              placeholder="e.g. PRINTEMIRATES"
              value={newChannelForm.provider_code}
              onChange={(e) => setNewChannelForm((p) => ({ ...p, provider_code: e.target.value.toUpperCase() }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono uppercase focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Default Currency</label>
              <input
                type="text"
                value={newChannelForm.default_currency}
                onChange={(e) => setNewChannelForm((p) => ({ ...p, default_currency: e.target.value.toUpperCase() }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono uppercase"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Default Carrier</label>
              <input
                type="text"
                value={newChannelForm.default_carrier}
                onChange={(e) => setNewChannelForm((p) => ({ ...p, default_carrier: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={newChannelForm.require_hmac}
              onChange={(e) => setNewChannelForm((p) => ({ ...p, require_hmac: e.target.checked }))}
            />
            <span className="text-slate-700 font-medium">Require HMAC-SHA256 signature (X-Provider-Signature)</span>
          </label>
        </div>
      </Modal>

      {/* Modal: One-Time Credentials Reveal */}
      <Modal
        isOpen={!!revealedCreds}
        onClose={() => setRevealedCreds(null)}
        title={revealedCreds?.title || "Generated API Credentials"}
        description="Copy and store these keys securely now. For security, raw keys are hashed in the database and will not be shown again."
        footer={
          <Button size="sm" onClick={() => setRevealedCreds(null)}>
            I Have Saved These Keys
          </Button>
        }
      >
        {revealedCreds && (
          <div className="space-y-3 text-xs">
            {revealedCreds.test_api_key && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-800">Test / Sandbox API Key (routes to TEST_ORDER)</span>
                  <button
                    type="button"
                    onClick={() => copyValue("test", revealedCreds.test_api_key)}
                    className="inline-flex items-center gap-1 text-amber-800 font-semibold hover:underline"
                  >
                    {copiedKey === "test" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === "test" ? "Copied" : "Copy"}
                  </button>
                </div>
                <code className="block font-mono text-[11px] break-all text-slate-900">
                  {revealedCreds.test_api_key}
                </code>
              </div>
            )}

            {revealedCreds.live_api_key && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800">Production / Live API Key (routes to RECEIVED)</span>
                  <button
                    type="button"
                    onClick={() => copyValue("live", revealedCreds.live_api_key)}
                    className="inline-flex items-center gap-1 text-emerald-800 font-semibold hover:underline"
                  >
                    {copiedKey === "live" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === "live" ? "Copied" : "Copy"}
                  </button>
                </div>
                <code className="block font-mono text-[11px] break-all text-slate-900">
                  {revealedCreds.live_api_key}
                </code>
              </div>
            )}

            {revealedCreds.webhook_secret && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">HMAC Webhook Secret (X-Provider-Signature)</span>
                  <button
                    type="button"
                    onClick={() => copyValue("hmac", revealedCreds.webhook_secret)}
                    className="inline-flex items-center gap-1 text-slate-700 font-semibold hover:underline"
                  >
                    {copiedKey === "hmac" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === "hmac" ? "Copied" : "Copy"}
                  </button>
                </div>
                <code className="block font-mono text-[11px] break-all text-slate-900">
                  {revealedCreds.webhook_secret}
                </code>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Download Channel API Guide PDF */}
      <Modal
        isOpen={!!pdfTargetChannel}
        onClose={() => setPdfTargetChannel(null)}
        title={`Export API Guide PDF — ${pdfTargetChannel?.provider_code || ""}`}
        description="Generate a partner-ready API & Implementation Guide PDF tailored for this channel."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setPdfTargetChannel(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
            </Button>
          </div>
        }
      >
        {pdfTargetChannel && (
          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pdfIncludeTestKey}
                onChange={(e) => setPdfIncludeTestKey(e.target.checked)}
              />
              <div>
                <span className="font-bold text-amber-800 block">Include Test / Sandbox API Key (sp_test_...)</span>
                <span className="text-slate-600">Allows the partner to immediately run sandbox tests (TEST_ORDER).</span>
                {!pdfTargetChannel.has_encrypted_test_key && (
                  <span className="text-amber-700 font-semibold block mt-1">
                    Note: Created before encrypted storage — click &ldquo;Rotate&rdquo; on the Test key first to embed the full key.
                  </span>
                )}
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pdfIncludeLiveKey}
                onChange={(e) => setPdfIncludeLiveKey(e.target.checked)}
              />
              <div>
                <span className="font-bold text-emerald-800 block">Include Production / Live API Key (sp_live_...)</span>
                <span className="text-slate-600">Embeds the live production key. Only share this PDF over a secure channel.</span>
                {!pdfTargetChannel.has_encrypted_live_key && (
                  <span className="text-amber-700 font-semibold block mt-1">
                    Note: Created before encrypted storage — click &ldquo;Rotate&rdquo; on the Production key first to embed the full key.
                  </span>
                )}
              </div>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

