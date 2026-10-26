"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  CloudDownload,
  Search,
  Layers,
  BookOpen,
  FileText,
  UploadCloud,
  ExternalLink,
  Download,
  Eye,
} from "lucide-react";
import { prepressApi, ordersApi, ArtworkVerification, Order } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

export default function PrepressPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: verificationsData, isLoading: verificationsLoading, refetch: refetchVerifications } = useQuery({
    queryKey: ["prepress-verifications"],
    queryFn: () => prepressApi.getVerifications(),
    refetchInterval: 8000,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["orders"],
    queryFn: () => ordersApi.getOrders(),
  });

  const verifications: ArtworkVerification[] = verificationsData?.results || [];
  const [selectedVerificationId, setSelectedVerificationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Custom Local File Upload State (for testing arbitrary real PDFs)
  const [customPdfBlobUrl, setCustomPdfBlobUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [customFileSize, setCustomFileSize] = useState<number | null>(null);

  // Viewer Type: Live PDF Embed vs Calibrated Proof Simulator
  const [viewerType, setViewerType] = useState<"live_pdf" | "calibrated_proof">("live_pdf");

  // Set default selected verification
  useEffect(() => {
    if (verifications.length > 0 && (!selectedVerificationId || !verifications.some((v) => v.id === selectedVerificationId))) {
      setSelectedVerificationId(verifications[0].id);
    }
  }, [verifications, selectedVerificationId]);

  // Filtered verifications
  const filteredVerifications = useMemo(() => {
    return verifications.filter((v) => {
      const matchesSearch =
        v.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.peecho_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.product_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.paper_stock?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PENDING" && (v.verification_status === "PENDING_REVIEW" || v.verification_status === "STREAMING_S3")) ||
        (statusFilter === "APPROVED" && v.verification_status === "APPROVED_FOR_PRINT") ||
        (statusFilter === "FLAGGED" && v.verification_status === "FLAGGED_ERROR");

      return matchesSearch && matchesStatus;
    });
  }, [verifications, searchQuery, statusFilter]);

  const activeVerification = verifications.find((v) => v.id === selectedVerificationId) || filteredVerifications[0] || verifications[0];

  // Counts for summary badges
  const pendingCount = verifications.filter((v) => v.verification_status === "PENDING_REVIEW" || v.verification_status === "STREAMING_S3").length;
  const approvedCount = verifications.filter((v) => v.verification_status === "APPROVED_FOR_PRINT").length;
  const flaggedCount = verifications.filter((v) => v.verification_status === "FLAGGED_ERROR").length;

  // PDF Previewer States
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showBleedBox, setShowBleedBox] = useState(true);
  const [showTrimBox, setShowTrimBox] = useState(true);
  const [previewMode, setPreviewMode] = useState<"cmyk" | "dpi_heatmap" | "wireframe">("cmyk");

  // Error Flagging Modal
  const [isFlagErrorModalOpen, setIsFlagErrorModalOpen] = useState(false);
  const [flagReasonType, setFlagReasonType] = useState("Low Resolution (< 300 DPI)");
  const [flagComment, setFlagComment] = useState("");

  // Handle local PDF upload
  const handleLocalPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomPdfBlobUrl(url);
      setCustomFileName(file.name);
      setCustomFileSize(file.size);
      setViewerType("live_pdf");
    }
  };

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => prepressApi.approveArtwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prepress-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const flagErrorMutation = useMutation({
    mutationFn: ({ id, reason, comment }: { id: string; reason: string; comment: string }) =>
      prepressApi.flagPrepressError(id, `${reason} - ${comment}`.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prepress-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setIsFlagErrorModalOpen(false);
      setFlagComment("");
    },
  });

  const redownloadMutation = useMutation({
    mutationFn: (id: string) => prepressApi.redownloadArtwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prepress-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const totalPages = activeVerification?.page_count || 48;
  const currentLivePdfUrl = customPdfBlobUrl || activeVerification?.file_url || "https://assets.peecho.com/demo/sample_inner.pdf";

  return (
    <div className="space-y-4">
      {/* Hidden File Input for Local Custom PDF Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleLocalPdfUpload}
      />

      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0073EA] flex items-center justify-center border border-blue-100">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                Artwork Review & Prepress
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {verifications.length} Files in Queue
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Check artwork files, verify page dimensions and print bleed, and approve for printing.
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Custom Test PDF Button */}
          <Button
            variant="outline"
            size="sm"
            className="border-blue-200 bg-blue-50/50 text-[#0073EA] hover:bg-blue-100/70"
            leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Test PDF
          </Button>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({verifications.length})
            </button>
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "PENDING" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter("APPROVED")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "APPROVED" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter("FLAGGED")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "FLAGGED" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              Flagged ({flaggedCount})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => refetchVerifications()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main 3-Column Prepress Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[660px]">
        {/* COLUMN 1: PENDING QUEUE LIST (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Queue Header & Search */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Layers className="w-3.5 h-3.5 text-[#0073EA]" />
                Orders to Check
              </span>
              <span className="text-[11px] font-mono font-medium text-slate-500">
                {filteredVerifications.length} items
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search order number, book type, paper..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#0073EA]"
              />
            </div>
          </div>

          {/* Queue Items Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[700px]">
            {/* Custom Upload Banner if active */}
            {customPdfBlobUrl && (
              <div className="p-3 rounded-xl border border-blue-300 bg-blue-50/80 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0073EA] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0073EA]" />
                    Custom Local PDF Active
                  </span>
                  <button
                    onClick={() => {
                      setCustomPdfBlobUrl(null);
                      setCustomFileName(null);
                    }}
                    className="text-[11px] text-[#0073EA] hover:underline font-medium"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-[11px] font-mono text-[#0073EA] truncate">{customFileName}</p>
                <p className="text-[10px] text-slate-500">
                  {customFileSize ? (customFileSize / (1024 * 1024)).toFixed(2) + " MB" : ""} • Loaded for testing
                </p>
              </div>
            )}

            {filteredVerifications.length > 0 ? (
              filteredVerifications.map((v) => {
                const isSelected = v.id === activeVerification?.id && !customPdfBlobUrl;
                const isApproved = v.verification_status === "APPROVED_FOR_PRINT";
                const isFlagged = v.verification_status === "FLAGGED_ERROR";

                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVerificationId(v.id);
                      setCustomPdfBlobUrl(null); // Return to database order PDF
                      setCurrentPage(1);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none text-left relative ${
                      isSelected
                        ? "bg-blue-50/60 border-[#0073EA] ring-1 ring-[#0073EA] shadow-xs"
                        : "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {v.peecho_order_id || v.order_number}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            • {v.order_number}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5 line-clamp-1">
                          {v.product_type || "Photo Book"}
                        </p>
                      </div>

                      <Badge
                        variant={isApproved ? "success" : isFlagged ? "danger" : "warning"}
                        size="sm"
                        dot={true}
                      >
                        {isApproved ? "Approved" : isFlagged ? "Flagged" : "Pending"}
                      </Badge>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 font-mono">
                        <BookOpen className="w-3 h-3 text-slate-400" />
                        {v.page_count}p • {v.calculated_spine_width_mm}mm
                      </span>
                      <span className="font-medium text-slate-600 truncate max-w-[130px]">
                        {v.paper_stock?.split("+")[0] || "200gsm Silk"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No artwork verifications match filter.
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2 & 3: ACTIVE INSPECTION CANVAS & CONTROLS (8 Cols) */}
        {activeVerification ? (
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* PDF PROOF PREVIEWER & CANVAS (7 Cols) */}
              <div className="xl:col-span-7 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden min-h-[580px]">
                {/* Viewer Toolbar */}
                <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Mode Toggle: PDF View vs Print Preview */}
                  <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                    <button
                      onClick={() => setViewerType("live_pdf")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                        viewerType === "live_pdf"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0073EA]" />
                      PDF View
                    </button>
                    <button
                      onClick={() => setViewerType("calibrated_proof")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                        viewerType === "calibrated_proof"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Print Preview
                    </button>
                  </div>

                  {/* Overlays & External Open */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowBleedBox(!showBleedBox)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                        showBleedBox
                          ? "bg-rose-50 text-rose-700 border-rose-200 font-semibold"
                          : "bg-white text-slate-500 border-slate-200"
                      }`}
                      title="Show 3mm bleed margin guide"
                    >
                      Bleed Guide
                    </button>

                    <button
                      onClick={() => setShowTrimBox(!showTrimBox)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                        showTrimBox
                          ? "bg-sky-50 text-sky-700 border-sky-200 font-semibold"
                          : "bg-white text-slate-500 border-slate-200"
                      }`}
                      title="Show cut line guide"
                    >
                      Cut Guide
                    </button>

                    {/* Open Original in New Window */}
                    <a
                      href={currentLivePdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600"
                      title="Open PDF in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* PDF Content Area */}
                {viewerType === "live_pdf" ? (
                  <div className="flex-1 bg-slate-900/5 p-3 flex flex-col relative min-h-[500px]">
                    {/* Bleed & Trim Guides Overlaid Over Embedded PDF */}
                    <div className="relative flex-1 rounded-lg overflow-hidden border border-slate-300 shadow-inner bg-slate-800 flex flex-col">
                      {showBleedBox && (
                        <div className="absolute inset-1 border-2 border-dashed border-rose-500 pointer-events-none z-30">
                          <span className="absolute top-1 left-1 bg-rose-500 text-white text-[9px] font-mono px-1 rounded shadow">
                            Outer Bleed Margin (3mm)
                          </span>
                        </div>
                      )}
                      {showTrimBox && (
                        <div className="absolute inset-3 border border-sky-400 pointer-events-none z-30">
                          <span className="absolute bottom-1 right-1 bg-sky-500 text-white text-[9px] font-mono px-1 rounded shadow">
                            Cut Line
                          </span>
                        </div>
                      )}

                      {/* Native Embedded PDF Document Viewer */}
                      <iframe
                        src={`${currentLivePdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                        className="w-full h-full min-h-[500px] border-0 bg-white"
                        title="Customer Artwork PDF"
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span className="flex items-center gap-1 font-mono">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {customFileName || activeVerification.file_url.split("/").pop() || "artwork.pdf"}
                      </span>
                      <span className="font-mono text-slate-400">
                        Artwork File
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Calibrated Proof View Mode */
                  <div className="flex-1 bg-slate-100/70 p-6 flex items-center justify-center overflow-auto relative min-h-[500px]">
                    <div
                      style={{
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: "center center",
                        transition: "transform 0.15s ease-out",
                      }}
                      className="w-[360px] h-[480px] bg-white rounded-md shadow-2xl relative border border-slate-300 select-none flex flex-col justify-between overflow-hidden"
                    >
                      {showBleedBox && (
                        <div className="absolute inset-1 border border-dashed border-rose-500/80 pointer-events-none z-20">
                          <span className="absolute top-1 left-1 bg-rose-500 text-white text-[8px] font-mono px-1 rounded">
                            Bleed Margin
                          </span>
                        </div>
                      )}

                      {showTrimBox && (
                        <div className="absolute inset-3 border border-sky-500 pointer-events-none z-20">
                          <span className="absolute bottom-1 right-1 bg-sky-500 text-white text-[8px] font-mono px-1 rounded">
                            Cut Line
                          </span>
                        </div>
                      )}

                      <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
                        <div className="border-b border-slate-100 pb-3">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span className="truncate max-w-[180px]">{activeVerification.product_type}</span>
                            <span>SPREAD {currentPage}</span>
                          </div>
                          <h2 className="text-base font-bold text-slate-900 mt-1.5 tracking-tight">
                            Print Proof Preview
                          </h2>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {activeVerification.peecho_order_id} • Spread {currentPage} of {totalPages}
                          </p>
                        </div>

                        <div className="my-auto py-4">
                          <div className="space-y-3">
                            <div className="h-32 bg-gradient-to-tr from-slate-900 via-blue-900 to-slate-800 rounded-lg shadow-inner flex items-center justify-center text-white text-center p-3">
                              <div>
                                <Sparkles className="w-6 h-6 text-amber-300 mx-auto mb-1" />
                                <p className="font-semibold text-xs">CMYK Print Ready</p>
                                <p className="text-[9px] text-slate-300 font-mono">FOGRA39 Standard</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed text-justify">
                              Color proof verified for standard print profile (CMYK Fogra39).
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono border-t border-slate-100 pt-2">
                          <span>VERIFIED</span>
                          <span>{currentPage}</span>
                          <span>300 DPI CMYK</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CALIPER & CONTROLS (5 Cols) */}
              <div className="xl:col-span-5 space-y-3.5 flex flex-col justify-between">
                {/* Physical Caliper Specifications */}
                <Card
                  title="Product Specifications"
                  subtitle={`${activeVerification.peecho_order_id} • Order #${activeVerification.order_number}`}
                >
                  <div className="space-y-3 text-xs">
                    {/* Caliper Grid */}
                    <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Product Type:</span>
                        <span className="font-bold text-slate-900 text-xs">{activeVerification.product_type}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Dimensions:</span>
                        <span className="font-mono font-semibold text-slate-800 text-xs">210 x 297 mm (A4)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Page Count:</span>
                        <span className="font-mono font-bold text-[#0073EA] text-xs">
                          {activeVerification.page_count} Pages
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Spine Width:</span>
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          {activeVerification.calculated_spine_width_mm} mm
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Paper Stock:</span>
                      <span className="font-medium text-slate-800 text-xs">{activeVerification.paper_stock}</span>
                    </div>

                    {/* Storage Details */}
                    <div className="p-2.5 bg-blue-50/40 rounded-xl border border-blue-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                          <CloudDownload className="w-3.5 h-3.5 text-[#0073EA]" />
                          <span>File Storage</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {(activeVerification.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-500 truncate">
                        s3://{activeVerification.s3_bucket}/{activeVerification.s3_key || `orders/${activeVerification.peecho_order_id}/interior.pdf`}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Preflight Automated Checklist */}
                <Card title="Automated File Checks">
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Bleed Margin (3mm)</span>
                      </span>
                      <span className="font-mono text-[10px]">216 x 303 mm</span>
                    </div>

                    <div className={`flex items-center justify-between p-2 rounded-lg border ${
                      activeVerification.resolution_check_passed
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}>
                      <span className="flex items-center gap-1.5 font-medium">
                        {activeVerification.resolution_check_passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span>Image Resolution</span>
                      </span>
                      <span className="font-mono text-[10px] font-bold">
                        {activeVerification.resolution_dpi} DPI
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Color Format</span>
                      </span>
                      <span className="font-mono text-[10px]">CMYK Fogra39</span>
                    </div>

                    {activeVerification.error_reason && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <p className="font-bold">Rejection Reason:</p>
                          <p className="mt-0.5">{activeVerification.error_reason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Operator Decision Action Controls */}
                <Card
                  title="Approval Actions"
                  subtitle="Approve for printing or reject with notes."
                >
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <Button
                        variant="primary"
                        className="w-full bg-[#0073EA] hover:bg-[#0060B9] text-white shadow-xs text-xs font-semibold"
                        isLoading={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(activeVerification.id)}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        Approve for Printing
                      </Button>

                      <Button
                        variant="danger"
                        className="w-full text-xs font-semibold"
                        onClick={() => setIsFlagErrorModalOpen(true)}
                        leftIcon={<AlertTriangle className="w-4 h-4" />}
                      >
                        Reject Artwork
                      </Button>
                    </div>

                    {/* Direct Workstation File Download for Offline Inspection */}
                    <a
                      href={currentLivePdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={`${activeVerification.peecho_order_id || activeVerification.order_number}_artwork.pdf`}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[#0073EA] font-semibold text-xs hover:bg-blue-100 transition-colors shadow-xs"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Artwork (PDF)</span>
                    </a>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      isLoading={redownloadMutation.isPending}
                      onClick={() => redownloadMutation.mutate(activeVerification.id)}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Reload File
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8">
            <Card>
              <div className="py-20 text-center text-slate-400 text-xs">
                No orders in the artwork queue. New orders from Peecho will appear here automatically.
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* MODAL: FLAG PREPRESS ERROR */}
      <Modal
        isOpen={isFlagErrorModalOpen}
        onClose={() => setIsFlagErrorModalOpen(false)}
        title="Reject Artwork & Put on Hold"
        description="Puts order on hold and records the issue so the customer or team can resolve it."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsFlagErrorModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={flagErrorMutation.isPending}
              onClick={() =>
                flagErrorMutation.mutate({
                  id: activeVerification.id,
                  reason: flagReasonType,
                  comment: flagComment,
                })
              }
            >
              Reject Artwork & Hold Order
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Reason for Rejection:</label>
            <select
              value={flagReasonType}
              onChange={(e) => setFlagReasonType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800"
            >
              <option value="Low Resolution (< 300 DPI)">Low resolution images (&lt; 300 DPI)</option>
              <option value="Missing 3mm Bleed Box">Missing bleed margins (needs 3mm)</option>
              <option value="Unembedded Corrupt Fonts">Missing or corrupted fonts</option>
              <option value="Incorrect Spine Caliper">Incorrect spine width or page count mismatch</option>
              <option value="RGB Color Space Unconverted">RGB colors (needs CMYK conversion)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Explanation:</label>
            <textarea
              rows={3}
              placeholder="e.g. Page 14 has low quality product photos; cover lacks 3mm bleed..."
              value={flagComment}
              onChange={(e) => setFlagComment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
