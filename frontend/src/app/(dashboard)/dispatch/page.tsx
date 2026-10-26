"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  PackageCheck,
  Globe2,
  ScanLine,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  RefreshCw,
  Send,
  FileText,
  Weight,
  MapPin,
  Calendar,
  Box,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Download,
  Check,
} from "lucide-react";
import { dispatchApi } from "@/services/api/dispatch";
import { ordersApi } from "@/services/api/orders";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Shipment,
  Order,
  ConfirmDispatchPayload,
  CarrierEvent,
} from "@/services/api/types";
import { useNotifications } from "@/context/notification-context";

// Sound effect synthesizer for instant feedback
const playAudioFeedback = (type: "success" | "sync") => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (err) {
    console.debug("Audio feedback skipped:", err);
  }
};

const CARRIERS_LIST = [
  { code: "SELF_DELIVERY", name: "Own Delivery Person (In-House)", color: "from-emerald-500 to-teal-600", transit: "Direct / Same-Day" },
  { code: "DHL", name: "DHL Express Worldwide", color: "from-yellow-400 to-amber-500", transit: "1-3 Days" },
  { code: "FEDEX", name: "FedEx Priority", color: "from-purple-600 to-indigo-600", transit: "2-4 Days" },
  { code: "ARAMEX", name: "Aramex International", color: "from-red-500 to-rose-600", transit: "3-5 Days" },
  { code: "UPS", name: "UPS Worldwide Express", color: "from-amber-700 to-amber-900", transit: "2-4 Days" },
  { code: "BLUEDART", name: "BlueDart Express", color: "from-blue-600 to-indigo-700", transit: "1-2 Days" },
  { code: "DTDC", name: "DTDC Express", color: "from-cyan-600 to-blue-600", transit: "2-3 Days" },
];

export default function DispatchPage() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  // Form State for Packing & Dispatch Station
  const [orderSearch, setOrderSearch] = useState<string>("");
  const [selectedCarrier, setSelectedCarrier] = useState<string>("DHL");
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("0.650");
  const [packageType, setPackageType] = useState<string>("BUBBLE_MAILER");
  const [shippingCost, setShippingCost] = useState<string>("16.50");
  const [notes, setNotes] = useState<string>("");
  const [triggerPeechoSync, setTriggerPeechoSync] = useState<boolean>(true);

  // Filter & Modal State
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [selectedShipmentForTimeline, setSelectedShipmentForTimeline] = useState<Shipment | null>(null);
  const [lastDispatchedShipment, setLastDispatchedShipment] = useState<Shipment | null>(null);

  // Queries
  const { data: shipmentsData, isLoading: isLoadingShipments, refetch: refetchShipments } = useQuery({
    queryKey: ["dispatch", "shipments", searchFilter],
    queryFn: () => dispatchApi.getShipments({ search: searchFilter || undefined }),
    refetchInterval: 5000,
  });

  const {
    data: readyOrdersData,
    isLoading: isLoadingReady,
    isRefetching: isRefetchingReady,
    refetch: refetchReadyOrders,
  } = useQuery({
    queryKey: ["orders", "readyForDispatch"],
    queryFn: () => ordersApi.getOrders({ status: "PACKED,READY_FOR_DISPATCH" }),
    refetchInterval: 4000,
  });

  // Fallback single order search if typed manually and not in ready queue
  const { data: searchedOrderData } = useQuery({
    queryKey: ["orders", "dispatchLookup", orderSearch],
    queryFn: () => ordersApi.getOrders({ search: orderSearch.trim() }),
    enabled: !!orderSearch.trim(),
  });

  // Selected Order for Dispatch Lookup
  const activeOrder = useMemo(() => {
    if (!orderSearch.trim()) return null;
    const clean = orderSearch.trim().toLowerCase();
    const foundInReady = readyOrdersData?.results.find(
      (o) =>
        o.order_number.toLowerCase() === clean ||
        o.peecho_order_id.toLowerCase() === clean ||
        o.order_number.toLowerCase().includes(clean) ||
        o.customer_name.toLowerCase().includes(clean)
    );
    if (foundInReady) return foundInReady;
    return searchedOrderData?.results?.[0] || null;
  }, [orderSearch, readyOrdersData, searchedOrderData]);

  // Mutations
  const confirmDispatchMutation = useMutation({
    mutationFn: (payload: ConfirmDispatchPayload) => dispatchApi.confirmDispatch(payload),
    onSuccess: (data) => {
      setLastDispatchedShipment(data.shipment);
      playAudioFeedback("success");
      setOrderSearch("");
      setTrackingNumber("");
      setNotes("");

      const orderNum = data.shipment?.order_number || activeOrder?.order_number || "Order";
      addNotification({
        title: `Order Dispatched: ${orderNum}`,
        message: `Assigned to ${data.shipment?.carrier_name || "Courier"}. Tracking: ${data.shipment?.tracking_number}. Peecho tracking synced.`,
        type: "success",
        category: "DISPATCH",
        orderNumber: orderNum,
        link: "/dispatch",
      });

      queryClient.invalidateQueries({ queryKey: ["dispatch", "shipments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.error || err?.response?.data?.detail || "Dispatch confirmation failed.";
      addNotification({
        title: "Dispatch Failed",
        message: errMsg,
        type: "error",
        category: "DISPATCH",
      });
    },
  });

  const retryPeechoSyncMutation = useMutation({
    mutationFn: (shipmentId: string) => dispatchApi.retryPeechoSync(shipmentId),
    onSuccess: (data) => {
      playAudioFeedback("sync");
      queryClient.invalidateQueries({ queryKey: ["dispatch", "shipments"] });
      if (selectedShipmentForTimeline?.id === data.shipment.id) {
        setSelectedShipmentForTimeline(data.shipment);
      }
      const orderNum = data.shipment?.order_number || "Order";
      addNotification({
        title: `Peecho Sync Confirmed: ${orderNum}`,
        message: `Shipment tracking synchronized with Peecho API Gateway.`,
        type: "success",
        category: "STATUS_SYNC",
        orderNumber: orderNum,
        link: "/dispatch",
      });
    },
  });

  const pollTrackingMutation = useMutation({
    mutationFn: (shipmentId: string) => dispatchApi.pollTracking(shipmentId),
    onSuccess: (data) => {
      playAudioFeedback("sync");
      queryClient.invalidateQueries({ queryKey: ["dispatch", "shipments"] });
      if (selectedShipmentForTimeline?.id === data.shipment.id) {
        setSelectedShipmentForTimeline(data.shipment);
      }
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ shipmentId, milestoneCode }: { shipmentId: string; milestoneCode: string }) =>
      dispatchApi.updateMilestone(shipmentId, milestoneCode),
    onSuccess: (data) => {
      playAudioFeedback("sync");
      queryClient.invalidateQueries({ queryKey: ["dispatch", "shipments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (selectedShipmentForTimeline?.id === data.shipment.id) {
        setSelectedShipmentForTimeline(data.shipment);
      }
      const orderNum = data.shipment?.order_number || "Order";
      addNotification({
        title: `Milestone Auto-Synced: ${orderNum}`,
        message: `Milestone updated to '${data.shipment?.status_code}'. Peecho sync confirmed.`,
        type: "success",
        category: "STATUS_SYNC",
        orderNumber: orderNum,
        link: "/dispatch",
      });
    },
  });


  const handleSelectOrder = (order: Order) => {
    setOrderSearch(order.order_number);
    // Auto-generate realistic draft tracking number
    if (selectedCarrier === "SELF_DELIVERY") {
      setTrackingNumber(`DELIVERY-${order.order_number}`);
    } else {
      const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
      setTrackingNumber(`${selectedCarrier}-${randomDigits}`);
    }
  };

  const handleCarrierChange = (code: string) => {
    setSelectedCarrier(code);
    if (code === "SELF_DELIVERY") {
      setShippingCost("0.00");
      if (!trackingNumber || trackingNumber.includes("-")) {
        const orderSuffix = activeOrder?.order_number || Math.floor(1000 + Math.random() * 9000);
        setTrackingNumber(`DELIVERY-${orderSuffix}`);
      }
    } else {
      if (shippingCost === "0.00") setShippingCost("16.50");
      if (!trackingNumber || trackingNumber.startsWith("DELIVERY-") || trackingNumber.includes("-")) {
        const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
        setTrackingNumber(`${code}-${randomDigits}`);
      }
    }
  };

  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = activeOrder ? activeOrder.order_number : orderSearch.trim();
    if (!identifier || !trackingNumber.trim()) return;

    const carrierObj = CARRIERS_LIST.find((c) => c.code === selectedCarrier);
    const resolvedCarrierName = carrierObj?.name || selectedCarrier;

    confirmDispatchMutation.mutate({
      order_identifier: identifier,
      carrier_code: selectedCarrier,
      carrier_name: resolvedCarrierName,
      tracking_number: trackingNumber.trim(),
      weight_kg: weightKg,
      package_type: packageType,
      shipping_cost: shippingCost,
      notes: notes.trim() || undefined,
      trigger_peecho_sync: triggerPeechoSync,
    });
  };

  // Metrics Calculations
  const shipments = shipmentsData?.results || [];
  const totalCount = shipments.length;
  const inTransitCount = shipments.filter((s) => s.status_code === "IN_TRANSIT").length;
  const outForDeliveryCount = shipments.filter((s) => s.status_code === "OUT_FOR_DELIVERY").length;
  const deliveredCount = shipments.filter((s) => s.status_code === "DELIVERED").length;
  const peechoSyncedCount = shipments.filter((s) => s.peecho_synced).length;
  const syncPercentage = totalCount > 0 ? Math.round((peechoSyncedCount / totalCount) * 100) : 100;

  const filteredShipments = useMemo(() => {
    if (statusFilter === "ALL") return shipments;
    if (statusFilter === "PEECHO_PENDING") return shipments.filter((s) => !s.peecho_synced);
    return shipments.filter((s) => s.status_code === statusFilter);
  }, [shipments, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Logistics Stats Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0073EA] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Packing & Shipping</h1>
              <Badge variant="success" className="font-semibold text-xs">
                Live Courier Sync
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign tracking numbers to packed orders, generate shipping labels, and notify Peecho.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchShipments()}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3.5 border-slate-200/80">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0073EA] flex items-center justify-center font-bold">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Shipped</p>
            <p className="text-xl font-bold text-slate-900">{totalCount}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5 border-slate-200/80">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <RotateCw className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">In Transit</p>
            <p className="text-xl font-bold text-amber-600">{inTransitCount}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5 border-slate-200/80">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Delivered</p>
            <p className="text-xl font-bold text-emerald-600">{deliveredCount}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5 border-slate-200/80">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Sync Rate</p>
            <p className="text-xl font-bold text-blue-600">{syncPercentage}%</p>
          </div>
        </Card>
      </div>

      {/* Main Dispatch Workbench: Left Packaging & Dispatch Terminal, Right Quick Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Columns: Packing & Dispatch Form */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-[#0073EA]" />
                <CardTitle className="text-sm font-bold text-slate-900">Pack & Ship Order</CardTitle>
              </div>
              <Badge variant="neutral" className="text-xs font-mono">
                SHIPPING STATION
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Step 1: Scan Order */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[#0073EA]" />
                  <span>1. Enter Order Number</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Enter order number e.g. SP-2026-90412..."
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0073EA] focus:border-transparent transition-all"
                  />
                  {orderSearch && (
                    <button
                      onClick={() => setOrderSearch("")}
                      className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick select chips from ready queue */}
                {readyOrdersData?.results && readyOrdersData.results.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">Ready Orders:</span>
                    {readyOrdersData.results.slice(0, 4).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleSelectOrder(o)}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                          orderSearch === o.order_number
                            ? "bg-blue-50 text-[#0073EA] border-blue-300 font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {o.order_number} ({o.customer_name})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Order Details Card (if resolved) */}
              {activeOrder && (
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{activeOrder.order_number}</span>
                      <span className="text-slate-500 font-mono">Peecho ID: {activeOrder.peecho_order_id}</span>
                    </div>
                    <Badge variant="info" className="text-[10px]">
                      {activeOrder.sla_priority}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400">Customer:</span>{" "}
                      <strong className="text-slate-700">{activeOrder.customer_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Destination:</span>{" "}
                      <strong className="text-slate-700">
                        {activeOrder.shipping_address?.city || "Amsterdam"},{" "}
                        {activeOrder.shipping_address?.country || "NL"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Quantity:</span>{" "}
                      <strong className="text-slate-700">{activeOrder.total_items_count} Units</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Controls */}
              <form onSubmit={handleConfirmDispatch} className="space-y-4 pt-2">
                {/* Carrier Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#0073EA]" />
                    <span>2. Select Courier</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CARRIERS_LIST.map((c) => {
                      const isSelected = selectedCarrier === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleCarrierChange(c.code)}
                          className={`p-3 rounded-xl border text-left transition-all relative ${
                            isSelected
                              ? "border-[#0073EA] bg-blue-50/70 text-[#0073EA] shadow-xs ring-1 ring-[#0073EA]"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{c.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#0073EA]" />}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">Est. Delivery: {c.transit}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tracking Number & Weight */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {selectedCarrier === "SELF_DELIVERY" ? (
                        <>3. Delivery Person / Run Reference <span className="text-rose-500">*</span></>
                      ) : (
                        <>3. Tracking Number <span className="text-rose-500">*</span></>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder={
                        selectedCarrier === "SELF_DELIVERY"
                          ? "e.g. Driver: Mohan (+91 98765 43210) or Run-01"
                          : "e.g. DHL-9920194812"
                      }
                      className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0073EA]"
                    />
                    {selectedCarrier === "SELF_DELIVERY" && (
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                        ✓ In-house delivery. You can manually update status to Out for Delivery and Delivered.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Parcel Weight (kg)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">kg</span>
                    </div>
                  </div>
                </div>

                {/* Package Type & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Packaging Type
                    </label>
                    <select
                      value={packageType}
                      onChange={(e) => setPackageType(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA] bg-white"
                    >
                      <option value="BUBBLE_MAILER">Bubble Mailer (Single Book)</option>
                      <option value="RIGID_BOOK_BOX">Book Box (Hardcovers & Sets)</option>
                      <option value="FLUTED_CARTON">Cardboard Box</option>
                      <option value="PALLET_CRATE">Pallet Crate (Bulk)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Verified packaging, bubble wrap added"
                      className="w-full h-10 px-3.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0073EA]"
                    />
                  </div>
                </div>

                {/* Automated Peecho Callback Checkbox */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="peecho-sync-toggle"
                      type="checkbox"
                      checked={triggerPeechoSync}
                      onChange={(e) => setTriggerPeechoSync(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0073EA] focus:ring-[#0073EA] border-slate-300"
                    />
                    <label htmlFor="peecho-sync-toggle" className="text-xs font-medium text-slate-700 cursor-pointer">
                      Automatically notify Peecho of shipment and tracking number
                    </label>
                  </div>
                  <Globe2 className="w-4 h-4 text-[#0073EA]" />
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  disabled={confirmDispatchMutation.isPending || !trackingNumber.trim() || (!activeOrder && !orderSearch.trim())}
                  className="w-full h-12 bg-[#0073EA] hover:bg-[#0060B9] text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs"
                >
                  {confirmDispatchMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Confirm Shipping & Update Tracking</span>
                </Button>
              </form>

              {/* Confirmation Banner */}
              {lastDispatchedShipment && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-sm">Order Shipped Successfully</span>
                    </div>
                    <Badge variant="success" className="font-mono text-xs">
                      {lastDispatchedShipment.tracking_number}
                    </Badge>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Order <strong>{lastDispatchedShipment.order_number}</strong> assigned to{" "}
                    <strong>{lastDispatchedShipment.carrier_name}</strong>. Peecho tracking updated.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 4 Columns: Ready to Ship Queue */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-[#0073EA]" />
                <CardTitle className="text-sm font-bold text-slate-900">Ready to Ship</CardTitle>
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Auto-sync
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral" className="text-xs font-mono">
                  {readyOrdersData?.count || 0} Orders
                </Badge>
                <button
                  type="button"
                  onClick={() => refetchReadyOrders()}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Refresh Ready to Ship Queue"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefetchingReady ? "animate-spin text-[#0073EA]" : ""}`} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto divide-y divide-slate-100">
              {readyOrdersData?.results && readyOrdersData.results.length > 0 ? (
                readyOrdersData.results.map((order: Order) => (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className="p-3.5 hover:bg-blue-50/50 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-900">{order.order_number}</span>
                        <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                          {order.sla_priority}
                        </Badge>
                        {order.status_details && (
                          <Badge
                            variant="custom"
                            bgHex={order.status_details.badge_bg}
                            textHex={order.status_details.badge_text}
                            className="text-[10px] py-0 px-1.5 font-semibold"
                          >
                            {order.status_details.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {order.customer_name} • {order.shipping_address?.city || "Amsterdam"},{" "}
                        {order.shipping_address?.country || "NL"}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  No orders currently waiting to be shipped.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Carrier Policy Guide */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0073EA]" />
              <span>Shipping Policy</span>
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Orders should be shipped and tracking numbers assigned within 24 hours of printing completion.
            </p>
          </div>
        </div>

      </div>

      {/* Bottom Section: Live Shipments Table */}
      <Card>
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#0073EA]" />
            <CardTitle className="text-sm font-bold text-slate-900">Shipments & Tracking</CardTitle>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: "All Shipments" },
              { id: "IN_TRANSIT", label: "In Transit" },
              { id: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
              { id: "DELIVERED", label: "Delivered" },
              { id: "PEECHO_PENDING", label: "Needs Sync" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  statusFilter === f.id
                    ? "bg-[#0073EA] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                <th className="py-3 px-4">Order Number</th>
                <th className="py-3 px-4">Customer & Address</th>
                <th className="py-3 px-4">Courier & Tracking</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Peecho Sync</th>
                <th className="py-3 px-4">Date Shipped</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingShipments ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading shipments...
                  </td>
                </tr>
              ) : filteredShipments.length > 0 ? (
                filteredShipments.map((shipment: Shipment) => (
                  <tr key={shipment.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">{shipment.order_number}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Peecho: {shipment.peecho_order_id}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{shipment.customer_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {shipment.shipping_address?.city || "Amsterdam"},{" "}
                          {shipment.shipping_address?.country || "NL"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200">
                          {shipment.carrier_code}
                        </span>
                        <span className="font-mono">{shipment.tracking_number}</span>
                      </div>
                      {shipment.tracking_url && (
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#0073EA] hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <span>Track Online</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          shipment.status_code === "DELIVERED"
                            ? "success"
                            : shipment.status_code === "OUT_FOR_DELIVERY"
                            ? "info"
                            : shipment.status_code === "IN_TRANSIT"
                            ? "warning"
                            : "neutral"
                        }
                        className="text-[11px]"
                      >
                        {shipment.status_code.replace("_", " ")}
                      </Badge>
                      {shipment.carrier_events_log && shipment.carrier_events_log.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 max-w-xs">
                          {shipment.carrier_events_log[0].description}
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {shipment.peecho_synced ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Synced</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="danger" className="text-[10px]">
                            Pending
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryPeechoSyncMutation.mutate(shipment.id)}
                            disabled={retryPeechoSyncMutation.isPending}
                            className="h-6 px-2 text-[10px]"
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {shipment.dispatched_at
                        ? new Date(shipment.dispatched_at).toLocaleString()
                        : new Date(shipment.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {shipment.status_code !== "DELIVERED" && shipment.status_code !== "OUT_FOR_DELIVERY" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateMilestoneMutation.mutate({
                                shipmentId: shipment.id,
                                milestoneCode: "OUT_FOR_DELIVERY",
                              })
                            }
                            disabled={updateMilestoneMutation.isPending}
                            title="Mark Out for Delivery"
                            className="h-7 px-2 text-[10px] text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
                          >
                            Out for Delivery
                          </Button>
                        )}

                        {shipment.status_code !== "DELIVERED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateMilestoneMutation.mutate({
                                shipmentId: shipment.id,
                                milestoneCode: "DELIVERED",
                              })
                            }
                            disabled={updateMilestoneMutation.isPending}
                            title="Mark as Delivered"
                            className="h-7 px-2 text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          >
                            Mark Delivered
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pollTrackingMutation.mutate(shipment.id)}
                          disabled={pollTrackingMutation.isPending}
                          title="Check Status from Carrier"
                          className="h-7 px-2 text-[11px] text-[#0073EA] border-blue-200 hover:bg-blue-50"
                        >
                          <RotateCw className="w-3 h-3 mr-1" />
                          <span>Check</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedShipmentForTimeline(shipment)}
                          className="h-7 px-2 text-[11px]"
                        >
                          <span>History</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No shipments match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal: Carrier Timeline & Peecho Payload Inspector */}
      {selectedShipmentForTimeline && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedShipmentForTimeline(null)}
          title={`Shipment Details: ${selectedShipmentForTimeline.tracking_number}`}
        >
          <div className="space-y-5">
            {/* Top Shipment Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Order:</span>{" "}
                <strong className="text-slate-800 font-mono">{selectedShipmentForTimeline.order_number}</strong>
              </div>
              <div>
                <span className="text-slate-400">Carrier:</span>{" "}
                <strong className="text-slate-800">{selectedShipmentForTimeline.carrier_name}</strong>
              </div>
              <div>
                <span className="text-slate-400">Peecho ID:</span>{" "}
                <strong className="text-slate-800 font-mono">{selectedShipmentForTimeline.peecho_order_id}</strong>
              </div>
              <div>
                <span className="text-slate-400">Weight:</span>{" "}
                <strong className="text-slate-800">{selectedShipmentForTimeline.weight_kg} KG</strong>
              </div>
              <div>
                <span className="text-slate-400">Package:</span>{" "}
                <strong className="text-slate-800">{selectedShipmentForTimeline.package_type}</strong>
              </div>
              <div>
                <span className="text-slate-400">AWB Document:</span>{" "}
                {selectedShipmentForTimeline.awb_document_url ? (
                  <a
                    href={selectedShipmentForTimeline.awb_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0073EA] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Download AWB</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (
                  <span className="text-slate-400">N/A</span>
                )}
              </div>
            </div>

            {/* Carrier Milestone Checkpoint Timeline */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0073EA]" />
                  <span>Carrier Checkpoint Milestones</span>
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pollTrackingMutation.mutate(selectedShipmentForTimeline.id)}
                  disabled={pollTrackingMutation.isPending}
                  className="h-7 text-xs"
                >
                  <RotateCw className="w-3 h-3 mr-1" />
                  <span>Advance Checkpoint</span>
                </Button>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {selectedShipmentForTimeline.carrier_events_log && selectedShipmentForTimeline.carrier_events_log.length > 0 ? (
                  selectedShipmentForTimeline.carrier_events_log.map((event: CarrierEvent, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-[#0073EA] flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{event.status}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-600">{event.description}</p>
                        <p className="text-[11px] text-slate-400">{event.location}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No checkpoint updates recorded yet. Click "Advance Checkpoint" to simulate carrier poll.
                  </div>
                )}
              </div>
            </div>

            {/* Raw Peecho Sync Response Payload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-[#0073EA]" />
                  <span>Peecho Gateway Callback Response</span>
                </h4>
                {!selectedShipmentForTimeline.peecho_synced && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryPeechoSyncMutation.mutate(selectedShipmentForTimeline.id)}
                    disabled={retryPeechoSyncMutation.isPending}
                    className="h-6 text-[10px]"
                  >
                    Retry Peecho Sync
                  </Button>
                )}
              </div>

              <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-40 border border-slate-800">
                {JSON.stringify(selectedShipmentForTimeline.peecho_sync_response || { status: "pending" }, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
