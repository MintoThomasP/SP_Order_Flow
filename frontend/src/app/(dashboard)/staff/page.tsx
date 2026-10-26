"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  ShieldCheck,
  UserPlus,
  KeyRound,
  History,
  FileCode2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Truck,
  Printer,
  FileCheck2,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Sliders,
  MoreVertical,
  Activity,
  Layers,
} from "lucide-react";
import { authApi, lookupsApi, StaffUser, UserAuditLog, SystemRole } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"directory" | "audit-logs" | "matrix">("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [auditFilterAction, setAuditFilterAction] = useState<string>("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<StaffUser | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<UserAuditLog | null>(null);

  // Form states
  const [newUser, setNewUser] = useState({
    email: "",
    password: "Admin@123456",
    first_name: "",
    last_name: "",
    employee_id: "",
    department: "Prepress & Preflight",
    phone_number: "",
    role: "",
  });

  const [assignRoleData, setAssignRoleData] = useState({
    role_id: "",
    reason: "",
  });

  // Queries
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["staff-users", searchQuery],
    queryFn: () => authApi.getUsers(searchQuery || undefined),
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => lookupsApi.getRoles(),
  });

  // Only operational roles can be assigned to human staff (exclude machine daemons like PEECHO_SERVICE)
  const assignableRoles = useMemo(() => {
    return (rolesData?.results || []).filter((r) => r.code !== "PEECHO_SERVICE");
  }, [rolesData?.results]);

  const { data: auditLogsData, isLoading: auditLoading, refetch: refetchAuditLogs } = useQuery({
    queryKey: ["audit-logs", auditFilterAction],
    queryFn: () => authApi.getAuditLogs({ action: auditFilterAction || undefined }),
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (userData: any) => authApi.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setIsCreateModalOpen(false);
      setNewUser({
        email: "",
        password: "Admin@123456",
        first_name: "",
        last_name: "",
        employee_id: "",
        department: "Prepress & Preflight",
        phone_number: "",
        role: "",
      });
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId, reason }: { userId: string; roleId: string; reason: string }) =>
      authApi.assignRole(userId, roleId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setIsAssignRoleModalOpen(false);
      setSelectedUserForRole(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (userId: string) => authApi.toggleUserStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const openAssignRoleModal = (user: StaffUser) => {
    setSelectedUserForRole(user);
    setAssignRoleData({
      role_id: user.role_details?.id || user.role || "",
      reason: `Assigned new role for ${user.full_name}`,
    });
    setIsAssignRoleModalOpen(true);
  };

  // Directory Columns
  const userColumns: Column<StaffUser>[] = [
    {
      header: "Team Member",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0073EA] text-white font-semibold text-xs flex items-center justify-center shadow-xs">
            {u.first_name?.[0] || u.email[0].toUpperCase()}
            {u.last_name?.[0] || ""}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-xs">{u.full_name}</p>
            <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Employee ID",
      accessorKey: "employee_id",
      cell: (u) => (
        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {u.employee_id || "N/A"}
        </span>
      ),
    },
    {
      header: "Department",
      accessorKey: "department",
      className: "text-slate-600 text-xs font-medium",
    },
    {
      header: "Role",
      cell: (u) => {
        const role = u.role_details;
        return role ? (
          <Badge variant="primary" dot={true}>
            {role.name}
          </Badge>
        ) : (
          <span className="text-xs text-slate-400 italic">No Role</span>
        );
      },
    },
    {
      header: "Status",
      cell: (u) => (
        <Badge variant={u.is_active ? "success" : "neutral"} size="sm">
          {u.is_active ? "Active" : "Deactivated"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openAssignRoleModal(u)}
            leftIcon={<KeyRound className="w-3.5 h-3.5 text-[#0073EA]" />}
          >
            Change Role
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleStatusMutation.mutate(u.id)}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            {u.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  // Audit Log Columns
  const auditColumns: Column<UserAuditLog>[] = [
    {
      header: "Date & Time",
      cell: (log) => (
        <span className="font-mono text-[11px] text-slate-500">
          {new Date(log.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Team Member",
      cell: (log) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-800 text-xs">{log.user_name}</span>
        </div>
      ),
    },
    {
      header: "Action",
      cell: (log) => {
        let variant: "primary" | "success" | "warning" | "danger" | "info" = "primary";
        if (log.action.includes("DOWNLOAD")) variant = "info";
        if (log.action.includes("STATUS")) variant = "primary";
        if (log.action.includes("TRACKING")) variant = "success";
        if (log.action.includes("ROLE")) variant = "warning";
        if (log.action.includes("RERUN")) variant = "danger";

        return (
          <Badge variant={variant} size="sm" dot={true}>
            {log.action.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      header: "Item / Reference",
      cell: (log) => (
        <span className="font-mono text-xs text-slate-600">
          {log.resource_type} : <strong className="text-slate-900">{log.resource_id}</strong>
        </span>
      ),
    },
    {
      header: "IP Address",
      cell: (log) => (
        <span className="font-mono text-[11px] text-slate-400">
          {log.ip_address || "Internal"}
        </span>
      ),
    },
    {
      header: "Details",
      cell: (log) => (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Eye className="w-3 h-3 text-slate-400" />}
          onClick={() => setSelectedAuditLog(log)}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Staff Accounts & Permissions
            </h1>
            <Badge variant="primary" size="sm">Staff</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage team members, roles, station permissions, and activity history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              refetchUsers();
              refetchAuditLogs();
            }}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Add Team Member
          </Button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Team Members"
          value={usersData?.count || 5}
          change="Registered"
          trend="neutral"
          subtitle="All team members"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Staff Roles"
          value={assignableRoles.length || 5}
          change="Operational"
          trend="neutral"
          subtitle="Staff permission roles"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Activity Logs"
          value={auditLogsData?.count || 6}
          change="Recent"
          trend="up"
          subtitle="Recorded actions"
          icon={<History className="w-5 h-5" />}
        />
        <StatCard
          title="On Shift Today"
          value="4 Operators"
          change="Factory Floor"
          trend="up"
          subtitle="Prepress & Print"
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("directory")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "directory"
              ? "border-[#0073EA] text-[#0073EA]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team Members</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
            {usersData?.count || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("audit-logs")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "audit-logs"
              ? "border-[#0073EA] text-[#0073EA]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Activity History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
            {auditLogsData?.count || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "matrix"
              ? "border-[#0073EA] text-[#0073EA]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Role Permissions</span>
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, department, or employee ID..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
              />
            </div>
          </div>

          <Card noPadding={true}>
            <Table
              data={usersData?.results || []}
              columns={userColumns}
              keyExtractor={(u) => u.id}
              isLoading={usersLoading}
            />
          </Card>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === "audit-logs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Filter by Action:
              </span>
              <select
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="">All Activities</option>
                <option value="ARTWORK_DOWNLOAD">Artwork Downloads</option>
                <option value="STATUS_CHANGE">Status Updates</option>
                <option value="TRACKING_CODE_ENTRY">Tracking Numbers Added</option>
                <option value="ROLE_ASSIGNMENT">Role Changes</option>
                <option value="PRINT_JOB_RERUN">Reprint Requests</option>
                <option value="USER_LOGIN">User Logins</option>
              </select>
            </div>
            <span className="text-xs text-slate-400">
              All system activities are securely logged.
            </span>
          </div>

          <Card noPadding={true}>
            <Table
              data={auditLogsData?.results || []}
              columns={auditColumns}
              keyExtractor={(log) => log.id}
              isLoading={auditLoading}
            />
          </Card>
        </div>
      )}

      {/* TAB 3: RBAC MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          <Card
            title="Role Permissions Matrix"
            subtitle="Overview of what each role is permitted to perform across the platform."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Download Files</th>
                    <th className="py-3 px-4">Approve Artwork</th>
                    <th className="py-3 px-4">Print Orders</th>
                    <th className="py-3 px-4">Ship Orders</th>
                    <th className="py-3 px-4">Manage Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-[#0073EA]">Super Admin</td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-purple-700">Prepress Specialist</td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-amber-700">Production Manager</td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-sky-700">Shopfloor Operator</td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-emerald-700">Dispatch / Finance Specialist</td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></td>
                    <td className="py-3 px-4 text-slate-300"><XCircle className="w-4 h-4" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 1: CREATE STAFF USER */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Team Member"
        description="Create a new account for a team member and set their role."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={createUserMutation.isPending}
              onClick={() => createUserMutation.mutate(newUser)}
            >
              Add Member
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">First Name</label>
              <input
                type="text"
                placeholder="e.g. Rachel"
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                placeholder="e.g. Chen"
                value={newUser.last_name}
                onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="rachel.chen@silverpointpod.com"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Employee ID</label>
              <input
                type="text"
                placeholder="EMP-6091"
                value={newUser.employee_id}
                onChange={(e) => setNewUser({ ...newUser, employee_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
              >
                <option value="Prepress & Preflight">Prepress & Artwork</option>
                <option value="Production Shopfloor">Factory Floor</option>
                <option value="Digital Press & Bindery">Printing & Binding</option>
                <option value="Logistics & Finance">Shipping & Billing</option>
                <option value="Executive Management">Management</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Staff Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
            >
              <option value="">Select a role...</option>
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: ASSIGN ROLE */}
      <Modal
        isOpen={isAssignRoleModalOpen}
        onClose={() => setIsAssignRoleModalOpen(false)}
        title={`Change Role for ${selectedUserForRole?.full_name || "Team Member"}`}
        description="Update role and permissions for this team member."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAssignRoleModalOpen(false)}>
               Cancel
            </Button>
            <Button
              size="sm"
              isLoading={assignRoleMutation.isPending}
              onClick={() => {
                if (selectedUserForRole && assignRoleData.role_id) {
                  assignRoleMutation.mutate({
                    userId: selectedUserForRole.id,
                    roleId: assignRoleData.role_id,
                    reason: assignRoleData.reason,
                  });
                }
              }}
            >
              Save Role
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Staff Role</label>
            <select
              value={assignRoleData.role_id}
              onChange={(e) => setAssignRoleData({ ...assignRoleData, role_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium"
            >
              <option value="">Select new role...</option>
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.description || r.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Reason for Change (Optional)
            </label>
            <textarea
              rows={3}
              value={assignRoleData.reason}
              onChange={(e) => setAssignRoleData({ ...assignRoleData, reason: e.target.value })}
              placeholder="e.g. Promoted to Lead Operator..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 3: AUDIT LOG METADATA DETAIL */}
      <Modal
        isOpen={!!selectedAuditLog}
        onClose={() => setSelectedAuditLog(null)}
        title="Activity Log Details"
        description={`Log ID: ${selectedAuditLog?.id}`}
        footer={
          <Button size="sm" variant="outline" onClick={() => setSelectedAuditLog(null)}>
            Close
          </Button>
        }
      >
        {selectedAuditLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px]">
              <div>
                <p className="text-slate-400">Action:</p>
                <p className="font-semibold text-slate-900">{selectedAuditLog.action.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-slate-400">Item / Reference:</p>
                <p className="font-semibold text-slate-900">
                  {selectedAuditLog.resource_type} / {selectedAuditLog.resource_id}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Team Member:</p>
                <p className="font-semibold text-slate-900">{selectedAuditLog.user_email_snapshot}</p>
              </div>
              <div>
                <p className="text-slate-400">IP Address:</p>
                <p className="font-semibold text-slate-900">{selectedAuditLog.ip_address || "Internal"}</p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-[#0073EA]" />
                <span>Action Details</span>
              </p>
              <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-52">
                {JSON.stringify(selectedAuditLog.details, null, 2)}
              </pre>
            </div>

            <div className="text-[11px] text-slate-400">
              System Agent: {selectedAuditLog.user_agent || "Web Browser"}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
