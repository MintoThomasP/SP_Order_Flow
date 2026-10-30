"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  FileText,
  DollarSign,
  TrendingUp,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Eye,
  Check,
  Building2,
  Calendar,
  CreditCard,
} from "lucide-react";
import { financeApi } from "@/services/api/finance";
import { ordersApi } from "@/services/api/orders";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/context/notification-context";
import {
  PeechoInvoice,
  Order,
} from "@/services/api/types";

export default function FinancePage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Invoice Generation Modal State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<string>("September 2026 / W39");
  const [taxRatePercent, setTaxRatePercent] = useState<string>("21.00");

  // Mark Paid Modal State
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<PeechoInvoice | null>(null);
  const [paymentReference, setPaymentReference] = useState<string>("");

  // Inspect Invoice Line Items Modal State
  const [inspectedInvoice, setInspectedInvoice] = useState<PeechoInvoice | null>(null);

  // Pagination States
  const [invoicesPage, setInvoicesPage] = useState<number>(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState<number>(10);

  // Queries
  const { data: invoicesData, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["finance", "invoices", invoicesPage, invoicesPageSize],
    queryFn: () => financeApi.getInvoices({ page: invoicesPage, page_size: invoicesPageSize }),
  });

  const { data: ordersData } = useQuery({
    queryKey: ["orders", "forInvoicing"],
    queryFn: () => ordersApi.getOrders(),
  });

  // Mutations
  const generateInvoiceMutation = useMutation({
    mutationFn: () =>
      financeApi.generateInvoice({
        billing_period: billingPeriod,
        order_ids: selectedOrderIds.length > 0 ? selectedOrderIds : undefined,
        tax_rate_percent: taxRatePercent,
        currency: "EUR",
      }),
    onSuccess: () => {
      setIsGenerateModalOpen(false);
      setSelectedOrderIds([]);
      queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] });
      toast.success(
        "Invoice Generated Successfully",
        `Monthly billing invoice for period "${billingPeriod}" created and ready for settlement.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || "Failed to generate invoice";
      toast.error("Invoice Generation Failed", msg);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: () => {
      if (!selectedInvoiceForPayment) throw new Error("No invoice selected");
      return financeApi.markInvoicePaid(selectedInvoiceForPayment.id, {
        payment_reference: paymentReference.trim() || `WIRE-EUR-${Math.floor(100000 + Math.random() * 900000)}`,
      });
    },
    onSuccess: () => {
      const invNum = selectedInvoiceForPayment?.invoice_number || "Invoice";
      setSelectedInvoiceForPayment(null);
      setPaymentReference("");
      queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] });
      toast.success(
        "Payment Recorded Successfully",
        `${invNum} has been marked as PAID and settled.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || "Failed to record payment";
      toast.error("Payment Update Failed", msg);
    },
  });

  // Financial KPI Metrics
  const invoices = invoicesData?.results || [];
  const totalRevenue = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + Number(inv.grand_total || 0), 0);
  }, [invoices]);

  const settledRevenue = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "PAID")
      .reduce((acc, inv) => acc + Number(inv.grand_total || 0), 0);
  }, [invoices]);

  const outstandingReceivables = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "ISSUED" || inv.status === "OVERDUE")
      .reduce((acc, inv) => acc + Number(inv.grand_total || 0), 0);
  }, [invoices]);

  const availableOrders = useMemo(() => {
    const list = [...(ordersData?.results || [])];
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [ordersData?.results]);

  const isAllOrdersSelected = useMemo(() => {
    return availableOrders.length > 0 && selectedOrderIds.length === availableOrders.length;
  }, [availableOrders.length, selectedOrderIds.length]);

  const isSomeOrdersSelected = useMemo(() => {
    return selectedOrderIds.length > 0 && selectedOrderIds.length < availableOrders.length;
  }, [availableOrders.length, selectedOrderIds.length]);

  const toggleSelectAllOrders = () => {
    if (isAllOrdersSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(availableOrders.map((o) => o.id));
    }
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0073EA] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Invoices</h1>
              <Badge variant="primary" className="text-xs font-semibold">
                Finance
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer monthly billing invoices, payment reconciliation, and settlements.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => setIsGenerateModalOpen(true)}
            className="bg-[#0073EA] hover:bg-[#0060B9] text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchInvoices()}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200/80">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Total Invoiced</p>
            <span className="p-1.5 rounded-lg bg-blue-50 text-[#0073EA]">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">
            €{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{invoices.length} Invoices</p>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Paid Invoices</p>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-emerald-600 mt-2">
            €{settledRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Payment Received</p>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Unpaid Invoices</p>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-amber-600 mt-2">
            €{outstandingReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">Pending Payment</p>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Average Margin</p>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-blue-600 mt-2">42.8%</p>
          <p className="text-[11px] text-blue-700 mt-0.5">After Material & Print Costs</p>
        </Card>
      </div>

      {/* Invoices Table Card */}
      <Card>
          <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0073EA]" />
              <CardTitle className="text-sm font-bold text-slate-900">Invoices</CardTitle>
            </div>
            <span className="text-[11px] text-slate-400">Peecho B.V.</span>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Invoice Number</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Orders Count</th>
                  <th className="py-3 px-4">Subtotal</th>
                  <th className="py-3 px-4">Tax (21%)</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingInvoices ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading invoices...
                    </td>
                  </tr>
                ) : invoices.length > 0 ? (
                  invoices.map((inv: PeechoInvoice) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {inv.invoice_number}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{inv.billing_period}</div>
                        <div className="text-[11px] text-slate-400">Client: {inv.client_name}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setInspectedInvoice(inv)}
                          className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0073EA] font-semibold text-[11px] hover:bg-blue-100 transition-all flex items-center gap-1"
                        >
                          <span>{inv.orders_count} Orders</span>
                          <Eye className="w-3 h-3" />
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono">
                        €{Number(inv.subtotal_amount).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono">
                        €{Number(inv.tax_amount).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        €{Number(inv.grand_total).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={inv.status === "PAID" ? "success" : inv.status === "ISSUED" ? "warning" : "neutral"}
                          className="text-[11px]"
                        >
                          {inv.status}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct Download Invoice PDF */}
                          <a
                            href={financeApi.getInvoicePdfUrl(inv.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0073EA] transition-all"
                            title="Download Invoice PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>PDF</span>
                          </a>

                          {/* Direct Download Statement */}
                          <a
                            href={financeApi.getSoaPdfUrl(inv.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0073EA] transition-all"
                            title="Download Statement PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>Statement</span>
                          </a>

                          {inv.status !== "PAID" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedInvoiceForPayment(inv);
                                setPaymentReference(`WIRE-EUR-${Math.floor(100000 + Math.random() * 900000)}`);
                              }}
                              className="h-7 px-2 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              <span>Mark Paid</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No invoices created yet. Click "Create Invoice" to generate a new invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100">
              <Pagination
                currentPage={invoicesData?.current_page || invoicesPage}
                totalPages={invoicesData?.total_pages || Math.ceil((invoicesData?.count || 0) / invoicesPageSize) || 1}
                pageSize={invoicesData?.page_size || invoicesPageSize}
                totalCount={invoicesData?.count || 0}
                onPageChange={(p) => setInvoicesPage(p)}
                onPageSizeChange={(s) => {
                  setInvoicesPageSize(s);
                  setInvoicesPage(1);
                }}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </CardContent>
        </Card>


      {/* MODAL: CREATE INVOICE */}
      {isGenerateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsGenerateModalOpen(false)}
          title="Create Customer Invoice"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Billing Period</label>
              <input
                type="text"
                name="finance_billing_period"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value)}
                placeholder="e.g. September 2026 / W39"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#0073EA]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tax Rate (%)</label>
              <input
                type="text"
                name="finance_tax_rate"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#0073EA]"
              />
            </div>

            {/* Orders Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Select Orders to Include</label>
                {availableOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllOrders}
                    className="text-[11px] font-semibold text-[#0073EA] hover:underline cursor-pointer"
                  >
                    {isAllOrdersSelected ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {availableOrders.length > 0 && (
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAllOrdersSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeOrdersSelected;
                        }}
                        onChange={toggleSelectAllOrders}
                        className="w-3.5 h-3.5 rounded text-[#0073EA] focus:ring-0 cursor-pointer"
                      />
                      <span>Select All Orders ({availableOrders.length})</span>
                    </label>
                    <span className="text-[11px] font-normal text-slate-500">
                      {selectedOrderIds.length > 0
                        ? `${selectedOrderIds.length} of ${availableOrders.length} selected`
                        : "All Recent Orders (Default)"}
                    </span>
                  </div>
                )}

                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {availableOrders.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No orders available to invoice.
                    </div>
                  ) : (
                    availableOrders.map((order: Order) => {
                      const isChecked = selectedOrderIds.includes(order.id);
                      return (
                        <div
                          key={order.id}
                          onClick={() => toggleOrderSelection(order.id)}
                          className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked ? "bg-blue-50/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded text-[#0073EA] cursor-pointer"
                            />
                            <span className="font-mono font-bold text-slate-900">{order.order_number}</span>
                            <span className="text-slate-500">({order.customer_name})</span>
                          </div>
                          <span className="font-mono text-slate-700">€{Number(order.total_amount || 14.5).toFixed(2)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsGenerateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => generateInvoiceMutation.mutate()}
                disabled={generateInvoiceMutation.isPending}
                className="bg-[#0073EA] hover:bg-[#0060B9] text-white"
              >
                {generateInvoiceMutation.isPending ? "Generating..." : "Create Invoice"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: MARK INVOICE PAID */}
      {selectedInvoiceForPayment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoiceForPayment(null)}
          title={`Record Payment for ${selectedInvoiceForPayment.invoice_number}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Settle outstanding balance of{" "}
              <strong>
                €{Number(selectedInvoiceForPayment.grand_total).toFixed(2)} {selectedInvoiceForPayment.currency}
              </strong>{" "}
              from Peecho B.V.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Wire Transfer / Payment Reference
              </label>
              <input
                type="text"
                name="finance_payment_reference"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. WIRE-EUR-9918239"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#0073EA]"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedInvoiceForPayment(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => markPaidMutation.mutate()}
                disabled={markPaidMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {markPaidMutation.isPending ? "Recording..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: INSPECT INVOICE LINE ITEMS */}
      {inspectedInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setInspectedInvoice(null)}
          title={`Invoice Details: ${inspectedInvoice.invoice_number}`}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{inspectedInvoice.client_name}</p>
                <p className="text-[11px] text-slate-500">Period: {inspectedInvoice.billing_period}</p>
              </div>
              <p className="font-mono font-bold text-base text-[#0073EA]">
                €{Number(inspectedInvoice.grand_total).toFixed(2)}
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {inspectedInvoice.line_items && inspectedInvoice.line_items.length > 0 ? (
                inspectedInvoice.line_items.map((item) => (
                  <div key={item.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{item.order_number}</div>
                      <div className="text-[11px] text-slate-500">{item.product_description}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900">€{Number(item.line_total).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">{item.quantity} Qty</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  Line items generated from linked order batch.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
