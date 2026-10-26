"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Printer,
  FileCode2,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  QrCode,
  Sliders,
  Ruler,
  Play,
  CheckCheck,
  Eye,
  FileText,
  Clock,
  Zap,
} from "lucide-react";
import { productionApi, ordersApi, ProductionBatch, Order } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";

export default function ProductionBatchingPage() {
  const queryClient = useQueryClient();

  // Modals & Selection
  const [isCompileModalOpen, setIsCompileModalOpen] = useState(false);
  const [selectedBatchForTicket, setSelectedBatchForTicket] = useState<ProductionBatch | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Compiler Form State
  const [batchForm, setBatchForm] = useState({
    paper_stock: "200gsm Silk Inner + 350gsm Hardcover Gloss",
    size_format: "A4 Landscape (210 x 297 mm)",
    binding_type: "HARDCOVER_CASEBOUND",
    target_press: "HP_INDIGO_12000",
    priority: "RUSH",
    notes: "Imposition 4-up Work & Turn • Run on Press Pallet 1",
  });

  // Queries
  const { data: batchesData, isLoading: batchesLoading, refetch: refetchBatches } = useQuery({
    queryKey: ["production-batches"],
    queryFn: () => productionApi.getBatches(),
  });

  const { data: eligibleOrders, isLoading: eligibleLoading, refetch: refetchEligible } = useQuery({
    queryKey: ["eligible-orders"],
    queryFn: () => productionApi.getEligibleOrders(),
  });

  // Mutations
  const createBatchMutation = useMutation({
    mutationFn: (data: any) => productionApi.createBatch(data),
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: ["production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["eligible-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setIsCompileModalOpen(false);
      setSelectedOrderIds([]);
      setSelectedBatchForTicket(newBatch);
    },
  });

  const updateBatchStatusMutation = useMutation({
    mutationFn: ({ batchId, statusCode }: { batchId: string; statusCode: string }) =>
      productionApi.updateBatchStatus(batchId, statusCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOrders = () => {
    if (eligibleOrders) {
      if (selectedOrderIds.length === eligibleOrders.length) {
        setSelectedOrderIds([]);
      } else {
        setSelectedOrderIds(eligibleOrders.map((o) => o.id));
      }
    }
  };

  // Batches Table Columns
  const batchColumns: Column<ProductionBatch>[] = [
    {
      header: "Batch Number",
      cell: (b) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-[#0073EA]">
            {b.batch_number}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {new Date(b.created_at).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      header: "Print Machine",
      cell: (b) => (
        <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
          <Printer className="w-3.5 h-3.5 text-[#0073EA]" />
          <span>{b.press_label || b.target_press}</span>
        </div>
      ),
    },
    {
      header: "Paper & Binding",
      cell: (b) => (
        <div className="flex flex-col max-w-[200px]">
          <span className="text-xs font-semibold text-slate-800 truncate">{b.paper_stock}</span>
          <span className="text-[11px] text-slate-500">{b.binding_label || b.binding_type}</span>
        </div>
      ),
    },
    {
      header: "Quantity & Sheets",
      cell: (b) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-slate-800">
            {b.total_orders_count} Orders ({b.total_items_count} items)
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {b.total_sheets_count} Sheets
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (b) => {
        const st = b.status_details;
        return st ? (
          <Badge variant="custom" bgHex={st.badge_bg} textHex={st.badge_text} dot={true}>
            {st.name}
          </Badge>
        ) : (
          <Badge variant="primary">{b.status}</Badge>
        );
      },
    },
    {
      header: "Actions",
      cell: (b) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<QrCode className="w-3.5 h-3.5 text-[#0073EA]" />}
            onClick={() => setSelectedBatchForTicket(b)}
          >
            Job Ticket
          </Button>

          {b.status !== "COMPLETED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                updateBatchStatusMutation.mutate({
                  batchId: b.id,
                  statusCode: b.status === "PRINTING" ? "COMPLETED" : "PRINTING",
                })
              }
            >
              {b.status === "PRINTING" ? "Mark Complete" : "Send to Press"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Main Batch Compiler Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Print Batches & Job Tickets
            </h1>
            <Badge variant="primary" size="sm">Production</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Group approved print orders by paper type and print machine job tickets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              refetchBatches();
              refetchEligible();
            }}
          >
            Refresh
          </Button>

          <Button
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCompileModalOpen(true)}
            className="bg-[#0073EA] hover:bg-[#0060B9] shadow-sm shadow-blue-500/20"
          >
            Create Print Batch ({eligibleOrders?.length || 0} Ready)
          </Button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Batches"
          value={batchesData?.count || 1}
          change="In Production"
          trend="up"
          subtitle="Currently printing"
          icon={<Layers className="w-5 h-5" />}
        />
        <StatCard
          title="Ready for Batching"
          value={eligibleOrders?.length || 0}
          change="Approved Artwork"
          trend="neutral"
          subtitle="Waiting for press"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Scheduled Sheets"
          value="142 Sheets"
          change="Digital Press"
          trend="up"
          subtitle="Estimated time: 45m"
          icon={<Printer className="w-5 h-5 text-[#0073EA]" />}
        />
        <StatCard
          title="Job Tickets Ready"
          value="100%"
          change="Generated"
          trend="up"
          subtitle="Ready for operators"
          icon={<QrCode className="w-5 h-5 text-purple-600" />}
        />
      </div>

      {/* Production Batches List */}
      <Card
        title="Print Batches"
        subtitle="Active batches with job tickets for print operators."
        noPadding={true}
      >
        <Table
          data={batchesData?.results || []}
          columns={batchColumns}
          keyExtractor={(b) => b.id}
          isLoading={batchesLoading}
        />
      </Card>

      {/* MODAL 1: CREATE PRODUCTION BATCH */}
      <Modal
        isOpen={isCompileModalOpen}
        onClose={() => setIsCompileModalOpen(false)}
        title="Create Print Batch"
        description="Select approved orders and assign them to a print machine."
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCompileModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedOrderIds.length === 0}
              isLoading={createBatchMutation.isPending}
              onClick={() =>
                createBatchMutation.mutate({
                  ...batchForm,
                  order_ids: selectedOrderIds,
                })
              }
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Create Batch & Job Ticket ({selectedOrderIds.length} Selected)
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Step 1: Select Orders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0073EA]" />
                <span>Step 1: Select Orders to Include</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllOrders}
                className="text-xs text-[#0073EA] hover:underline font-medium cursor-pointer"
              >
                {selectedOrderIds.length === (eligibleOrders?.length || 0)
                  ? "Deselect All"
                  : "Select All Ready"}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
              {eligibleOrders && eligibleOrders.length > 0 ? (
                eligibleOrders.map((ord) => {
                  const isSelected = selectedOrderIds.includes(ord.id);
                  const firstItem = ord.items?.[0];

                  return (
                    <div
                      key={ord.id}
                      onClick={() => toggleSelectOrder(ord.id)}
                      className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50/60" : "hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-[#0073EA] pointer-events-none"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                            <span className="font-mono text-[11px] text-slate-400">[{ord.peecho_order_id}]</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {firstItem?.product_type} • {firstItem?.page_count}pp • Spine: {firstItem?.spine_width_mm}mm
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-semibold text-slate-700 block">
                          Qty: {ord.total_items_count}
                        </span>
                        <span className="text-[10px] text-[#0073EA] font-medium">{ord.sla_priority}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-400">
                  No approved orders waiting to be batched.
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Configure Press Specifications */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <label className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#0073EA]" />
              <span>Step 2: Print & Paper Settings</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Print Machine</label>
                <select
                  value={batchForm.target_press}
                  onChange={(e) => setBatchForm({ ...batchForm, target_press: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800"
                >
                  <option value="HP_INDIGO_12000">HP Indigo 12000 (B2 Sheetfed)</option>
                  <option value="CANON_VARIOPRINT">Canon varioPRINT iX3200 (Inkjet)</option>
                  <option value="HEIDELBERG_VERSAFIRE">Heidelberg Versafire EP</option>
                  <option value="EPSON_SURECOLOR">Epson SureColor P20000</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Binding Type</label>
                <select
                  value={batchForm.binding_type}
                  onChange={(e) => setBatchForm({ ...batchForm, binding_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800"
                >
                  <option value="HARDCOVER_CASEBOUND">Hardcover Casebound (3mm Greyboard)</option>
                  <option value="PUR_PERFECT_BOUND">Softcover PUR Perfect Bound</option>
                  <option value="WIRE_O_SPIRAL">Wire-O Spiral Bound</option>
                  <option value="SADDLE_STITCH">Saddle Stitch Booklet</option>
                  <option value="CANVAS_STRETCH">Canvas Gallery Wrap</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Paper Type & Weight</label>
                <input
                  type="text"
                  value={batchForm.paper_stock}
                  onChange={(e) => setBatchForm({ ...batchForm, paper_stock: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Paper / Sheet Size</label>
                <input
                  type="text"
                  value={batchForm.size_format}
                  onChange={(e) => setBatchForm({ ...batchForm, size_format: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-medium">Notes for Printer Operator</label>
              <input
                type="text"
                placeholder="e.g. Work & Turn imposition, load B2 pallet on Feeder 1..."
                value={batchForm.notes}
                onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: PRINT / PREVIEW QR JOB TICKET */}
      <Modal
        isOpen={!!selectedBatchForTicket}
        onClose={() => setSelectedBatchForTicket(null)}
        title={
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#0073EA]" />
            <span>Job Ticket • {selectedBatchForTicket?.batch_number}</span>
          </div>
        }
        description="Print ticket with batch details, paper specs, and order list for machine operators."
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedBatchForTicket(null)}
            >
              Close
            </Button>

            {selectedBatchForTicket && (
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1"}/production/batches/${selectedBatchForTicket.id}/download-ticket/`}
                target="_blank"
                rel="noreferrer"
                download={`${selectedBatchForTicket.batch_number}_job_ticket.pdf`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0073EA] hover:bg-[#0060B9] text-white rounded-lg font-semibold text-xs shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Job Ticket (PDF)</span>
              </a>
            )}
          </div>
        }
      >
        {selectedBatchForTicket && (
          <div className="space-y-4 text-xs">
            {/* Ticket Header Preview */}
            <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                  Print Job Ticket
                </span>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">
                  {selectedBatchForTicket.batch_number}
                </h3>
                <p className="text-slate-400 text-xs font-mono mt-1">
                  Machine: {selectedBatchForTicket.press_label || selectedBatchForTicket.target_press}
                </p>
              </div>

              {/* QR Code Graphic Indicator */}
              <div className="w-16 h-16 bg-white p-1 rounded-lg flex items-center justify-center shadow-md">
                <QrCode className="w-14 h-14 text-slate-900" />
              </div>
            </div>

            {/* Batch Specifications Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block font-sans">Paper Type:</span>
                <span className="font-semibold text-slate-900">{selectedBatchForTicket.paper_stock}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans">Sheet Size:</span>
                <span className="font-semibold text-slate-900">{selectedBatchForTicket.size_format}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans">Binding:</span>
                <span className="font-semibold text-slate-900">
                  {selectedBatchForTicket.binding_label || selectedBatchForTicket.binding_type}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans">Total Sheets:</span>
                <span className="font-bold text-[#0073EA]">
                  {selectedBatchForTicket.total_sheets_count} Sheets ({selectedBatchForTicket.total_orders_count} orders)
                </span>
              </div>
            </div>

            {/* Bundled Orders Table */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Orders in this Batch:</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {selectedBatchForTicket.orders?.map((ord) => (
                  <div key={ord.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                      <span className="text-slate-400 font-mono text-[11px] ml-2">[{ord.peecho_order_id}]</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {ord.items?.[0]?.product_type} • Qty: {ord.total_items_count} • Spine: {ord.items?.[0]?.spine_width_mm}mm
                      </p>
                    </div>

                    <span className="font-mono text-[10px] text-[#0073EA] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      Order #{ord.order_number}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
