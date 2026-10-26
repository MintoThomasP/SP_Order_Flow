"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  SlidersHorizontal,
  PackageCheck,
  Globe2,
  FileCheck2,
  Printer,
  Truck,
  LayoutDashboard,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  Database,
  KeyRound,
  Sparkles,
  Info,
} from "lucide-react";
import { lookupsApi, SystemRole, EntityStatus } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";

export default function ModulePage() {
  const params = useParams();
  const moduleSlug = (params?.module as string) || "overview";
  const queryClient = useQueryClient();

  // Dynamic Lookups Queries
  const { data: rolesData, isLoading: rolesLoading, refetch: refetchRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => lookupsApi.getRoles(),
  });

  const { data: statusesData, isLoading: statusesLoading, refetch: refetchStatuses } = useQuery({
    queryKey: ["statuses"],
    queryFn: () => lookupsApi.getStatuses(),
  });

  // Modals for creating dynamic status / role
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState({
    entity_type: "ORDER",
    code: "",
    name: "",
    badge_color: "blue",
    badge_bg: "#EFF6FF",
    badge_text: "#0073EA",
    sort_order: 10,
    is_terminal: false,
    is_failure_state: false,
    description: "",
  });

  const [newRole, setNewRole] = useState({
    code: "",
    name: "",
    description: "",
    permissions_matrix: { read: true, write: true },
  });

  const createStatusMutation = useMutation({
    mutationFn: (status: Partial<EntityStatus>) => lookupsApi.createStatus(status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
      setIsStatusModalOpen(false);
      setNewStatus({
        entity_type: "ORDER",
        code: "",
        name: "",
        badge_color: "blue",
        badge_bg: "#EFF6FF",
        badge_text: "#0073EA",
        sort_order: 10,
        is_terminal: false,
        is_failure_state: false,
        description: "",
      });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (role: Partial<SystemRole>) => lookupsApi.createRole(role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setIsRoleModalOpen(false);
      setNewRole({
        code: "",
        name: "",
        description: "",
        permissions_matrix: { read: true, write: true },
      });
    },
  });

  // Table column definitions for Statuses
  const statusColumns: Column<EntityStatus>[] = [
    {
      header: "Category",
      accessorKey: "entity_type",
      cell: (st) => (
        <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {st.entity_type}
        </span>
      ),
    },
    {
      header: "Status Badge",
      cell: (st) => (
        <Badge
          variant="custom"
          bgHex={st.badge_bg}
          textHex={st.badge_text}
          dot={true}
        >
          {st.name}
        </Badge>
      ),
    },
    {
      header: "Code",
      accessorKey: "code",
      cell: (st) => (
        <span className="font-mono text-xs text-slate-500 font-medium">
          {st.code}
        </span>
      ),
    },
    {
      header: "Display Order",
      accessorKey: "sort_order",
      className: "text-slate-500 font-mono text-xs",
    },
    {
      header: "Type",
      cell: (st) => (
        <div className="flex items-center gap-1.5">
          {st.is_terminal && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200">
              Final State
            </span>
          )}
          {st.is_failure_state && (
            <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-medium border border-rose-200">
              On Hold
            </span>
          )}
          {!st.is_terminal && !st.is_failure_state && (
            <span className="text-[10px] text-slate-400">In Progress</span>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (st) => (
        <Badge variant={st.is_active ? "success" : "neutral"} size="sm">
          {st.is_active ? "Active" : "Disabled"}
        </Badge>
      ),
    },
  ];

  // Table column definitions for Roles
  const roleColumns: Column<SystemRole>[] = [
    {
      header: "Code",
      accessorKey: "code",
      cell: (r) => (
        <span className="font-mono font-semibold text-xs text-[#0073EA]">
          {r.code}
        </span>
      ),
    },
    {
      header: "Role Name",
      accessorKey: "name",
      cell: (r) => <span className="font-medium text-slate-900">{r.name}</span>,
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: (r) => (
        <span className="text-slate-500 line-clamp-1 max-w-sm text-xs">
          {r.description || "No description provided."}
        </span>
      ),
    },
    {
      header: "Type",
      cell: (r) => (
        <Badge variant={r.is_system_default ? "primary" : "neutral"} size="sm">
          {r.is_system_default ? "Default" : "Custom"}
        </Badge>
      ),
    },
  ];

  // 1. OVERVIEW MODULE
  if (moduleSlug === "overview") {
    return (
      <div className="space-y-6">
        {/* Page Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              POD Operations Center & Peecho Gateway
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live shopfloor metrics, dynamic entity statuses, and automated Peecho order routing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => {
                refetchRoles();
                refetchStatuses();
              }}
            >
              Sync Gateway
            </Button>
            <Button
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => setIsStatusModalOpen(true)}
            >
              Add Dynamic Status
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Active Orders"
            value="1,482"
            change="+14.2%"
            trend="up"
            subtitle="vs. yesterday"
            icon={<PackageCheck className="w-5 h-5" />}
          />
          <StatCard
            title="Peecho Ingested"
            value="384"
            change="100% Synced"
            trend="up"
            subtitle="0 payload drops"
            icon={<Globe2 className="w-5 h-5" />}
          />
          <StatCard
            title="Press RIP Queue"
            value="42 Jobs"
            change="Normal load"
            trend="neutral"
            subtitle="Avg 1.4m / job"
            icon={<Printer className="w-5 h-5" />}
          />
          <StatCard
            title="Ready For Dispatch"
            value="196"
            change="FedEx / DHL"
            trend="up"
            subtitle="Next pickup 16:30"
            icon={<Truck className="w-5 h-5" />}
          />
        </div>

        {/* Dynamic Lookup Statuses Live Preview */}
        <Card
          title="Dynamic Entity Status Registry (Zero Hardcoded Choices)"
          subtitle="All workflow statuses are dynamically resolved and styled via Django REST API."
          action={
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                {statusesData?.count || 0} Statuses Configured
              </Badge>
            </div>
          }
        >
          <Table
            data={statusesData?.results || []}
            columns={statusColumns}
            keyExtractor={(st) => st.id}
            isLoading={statusesLoading}
          />
        </Card>

        {/* Architecture Baseline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            title="Peecho API Gateway Connection"
            subtitle="Automated webhook listener and bidirectional order synchronization."
          >
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <p className="font-semibold text-slate-800">REST API Gateway</p>
                    <p className="text-slate-400 text-[11px]">https://api.peecho.com/v2/orders</p>
                  </div>
                </div>
                <Badge variant="success" size="sm">Active (200 OK)</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-600">
                <div className="p-3 rounded-lg bg-white border border-slate-200">
                  <p className="text-[11px] text-slate-400">Webhook Secret</p>
                  <p className="font-mono text-xs font-semibold text-slate-800 mt-0.5">••••••••9xK1</p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-slate-200">
                  <p className="text-[11px] text-slate-400">Polling Interval</p>
                  <p className="font-mono text-xs font-semibold text-slate-800 mt-0.5">Real-time Hook</p>
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Multi-Environment Database Config"
            subtitle="Decoupled Django settings architecture supporting local SQLite & production PostgreSQL."
          >
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-[#0073EA]" />
                  <div>
                    <p className="font-semibold text-slate-800">Local Dev Engine</p>
                    <p className="text-[11px] text-slate-500">config/settings/local.py (SQLite3)</p>
                  </div>
                </div>
                <Badge variant="primary" size="sm">Active</Badge>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-800">Production Engine</p>
                    <p className="text-[11px] text-slate-500">config/settings/production.py (PostgreSQL / MySQL)</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">Target Config</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 2. DYNAMIC LOOKUPS & RBAC MODULE
  if (moduleSlug === "lookups") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Status & Roles
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure order statuses, job progression states, and user access roles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsRoleModalOpen(true)}
            >
              Add Role
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsStatusModalOpen(true)}
            >
              Add Status
            </Button>
          </div>
        </div>

        {/* Roles Section */}
        <Card
          title="User Roles"
          subtitle="System access roles and permission levels."
          action={
            <Badge variant="primary" size="sm">
              {rolesData?.count || 0} Roles
            </Badge>
          }
        >
          <Table
            data={rolesData?.results || []}
            columns={roleColumns}
            keyExtractor={(r) => r.id}
            isLoading={rolesLoading}
          />
        </Card>

        {/* Statuses Section */}
        <Card
          title="Order & Job Statuses"
          subtitle="Statuses used across orders, print jobs, and shipments."
          action={
            <Badge variant="primary" size="sm">
              {statusesData?.count || 0} Statuses
            </Badge>
          }
        >
          <Table
            data={statusesData?.results || []}
            columns={statusColumns}
            keyExtractor={(st) => st.id}
            isLoading={statusesLoading}
          />
        </Card>

        {/* Modal: Create Entity Status */}
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          title="Add New Status"
          description="Create a new status for orders, jobs, or shipments."
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={createStatusMutation.isPending}
                onClick={() => createStatusMutation.mutate(newStatus)}
              >
                Save Status
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Category</label>
                <select
                  value={newStatus.entity_type}
                  onChange={(e) => setNewStatus({ ...newStatus, entity_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                >
                  <option value="ORDER">Order</option>
                  <option value="PRINT_JOB">Print Job</option>
                  <option value="PEECHO_SYNC">Peecho Sync</option>
                  <option value="SHIPMENT">Shipment</option>
                  <option value="BATCH">Batch</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Code (Unique)</label>
                <input
                  type="text"
                  placeholder="e.g. BINDERY_COMPLETE"
                  value={newStatus.code}
                  onChange={(e) => setNewStatus({ ...newStatus, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Name</label>
              <input
                type="text"
                placeholder="e.g. Bindery Complete"
                value={newStatus.name}
                onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Badge Background</label>
                <input
                  type="color"
                  value={newStatus.badge_bg}
                  onChange={(e) => setNewStatus({ ...newStatus, badge_bg: e.target.value })}
                  className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg p-0.5 cursor-pointer"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Badge Text Color</label>
                <input
                  type="color"
                  value={newStatus.badge_text}
                  onChange={(e) => setNewStatus({ ...newStatus, badge_text: e.target.value })}
                  className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg p-0.5 cursor-pointer"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={newStatus.sort_order}
                  onChange={(e) => setNewStatus({ ...newStatus, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                placeholder="What this status represents..."
                value={newStatus.description}
                onChange={(e) => setNewStatus({ ...newStatus, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newStatus.is_terminal}
                  onChange={(e) => setNewStatus({ ...newStatus, is_terminal: e.target.checked })}
                  className="w-4 h-4 rounded text-[#0073EA]"
                />
                <span className="text-xs text-slate-700 font-medium">Final Completed State</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newStatus.is_failure_state}
                  onChange={(e) => setNewStatus({ ...newStatus, is_failure_state: e.target.checked })}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <span className="text-xs text-slate-700 font-medium">Hold / Error State</span>
              </label>
            </div>
          </div>
        </Modal>

        {/* Modal: Create Role */}
        <Modal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          title="Add New Role"
          description="Create a new access role for team members."
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={createRoleMutation.isPending}
                onClick={() => createRoleMutation.mutate(newRole)}
              >
                Save Role
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role Code</label>
              <input
                type="text"
                placeholder="e.g. QA_LEAD"
                value={newRole.code}
                onChange={(e) => setNewRole({ ...newRole, code: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role Name</label>
              <input
                type="text"
                placeholder="e.g. Quality Assurance Lead"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                placeholder="Role responsibilities and duties..."
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                rows={2}
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // 3. SETTINGS & MULTI-ENVIRONMENT MODULE
  if (moduleSlug === "settings") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            System Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            System configuration, database connectivity, and backend service status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            title="Environment Configuration"
            subtitle="Current database and backend settings."
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-800">backend/config/settings/base.py</p>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  Core settings, REST API endpoints, security headers, and app registrations.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-emerald-900">backend/config/settings/local.py</p>
                  <Badge variant="success" size="sm">Active (Local)</Badge>
                </div>
                <p className="text-[11px] text-emerald-700 font-sans mt-0.5">
                  Local SQLite database for fast response and testing.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">backend/config/settings/production.py</p>
                  <Badge variant="neutral" size="sm">Production</Badge>
                </div>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  PostgreSQL database engine with SSL security and connection pooling.
                </p>
              </div>
            </div>
          </Card>

          <Card
            title="System Data Structure"
            subtitle="Standard audit fields across all orders, jobs, and batches."
          >
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] space-y-1">
              <p className="text-slate-400"># Standard System Model</p>
              <p><span className="text-indigo-400">class</span> <span className="text-amber-300">BaseModel</span>(models.Model):</p>
              <p className="pl-4 text-emerald-400">id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)</p>
              <p className="pl-4 text-emerald-400">created_at = models.DateTimeField(auto_now_add=True, db_index=True)</p>
              <p className="pl-4 text-emerald-400">updated_at = models.DateTimeField(auto_now=True, db_index=True)</p>
              <p className="pl-4 text-emerald-400">is_active = models.BooleanField(default=True, db_index=True)</p>
              <p className="pl-4 mt-2"><span className="text-indigo-400">class</span> <span className="text-amber-300">Meta</span>:</p>
              <p className="pl-8 text-slate-400">abstract = True</p>
              <p className="pl-8 text-slate-400">ordering = ["-created_at"]</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 4. OTHER POD MODULES
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight capitalize">
            {moduleSlug}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational dashboard and settings for this section.
          </p>
        </div>
        <Badge variant="primary" size="md">
          {moduleSlug.toUpperCase()}
        </Badge>
      </div>

      <Card
        title={`${moduleSlug.toUpperCase()} Dashboard`}
        subtitle="Operational workflow and status."
      >
        <div className="py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0073EA] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">
            {moduleSlug.toUpperCase()} Ready
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            All system data and workflows are active and connected.
          </p>
        </div>
      </Card>
    </div>
  );
}
