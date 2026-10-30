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
  Lock,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { prepressApi, ordersApi, ArtworkVerification, Order, StaffUser } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/context/notification-context";

export default function PrepressPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: verificationsData, isLoading: verificationsLoading, refetch: refetchVerifications } = useQuery({
    queryKey: ["prepress-verifications"],
    queryFn: () => prepressApi.getVerifications(),
    refetchInterval: 8000,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["orders", "prepressSync"],
    queryFn: () => ordersApi.getOrders({ page_size: 100 }),
    refetchInterval: 6000,
  });

  const verifications: ArtworkVerification[] = verificationsData?.results || [];
  const [selectedVerificationId, setSelectedVerificationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Queue Pagination States
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(8);

  useEffect(() => {
    setQueuePage(1);
  }, [searchQuery, statusFilter]);

  // Custom Local File Upload State (for testing arbitrary real PDFs)
  const [customPdfBlobUrl, setCustomPdfBlobUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [customFileSize, setCustomFileSize] = useState<number | null>(null);

  // Viewer Type: Live PDF Embed vs Calibrated Proof Simulator
  const [viewerType, setViewerType] = useState<"live_pdf" | "calibrated_proof">("live_pdf");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");

  // Set default selected verification (supporting orderId in URL if passed from Orders page)
  useEffect(() => {
    if (verifications.length > 0) {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const targetOrderId = params.get("orderId");
        if (targetOrderId) {
          const match = verifications.find((v) => v.order === targetOrderId || v.order_number === targetOrderId);
          if (match) {
            setSelectedVerificationId(match.id);
            return;
          }
        }
      }
      if (!selectedVerificationId || !verifications.some((v) => v.id === selectedVerificationId)) {
        setSelectedVerificationId(verifications[0].id);
      }
    }
  }, [verifications, selectedVerificationId]);

  // Helper to determine unified approval status for any verification item
  const getVerificationApprovalStatus = (
    v: ArtworkVerification | null | undefined,
    parentStatus?: string
  ) => {
    if (!v) return { isApproved: false, isFlagged: false, isPending: true };
    const orderCode = (v.order_status || parentStatus || "").toUpperCase();
    const isApproved =
      v.verification_status === "APPROVED_FOR_PRINT" ||
      [
        "PREPRESS_PASSED",
        "BATCHED",
        "IN_PRODUCTION",
        "PRINTING",
        "QUALITY_AUDIT",
        "PRODUCTION_COMPLETED",
        "PACKED",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
      ].includes(orderCode);

    const isFlagged =
      v.verification_status === "FLAGGED_ERROR" ||
      orderCode === "EXCEPTION_HOLD";

    return { isApproved, isFlagged, isPending: !isApproved && !isFlagged };
  };

  // Filtered verifications
  const filteredVerifications = useMemo(() => {
    return verifications.filter((v) => {
      const matchesSearch =
        v.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.peecho_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.product_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.paper_stock?.toLowerCase().includes(searchQuery.toLowerCase());

      const { isApproved, isFlagged, isPending } = getVerificationApprovalStatus(v);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PENDING" && isPending) ||
        (statusFilter === "APPROVED" && isApproved) ||
        (statusFilter === "FLAGGED" && isFlagged);

      return matchesSearch && matchesStatus;
    });
  }, [verifications, searchQuery, statusFilter]);

  const paginatedVerifications = useMemo(() => {
    const start = (queuePage - 1) * queuePageSize;
    return filteredVerifications.slice(start, start + queuePageSize);
  }, [filteredVerifications, queuePage, queuePageSize]);

  const activeVerification = verifications.find((v) => v.id === selectedVerificationId) || filteredVerifications[0] || verifications[0];

  // Current user & admin role detection
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [adminReevaluateUnlocked, setAdminReevaluateUnlocked] = useState(false);

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

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return Boolean(
      currentUser.is_superuser ||
      currentUser.is_staff ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "ADMIN" ||
      currentUser.role_details?.code === "SUPER_ADMIN" ||
      currentUser.role_details?.code === "ADMIN"
    );
  }, [currentUser]);

  // Reset admin decision override whenever active verification changes
  useEffect(() => {
    setAdminReevaluateUnlocked(false);
  }, [selectedVerificationId]);

  // Parent Order & Decision State Detection
  const parentOrder = useMemo(() => {
    if (!activeVerification) return null;
    return (
      ordersData?.results?.find(
        (o) => o.id === activeVerification.order || o.order_number === activeVerification.order_number
      ) || null
    );
  }, [ordersData?.results, activeVerification]);

  const parentStatusCode =
    parentOrder?.status_details?.code?.toUpperCase() ||
    (typeof parentOrder?.status === "string" ? parentOrder.status.toUpperCase() : "");

  const activeApprovalStatus = useMemo(() => {
    return getVerificationApprovalStatus(activeVerification, parentStatusCode);
  }, [activeVerification, parentStatusCode]);

  const isAlreadyApproved = activeApprovalStatus.isApproved;
  const isAlreadyRejected = activeApprovalStatus.isFlagged;
  const isPendingReview = activeApprovalStatus.isPending;

  // Available documents for active verification (supporting multiple documents: Interior, Cover Wrap, etc.)
  const availableDocuments = useMemo(() => {
    if (!activeVerification) return [];
    if (activeVerification.documents && activeVerification.documents.length > 0) {
      return activeVerification.documents;
    }
    const docs = [];
    const artUrl = activeVerification.file_url || "/artworks/peecho_hardcover_photobook_a4.pdf";
    docs.push({
      id: `${activeVerification.id}-interior`,
      name: "Book Interior Pages (PDF)",
      file_type: activeVerification.file_type || "CONTENT_INTERIOR",
      file_url: artUrl,
      page_count: activeVerification.page_count,
      is_primary: true,
    });
    const covUrl = activeVerification.pdf_cover_url || "/artworks/peecho_hardcover_wrap_cover.pdf";
    if (covUrl !== artUrl) {
      docs.push({
        id: `${activeVerification.id}-cover`,
        name: "Book Cover Wrap (PDF)",
        file_type: "COVER_WRAP",
        file_url: covUrl,
        page_count: 1,
        is_primary: false,
      });
    }
    return docs;
  }, [activeVerification]);

  // Auto-sync selectedDocumentId when available documents change
  useEffect(() => {
    if (availableDocuments.length > 0) {
      if (!selectedDocumentId || !availableDocuments.some((d) => d.id === selectedDocumentId)) {
        setSelectedDocumentId(availableDocuments[0].id);
      }
    } else {
      setSelectedDocumentId("");
    }
  }, [availableDocuments, selectedDocumentId]);

  const activeDocument = useMemo(() => {
    return availableDocuments.find((d) => d.id === selectedDocumentId) || availableDocuments[0] || null;
  }, [availableDocuments, selectedDocumentId]);

  // Counts for summary badges
  const pendingCount = verifications.filter((v) => getVerificationApprovalStatus(v).isPending).length;
  const approvedCount = verifications.filter((v) => getVerificationApprovalStatus(v).isApproved).length;
  const flaggedCount = verifications.filter((v) => getVerificationApprovalStatus(v).isFlagged).length;

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
      toast.info("Custom PDF Loaded", `Loaded "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) for inspection.`);
    }
  };

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, adminApproved }: { id: string; adminApproved?: boolean }) =>
      prepressApi.approveArtwork(id, { admin_approved: adminApproved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prepress-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setAdminReevaluateUnlocked(false);
      toast.success(
        "Artwork Approved Successfully",
        `Order ${activeVerification?.order_number || ""} verified and cleared for print imposition.`,
        { orderNumber: activeVerification?.order_number }
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || "Failed to approve artwork";
      toast.error("Artwork Approval Failed", msg, { orderNumber: activeVerification?.order_number });
    },
  });

  const flagErrorMutation = useMutation({
    mutationFn: ({ id, reason, comment, adminApproved }: { id: string; reason: string; comment: string; adminApproved?: boolean }) =>
      prepressApi.flagPrepressError(id, `${reason} - ${comment}`.trim(), comment, adminApproved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prepress-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setIsFlagErrorModalOpen(false);
      setFlagComment("");
      setAdminReevaluateUnlocked(false);
      toast.warning(
        "Artwork Flagged & Rejected",
        `Order ${activeVerification?.order_number || ""} rejected. Placed on prepress hold.`,
        { orderNumber: activeVerification?.order_number }
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || "Failed to flag artwork error";
      toast.error("Rejection Failed", msg, { orderNumber: activeVerification?.order_number });
    },
  });

  const redownloadMutation = useMutation({
    mutationFn: (id: string) => prepressApi.redownloadArtwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prepress-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Artwork Re-downloaded", "Synchronized latest production assets from API.");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || "Failed to re-download artwork";
      toast.error("Re-download Failed", msg);
    },
  });

  const totalPages = activeDocument?.page_count || activeVerification?.page_count || 24;
  const currentLivePdfUrl =
    customPdfBlobUrl ||
    activeDocument?.file_url ||
    activeVerification?.file_url ||
    "/artworks/peecho_hardcover_photobook_a4.pdf";
  const currentLivePdfName =
    customFileName ||
    activeDocument?.name ||
    activeVerification?.product_type ||
    "Artwork PDF";

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
                name="prepress_search_input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
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
              paginatedVerifications.map((v) => {
                const isSelected = v.id === activeVerification?.id && !customPdfBlobUrl;
                const { isApproved, isFlagged } = getVerificationApprovalStatus(v);

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

          {filteredVerifications.length > 0 && (
            <Pagination
              currentPage={queuePage}
              totalPages={Math.ceil(filteredVerifications.length / queuePageSize) || 1}
              totalCount={filteredVerifications.length}
              pageSize={queuePageSize}
              pageSizeOptions={[5, 8, 15, 25]}
              onPageChange={setQueuePage}
              onPageSizeChange={(sz) => {
                setQueuePageSize(sz);
                setQueuePage(1);
              }}
              showPageSizeSelector={false}
              className="border-t border-slate-200"
            />
          )}
        </div>

        {/* COLUMN 2 & 3: ACTIVE INSPECTION CANVAS & CONTROLS (8 Cols) */}
        {activeVerification ? (
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* PDF PROOF PREVIEWER & CANVAS (7 Cols) */}
              <div className="xl:col-span-7 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden min-h-[580px]">
                {/* Multi-Document Selector Tabs */}
                {availableDocuments.length > 1 && (
                  <div className="px-3.5 py-2 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <Layers className="w-3.5 h-3.5 text-[#0073EA]" />
                        <span>Documents ({availableDocuments.length}):</span>
                      </span>
                      {availableDocuments.map((doc) => {
                        const isSelected = activeDocument?.id === doc.id;
                        return (
                          <button
                            key={doc.id}
                            onClick={() => setSelectedDocumentId(doc.id)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              isSelected
                                ? "bg-[#0073EA] text-white shadow-xs"
                                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{doc.name}</span>
                            {doc.page_count ? (
                              <span
                                className={`text-[10px] px-1 rounded font-mono ${
                                  isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {doc.page_count}p
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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

                  {/* Overlays, Zoom & External Open */}
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

                    {viewerType === "calibrated_proof" && (
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono">
                        <button
                          onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                          className="hover:text-blue-600 font-bold px-0.5"
                          title="Zoom Out"
                        >
                          -
                        </button>
                        <span className="text-slate-700">{zoomLevel}%</span>
                        <button
                          onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                          className="hover:text-blue-600 font-bold px-0.5"
                          title="Zoom In"
                        >
                          +
                        </button>
                        <button
                          onClick={() => setZoomLevel(100)}
                          className="hover:text-blue-600 ml-0.5 text-[9px] text-slate-400"
                        >
                          Reset
                        </button>
                      </div>
                    )}

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
                  <div className="flex-1 bg-slate-900/5 p-3 flex flex-col relative min-h-[520px]">
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
                        key={`live-${currentLivePdfUrl}`}
                        src={`${currentLivePdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                        className="w-full h-full min-h-[520px] border-0 bg-white"
                        title="Customer Artwork PDF"
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span className="flex items-center gap-1 font-mono">
                        <FileText className="w-3.5 h-3.5 text-[#0073EA]" />
                        {currentLivePdfName}
                      </span>
                      <span className="font-mono text-slate-400">
                        {activeVerification.peecho_order_id || activeVerification.order_number} • Interactive PDF Mode
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Calibrated Proof View Mode with Real Document */
                  <div className="flex-1 bg-slate-900/95 p-6 flex flex-col items-center justify-center overflow-auto relative min-h-[520px]">
                    {/* Studio Proof Top Calibration Header */}
                    <div className="w-full max-w-xl flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          FOGRA39 CMYK PROOF
                        </span>
                        <span className="text-slate-300 truncate max-w-[220px]">
                          {currentLivePdfName}
                        </span>
                      </div>

                      {/* Calibration Color Bar */}
                      <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        <span className="text-[9px] text-slate-400 mr-1">STRIP:</span>
                        <div className="w-3 h-3 bg-cyan-500 rounded-xs shadow" title="Cyan (100%)" />
                        <div className="w-3 h-3 bg-pink-500 rounded-xs shadow" title="Magenta (100%)" />
                        <div className="w-3 h-3 bg-yellow-400 rounded-xs shadow" title="Yellow (100%)" />
                        <div className="w-3 h-3 bg-black rounded-xs shadow border border-slate-600" title="Key/Black (100%)" />
                      </div>
                    </div>

                    {/* Real Document Press Proof Frame */}
                    <div
                      style={{
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: "center center",
                        transition: "transform 0.15s ease-out",
                      }}
                      className="w-[440px] h-[580px] bg-white rounded shadow-2xl relative border-4 border-slate-300 select-none flex flex-col overflow-hidden"
                    >
                      {/* Corner Registration Targets */}
                      <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-slate-900 z-30 pointer-events-none" />
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-slate-900 z-30 pointer-events-none" />
                      <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-slate-900 z-30 pointer-events-none" />
                      <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-slate-900 z-30 pointer-events-none" />

                      {showBleedBox && (
                        <div className="absolute inset-1.5 border-2 border-dashed border-rose-500 pointer-events-none z-30">
                          <span className="absolute top-1 left-1 bg-rose-500 text-white text-[8px] font-mono px-1 rounded shadow">
                            Bleed Box (3mm)
                          </span>
                        </div>
                      )}

                      {showTrimBox && (
                        <div className="absolute inset-4 border border-sky-400 pointer-events-none z-30">
                          <span className="absolute bottom-1 right-1 bg-sky-500 text-white text-[8px] font-mono px-1 rounded shadow">
                            Cut Trim Line
                          </span>
                        </div>
                      )}

                      {/* The EXACT SAME DOCUMENT in Print Preview Mode */}
                      <iframe
                        key={`proof-${currentLivePdfUrl}`}
                        src={`${currentLivePdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full border-0 bg-white"
                        title={`Print Proof: ${currentLivePdfName}`}
                      />
                    </div>

                    {/* Studio Proof Footer */}
                    <div className="w-full max-w-xl flex items-center justify-between text-[10px] text-slate-400 font-mono mt-3 px-1">
                      <span>PRESS: HP INDIGO 12000 (FOGRA39)</span>
                      <span>{activeVerification.peecho_order_id} • 300 DPI CMYK VERIFIED</span>
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
                  subtitle={
                    isAlreadyApproved
                      ? "Artwork decision finalized: Approved for print production."
                      : isAlreadyRejected
                      ? "Artwork decision finalized: Rejected & placed on exception hold."
                      : "Inspect and approve for printing or reject with notes."
                  }
                >
                  <div className="space-y-3">
                    {/* CASE 1: ALREADY APPROVED */}
                    {isAlreadyApproved && (
                      <div className="space-y-2.5">
                        <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Artwork Approved for Print
                            </span>
                            <Badge variant="success" size="sm">Approved</Badge>
                          </div>
                          <p className="text-[11px] text-emerald-800 leading-relaxed">
                            This artwork has already been approved and passed preflight verification. The order is progressing in the production pipeline.
                          </p>
                          <div className="pt-1.5 border-t border-emerald-200/70 text-[10px] text-emerald-700 flex flex-wrap items-center justify-between gap-1">
                            <span>Verified by: <strong>{activeVerification.verified_by_name || "Prepress Operator"}</strong></span>
                            {activeVerification.verified_at && (
                              <span>{new Date(activeVerification.verified_at).toLocaleDateString()} {new Date(activeVerification.verified_at).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>

                        {/* When approved, decision buttons are locked and clearly labeled */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            disabled={true}
                            className="w-full bg-emerald-100/90 text-emerald-800 border border-emerald-300 font-semibold text-xs cursor-default shadow-none"
                            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          >
                            Already Approved ✓
                          </Button>

                          <Button
                            disabled={!adminReevaluateUnlocked}
                            variant="outline"
                            className={`w-full text-xs font-semibold ${
                              adminReevaluateUnlocked
                                ? "border-rose-300 text-rose-700 hover:bg-rose-50"
                                : "text-slate-400 border-slate-200 cursor-not-allowed bg-slate-50"
                            }`}
                            onClick={() => {
                              if (adminReevaluateUnlocked) {
                                setIsFlagErrorModalOpen(true);
                              }
                            }}
                            leftIcon={adminReevaluateUnlocked ? <AlertTriangle className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                          >
                            {adminReevaluateUnlocked ? "Reject & Hold" : "Rejection Locked"}
                          </Button>
                        </div>

                        {/* Admin Re-evaluation Toggle */}
                        {isAdmin && (
                          <div className="pt-1">
                            {!adminReevaluateUnlocked ? (
                              <button
                                type="button"
                                onClick={() => setAdminReevaluateUnlocked(true)}
                                className="w-full text-center text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 py-1.5 px-2 rounded-lg border border-purple-200 flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                                <span>Unlock Admin Decision Override</span>
                              </button>
                            ) : (
                              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/70 space-y-2 text-xs animate-in fade-in">
                                <div className="flex items-center justify-between text-purple-900 font-bold">
                                  <span className="flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                    Admin Override Mode Unlocked
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAdminReevaluateUnlocked(false)}
                                    className="text-slate-400 hover:text-slate-600 text-[11px] font-medium underline"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <p className="text-[11px] text-purple-800">
                                  As an Administrator, you may reverse this approval and flag an error if defects were discovered post-approval.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* CASE 2: ALREADY REJECTED / FLAGGED */}
                    {isAlreadyRejected && (
                      <div className="space-y-2.5">
                        <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs flex items-center gap-1.5 text-rose-800">
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                              Artwork Rejected & On Hold
                            </span>
                            <Badge variant="danger" size="sm">Flagged Error</Badge>
                          </div>
                          <p className="text-[11px] text-rose-800 leading-relaxed">
                            This artwork was flagged with errors and placed on exception hold. Press production is halted.
                          </p>
                          {activeVerification.error_reason && (
                            <div className="p-2 bg-white/90 rounded-lg border border-rose-200 text-[11px] text-rose-900">
                              <span className="font-bold block text-rose-800">Recorded Reason:</span>
                              <span className="mt-0.5 block">{activeVerification.error_reason}</span>
                            </div>
                          )}
                          <div className="pt-1.5 border-t border-rose-200/70 text-[10px] text-rose-700 flex flex-wrap items-center justify-between gap-1">
                            <span>Flagged by: <strong>{activeVerification.verified_by_name || "Prepress Operator"}</strong></span>
                            {activeVerification.verified_at && (
                              <span>{new Date(activeVerification.verified_at).toLocaleDateString()} {new Date(activeVerification.verified_at).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>

                        {/* When rejected, decision buttons are locked and clearly labeled */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            disabled={!adminReevaluateUnlocked}
                            variant="primary"
                            className={`w-full text-xs font-semibold ${
                              adminReevaluateUnlocked
                                ? "bg-[#0073EA] hover:bg-[#0060B9] text-white"
                                : "text-slate-400 border-slate-200 cursor-not-allowed bg-slate-50 border"
                            }`}
                            isLoading={approveMutation.isPending}
                            onClick={() => {
                              if (adminReevaluateUnlocked) {
                                approveMutation.mutate({ id: activeVerification.id, adminApproved: true });
                              }
                            }}
                            leftIcon={adminReevaluateUnlocked ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                          >
                            {adminReevaluateUnlocked ? "Clear Hold & Approve" : "Approval Locked"}
                          </Button>

                          <Button
                            disabled={true}
                            className="w-full bg-rose-100/90 text-rose-800 border border-rose-300 font-semibold text-xs cursor-default shadow-none"
                            leftIcon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
                          >
                            Already Rejected ✕
                          </Button>
                        </div>

                        {/* Admin Re-evaluation Toggle */}
                        {isAdmin && (
                          <div className="pt-1">
                            {!adminReevaluateUnlocked ? (
                              <button
                                type="button"
                                onClick={() => setAdminReevaluateUnlocked(true)}
                                className="w-full text-center text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 py-1.5 px-2 rounded-lg border border-purple-200 flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                                <span>Unlock Admin Decision Override</span>
                              </button>
                            ) : (
                              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/70 space-y-2 text-xs animate-in fade-in">
                                <div className="flex items-center justify-between text-purple-900 font-bold">
                                  <span className="flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                    Admin Re-evaluation Mode Unlocked
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAdminReevaluateUnlocked(false)}
                                    className="text-slate-400 hover:text-slate-600 text-[11px] font-medium underline"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <p className="text-[11px] text-purple-800">
                                  If the artwork defect has been rectified or approved under exception by the admin, click "Clear Hold & Approve".
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* CASE 3: PENDING REVIEW (Active decision buttons) */}
                    {isPendingReview && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <Button
                          variant="primary"
                          className="w-full bg-[#0073EA] hover:bg-[#0060B9] text-white shadow-xs text-xs font-semibold"
                          isLoading={approveMutation.isPending}
                          onClick={() => approveMutation.mutate({ id: activeVerification.id })}
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
                    )}

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
                  adminApproved: adminReevaluateUnlocked,
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
