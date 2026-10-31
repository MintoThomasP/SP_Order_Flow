"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  Search,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  User,
  ArrowRight,
  Filter,
  X,
  BookOpen,
  Maximize2,
  Hash,
  Package,
  Calendar,
  ShieldCheck,
  FileCheck,
  CheckSquare,
  Square,
  Send,
  HelpCircle,
  ListFilter,
  LayoutGrid,
  Table as TableIcon,
  Edit,
  Trash2,
  Settings,
  Gauge,
  Check,
} from "lucide-react";
import {
  productionApi,
  ProductionBatch,
  Order,
  BatchedOrder,
  OrderItem,
  PrintMachine,
  BindingMethod,
} from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/context/notification-context";

export default function ProductionBatchingPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [pressFilter, setPressFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // View toggle for Active Batches: "cards" (machine job cards with orders inside) vs "table" (compact table)
  const [batchesViewMode, setBatchesViewMode] = useState<"cards" | "table">("cards");

  // Pagination States
  const [unbatchedPage, setUnbatchedPage] = useState(1);
  const [unbatchedPageSize, setUnbatchedPageSize] = useState(10);
  const [batchesPage, setBatchesPage] = useState(1);
  const [batchesPageSize, setBatchesPageSize] = useState(5);

  useEffect(() => {
    setUnbatchedPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setBatchesPage(1);
  }, [searchQuery, pressFilter, statusFilter]);

  // Modals & Inspection State
  const [selectedBatchForTicket, setSelectedBatchForTicket] = useState<ProductionBatch | null>(null);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [selectedArtworkForModal, setSelectedArtworkForModal] = useState<{ url: string; title: string } | null>(null);

  // Unbatched Selection & Batch Creator State
  const [selectedUnbatchedOrderIds, setSelectedUnbatchedOrderIds] = useState<string[]>([]);
  const [targetPressSelection, setTargetPressSelection] = useState("HP_INDIGO_12000");
  const [paperStockInput, setPaperStockInput] = useState("200gsm Silk Inner + 350gsm Hardcover Gloss");
  const [bindingTypeSelection, setBindingTypeSelection] = useState("HARDCOVER_CASEBOUND");
  const [isAdvancedCreateOpen, setIsAdvancedCreateOpen] = useState(false);

  // Tab & Equipment Management States
  const [activeMainTab, setActiveMainTab] = useState<"all" | "batches" | "unbatched" | "equipment">("all");
  const [expandedBatchIds, setExpandedBatchIds] = useState<Record<string, boolean>>({});
  const toggleBatchExpanded = (batchId: string) => {
    setExpandedBatchIds((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };
  const [equipmentSubTab, setEquipmentSubTab] = useState<"machines" | "bindings">("machines");
  const [equipmentSearch, setEquipmentSearch] = useState("");

  // Print Machine Form & Modal State
  const initialMachineForm = {
    code: "",
    name: "",
    sheet_format: "B2 (530 x 750 mm)",
    max_speed_cph: 4500,
    description: "",
    is_active: true,
  };
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<PrintMachine | null>(null);
  const [machineForm, setMachineForm] = useState(initialMachineForm);
  const [machineToDelete, setMachineToDelete] = useState<PrintMachine | null>(null);

  // Binding Method Form & Modal State
  const initialBindingForm = {
    code: "",
    name: "",
    min_pages: 1,
    max_pages: 500,
    default_caliper_mm: 3.0,
    description: "",
    is_active: true,
  };
  const [isBindingModalOpen, setIsBindingModalOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<BindingMethod | null>(null);
  const [bindingForm, setBindingForm] = useState(initialBindingForm);
  const [bindingToDelete, setBindingToDelete] = useState<BindingMethod | null>(null);

  // Queries
  const {
    data: batchesData,
    isLoading: batchesLoading,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: ["production-batches", pressFilter, statusFilter],
    queryFn: () =>
      productionApi.getBatches({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        target_press: pressFilter === "ALL" ? undefined : pressFilter,
      }),
  });

  const {
    data: eligibleOrders,
    isLoading: eligibleLoading,
    refetch: refetchEligible,
  } = useQuery({
    queryKey: ["eligible-orders"],
    queryFn: () => productionApi.getEligibleOrders(),
  });

  // Dynamic Print Machines Query
  const {
    data: machinesData = [],
    isLoading: machinesLoading,
    refetch: refetchMachines,
  } = useQuery({
    queryKey: ["print-machines"],
    queryFn: () => productionApi.getAllMachines(false),
  });

  // Dynamic Binding Methods Query
  const {
    data: bindingMethodsData = [],
    isLoading: bindingMethodsLoading,
    refetch: refetchBindingMethods,
  } = useQuery({
    queryKey: ["binding-methods"],
    queryFn: () => productionApi.getAllBindingMethods(false),
  });

  const activeMachines = useMemo(() => {
    return machinesData.filter((m) => m.is_active);
  }, [machinesData]);

  const activeBindingMethods = useMemo(() => {
    return bindingMethodsData.filter((b) => b.is_active);
  }, [bindingMethodsData]);

  // Keep dropdown default values in sync with active equipment from DB
  useEffect(() => {
    if (activeMachines.length > 0 && !activeMachines.some((m) => m.code === targetPressSelection)) {
      setTargetPressSelection(activeMachines[0].code);
    }
  }, [activeMachines, targetPressSelection]);

  useEffect(() => {
    if (activeBindingMethods.length > 0 && !activeBindingMethods.some((b) => b.code === bindingTypeSelection)) {
      setBindingTypeSelection(activeBindingMethods[0].code);
    }
  }, [activeBindingMethods, bindingTypeSelection]);

  // Mutations
  const createBatchMutation = useMutation({
    mutationFn: (data: any) => productionApi.createBatch(data),
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: ["production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["eligible-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedUnbatchedOrderIds([]);
      setIsAdvancedCreateOpen(false);
      setSelectedBatchForTicket(newBatch);
      toast.success(
        "Print Batch Created Successfully",
        `Batch ${newBatch.batch_number} created with ${newBatch.total_orders_count || selectedUnbatchedOrderIds.length} orders ready for imposition.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to create batch";
      toast.error("Batch Creation Failed", msg);
    },
  });

  const updateBatchStatusMutation = useMutation({
    mutationFn: ({ batchId, statusCode }: { batchId: string; statusCode: string }) =>
      productionApi.updateBatchStatus(batchId, statusCode),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(
        "Batch Status Updated",
        `Batch status successfully advanced to ${variables.statusCode}.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to update batch status";
      toast.error("Status Update Failed", msg);
    },
  });

  // Machine Mutations
  const createMachineMutation = useMutation({
    mutationFn: (data: Partial<PrintMachine>) => productionApi.createMachine(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-machines"] });
      setIsMachineModalOpen(false);
      resetMachineForm();
      toast.success(
        "Target Print Machine Registered",
        `Equipment "${machineForm.name}" added to factory production roster.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to add machine";
      toast.error("Machine Registration Failed", msg);
    },
  });

  const updateMachineMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PrintMachine> }) =>
      productionApi.updateMachine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-machines"] });
      setIsMachineModalOpen(false);
      setEditingMachine(null);
      toast.success(
        "Print Machine Updated",
        `Target machine configuration updated successfully.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to update machine";
      toast.error("Machine Update Failed", msg);
    },
  });

  const deleteMachineMutation = useMutation({
    mutationFn: (id: string) => productionApi.deleteMachine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-machines"] });
      const name = machineToDelete?.name || "Machine";
      setMachineToDelete(null);
      toast.warning(
        "Print Machine Removed",
        `Equipment "${name}" has been removed from factory equipment.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to delete machine";
      toast.error("Machine Deletion Failed", msg);
    },
  });

  // Binding Mutations
  const createBindingMutation = useMutation({
    mutationFn: (data: Partial<BindingMethod>) => productionApi.createBindingMethod(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["binding-methods"] });
      setIsBindingModalOpen(false);
      resetBindingForm();
      toast.success(
        "Binding Method Registered",
        `Binding specification "${bindingForm.name}" registered successfully.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to add binding method";
      toast.error("Binding Method Failed", msg);
    },
  });

  const updateBindingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BindingMethod> }) =>
      productionApi.updateBindingMethod(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["binding-methods"] });
      setIsBindingModalOpen(false);
      setEditingBinding(null);
      toast.success(
        "Binding Method Updated",
        `Binding specification updated successfully.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to update binding method";
      toast.error("Binding Update Failed", msg);
    },
  });

  const deleteBindingMutation = useMutation({
    mutationFn: (id: string) => productionApi.deleteBindingMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["binding-methods"] });
      const name = bindingToDelete?.name || "Binding Method";
      setBindingToDelete(null);
      toast.warning(
        "Binding Method Removed",
        `Binding specification "${name}" has been removed.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to delete binding method";
      toast.error("Binding Deletion Failed", msg);
    },
  });

  // Machine Form Handlers
  const resetMachineForm = () => {
    setMachineForm(initialMachineForm);
    setEditingMachine(null);
  };

  const openAddMachine = () => {
    resetMachineForm();
    setIsMachineModalOpen(true);
  };

  const openEditMachine = (m: PrintMachine) => {
    setEditingMachine(m);
    setMachineForm({
      code: m.code,
      name: m.name,
      sheet_format: m.sheet_format || "",
      max_speed_cph: m.max_speed_cph || 0,
      description: m.description || "",
      is_active: m.is_active,
    });
    setIsMachineModalOpen(true);
  };

  const handleSaveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineForm.name.trim()) return;
    const rawCode = machineForm.code.trim() || machineForm.name.trim();
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");

    if (editingMachine) {
      updateMachineMutation.mutate({
        id: editingMachine.id,
        data: {
          ...machineForm,
          code,
          max_speed_cph: Number(machineForm.max_speed_cph) || 0,
        },
      });
    } else {
      createMachineMutation.mutate({
        ...machineForm,
        code,
        max_speed_cph: Number(machineForm.max_speed_cph) || 0,
      });
    }
  };

  // Binding Form Handlers
  const resetBindingForm = () => {
    setBindingForm(initialBindingForm);
    setEditingBinding(null);
  };

  const openAddBinding = () => {
    resetBindingForm();
    setIsBindingModalOpen(true);
  };

  const openEditBinding = (b: BindingMethod) => {
    setEditingBinding(b);
    setBindingForm({
      code: b.code,
      name: b.name,
      min_pages: b.min_pages || 1,
      max_pages: b.max_pages || 500,
      default_caliper_mm: Number(b.default_caliper_mm) || 3.0,
      description: b.description || "",
      is_active: b.is_active,
    });
    setIsBindingModalOpen(true);
  };

  const handleSaveBinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindingForm.name.trim()) return;
    const rawCode = bindingForm.code.trim() || bindingForm.name.trim();
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");

    if (editingBinding) {
      updateBindingMutation.mutate({
        id: editingBinding.id,
        data: {
          ...bindingForm,
          code,
          min_pages: Number(bindingForm.min_pages) || 1,
          max_pages: Number(bindingForm.max_pages) || 500,
          default_caliper_mm: Number(bindingForm.default_caliper_mm) || 0,
        },
      });
    } else {
      createBindingMutation.mutate({
        ...bindingForm,
        code,
        min_pages: Number(bindingForm.min_pages) || 1,
        max_pages: Number(bindingForm.max_pages) || 500,
        default_caliper_mm: Number(bindingForm.default_caliper_mm) || 0,
      });
    }
  };

  // Search filtering in Equipment & Binding tab
  const filteredMachines = useMemo(() => {
    if (!equipmentSearch.trim()) return machinesData;
    const q = equipmentSearch.toLowerCase().trim();
    return machinesData.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.sheet_format && m.sheet_format.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [machinesData, equipmentSearch]);

  const filteredBindingMethods = useMemo(() => {
    if (!equipmentSearch.trim()) return bindingMethodsData;
    const q = equipmentSearch.toLowerCase().trim();
    return bindingMethodsData.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q))
    );
  }, [bindingMethodsData, equipmentSearch]);

  // Normalize raw batch list (handles both paginated response and direct array)
  const rawBatches: ProductionBatch[] = useMemo(() => {
    if (Array.isArray(batchesData)) return batchesData;
    if (batchesData?.results && Array.isArray(batchesData.results)) return batchesData.results;
    return [];
  }, [batchesData]);

  // Normalize raw eligible unbatched orders
  const rawEligibleOrders: Order[] = useMemo(() => {
    if (Array.isArray(eligibleOrders)) return eligibleOrders;
    if ((eligibleOrders as any)?.results && Array.isArray((eligibleOrders as any).results)) {
      return (eligibleOrders as any).results;
    }
    return [];
  }, [eligibleOrders]);

  // Helper to reliably resolve batch status code (QUEUED_PRESS, PRINTING, COMPLETED)
  const getBatchStatusCode = (b: ProductionBatch): string => {
    return (b.status_code || b.status_details?.code || b.status || "QUEUED_PRESS").toUpperCase();
  };

  // Filter batches by machine, status, and search query (strictly descending - newest first)
  const filteredBatches = useMemo(() => {
    const list = rawBatches.filter((b) => {
      const bStatus = getBatchStatusCode(b);
      if (pressFilter !== "ALL" && b.target_press !== pressFilter) return false;
      if (statusFilter !== "ALL" && bStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesBatch =
          (b.batch_number || "").toLowerCase().includes(q) ||
          (b.paper_stock || "").toLowerCase().includes(q) ||
          ((b.press_label || b.target_press) || "").toLowerCase().includes(q);
        const matchesAnyOrder = b.orders?.some(
          (o) =>
            (o.order_number || "").toLowerCase().includes(q) ||
            (o.peecho_order_id && o.peecho_order_id.toLowerCase().includes(q)) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
            o.items?.some((it) => (it.product_type || "").toLowerCase().includes(q))
        );
        return matchesBatch || matchesAnyOrder;
      }
      return true;
    });

    return list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b.batch_number || "").localeCompare(a.batch_number || "", undefined, { numeric: true });
    });
  }, [rawBatches, pressFilter, statusFilter, searchQuery]);

  const queuedBatchesCount = useMemo(() => {
    return rawBatches.filter((b) => {
      const st = getBatchStatusCode(b);
      return st === "QUEUED_PRESS" || st === "BATCHED";
    }).length;
  }, [rawBatches]);

  const printingBatchesCount = useMemo(() => {
    return rawBatches.filter((b) => {
      const st = getBatchStatusCode(b);
      return st === "PRINTING";
    }).length;
  }, [rawBatches]);

  const completedBatchesCount = useMemo(() => {
    return rawBatches.filter((b) => {
      const st = getBatchStatusCode(b);
      return st === "COMPLETED";
    }).length;
  }, [rawBatches]);

  // Flatten batched orders
  const allBatchedOrders = useMemo(() => {
    const list: Array<Order & { parentBatch: ProductionBatch }> = [];
    for (const b of rawBatches) {
      if (b.orders && b.orders.length > 0) {
        for (const o of b.orders) {
          list.push({ ...o, parentBatch: b });
        }
      }
    }
    return list;
  }, [rawBatches]);

  // Filter eligible (unbatched) orders by search query (strictly descending - newest first)
  const filteredUnbatchedOrders = useMemo(() => {
    let list = rawEligibleOrders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          (o.order_number || "").toLowerCase().includes(q) ||
          (o.peecho_order_id && o.peecho_order_id.toLowerCase().includes(q)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          o.items?.some((it) => (it.product_type || "").toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b.order_number || "").localeCompare(a.order_number || "", undefined, { numeric: true });
    });
  }, [rawEligibleOrders, searchQuery]);

  // Paginated Slices
  const paginatedUnbatchedOrders = useMemo(() => {
    const start = (unbatchedPage - 1) * unbatchedPageSize;
    return filteredUnbatchedOrders.slice(start, start + unbatchedPageSize);
  }, [filteredUnbatchedOrders, unbatchedPage, unbatchedPageSize]);

  const paginatedBatches = useMemo(() => {
    const start = (batchesPage - 1) * batchesPageSize;
    return filteredBatches.slice(start, start + batchesPageSize);
  }, [filteredBatches, batchesPage, batchesPageSize]);

  // Order Search Tracker (Find which batch or state an order is in)
  const trackedOrderResult = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return null;
    const q = searchQuery.toLowerCase().trim();

    // Check if in a batch
    const foundBatched = allBatchedOrders.find(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.peecho_order_id && o.peecho_order_id.toLowerCase().includes(q))
    );
    if (foundBatched) {
      return {
        type: "BATCHED" as const,
        order: foundBatched,
        batch: foundBatched.parentBatch,
      };
    }

    // Check if in unbatched
    const foundUnbatched = rawEligibleOrders.find(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.peecho_order_id && o.peecho_order_id.toLowerCase().includes(q))
    );
    if (foundUnbatched) {
      return {
        type: "UNBATCHED" as const,
        order: foundUnbatched,
      };
    }

    return null;
  }, [searchQuery, allBatchedOrders, rawEligibleOrders]);

  // Selection handlers
  const toggleSelectUnbatched = (id: string) => {
    setSelectedUnbatchedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllUnbatched = () => {
    if (filteredUnbatchedOrders.length === 0) return;
    if (selectedUnbatchedOrderIds.length === filteredUnbatchedOrders.length) {
      setSelectedUnbatchedOrderIds([]);
    } else {
      setSelectedUnbatchedOrderIds(filteredUnbatchedOrders.map((o) => o.id));
    }
  };

  const handleQuickCreateBatch = () => {
    if (selectedUnbatchedOrderIds.length === 0) return;
    createBatchMutation.mutate({
      order_ids: selectedUnbatchedOrderIds,
      target_press: targetPressSelection,
      paper_stock: paperStockInput,
      binding_type: bindingTypeSelection,
      size_format: "A4 Landscape (210 x 297 mm)",
      priority: "RUSH",
      notes: `Batch scheduled on ${targetPressSelection.replace(/_/g, " ")}`,
    });
  };

  // Metrics
  const totalUnbatchedCount = rawEligibleOrders.length;
  const totalBatchedCount = allBatchedOrders.length;
  const totalActiveBatchesCount = rawBatches.length;
  const totalSheetsVolume = rawBatches.reduce((acc, b) => acc + (b.total_sheets_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Production Batching & Press Queues
            </h1>
            <Badge variant="primary" size="sm">Shopfloor Station</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage print floor batches, machine queue runs, and prepress order bundling.
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
              refetchMachines();
              refetchBindingMethods();
            }}
          >
            Refresh
          </Button>

          {(activeMainTab === "all" || activeMainTab === "unbatched") && (
            <Button
              size="sm"
              leftIcon={<Sliders className="w-3.5 h-3.5" />}
              onClick={() => setIsAdvancedCreateOpen(true)}
              variant="secondary"
            >
              Custom Imposition
            </Button>
          )}

          <Button
            size="sm"
            variant={activeMainTab === "equipment" ? "secondary" : "outline"}
            leftIcon={<Settings className="w-3.5 h-3.5" />}
            onClick={() => setActiveMainTab(activeMainTab === "equipment" ? "all" : "equipment")}
          >
            {activeMainTab === "equipment" ? "Back to Operations" : "Equipment Setup"}
          </Button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeMainTab === "all"
                ? "bg-[#0073EA] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All Operations (Unified)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeMainTab === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {rawBatches.length + rawEligibleOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("batches")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeMainTab === "batches"
                ? "bg-[#0073EA] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Print Batches & Press Queues</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeMainTab === "batches" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
              }`}
            >
              {rawBatches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("unbatched")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeMainTab === "unbatched"
                ? "bg-[#0073EA] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Orders Awaiting Batching</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeMainTab === "unbatched" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
              }`}
            >
              {totalUnbatchedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("equipment")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeMainTab === "equipment"
                ? "bg-[#0073EA] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Equipment & Machines</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeMainTab === "equipment" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {machinesData.length + bindingMethodsData.length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Top Order Tracker (Finds any order instantly across all states) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="batching_tracker_search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              placeholder="🔍 Search any Order # (e.g. SP-2026-1001), Customer Name, or Batch Number to find where it is..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 🎯 Order Tracker Instant Result Banner */}
        {trackedOrderResult && (
          <div
            className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150 ${
              trackedOrderResult.type === "BATCHED"
                ? "bg-blue-50/90 border-blue-200 text-blue-950"
                : "bg-amber-50/90 border-amber-200 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  trackedOrderResult.type === "BATCHED"
                    ? "bg-blue-600 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                {trackedOrderResult.type === "BATCHED" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div>
                {trackedOrderResult.type === "BATCHED" ? (
                  <>
                    <p className="font-bold text-slate-900">
                      Order #{trackedOrderResult.order.order_number} is in Print Batch{" "}
                      <span className="font-mono text-[#0073EA] font-bold">
                        {trackedOrderResult.batch?.batch_number}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Customer: {trackedOrderResult.order.customer_name} • Machine:{" "}
                      <span className="font-medium">
                        {trackedOrderResult.batch?.press_label || trackedOrderResult.batch?.target_press}
                      </span>{" "}
                      • Status:{" "}
                      <span className="font-bold text-blue-700">
                        {trackedOrderResult.batch?.status_details?.name || trackedOrderResult.batch?.status}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-slate-900">
                      Order #{trackedOrderResult.order.order_number} is Unbatched (Waiting to Print)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Customer: {trackedOrderResult.order.customer_name} • Passed Prepress • Ready to be assigned to a press machine.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {trackedOrderResult.type === "BATCHED" && trackedOrderResult.batch && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white text-xs h-7"
                  leftIcon={<QrCode className="w-3.5 h-3.5 text-[#0073EA]" />}
                  onClick={() => setSelectedBatchForTicket(trackedOrderResult.batch!)}
                >
                  Job Ticket
                </Button>
              )}
              {trackedOrderResult.type === "UNBATCHED" && (
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7"
                  onClick={() => setActiveMainTab("unbatched")}
                >
                  Go to Batching Table
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="bg-white text-xs h-7"
                onClick={() => setSelectedOrderForModal(trackedOrderResult.order)}
              >
                Inspect Order
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Three Clean High-Level KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Active Batches on Press */}
        <div
          onClick={() => {
            setActiveMainTab("batches");
            setStatusFilter("ALL");
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeMainTab === "batches"
              ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-xs"
              : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Active Print Batches
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0073EA]">
                  {rawBatches.length}
                </span>
                <span className="text-xs text-blue-600 font-semibold">
                  {printingBatchesCount} Printing • {queuedBatchesCount} Queued
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Assigned to factory presses</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0073EA] flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: Awaiting Batch */}
        <div
          onClick={() => setActiveMainTab("unbatched")}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeMainTab === "unbatched"
              ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs"
              : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Orders Awaiting Batching
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-amber-700">{totalUnbatchedCount}</span>
                <span className="text-xs text-amber-600 font-semibold">Ready to print</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Prepress inspection passed</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Sheets Scheduled */}
        <div
          onClick={() => setActiveMainTab("all")}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeMainTab === "all"
              ? "bg-purple-50/80 border-purple-300 ring-2 ring-purple-500/20 shadow-xs"
              : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Production Run Volume
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-purple-700">
                  {totalSheetsVolume.toLocaleString()}
                </span>
                <span className="text-xs text-purple-600 font-semibold">Sheets</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {totalBatchedCount} orders bundled across batches
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. PRIMARY TAB CONTENT */}

      {/* TAB 1: PRINT BATCHES & PRESS QUEUES */}
      {(activeMainTab === "all" || activeMainTab === "batches") && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Controls Bar: Sub-filters + Machine Filter + View Mode */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Sub-status filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                All Batches ({rawBatches.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("QUEUED_PRESS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "QUEUED_PRESS"
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Queued</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    statusFilter === "QUEUED_PRESS" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {queuedBatchesCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PRINTING")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "PRINTING"
                    ? "bg-amber-500 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Printing on Press</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    statusFilter === "PRINTING" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {printingBatchesCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("COMPLETED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "COMPLETED"
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    statusFilter === "COMPLETED" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {completedBatchesCount}
                </span>
              </button>
            </div>

            {/* Right: Machine selector & View toggle */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Press:</span>
                <select
                  value={pressFilter}
                  onChange={(e) => setPressFilter(e.target.value)}
                  className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Print Machines</option>
                  {activeMachines.map((m) => (
                    <option key={m.id} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* View mode toggle */}
              <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBatchesViewMode("cards")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    batchesViewMode === "cards"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-[#0073EA]" />
                  <span>Job Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchesViewMode("table")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    batchesViewMode === "table"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {batchesLoading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                <div className="w-4 h-4 rounded-full border-2 border-[#0073EA] border-t-transparent animate-spin" />
                <span>Loading print batches...</span>
              </div>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
              <Printer className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">No Print Batches Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {statusFilter !== "ALL" || pressFilter !== "ALL" || searchQuery
                  ? "No print batches match the active filters or search term."
                  : "There are currently no active print batches. Go to 'Orders Awaiting Batching' to bundle prepress-approved orders into your first print run."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {(statusFilter !== "ALL" || pressFilter !== "ALL" || searchQuery) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setStatusFilter("ALL");
                      setPressFilter("ALL");
                      setSearchQuery("");
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
                <Button
                  size="sm"
                  className="bg-[#0073EA] hover:bg-[#0060B9] text-white"
                  onClick={() => setActiveMainTab("unbatched")}
                  leftIcon={<Package className="w-3.5 h-3.5" />}
                >
                  View Orders Awaiting Batching
                </Button>
              </div>
            </div>
          ) : batchesViewMode === "cards" ? (
            /* A. BATCH MACHINE CARDS */
            <div className="space-y-4">
              {paginatedBatches.map((batch) => {
                const ordersInside = batch.orders || [];
                const statusCode = getBatchStatusCode(batch);
                const isMutatingThis =
                  updateBatchStatusMutation.isPending &&
                  (updateBatchStatusMutation.variables as any)?.batchId === batch.id;
                const isExpanded = expandedBatchIds[batch.id] !== undefined ? expandedBatchIds[batch.id] : true;

                return (
                  <div
                    key={batch.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                  >
                    {/* Batch Card Header */}
                    <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-xs ${
                            statusCode === "COMPLETED"
                              ? "bg-emerald-600"
                              : statusCode === "PRINTING"
                              ? "bg-amber-500"
                              : "bg-blue-600"
                          }`}
                        >
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-base font-bold tracking-tight text-white">
                              {batch.batch_number}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                              {batch.press_label || batch.target_press}
                            </span>
                            {batch.priority === "RUSH" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-400/30">
                                RUSH PRIORITY
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Created {new Date(batch.created_at).toLocaleDateString()} at{" "}
                            {new Date(batch.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Imposition: {batch.notes || "Standard 4-up Layout"}
                          </p>
                        </div>
                      </div>

                      {/* Right Header: Progress Stepper & Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* 3-Stage Progress Stepper */}
                        <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg text-[10px] font-bold border border-white/15">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              statusCode === "QUEUED_PRESS" || statusCode === "BATCHED"
                                ? "bg-blue-500 text-white"
                                : "text-slate-400"
                            }`}
                          >
                            1. Queued
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              statusCode === "PRINTING" ? "bg-amber-500 text-white" : "text-slate-400"
                            }`}
                          >
                            2. Printing
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              statusCode === "COMPLETED" ? "bg-emerald-500 text-white" : "text-slate-400"
                            }`}
                          >
                            3. Done
                          </span>
                        </div>

                        {/* Print Job Ticket (QR) */}
                        <Button
                          size="sm"
                          leftIcon={<QrCode className="w-3.5 h-3.5 text-white" />}
                          onClick={() => setSelectedBatchForTicket(batch)}
                          className="bg-white/15 hover:bg-white/25 text-white text-xs h-8 border border-white/20"
                        >
                          Job Ticket (QR)
                        </Button>

                        {/* Status Transition Action Button */}
                        {(statusCode === "QUEUED_PRESS" || statusCode === "BATCHED") && (
                          <Button
                            size="sm"
                            isLoading={isMutatingThis}
                            disabled={updateBatchStatusMutation.isPending}
                            onClick={() =>
                              updateBatchStatusMutation.mutate({
                                batchId: batch.id,
                                statusCode: "PRINTING",
                              })
                            }
                            className="bg-[#0073EA] hover:bg-[#0060B9] text-white text-xs h-8 font-bold shadow-xs"
                            leftIcon={<Play className="w-3 h-3" />}
                          >
                            Send to Press ▶
                          </Button>
                        )}

                        {statusCode === "PRINTING" && (
                          <Button
                            size="sm"
                            isLoading={isMutatingThis}
                            disabled={updateBatchStatusMutation.isPending}
                            onClick={() =>
                              updateBatchStatusMutation.mutate({
                                batchId: batch.id,
                                statusCode: "COMPLETED",
                              })
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-bold shadow-xs"
                            leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
                          >
                            Mark Complete ✓
                          </Button>
                        )}

                        {statusCode === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Batch Technical Specs Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">
                          Paper Stock & Weight
                        </span>
                        <span className="font-semibold text-slate-900 truncate block" title={batch.paper_stock}>
                          {batch.paper_stock}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">
                          Trim Format & Binding
                        </span>
                        <span className="font-semibold text-slate-900 truncate block">
                          {batch.size_format} • {batch.binding_label || batch.binding_type}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">
                          Bundled Orders
                        </span>
                        <span className="font-bold text-[#0073EA] block">
                          {ordersInside.length} Orders ({batch.total_items_count} Items)
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">
                          Calculated Run Sheets
                        </span>
                        <span className="font-bold text-purple-700 block">
                          {batch.total_sheets_count} Sheets
                        </span>
                      </div>
                    </div>

                    {/* BUNDLED ORDERS ACCORDION */}
                    <div className="p-4 bg-white space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#0073EA]" />
                          <h4 className="font-bold text-xs text-slate-900">
                            Orders Inside This Batch ({ordersInside.length} Orders):
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleBatchExpanded(batch.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 p-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                              <span>Hide Orders</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                              <span>View {ordersInside.length} Orders</span>
                            </>
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <>
                          {ordersInside.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 italic">
                              No orders currently linked to this batch.
                            </p>
                          ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden animate-in fade-in duration-150">
                              {ordersInside.map((ord, idx) => {
                                const firstItem = ord.items?.[0];
                                const isMatch =
                                  searchQuery.trim() &&
                                  (ord.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (ord.peecho_order_id && ord.peecho_order_id.toLowerCase().includes(searchQuery.toLowerCase())));

                                return (
                                  <div
                                    key={ord.id}
                                    className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-colors ${
                                      isMatch ? "bg-amber-50/70" : idx % 2 === 0 ? "bg-slate-50/40" : "bg-white"
                                    }`}
                                  >
                                    {/* Order & Customer */}
                                    <div className="flex items-start gap-3">
                                      <span className="font-mono text-xs font-bold text-slate-400 mt-0.5">
                                        #{idx + 1}
                                      </span>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedOrderForModal(ord)}
                                            className="font-mono font-bold text-sm text-[#0073EA] hover:underline cursor-pointer"
                                          >
                                            {ord.order_number}
                                          </button>
                                          {ord.peecho_order_id && (
                                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                              Peecho: {ord.peecho_order_id}
                                            </span>
                                          )}
                                          {ord.sla_priority && (
                                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                              {ord.sla_priority}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-600 mt-0.5">
                                          Customer: <span className="font-semibold text-slate-800">{ord.customer_name || "N/A"}</span>
                                          {ord.customer_email && ` (${ord.customer_email})`}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Product Specs */}
                                    <div className="flex flex-col text-[11px] text-slate-600 max-w-[260px]">
                                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                        <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{firstItem?.product_type || "POD Publication"}</span>
                                      </div>
                                      <span className="text-slate-400 font-mono text-[10px] mt-0.5">
                                        {firstItem?.page_count || 32} pages • Spine: {firstItem?.spine_width_mm || 8.5}mm
                                      </span>
                                    </div>

                                    {/* Quantity & Actions */}
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <span className="font-mono font-bold text-slate-900 block">
                                          Qty: {ord.total_items_count}
                                        </span>
                                        <span className="text-[10px] text-blue-600 font-medium">
                                          In Batch {batch.batch_number}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {firstItem?.pdf_artwork_url && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs px-2"
                                            leftIcon={<Eye className="w-3 h-3 text-[#0073EA]" />}
                                            onClick={() =>
                                              setSelectedArtworkForModal({
                                                url: firstItem.pdf_artwork_url,
                                                title: `${ord.order_number} - Interior Pages`,
                                              })
                                            }
                                          >
                                            Artwork PDF
                                          </Button>
                                        )}

                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="h-7 text-xs px-2"
                                          onClick={() => setSelectedOrderForModal(ord)}
                                        >
                                          Inspect Order
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* B. COMPACT TABLE VIEW */
            <Card noPadding={true}>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      <th className="py-3 px-4 font-semibold">Batch Number</th>
                      <th className="py-3 px-4 font-semibold">Print Machine</th>
                      <th className="py-3 px-4 font-semibold">Paper & Format</th>
                      <th className="py-3 px-4 font-semibold">Bundled Orders</th>
                      <th className="py-3 px-4 font-semibold">Volume</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {paginatedBatches.map((b) => {
                      const statusCode = getBatchStatusCode(b);
                      const isMutatingThis =
                        updateBatchStatusMutation.isPending &&
                        (updateBatchStatusMutation.variables as any)?.batchId === b.id;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-xs text-[#0073EA] block">
                              {b.batch_number}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(b.created_at).toLocaleDateString()}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {b.press_label || b.target_press}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 block truncate max-w-[180px]">
                              {b.paper_stock}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                              {b.size_format}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {b.orders?.map((ord) => (
                                <button
                                  key={ord.id}
                                  type="button"
                                  onClick={() => setSelectedOrderForModal(ord)}
                                  className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#0073EA] border border-blue-200 hover:bg-blue-100"
                                >
                                  {ord.order_number}
                                </button>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className="font-bold text-slate-800 block">{b.total_orders_count} Orders</span>
                            <span className="text-[11px] text-slate-400">{b.total_sheets_count} Sheets</span>
                          </td>

                          <td className="py-3.5 px-4">
                            {statusCode === "COMPLETED" ? (
                              <Badge variant="success">Completed</Badge>
                            ) : statusCode === "PRINTING" ? (
                              <Badge variant="warning">Printing on Press</Badge>
                            ) : (
                              <Badge variant="primary">Queued to Press</Badge>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                leftIcon={<QrCode className="w-3.5 h-3.5 text-[#0073EA]" />}
                                onClick={() => setSelectedBatchForTicket(b)}
                              >
                                Ticket
                              </Button>

                              {(statusCode === "QUEUED_PRESS" || statusCode === "BATCHED") && (
                                <Button
                                  size="sm"
                                  isLoading={isMutatingThis}
                                  disabled={updateBatchStatusMutation.isPending}
                                  className="h-7 text-xs bg-[#0073EA] hover:bg-[#0060B9] text-white font-bold"
                                  onClick={() =>
                                    updateBatchStatusMutation.mutate({
                                      batchId: b.id,
                                      statusCode: "PRINTING",
                                    })
                                  }
                                >
                                  Send to Press ▶
                                </Button>
                              )}

                              {statusCode === "PRINTING" && (
                                <Button
                                  size="sm"
                                  isLoading={isMutatingThis}
                                  disabled={updateBatchStatusMutation.isPending}
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                  onClick={() =>
                                    updateBatchStatusMutation.mutate({
                                      batchId: b.id,
                                      statusCode: "COMPLETED",
                                    })
                                  }
                                >
                                  Mark Complete ✓
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {filteredBatches.length > 0 && (
            <Pagination
              currentPage={batchesPage}
              totalPages={Math.ceil(filteredBatches.length / batchesPageSize) || 1}
              totalCount={filteredBatches.length}
              pageSize={batchesPageSize}
              pageSizeOptions={[3, 5, 10, 25]}
              onPageChange={setBatchesPage}
              onPageSizeChange={(sz) => {
                setBatchesPageSize(sz);
                setBatchesPage(1);
              }}
              className="rounded-xl border border-slate-200"
            />
          )}
        </div>
      )}

      {/* TAB 2: ORDERS AWAITING PRINT BATCHING */}
      {(activeMainTab === "all" || activeMainTab === "unbatched") && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <Card
            title={
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <span>Orders Awaiting Print Batching</span>
                <span className="text-xs px-2 py-0.5 font-mono font-bold rounded-full bg-amber-100 text-amber-800">
                  {filteredUnbatchedOrders.length} Ready to Print
                </span>
              </div>
            }
            subtitle="These orders passed prepress inspection and are waiting to be assigned to a print press machine."
            noPadding={true}
          >
            {/* Quick Batch Creator Toolbar */}
            {selectedUnbatchedOrderIds.length > 0 && (
              <div className="p-3 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0073EA] bg-white px-2.5 py-1 rounded-md border border-blue-200 shadow-xs">
                    {selectedUnbatchedOrderIds.length} Order{selectedUnbatchedOrderIds.length > 1 ? "s" : ""} Selected
                  </span>
                  <span className="text-slate-600">Select target press and create print batch:</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={targetPressSelection}
                    onChange={(e) => setTargetPressSelection(e.target.value)}
                    className="py-1.5 px-3 bg-white border border-blue-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    {activeMachines.map((m) => (
                      <option key={m.id} value={m.code}>
                        {m.name} {m.sheet_format ? `(${m.sheet_format})` : ""}
                      </option>
                    ))}
                  </select>

                  <Button
                    size="sm"
                    onClick={handleQuickCreateBatch}
                    isLoading={createBatchMutation.isPending}
                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                    className="bg-[#0073EA] hover:bg-[#0060B9]"
                  >
                    Bundle into Batch ({selectedUnbatchedOrderIds.length})
                  </Button>
                </div>
              </div>
            )}

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    <th className="py-3 px-4 w-12 text-center">
                      <button
                        type="button"
                        onClick={handleSelectAllUnbatched}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Select all ready orders"
                      >
                        {filteredUnbatchedOrders.length > 0 &&
                        selectedUnbatchedOrderIds.length === filteredUnbatchedOrders.length ? (
                          <CheckSquare className="w-4 h-4 text-[#0073EA]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-semibold">Order Number</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Publication / Product Specs</th>
                    <th className="py-3 px-4 font-semibold">Qty</th>
                    <th className="py-3 px-4 font-semibold">SLA Priority</th>
                    <th className="py-3 px-4 font-semibold">Prepress Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {eligibleLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-[#0073EA] border-t-transparent animate-spin" />
                          <span>Loading pending orders...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUnbatchedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <p className="font-semibold text-slate-600">No orders awaiting batching</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery
                            ? `No pending orders match "${searchQuery}"`
                            : "All approved orders are currently assigned to print batches."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUnbatchedOrders.map((ord) => {
                      const isSelected = selectedUnbatchedOrderIds.includes(ord.id);
                      const firstItem = ord.items?.[0];

                      return (
                        <tr
                          key={ord.id}
                          onClick={() => toggleSelectUnbatched(ord.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/60"
                          }`}
                        >
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectUnbatched(ord.id)}
                              className="w-4 h-4 rounded text-[#0073EA]"
                            />
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderForModal(ord);
                                }}
                                className="font-mono font-bold text-xs text-[#0073EA] hover:underline text-left cursor-pointer"
                              >
                                {ord.order_number}
                              </button>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {ord.peecho_order_id ? `Peecho: ${ord.peecho_order_id}` : "Direct Intake"}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">{ord.customer_name || "N/A"}</span>
                              <span className="text-[11px] text-slate-400">{ord.customer_email}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col max-w-[240px]">
                              <span className="font-medium text-slate-800 truncate">
                                {firstItem?.product_type || "POD Publication"}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono truncate">
                                {firstItem?.page_count || 32}pp • Spine: {firstItem?.spine_width_mm || 8.5}mm • {firstItem?.paper_stock}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            {ord.total_items_count}
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {ord.sla_priority || "STANDARD"}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <Badge variant="success" size="sm">
                              Prepress Passed
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {firstItem?.pdf_artwork_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  leftIcon={<Eye className="w-3 h-3 text-[#0073EA]" />}
                                  onClick={() =>
                                    setSelectedArtworkForModal({
                                      url: firstItem.pdf_artwork_url,
                                      title: `${ord.order_number} - Interior Artwork`,
                                    })
                                  }
                                >
                                  Artwork
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs px-2"
                                onClick={() => setSelectedOrderForModal(ord)}
                              >
                                Inspect
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredUnbatchedOrders.length > 0 && (
              <Pagination
                currentPage={unbatchedPage}
                totalPages={Math.ceil(filteredUnbatchedOrders.length / unbatchedPageSize) || 1}
                totalCount={filteredUnbatchedOrders.length}
                pageSize={unbatchedPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                onPageChange={setUnbatchedPage}
                onPageSizeChange={(sz) => {
                  setUnbatchedPageSize(sz);
                  setUnbatchedPage(1);
                }}
              />
            )}
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EQUIPMENT & BINDING METHODS MANAGEMENT WORKSPACE      */}
      {/* ======================================================== */}
      {activeMainTab === "equipment" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Subheader & Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Sub-tab Switcher */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEquipmentSubTab("machines");
                  setEquipmentSearch("");
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  equipmentSubTab === "machines"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Printer className="w-4 h-4" />
                Target Print Machines
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    equipmentSubTab === "machines" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {machinesData.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEquipmentSubTab("bindings");
                  setEquipmentSearch("");
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  equipmentSubTab === "bindings"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Binding Methods
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    equipmentSubTab === "bindings" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {bindingMethodsData.length}
                </span>
              </button>
            </div>

            {/* Search & Add Action */}
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="batching_equipment_search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  placeholder={
                    equipmentSubTab === "machines"
                      ? "Search machines by name or code..."
                      : "Search binding methods..."
                  }
                  value={equipmentSearch}
                  onChange={(e) => setEquipmentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
                />
              </div>

              {equipmentSubTab === "machines" ? (
                <Button
                  size="sm"
                  onClick={openAddMachine}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  className="bg-[#0073EA] hover:bg-[#0060B9]"
                >
                  Add Print Machine
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={openAddBinding}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  className="bg-[#0073EA] hover:bg-[#0060B9]"
                >
                  Add Binding Method
                </Button>
              )}
            </div>
          </div>

          {/* PRINT MACHINES GRID */}
          {equipmentSubTab === "machines" && (
            <div className="space-y-4">
              {filteredMachines.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-dashed border-slate-200 text-center">
                  <Printer className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">No Print Machines Found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {equipmentSearch
                      ? `No machines matching "${equipmentSearch}". Try clearing your search.`
                      : "Add your shopfloor printing presses to configure automated batch scheduling."}
                  </p>
                  <Button
                    size="sm"
                    onClick={openAddMachine}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    className="mt-4 bg-[#0073EA] hover:bg-[#0060B9]"
                  >
                    Add Print Machine
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMachines.map((m) => (
                    <div
                      key={m.id}
                      className={`bg-white rounded-xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                        m.is_active ? "border-slate-200 hover:border-slate-300 hover:shadow-md" : "border-slate-200 bg-slate-50/50 opacity-75"
                      }`}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${m.is_active ? "bg-blue-50 text-[#0073EA]" : "bg-slate-100 text-slate-400"}`}>
                              <Printer className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm leading-tight">{m.name}</h4>
                              <span className="font-mono text-[10px] text-slate-500 font-semibold uppercase">{m.code}</span>
                            </div>
                          </div>
                          {m.is_active ? (
                            <Badge variant="success" size="sm" dot>Active</Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">Inactive</Badge>
                          )}
                        </div>

                        {m.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {m.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sheet Format</span>
                            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                              <Maximize2 className="w-3 h-3 text-slate-500" />
                              {m.sheet_format || "Not specified"}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Rated Speed</span>
                            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                              <Gauge className="w-3 h-3 text-slate-500" />
                              {m.max_speed_cph ? `${Number(m.max_speed_cph).toLocaleString()} CPH` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            updateMachineMutation.mutate({
                              id: m.id,
                              data: { is_active: !m.is_active },
                            })
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              m.is_active ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                          {m.is_active ? "Deactivate" : "Activate"}
                        </button>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                            onClick={() => openEditMachine(m)}
                            leftIcon={<Edit className="w-3.5 h-3.5 text-slate-500" />}
                          >
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => setMachineToDelete(m)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BINDING METHODS GRID */}
          {equipmentSubTab === "bindings" && (
            <div className="space-y-4">
              {filteredBindingMethods.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-dashed border-slate-200 text-center">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">No Binding Methods Found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {equipmentSearch
                      ? `No binding methods matching "${equipmentSearch}". Try clearing your search.`
                      : "Add your shopfloor finishing and binding techniques to calculate spine caliper."}
                  </p>
                  <Button
                    size="sm"
                    onClick={openAddBinding}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    className="mt-4 bg-[#0073EA] hover:bg-[#0060B9]"
                  >
                    Add Binding Method
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBindingMethods.map((b) => (
                    <div
                      key={b.id}
                      className={`bg-white rounded-xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                        b.is_active ? "border-slate-200 hover:border-slate-300 hover:shadow-md" : "border-slate-200 bg-slate-50/50 opacity-75"
                      }`}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${b.is_active ? "bg-purple-50 text-purple-600" : "bg-slate-100 text-slate-400"}`}>
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm leading-tight">{b.name}</h4>
                              <span className="font-mono text-[10px] text-slate-500 font-semibold uppercase">{b.code}</span>
                            </div>
                          </div>
                          {b.is_active ? (
                            <Badge variant="success" size="sm" dot>Active</Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">Inactive</Badge>
                          )}
                        </div>

                        {b.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {b.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Page Capacity</span>
                            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                              <Layers className="w-3 h-3 text-slate-500" />
                              {b.min_pages} – {b.max_pages} pgs
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Default Caliper</span>
                            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                              <Ruler className="w-3 h-3 text-slate-500" />
                              {b.default_caliper_mm} mm
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            updateBindingMutation.mutate({
                              id: b.id,
                              data: { is_active: !b.is_active },
                            })
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              b.is_active ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                          {b.is_active ? "Deactivate" : "Activate"}
                        </button>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                            onClick={() => openEditBinding(b)}
                            leftIcon={<Edit className="w-3.5 h-3.5 text-slate-500" />}
                          >
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => setBindingToDelete(b)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <Modal
        isOpen={isAdvancedCreateOpen}
        onClose={() => setIsAdvancedCreateOpen(false)}
        title="Custom Batch Imposition"
        description="Configure press parameters and select specific orders for print grouping."
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAdvancedCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedUnbatchedOrderIds.length === 0}
              isLoading={createBatchMutation.isPending}
              onClick={handleQuickCreateBatch}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Generate Batch ({selectedUnbatchedOrderIds.length} Selected)
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-semibold">Target Print Machine</label>
              <button
                type="button"
                onClick={() => {
                  setIsAdvancedCreateOpen(false);
                  setActiveMainTab("equipment");
                  setEquipmentSubTab("machines");
                }}
                className="text-[11px] text-[#0073EA] hover:underline flex items-center gap-1 font-medium"
              >
                <Settings className="w-3 h-3" /> Manage Machines
              </button>
            </div>
            <select
              value={targetPressSelection}
              onChange={(e) => setTargetPressSelection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold"
            >
              {activeMachines.map((m) => (
                <option key={m.id} value={m.code}>
                  {m.name} {m.sheet_format ? `(${m.sheet_format})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-semibold">Binding Method</label>
              <button
                type="button"
                onClick={() => {
                  setIsAdvancedCreateOpen(false);
                  setActiveMainTab("equipment");
                  setEquipmentSubTab("bindings");
                }}
                className="text-[11px] text-[#0073EA] hover:underline flex items-center gap-1 font-medium"
              >
                <Settings className="w-3 h-3" /> Manage Bindings
              </button>
            </div>
            <select
              value={bindingTypeSelection}
              onChange={(e) => setBindingTypeSelection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold"
            >
              {activeBindingMethods.map((b) => (
                <option key={b.id} value={b.code}>
                  {b.name} ({b.min_pages}–{b.max_pages} pgs)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Paper Type & Weight</label>
            <input
              type="text"
              name="batching_paper_stock"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              value={paperStockInput}
              onChange={(e) => setPaperStockInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Select Orders ({selectedUnbatchedOrderIds.length} Selected)
            </label>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
              {rawEligibleOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => toggleSelectUnbatched(ord.id)}
                  className="p-2.5 flex items-center justify-between hover:bg-white cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedUnbatchedOrderIds.includes(ord.id)}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 rounded text-[#0073EA] pointer-events-none"
                    />
                    <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                    <span className="text-slate-500">• {ord.customer_name}</span>
                  </div>
                  <span className="font-mono text-slate-600">Qty: {ord.total_items_count}</span>
                </div>
              ))}
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
        maxWidth="2xl"
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
              <h4 className="font-semibold text-slate-800 mb-2">
                Orders Bundled in this Batch ({selectedBatchForTicket.orders?.length || 0}):
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {selectedBatchForTicket.orders?.map((ord) => (
                  <div key={ord.id} className="p-3 bg-white flex items-center justify-between text-xs hover:bg-blue-50/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                        <span className="text-slate-400 font-mono text-[11px]">[{ord.peecho_order_id || "Direct"}]</span>
                        <span className="text-[10px] text-slate-500">• {ord.customer_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {ord.items?.[0]?.product_type} • Qty: {ord.total_items_count} • Spine: {ord.items?.[0]?.spine_width_mm}mm
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForModal(ord)}
                        className="font-mono text-[10px] text-[#0073EA] bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-100 font-semibold"
                      >
                        Inspect Order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: ORDER QUICK INSPECTION MODAL */}
      <Modal
        isOpen={!!selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        title={
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#0073EA]" />
            <span>Order Details • {selectedOrderForModal?.order_number}</span>
          </div>
        }
        description="Specifications, customer details, assigned batch, and print artwork."
        maxWidth="2xl"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedOrderForModal(null)}
          >
            Close
          </Button>
        }
      >
        {selectedOrderForModal && (
          <div className="space-y-4 text-xs">
            {/* Order Overview Header Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] text-slate-400">ORDER NUMBER</span>
                  <h3 className="font-mono font-bold text-base text-slate-900">
                    {selectedOrderForModal.order_number}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[11px] text-slate-400">PEECHO ID</span>
                  <p className="font-mono font-semibold text-slate-700">
                    {selectedOrderForModal.peecho_order_id || "Direct API"}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-900">{selectedOrderForModal.customer_name || "N/A"}</span>
                  <span className="text-slate-400">({selectedOrderForModal.customer_email || "no email"})</span>
                </div>
                {selectedOrderForModal.sla_priority && (
                  <Badge variant="primary" size="sm">
                    {selectedOrderForModal.sla_priority}
                  </Badge>
                )}
              </div>
            </div>

            {/* Assigned Batch Details if available */}
            {selectedOrderForModal.batch_info ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#0073EA]" />
                  <div>
                    <span className="font-bold text-slate-900">
                      Assigned to Batch: {selectedOrderForModal.batch_info.batch_number}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Machine: {selectedOrderForModal.batch_info.press_label || selectedOrderForModal.batch_info.target_press}
                    </p>
                  </div>
                </div>
                <Badge variant="primary" size="sm">
                  {selectedOrderForModal.batch_info.status_name || selectedOrderForModal.batch_info.status_code || "In Production"}
                </Badge>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="font-bold text-slate-900">
                      Not Yet Assigned to a Print Batch
                    </span>
                    <p className="text-[11px] text-slate-500">
                      This order is awaiting press assignment in Section 1 above.
                    </p>
                  </div>
                </div>
                <Badge variant="warning" size="sm">
                  Waiting to Print
                </Badge>
              </div>
            )}

            {/* Order Items & Specifications */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Item Specifications & Artwork Files:</h4>
              <div className="space-y-2">
                {selectedOrderForModal.items?.map((item, idx) => (
                  <div key={item.id || idx} className="p-3 border border-slate-200 rounded-xl bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#0073EA]" />
                        <span className="font-semibold text-slate-900">{item.product_type}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        Qty: {item.quantity}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg text-[11px] font-mono">
                      <div>
                        <span className="text-slate-400 block font-sans">Pages:</span>
                        <span className="font-semibold text-slate-800">{item.page_count} pp</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Spine Width:</span>
                        <span className="font-semibold text-slate-800">{item.spine_width_mm} mm</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Paper Weight:</span>
                        <span className="font-semibold text-slate-800">{item.paper_stock || "200gsm Silk"}</span>
                      </div>
                    </div>

                    {/* Artwork Preview Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {item.pdf_artwork_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          leftIcon={<Eye className="w-3 h-3 text-[#0073EA]" />}
                          onClick={() =>
                            setSelectedArtworkForModal({
                              url: item.pdf_artwork_url,
                              title: `${selectedOrderForModal.order_number} - Interior Pages`,
                            })
                          }
                        >
                          Preview Interior (PDF)
                        </Button>
                      )}

                      {item.pdf_cover_url && item.pdf_cover_url !== item.pdf_artwork_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          leftIcon={<Eye className="w-3 h-3 text-purple-600" />}
                          onClick={() =>
                            setSelectedArtworkForModal({
                              url: item.pdf_cover_url,
                              title: `${selectedOrderForModal.order_number} - Cover Wrap`,
                            })
                          }
                        >
                          Preview Cover Wrap (PDF)
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4: EMBEDDED ARTWORK PDF VIEWER */}
      <Modal
        isOpen={!!selectedArtworkForModal}
        onClose={() => setSelectedArtworkForModal(null)}
        title={
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0073EA]" />
            <span>{selectedArtworkForModal?.title || "Artwork Document Preview"}</span>
          </div>
        }
        description="High-resolution document verification for machine imposition."
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedArtworkForModal(null)}
            >
              Close
            </Button>
            {selectedArtworkForModal && (
              <a
                href={selectedArtworkForModal.url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0073EA] hover:bg-[#0060B9] text-white rounded-lg font-semibold text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </a>
            )}
          </div>
        }
      >
        {selectedArtworkForModal && (
          <div className="h-[520px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
            <iframe
              src={selectedArtworkForModal.url}
              className="w-full h-full border-0"
              title="Artwork Preview"
            />
          </div>
        )}
      </Modal>

      {/* MODAL 5: ADD / EDIT PRINT MACHINE */}
      <Modal
        isOpen={isMachineModalOpen}
        onClose={() => setIsMachineModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#0073EA]" />
            <span>{editingMachine ? `Edit Print Machine: ${editingMachine.name}` : "Add New Target Print Machine"}</span>
          </div>
        }
        description="Register or modify a digital press or offset print machine for automated batch scheduling."
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setIsMachineModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveMachine}
              isLoading={createMachineMutation.isPending || updateMachineMutation.isPending}
              className="bg-[#0073EA] hover:bg-[#0060B9]"
            >
              {editingMachine ? "Update Machine" : "Save Machine"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveMachine} autoComplete="off" className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Machine Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="machine_form_name"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              required
              placeholder="e.g. HP Indigo 12000 (B2 Sheetfed)"
              value={machineForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setMachineForm((prev) => ({
                  ...prev,
                  name,
                  code: editingMachine ? prev.code : name.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_"),
                }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Machine Code (Slug Identifier) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="machine_form_code"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              required
              placeholder="e.g. HP_INDIGO_12000"
              value={machineForm.code}
              onChange={(e) =>
                setMachineForm((prev) => ({
                  ...prev,
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
                }))
              }
              className="w-full font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Programmatic key used on batch job tickets and QR code barcodes (uppercase & underscores).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Sheet Format</label>
              <input
                type="text"
                name="machine_form_sheet_format"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="e.g. B2 (530 x 750 mm)"
                value={machineForm.sheet_format}
                onChange={(e) => setMachineForm((prev) => ({ ...prev, sheet_format: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Max Speed (CPH)</label>
              <input
                type="number"
                name="machine_form_speed"
                autoComplete="off"
                data-lpignore="true"
                min="0"
                placeholder="e.g. 4600"
                value={machineForm.max_speed_cph}
                onChange={(e) => setMachineForm((prev) => ({ ...prev, max_speed_cph: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Operational description, capabilities, or maintenance notes..."
              value={machineForm.description}
              onChange={(e) => setMachineForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="machine_is_active"
              checked={machineForm.is_active}
              onChange={(e) => setMachineForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0073EA] focus:ring-[#0073EA]/30 border-slate-300"
            />
            <label htmlFor="machine_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active for Production Scheduling & Batch Creation
            </label>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: ADD / EDIT BINDING METHOD */}
      <Modal
        isOpen={isBindingModalOpen}
        onClose={() => setIsBindingModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <span>{editingBinding ? `Edit Binding Method: ${editingBinding.name}` : "Add New Binding Method"}</span>
          </div>
        }
        description="Register or modify a binding method and caliper specification for automated spine calculation."
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setIsBindingModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveBinding}
              isLoading={createBindingMutation.isPending || updateBindingMutation.isPending}
              className="bg-[#0073EA] hover:bg-[#0060B9]"
            >
              {editingBinding ? "Update Binding Method" : "Save Binding Method"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveBinding} autoComplete="off" className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Binding Method Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="binding_form_name"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              required
              placeholder="e.g. Hardcover Casebound (3mm Greyboard)"
              value={bindingForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setBindingForm((prev) => ({
                  ...prev,
                  name,
                  code: editingBinding ? prev.code : name.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_"),
                }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Binding Code (Slug Identifier) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="binding_form_code"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              required
              placeholder="e.g. HARDCOVER_CASEBOUND"
              value={bindingForm.code}
              onChange={(e) =>
                setBindingForm((prev) => ({
                  ...prev,
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
                }))
              }
              className="w-full font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Programmatic key used on batch job tickets and QR code barcodes (uppercase & underscores).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Min Pages</label>
              <input
                type="number"
                name="binding_form_min_pages"
                autoComplete="off"
                data-lpignore="true"
                min="1"
                placeholder="24"
                value={bindingForm.min_pages}
                onChange={(e) => setBindingForm((prev) => ({ ...prev, min_pages: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Max Pages</label>
              <input
                type="number"
                name="binding_form_max_pages"
                autoComplete="off"
                data-lpignore="true"
                min="1"
                placeholder="800"
                value={bindingForm.max_pages}
                onChange={(e) => setBindingForm((prev) => ({ ...prev, max_pages: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Caliper (mm)</label>
              <input
                type="number"
                name="binding_form_caliper"
                autoComplete="off"
                data-lpignore="true"
                step="0.01"
                min="0"
                placeholder="3.00"
                value={bindingForm.default_caliper_mm}
                onChange={(e) => setBindingForm((prev) => ({ ...prev, default_caliper_mm: Number(e.target.value) || 0 }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Finishing instructions, casing materials, or spine guidelines..."
              value={bindingForm.description}
              onChange={(e) => setBindingForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="binding_is_active"
              checked={bindingForm.is_active}
              onChange={(e) => setBindingForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0073EA] focus:ring-[#0073EA]/30 border-slate-300"
            />
            <label htmlFor="binding_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active for Production Scheduling & Batch Creation
            </label>
          </div>
        </form>
      </Modal>

      {/* MODAL 7: DELETE CONFIRMATION */}
      <Modal
        isOpen={!!machineToDelete || !!bindingToDelete}
        onClose={() => {
          setMachineToDelete(null);
          setBindingToDelete(null);
        }}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <AlertCircle className="w-5 h-5" />
            <span>Confirm Deletion</span>
          </div>
        }
        description="Are you sure you want to permanently delete this equipment record?"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMachineToDelete(null);
                setBindingToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={deleteMachineMutation.isPending || deleteBindingMutation.isPending}
              onClick={() => {
                if (machineToDelete) {
                  deleteMachineMutation.mutate(machineToDelete.id);
                } else if (bindingToDelete) {
                  deleteBindingMutation.mutate(bindingToDelete.id);
                }
              }}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Permanently Delete
            </Button>
          </div>
        }
      >
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
          <p className="font-semibold">
            {machineToDelete && `Print Machine: ${machineToDelete.name} (${machineToDelete.code})`}
            {bindingToDelete && `Binding Method: ${bindingToDelete.name} (${bindingToDelete.code})`}
          </p>
          <p className="text-[11px] text-rose-700">
            This will remove the item from all batching dropdowns. Existing historical batches already printed on this machine will retain their recorded names safely.
          </p>
        </div>
      </Modal>
    </div>
  );
}
