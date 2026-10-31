"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  EyeOff,
  Sliders,
  MoreVertical,
  Activity,
  Layers,
  Lock,
  Shield,
  ShieldAlert,
  Sparkles,
  Info,
  ChevronRight,
  Globe2,
  PackageCheck,
  Receipt,
  LayoutDashboard,
  Building2,
  Briefcase,
  Pencil,
} from "lucide-react";
import { authApi, lookupsApi, StaffUser, UserAuditLog, SystemRole } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Column } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";
import {
  NAVIGATION_ITEMS,
  ROLE_ACCESS_PROFILES,
  RoleAccessProfile,
  ROLE_ORDER_PERMISSIONS,
  getRoleOrderPermission,
} from "@/components/layout/navigation-config";
import { useToast } from "@/context/notification-context";

export const ALL_DEPARTMENTS = [
  "Prepress & Preflight",
  "Production Shopfloor",
  "Digital Press & Bindery",
  "Logistics & Shipping",
  "Billing & Finance",
  "Logistics & Finance",
  "Systems & Integrations",
  "Operations Management",
  "Executive Management",
] as const;

export const ROLE_SORT_ORDER: Record<string, number> = {
  PREPRESS_SPECIALIST: 1,
  SHOPFLOOR_OPERATOR: 2,
  PRODUCTION_MANAGER: 3,
  DISPATCH_SPECIALIST: 4,
  DISPATCH_FINANCE_SPECIALIST: 5,
  FINANCE_SPECIALIST: 6,
  INTEGRATION_SPECIALIST: 7,
  ADMIN: 8,
  SUPER_ADMIN: 9,
};

export const FRIENDLY_ROLES_CONFIG: Record<
  string,
  {
    simpleName: string;
    category: string;
    stationName: string;
    description: string;
    allowedOrdersNote: string;
    badgeVariant: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
    defaultDepartment: string;
  }
> = {
  PREPRESS_SPECIALIST: {
    simpleName: "Artwork & Prepress",
    category: "Artwork Check",
    stationName: "Artwork & Prepress Station",
    description: "Inspects artwork resolution, verifies bleeds and trim lines, and approves digital print proofs.",
    allowedOrdersNote: "Can update: Received, Prepress Queued, Artwork Approved, On Hold. (Production & Shipping locked)",
    badgeVariant: "warning",
    defaultDepartment: "Prepress & Preflight",
  },
  SHOPFLOOR_OPERATOR: {
    simpleName: "Print & Bindery Operator",
    category: "Press Runs",
    stationName: "Digital Press & Bindery Floor",
    description: "Operates HP Indigo / Canon digital presses, binding equipment, and logs machine progress.",
    allowedOrdersNote: "Can update: In Production, Printing, Quality Audit, Packed.",
    badgeVariant: "neutral",
    defaultDepartment: "Digital Press & Bindery",
  },
  PRODUCTION_MANAGER: {
    simpleName: "Production Floor Manager",
    category: "Shopfloor Planning",
    stationName: "Print Floor & Imposition",
    description: "Plans print batches, assigns presses, binding methods, and oversees floor throughput.",
    allowedOrdersNote: "Can update: Batched, Printing, Production Completed, Packed, Ready for Dispatch.",
    badgeVariant: "info",
    defaultDepartment: "Production Shopfloor",
  },
  DISPATCH_SPECIALIST: {
    simpleName: "Shipping & Courier Tracking",
    category: "Logistics",
    stationName: "Shipping & Fulfillment Station",
    description: "Packs parcels, prints courier labels (DHL/FedEx), and logs delivery tracking.",
    allowedOrdersNote: "Can update: Ready for Dispatch, Dispatched, In Transit, Delivered. (Prepress & Print locked)",
    badgeVariant: "success",
    defaultDepartment: "Logistics & Shipping",
  },
  DISPATCH_FINANCE_SPECIALIST: {
    simpleName: "Shipping & Invoicing (Combined)",
    category: "Logistics & Billing",
    stationName: "Logistics & Billing Station",
    description: "Handles both parcel shipping / courier waybills and customer invoice settlements.",
    allowedOrdersNote: "Can update: Ready for Dispatch, Dispatched, Delivered, and Invoicing.",
    badgeVariant: "success",
    defaultDepartment: "Logistics & Finance",
  },
  FINANCE_SPECIALIST: {
    simpleName: "Finance & Invoicing",
    category: "Accounting",
    stationName: "Invoicing & Financial Accounts",
    description: "Generates customer invoices, manages price tiers, calculates quotes, and reviews financial ledgers.",
    allowedOrdersNote: "Financial audit & invoicing access. (Physical print and shipping transitions locked)",
    badgeVariant: "success",
    defaultDepartment: "Billing & Finance",
  },
  INTEGRATION_SPECIALIST: {
    simpleName: "API & Integrations Lead",
    category: "Technical",
    stationName: "Integration & Intake Hub",
    description: "Monitors Peecho and Printify API webhooks, order payload intake, and connection diagnostics.",
    allowedOrdersNote: "Can update: Order Intake, Prepress Queued, Exception Hold.",
    badgeVariant: "info",
    defaultDepartment: "Systems & Integrations",
  },
  ADMIN: {
    simpleName: "Operations Manager (Admin)",
    category: "Management",
    stationName: "Operations Management",
    description: "Full operational supervision: order priority overrides, batch imposition, team access, and reports.",
    allowedOrdersNote: "Full Access: All order pipeline stages & supervisor overrides.",
    badgeVariant: "primary",
    defaultDepartment: "Operations Management",
  },
  SUPER_ADMIN: {
    simpleName: "System Super Admin",
    category: "Executive",
    stationName: "Executive Administration",
    description: "Unrestricted master system administration across all platform features.",
    allowedOrdersNote: "Unrestricted master platform access.",
    badgeVariant: "danger",
    defaultDepartment: "Executive Management",
  },
};

function getRoleIcon(code: string) {
  switch (code) {
    case "DISPATCH_SPECIALIST":
      return <Truck className="w-5 h-5 text-emerald-600" />;
    case "DISPATCH_FINANCE_SPECIALIST":
      return <PackageCheck className="w-5 h-5 text-teal-600" />;
    case "PREPRESS_SPECIALIST":
      return <FileCheck2 className="w-5 h-5 text-purple-600" />;
    case "SHOPFLOOR_OPERATOR":
      return <Printer className="w-5 h-5 text-amber-600" />;
    case "PRODUCTION_MANAGER":
      return <Layers className="w-5 h-5 text-blue-600" />;
    case "FINANCE_SPECIALIST":
      return <Receipt className="w-5 h-5 text-emerald-700" />;
    case "INTEGRATION_SPECIALIST":
      return <Globe2 className="w-5 h-5 text-indigo-600" />;
    case "ADMIN":
    case "SUPER_ADMIN":
    default:
      return <ShieldCheck className="w-5 h-5 text-rose-600" />;
  }
}

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"directory" | "audit-logs" | "matrix">("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [auditFilterAction, setAuditFilterAction] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [matrixDepartmentFilter, setMatrixDepartmentFilter] = useState<string>("ALL");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<StaffUser | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<UserAuditLog | null>(null);

  // Super Admin Password Modal states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<StaffUser | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const isSuperAdminUser = (u: StaffUser | null) => {
    if (!u) return false;
    return Boolean(u.is_superuser || u.role_details?.code === "SUPER_ADMIN");
  };

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

  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    employee_id: "",
    department: "Prepress & Preflight",
    phone_number: "",
    role: "",
    is_active: true,
    password: "",
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [assignRoleData, setAssignRoleData] = useState({
    role_id: "",
    department: "Prepress & Preflight",
    reason: "",
  });

  // Pagination
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);

  // Queries
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["staff-users", searchQuery, usersPage, usersPageSize],
    queryFn: () => authApi.getUsers({ search: searchQuery || undefined, page: usersPage, page_size: usersPageSize }),
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => lookupsApi.getRoles(),
  });

  // Only operational roles can be assigned to human staff (exclude machine daemons and protected SUPER_ADMIN)
  const assignableRoles = useMemo(() => {
    return (rolesData?.results || []).filter(
      (r) => r.code !== "PEECHO_SERVICE" && r.code !== "SUPER_ADMIN"
    );
  }, [rolesData?.results]);

  // Group roles by department
  const rolesByDepartment = useMemo(() => {
    const map: Record<string, typeof assignableRoles> = {};
    assignableRoles.forEach((r) => {
      const prof = ROLE_ACCESS_PROFILES[r.code];
      const dept = prof?.department || "Operations Management";
      if (!map[dept]) map[dept] = [];
      map[dept].push(r);
    });
    return map;
  }, [assignableRoles]);

  // Roles filtered by the department chosen in New User modal
  const availableRolesForNewUser = useMemo(() => {
    if (!newUser.department) return assignableRoles;
    const matches = assignableRoles.filter((r) => {
      const prof = ROLE_ACCESS_PROFILES[r.code];
      return prof?.department?.toLowerCase() === newUser.department.toLowerCase();
    });
    return matches.length > 0 ? matches : assignableRoles;
  }, [assignableRoles, newUser.department]);

  // Roles filtered by the department chosen in Assign Role modal
  const availableRolesForAssign = useMemo(() => {
    if (!assignRoleData.department) return assignableRoles;
    const matches = assignableRoles.filter((r) => {
      const prof = ROLE_ACCESS_PROFILES[r.code];
      return prof?.department?.toLowerCase() === assignRoleData.department.toLowerCase();
    });
    return matches.length > 0 ? matches : assignableRoles;
  }, [assignableRoles, assignRoleData.department]);

  // Filtered users in Directory based on Department (strictly descending - newest first)
  const filteredUsers = useMemo(() => {
    let list = usersData?.results || [];
    if (departmentFilter !== "ALL") {
      list = list.filter((u) => {
        const roleCode = u.role_details?.code;
        const prof = roleCode ? ROLE_ACCESS_PROFILES[roleCode] : null;
        const uDept = u.department || prof?.department || "";
        return uDept.toLowerCase() === departmentFilter.toLowerCase();
      });
    }
    return [...list].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b.email || "").localeCompare(a.email || "");
    });
  }, [usersData?.results, departmentFilter]);

  // Auto-set matching role when new user department changes and role is unset or doesn't match
  useEffect(() => {
    if (assignableRoles.length > 0 && newUser.department) {
      const matchingRole = assignableRoles.find((r) => {
        const prof = ROLE_ACCESS_PROFILES[r.code];
        return prof?.department?.toLowerCase() === newUser.department.toLowerCase();
      });
      if (matchingRole && (!newUser.role || !availableRolesForNewUser.some((r) => r.id === newUser.role))) {
        setNewUser((prev) => ({ ...prev, role: matchingRole.id }));
      }
    }
  }, [assignableRoles, newUser.department, availableRolesForNewUser]);

  // Auto-set matching role when assign role modal department changes
  useEffect(() => {
    if (assignableRoles.length > 0 && assignRoleData.department) {
      const matchingRole = assignableRoles.find((r) => {
        const prof = ROLE_ACCESS_PROFILES[r.code];
        return prof?.department?.toLowerCase() === assignRoleData.department.toLowerCase();
      });
      if (matchingRole && (!assignRoleData.role_id || !availableRolesForAssign.some((r) => r.id === assignRoleData.role_id))) {
        setAssignRoleData((prev) => ({ ...prev, role_id: matchingRole.id }));
      }
    }
  }, [assignableRoles, assignRoleData.department, availableRolesForAssign]);

  // Department member counts for directory filter pills
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: usersData?.results?.length || 0 };
    (usersData?.results || []).forEach((u) => {
      const roleCode = u.role_details?.code;
      const prof = roleCode ? ROLE_ACCESS_PROFILES[roleCode] : null;
      const uDept = u.department || prof?.department || "Operations Management";
      counts[uDept] = (counts[uDept] || 0) + 1;
    });
    return counts;
  }, [usersData?.results]);

  // Filtered profiles for permissions matrix
  const filteredProfiles = useMemo(() => {
    const list = Object.values(ROLE_ACCESS_PROFILES);
    if (matrixDepartmentFilter === "ALL") return list;
    return list.filter((p) => p.department.toLowerCase() === matrixDepartmentFilter.toLowerCase());
  }, [matrixDepartmentFilter]);

  // Selected role profile previews for modals
  const selectedNewUserRole = useMemo(() => {
    return assignableRoles.find((r) => r.id === newUser.role);
  }, [assignableRoles, newUser.role]);

  const newUserRoleProfile = useMemo(() => {
    if (!selectedNewUserRole) return null;
    return ROLE_ACCESS_PROFILES[selectedNewUserRole.code] || null;
  }, [selectedNewUserRole]);

  const selectedChangeRole = useMemo(() => {
    return assignableRoles.find((r) => r.id === assignRoleData.role_id);
  }, [assignableRoles, assignRoleData.role_id]);

  const changeRoleProfile = useMemo(() => {
    if (!selectedChangeRole) return null;
    return ROLE_ACCESS_PROFILES[selectedChangeRole.code] || null;
  }, [selectedChangeRole]);

  const newUserRoleOrderPerm = useMemo(() => {
    if (!selectedNewUserRole) return null;
    return getRoleOrderPermission(selectedNewUserRole.code);
  }, [selectedNewUserRole]);

  const changeRoleOrderPerm = useMemo(() => {
    if (!selectedChangeRole) return null;
    return getRoleOrderPermission(selectedChangeRole.code);
  }, [selectedChangeRole]);

  const selectedEditUserRole = useMemo(() => {
    return assignableRoles.find((r) => r.id === editFormData.role);
  }, [assignableRoles, editFormData.role]);

  const editUserRoleOrderPerm = useMemo(() => {
    if (!selectedEditUserRole) return null;
    return getRoleOrderPermission(selectedEditUserRole.code);
  }, [selectedEditUserRole]);

  const sortedAssignableRoles = useMemo(() => {
    return [...assignableRoles].sort((a, b) => {
      const orderA = ROLE_SORT_ORDER[a.code] || 99;
      const orderB = ROLE_SORT_ORDER[b.code] || 99;
      return orderA - orderB;
    });
  }, [assignableRoles]);

  const { data: auditLogsData, isLoading: auditLoading, refetch: refetchAuditLogs } = useQuery({
    queryKey: ["audit-logs", auditFilterAction, auditPage, auditPageSize],
    queryFn: () => authApi.getAuditLogs({ action: auditFilterAction || undefined, page: auditPage, page_size: auditPageSize }),
  });

  const sortedAuditLogs = useMemo(() => {
    const list = [...(auditLogsData?.results || [])];
    return list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [auditLogsData?.results]);

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (userData: any) => authApi.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setIsCreateModalOpen(false);
      toast.success(
        "Team Member Added Successfully",
        `Account created for ${newUser.first_name} ${newUser.last_name}.`
      );
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
    onError: (err: any) => {
      const msg = err?.response?.data?.email?.[0] || err?.response?.data?.detail || err?.message || "Failed to create team member";
      toast.error("Account Creation Failed", msg);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffUser> }) =>
      authApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setIsEditModalOpen(false);
      toast.success(
        "Staff Member Updated",
        `Details for ${editFormData.first_name} ${editFormData.last_name} saved successfully.`
      );
      setEditingUser(null);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to update team member";
      toast.error("Profile Update Failed", msg);
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId, reason }: { userId: string; roleId: string; reason: string }) =>
      authApi.assignRole(userId, roleId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setIsAssignRoleModalOpen(false);
      toast.success(
        "Role & Permissions Updated",
        `Assigned operational designation to ${selectedUserForRole?.full_name || "team member"}.`
      );
      setSelectedUserForRole(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || "Failed to update role";
      toast.error("Role Assignment Failed", msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (userId: string) => authApi.toggleUserStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      toast.info("Account Status Updated", "Staff member active status toggled successfully.");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || "Failed to update status";
      toast.error("Status Update Failed", msg);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      authApi.changePassword(userId, password),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setIsPasswordModalOpen(false);
      setNewPasswordVal("");
      setConfirmPasswordVal("");
      toast.success(
        "Password Updated Successfully",
        data?.detail || "The Super Admin credentials have been updated."
      );
    },
    onError: (err: any) => {
      const detail =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Failed to update password. Please ensure password has at least 6 characters.";
      toast.error("Password Update Failed", detail);
    },
  });

  const openChangePasswordModal = (user: StaffUser) => {
    setPasswordTargetUser(user);
    setNewPasswordVal("");
    setConfirmPasswordVal("");
    setShowNewPassword(false);
    setIsPasswordModalOpen(true);
  };

  const openEditUserModal = (user: StaffUser) => {
    if (isSuperAdminUser(user)) {
      openChangePasswordModal(user);
      return;
    }
    setEditingUser(user);
    const roleId = user.role_details?.id || user.role || "";
    const roleCode = user.role_details?.code || "";
    const prof = roleCode ? ROLE_ACCESS_PROFILES[roleCode] : null;
    const userDept = user.department || prof?.department || "Operations Management";
    setEditFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      employee_id: user.employee_id || "",
      department: userDept,
      phone_number: user.phone_number || "",
      role: roleId,
      is_active: user.is_active,
      password: "",
    });
    setShowEditPassword(false);
    setIsEditModalOpen(true);
  };

  const openAssignRoleModal = (user: StaffUser) => {
    if (isSuperAdminUser(user)) {
      toast.warning("Protected Role", "The Super Admin role is permanent and cannot be modified.");
      return;
    }
    setSelectedUserForRole(user);
    const roleCode = user.role_details?.code || "";
    const prof = roleCode ? ROLE_ACCESS_PROFILES[roleCode] : null;
    const userDept = user.department || prof?.department || "Prepress & Preflight";
    setAssignRoleData({
      role_id: user.role_details?.id || user.role || "",
      department: userDept,
      reason: `Assigned new role for ${user.full_name}`,
    });
    setIsAssignRoleModalOpen(true);
  };

  // Directory Columns
  const userColumns: Column<StaffUser>[] = [
    {
      header: "Team Member",
      cell: (u) => {
        const isSuper = isSuperAdminUser(u);
        return (
          <div
            onClick={() => {
              if (isSuper) {
                openChangePasswordModal(u);
              } else {
                openEditUserModal(u);
              }
            }}
            className="flex items-center gap-3 cursor-pointer group"
            title={isSuper ? "Master Super Admin: Click to change password" : "Click to edit team member profile"}
          >
            <div
              className={`w-8 h-8 rounded-full ${
                isSuper ? "bg-amber-600 ring-2 ring-amber-300 shadow-xs" : "bg-[#0073EA]"
              } text-white font-semibold text-xs flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}
            >
              {u.first_name?.[0] || u.email[0].toUpperCase()}
              {u.last_name?.[0] || ""}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-slate-900 text-xs group-hover:text-[#0073EA] transition-colors">
                  {u.full_name}
                </p>
                {isSuper && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <Lock className="w-2.5 h-2.5" />
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
            </div>
          </div>
        );
      },
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
      cell: (u) => {
        const role = u.role_details;
        const profile = role?.code ? ROLE_ACCESS_PROFILES[role.code] : null;
        const dept = u.department || profile?.department || "Operations Management";
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0073EA] shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-800 text-xs font-semibold block">{dept}</span>
              {profile && (
                <span className="text-[10px] text-slate-400 font-mono">{profile.accessBadge}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Role & Staff Designation",
      cell: (u) => {
        const role = u.role_details;
        const profile = role?.code ? ROLE_ACCESS_PROFILES[role.code] : null;
        return role ? (
          <div className="space-y-1 py-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant={profile?.badgeVariant || "primary"} size="sm" dot={true}>
                {role.name}
              </Badge>
              {profile && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200">
                  {profile.allowedSlugs.length} Modules
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-700 leading-snug">
              {profile?.designation || role.description || "Operational Staff"}
            </p>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">No Role Assigned</span>
        );
      },
    },
    {
      header: "Status",
      cell: (u) => {
        const isSuper = isSuperAdminUser(u);
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={u.is_active ? "success" : "neutral"} size="sm">
              {u.is_active ? "Active" : "Deactivated"}
            </Badge>
            {isSuper && (
              <span
                className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                title="Protected master account: cannot be deactivated"
              >
                Permanent
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Actions",
      cell: (u) => {
        const isSuper = isSuperAdminUser(u);
        if (isSuper) {
          return (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openChangePasswordModal(u)}
                leftIcon={<KeyRound className="w-3.5 h-3.5 text-amber-600" />}
                className="text-xs font-semibold h-7 px-2.5 border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 shadow-2xs"
              >
                Change Password
              </Button>
              <span
                className="text-[10px] text-slate-400 italic px-1 cursor-default select-none"
                title="Master Super Admin account is permanently protected. Only password changes are allowed."
              >
                Profile Locked
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditUserModal(u)}
              leftIcon={<Pencil className="w-3.5 h-3.5 text-slate-600" />}
              className="text-xs font-semibold h-7 px-2.5"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openChangePasswordModal(u)}
              leftIcon={<KeyRound className="w-3.5 h-3.5 text-amber-600" />}
              className="text-xs font-semibold h-7 px-2 border-amber-200 bg-amber-50/40 hover:bg-amber-100/70 text-amber-800"
              title="Reset staff member login password"
            >
              Password
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openAssignRoleModal(u)}
              leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-[#0073EA]" />}
              className="text-xs h-7 px-2.5"
            >
              Role
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toggleStatusMutation.mutate(u.id)}
              className={`text-xs h-7 px-2 ${
                u.is_active ? "text-slate-500 hover:text-rose-600" : "text-emerald-600 hover:text-emerald-700"
              }`}
            >
              {u.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        );
      },
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
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setUsersPage(1);
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  name="staff_search_query"
                  placeholder="Search by name, email, department, or employee ID..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 shrink-0">Department:</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setUsersPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] outline-none cursor-pointer"
                >
                  <option value="ALL">All Departments ({usersData?.results?.length || 0})</option>
                  {ALL_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept} {departmentCounts[dept] ? `(${departmentCounts[dept]})` : "(0)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Card noPadding={true}>
            <Table
              data={filteredUsers}
              columns={userColumns}
              keyExtractor={(u) => u.id}
              isLoading={usersLoading}
              pagination={{
                currentPage: usersData?.current_page || usersPage,
                totalPages:
                  departmentFilter === "ALL"
                    ? usersData?.total_pages || Math.ceil((usersData?.count || 0) / usersPageSize) || 1
                    : Math.ceil(filteredUsers.length / usersPageSize) || 1,
                pageSize: usersData?.page_size || usersPageSize,
                totalCount: departmentFilter === "ALL" ? (usersData?.count || 0) : filteredUsers.length,
                onPageChange: (p) => setUsersPage(p),
                onPageSizeChange: (s) => {
                  setUsersPageSize(s);
                  setUsersPage(1);
                },
                pageSizeOptions: [10, 25, 50],
              }}
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
                onChange={(e) => {
                  setAuditFilterAction(e.target.value);
                  setAuditPage(1);
                }}
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
              data={sortedAuditLogs}
              columns={auditColumns}
              keyExtractor={(log) => log.id}
              isLoading={auditLoading}
              pagination={{
                currentPage: auditLogsData?.current_page || auditPage,
                totalPages: auditLogsData?.total_pages || Math.ceil((auditLogsData?.count || 0) / auditPageSize) || 1,
                pageSize: auditLogsData?.page_size || auditPageSize,
                totalCount: auditLogsData?.count || 0,
                onPageChange: (p) => setAuditPage(p),
                onPageSizeChange: (s) => {
                  setAuditPageSize(s);
                  setAuditPage(1);
                },
                pageSizeOptions: [10, 25, 50],
              }}
            />
          </Card>
        </div>
      )}

      {/* TAB 3: MAXIMUM ACCESS ROLE & DESIGNATION MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          {/* Header Banner & Stats */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold tracking-wide uppercase">
                    RBAC Governance Framework
                  </span>
                  <Badge variant="primary" size="sm">9 Core Modules</Badge>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Maximum Access Roles & Staff Designations
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Platform access is strictly partitioned according to operational staff designations and workstation responsibilities. Each designation is granted maximum authorized access to required modules while unassigned station routes and views are automatically hidden.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 backdrop-blur-xs border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-white">9</p>
                  <p className="text-[10px] text-slate-300 font-medium">Designations</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xs border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">9</p>
                  <p className="text-[10px] text-slate-300 font-medium">Core Modules</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xs border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">100%</p>
                  <p className="text-[10px] text-slate-300 font-medium">RBAC Guarded</p>
                </div>
              </div>
            </div>
          </div>

          {/* Department Filter Bar for RBAC Matrix */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0073EA]" />
              <span className="text-xs font-bold text-slate-800">Department:</span>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={matrixDepartmentFilter}
                onChange={(e) => setMatrixDepartmentFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] outline-none cursor-pointer"
              >
                <option value="ALL">All Departments (9)</option>
                {ALL_DEPARTMENTS.map((dept) => {
                  const count = Object.values(ROLE_ACCESS_PROFILES).filter(
                    (p) => p.department.toLowerCase() === dept.toLowerCase()
                  ).length;
                  return (
                    <option key={dept} value={dept}>
                      {dept} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Master Authorization Matrix Card */}
          <Card
            title={`Module Authorization Matrix by Staff Designation ${matrixDepartmentFilter !== "ALL" ? `— ${matrixDepartmentFilter}` : ""}`}
            subtitle="Real-time map of permitted modules and station execution rights for every operational designation."
          >
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left text-xs border-collapse min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4 min-w-[240px]">Staff Designation & Role</th>
                    <th className="py-3 px-3 text-center min-w-[130px]">Access Scope</th>
                    {NAVIGATION_ITEMS.map((item) => (
                      <th key={item.slug} className="py-3 px-2 text-center font-medium">
                        <span className="block text-slate-800 font-semibold">{item.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono lowercase">/{item.slug}</span>
                      </th>
                    ))}
                    <th className="py-3 px-4 min-w-[220px]">Station Rights & Capabilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfiles.map((profile) => {
                    const activeCount = (usersData?.results || []).filter(
                      (u) => u.role_details?.code === profile.code
                    ).length;

                    return (
                      <tr key={profile.code} className="hover:bg-slate-50/70 transition-colors">
                        {/* Designation & Role */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">
                                {profile.designation}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant={profile.badgeVariant} size="sm" dot={true}>
                                {profile.title}
                              </Badge>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({profile.code})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {profile.department}
                            </p>
                          </div>
                        </td>

                        {/* Access Scope */}
                        <td className="py-3.5 px-3 text-center align-top">
                          <div className="inline-flex flex-col items-center gap-1">
                            <Badge variant={profile.badgeVariant} size="sm">
                              {profile.accessBadge}
                            </Badge>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {profile.allowedSlugs.length} of {NAVIGATION_ITEMS.length} Modules
                            </span>
                            {activeCount > 0 && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium border border-emerald-200">
                                {activeCount} Assigned
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 9 Modules Matrix Checkmarks */}
                        {NAVIGATION_ITEMS.map((item) => {
                          const isAllowed = profile.allowedSlugs.includes(item.slug);
                          return (
                            <td key={item.slug} className="py-3.5 px-2 text-center align-middle">
                              {isAllowed ? (
                                <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs" title={`Allowed: ${item.name}`}>
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 text-slate-300 border border-slate-100" title={`Locked: ${item.name}`}>
                                  <Lock className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Capabilities */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex flex-wrap gap-1">
                            {profile.capabilities.map((cap, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detailed Designation Cards Grid */}
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0073EA]" />
                <span>Operational Designation Profiles & Responsibilities</span>
              </h3>
              <p className="text-xs text-slate-500">
                Detailed scope of workstation responsibilities, departments, and authorized navigation routes for each staff tier.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.code}
                  className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3 flex flex-col justify-between hover:border-[#0073EA]/40 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs leading-tight">
                          {profile.designation}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {profile.department}
                        </p>
                      </div>
                      <Badge variant={profile.badgeVariant} size="sm">
                        {profile.title}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {profile.description}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Authorized Modules ({profile.allowedSlugs.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.allowedSlugs.map((slug) => {
                          const navItem = NAVIGATION_ITEMS.find((n) => n.slug === slug);
                          return (
                            <span
                              key={slug}
                              className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium border border-blue-100 flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-blue-500" />
                              {navItem?.name || slug}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Station Capabilities
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.capabilities.slice(0, 3).map((cap, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.2 bg-slate-50 text-slate-600 rounded font-normal border border-slate-200"
                          >
                            {cap}
                          </span>
                        ))}
                        {profile.capabilities.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.2 text-slate-400 font-medium">
                            +{profile.capabilities.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE STAFF USER */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Team Member"
        description="Register a new team member with their operational role and workstation."
        maxWidth="2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={createUserMutation.isPending}
              onClick={() => {
                if (!newUser.first_name?.trim() || !newUser.email?.trim() || !newUser.role) {
                  toast.warning(
                    "Incomplete Form",
                    "Please fill in first name, email address, and select a staff role."
                  );
                  return;
                }
                createUserMutation.mutate(newUser);
              }}
            >
              Add Member
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Hidden decoy fields to absorb aggressive browser autofill heuristics */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

          {/* Member Basic Information */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="staff_reg_first_name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="e.g. Rachel"
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="staff_reg_last_name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="e.g. Chen"
                value={newUser.last_name}
                onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="staff_reg_email"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="rachel.chen@silverpointpod.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Employee ID (Optional)</label>
              <input
                type="text"
                name="staff_reg_emp_id"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="e.g. EMP-6091"
                value={newUser.employee_id}
                onChange={(e) => setNewUser({ ...newUser, employee_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
          </div>

          {/* Simple & Visual Role Selection */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block font-bold text-slate-900 text-xs">
                  Select Staff Role & Workstation <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Click the operational role for this staff member. Station and permissions configure automatically.
                </p>
              </div>
              {selectedNewUserRole && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Selected: {FRIENDLY_ROLES_CONFIG[selectedNewUserRole.code]?.simpleName || selectedNewUserRole.name}
                </span>
              )}
            </div>

            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {sortedAssignableRoles.map((role) => {
                const config = FRIENDLY_ROLES_CONFIG[role.code] || {
                  simpleName: role.name,
                  category: "Operations",
                  stationName: "General Station",
                  description: role.description || "Operational team role.",
                  allowedOrdersNote: "Standard operational permissions.",
                  badgeVariant: "neutral" as const,
                  defaultDepartment: "Operations Management",
                };
                const isSelected = newUser.role === role.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setNewUser((prev) => ({
                        ...prev,
                        role: role.id,
                        department: config.defaultDepartment,
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "border-[#0073EA] bg-blue-50/70 ring-2 ring-[#0073EA]/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-white shadow-2xs" : "bg-slate-100"}`}>
                        {getRoleIcon(role.code)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 text-xs truncate">
                            {config.simpleName}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#0073EA] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-tight">
                          {config.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-medium truncate max-w-[150px]">
                        Station: <strong className="text-slate-700">{config.stationName}</strong>
                      </span>
                      <Badge variant={config.badgeVariant} size="sm">
                        {config.category}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Permissions Summary */}
          {selectedNewUserRole && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50/40 via-white to-slate-50 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-[#0073EA]" />
                  <span>Workstation & Access Summary</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">Department:</span>
                  <select
                    value={newUser.department}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, department: e.target.value }))}
                    className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#0073EA]"
                  >
                    {ALL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Assigned Workstation & Queue
                  </span>
                  <span className="font-semibold text-slate-900 block mt-0.5">
                    {newUserRoleOrderPerm?.stationName || "Standard Operations"}
                  </span>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    Dashboard defaults to this station's active orders queue.
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Orders Page Status Permission
                  </span>
                  <span className="font-semibold text-emerald-700 block mt-0.5">
                    {FRIENDLY_ROLES_CONFIG[selectedNewUserRole.code]?.allowedOrdersNote || "Station-specific transitions only"}
                  </span>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    Other pipeline stages are locked from unauthorized changes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 2: ASSIGN ROLE */}
      <Modal
        isOpen={isAssignRoleModalOpen}
        onClose={() => setIsAssignRoleModalOpen(false)}
        title={`Change Role for ${selectedUserForRole?.full_name || "Team Member"}`}
        description="Update operational role and workstation permissions."
        maxWidth="2xl"
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
          {/* Current User Info */}
          {selectedUserForRole && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800">{selectedUserForRole.full_name}</span>
                <span className="text-slate-400 font-mono ml-2">({selectedUserForRole.email})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Current:</span>
                <Badge variant="neutral" size="sm">
                  {selectedUserForRole.role_details?.name || "Staff"}
                </Badge>
              </div>
            </div>
          )}

          {/* Simple & Visual Role Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block font-bold text-slate-900 text-xs">
                  Choose New Role & Workstation <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Select the target role. Station and permissions will be updated accordingly.
                </p>
              </div>
              {selectedChangeRole && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Selected: {FRIENDLY_ROLES_CONFIG[selectedChangeRole.code]?.simpleName || selectedChangeRole.name}
                </span>
              )}
            </div>

            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {sortedAssignableRoles.map((role) => {
                const config = FRIENDLY_ROLES_CONFIG[role.code] || {
                  simpleName: role.name,
                  category: "Operations",
                  stationName: "General Station",
                  description: role.description || "Operational team role.",
                  allowedOrdersNote: "Standard operational permissions.",
                  badgeVariant: "neutral" as const,
                  defaultDepartment: "Operations Management",
                };
                const isSelected = assignRoleData.role_id === role.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setAssignRoleData((prev) => ({
                        ...prev,
                        role_id: role.id,
                        department: config.defaultDepartment,
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "border-[#0073EA] bg-blue-50/70 ring-2 ring-[#0073EA]/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-white shadow-2xs" : "bg-slate-100"}`}>
                        {getRoleIcon(role.code)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 text-xs truncate">
                            {config.simpleName}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#0073EA] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-tight">
                          {config.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-medium truncate max-w-[150px]">
                        Station: <strong className="text-slate-700">{config.stationName}</strong>
                      </span>
                      <Badge variant={config.badgeVariant} size="sm">
                        {config.category}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Summary */}
          {selectedChangeRole && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50/40 via-white to-slate-50 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-[#0073EA]" />
                  <span>New Permissions Summary</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">Department:</span>
                  <select
                    value={assignRoleData.department}
                    onChange={(e) => setAssignRoleData((prev) => ({ ...prev, department: e.target.value }))}
                    className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#0073EA]"
                  >
                    {ALL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Assigned Workstation & Queue
                  </span>
                  <span className="font-semibold text-slate-900 block mt-0.5">
                    {changeRoleOrderPerm?.stationName || "Standard Operations"}
                  </span>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    Dashboard defaults to this station's active orders queue.
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Orders Page Status Permission
                  </span>
                  <span className="font-semibold text-emerald-700 block mt-0.5">
                    {FRIENDLY_ROLES_CONFIG[selectedChangeRole.code]?.allowedOrdersNote || "Station-specific transitions only"}
                  </span>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    Other pipeline stages are locked from unauthorized changes.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Reason for Change (Optional)
            </label>
            <textarea
              rows={2}
              value={assignRoleData.reason}
              onChange={(e) => setAssignRoleData({ ...assignRoleData, reason: e.target.value })}
              placeholder="e.g. Promoted to Shipping Lead, transferred to Prepress..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: EDIT STAFF PROFILE */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Profile: ${editingUser?.full_name || "Team Member"}`}
        description="Update personal details, employee ID, workstation, and operational role."
        maxWidth="2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={updateUserMutation.isPending}
              onClick={() => {
                if (!editingUser) return;
                if (!editFormData.first_name?.trim() || !editFormData.email?.trim() || !editFormData.role) {
                  toast.warning(
                    "Incomplete Form",
                    "First name, email address, and staff role are required."
                  );
                  return;
                }
                if (editFormData.password?.trim() && editFormData.password.trim().length < 6) {
                  toast.warning(
                    "Password Too Short",
                    "Password must be at least 6 characters long."
                  );
                  return;
                }
                const payload: any = {
                  first_name: editFormData.first_name.trim(),
                  last_name: editFormData.last_name.trim(),
                  email: editFormData.email.trim(),
                  employee_id: editFormData.employee_id.trim() || null,
                  phone_number: editFormData.phone_number.trim(),
                  department: editFormData.department,
                  role: editFormData.role,
                  is_active: editFormData.is_active,
                };
                if (editFormData.password?.trim()) {
                  payload.password = editFormData.password.trim();
                }
                updateUserMutation.mutate({
                  id: editingUser.id,
                  data: payload,
                });
              }}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Hidden decoy fields to absorb aggressive browser autofill heuristics */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="staff_edit_first_name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="e.g. Rachel"
                value={editFormData.first_name}
                onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="staff_edit_last_name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="e.g. Chen"
                value={editFormData.last_name}
                onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
          </div>

          {/* Email, Employee ID, Phone & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="staff_edit_email"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="rachel.chen@silverpointpod.com"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Employee ID</label>
              <input
                type="text"
                name="staff_edit_emp_id"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="EMP-6091"
                value={editFormData.employee_id}
                onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
              <input
                type="text"
                name="staff_edit_phone"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="+44 20 7946 0912"
                value={editFormData.phone_number}
                onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Active Status</label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, is_active: true })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    editFormData.is_active
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, is_active: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    !editFormData.is_active
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Deactivated</span>
                </button>
              </div>
            </div>
          </div>

          {/* Optional Password Reset */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>Reset Staff Password (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400">Leave blank to retain current password</span>
            </div>
            <div className="relative">
              <input
                type={showEditPassword ? "text" : "password"}
                name="staff_edit_new_password"
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="Enter new password to reset for this staff member (min 6 chars)"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 pr-9 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              />
              <button
                type="button"
                onClick={() => setShowEditPassword(!showEditPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showEditPassword ? "Hide password" : "Show password"}
              >
                {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              If entered, this updates the staff member's login password immediately.
            </p>
          </div>

          {/* Simple & Visual Role Selection */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block font-bold text-slate-900 text-xs">
                  Staff Role & Workstation <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Select the operational role. Workstation queues and order status permissions update automatically.
                </p>
              </div>
              {selectedEditUserRole && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Selected: {FRIENDLY_ROLES_CONFIG[selectedEditUserRole.code]?.simpleName || selectedEditUserRole.name}
                </span>
              )}
            </div>

            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
              {sortedAssignableRoles.map((role) => {
                const config = FRIENDLY_ROLES_CONFIG[role.code] || {
                  simpleName: role.name,
                  category: "Operations",
                  stationName: "General Station",
                  description: role.description || "Operational team role.",
                  allowedOrdersNote: "Standard operational permissions.",
                  badgeVariant: "neutral" as const,
                  defaultDepartment: "Operations Management",
                };
                const isSelected = editFormData.role === role.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setEditFormData((prev) => ({
                        ...prev,
                        role: role.id,
                        department: config.defaultDepartment,
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "border-[#0073EA] bg-blue-50/70 ring-2 ring-[#0073EA]/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-white shadow-2xs" : "bg-slate-100"}`}>
                        {getRoleIcon(role.code)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 text-xs truncate">
                            {config.simpleName}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#0073EA] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-tight">
                          {config.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-medium truncate max-w-[150px]">
                        Station: <strong className="text-slate-700">{config.stationName}</strong>
                      </span>
                      <Badge variant={config.badgeVariant} size="sm">
                        {config.category}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Summary */}
          {selectedEditUserRole && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50/40 via-white to-slate-50 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-[#0073EA]" />
                  <span>Workstation & Permissions Summary</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">Department:</span>
                  <select
                    value={editFormData.department}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, department: e.target.value }))}
                    className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#0073EA]"
                  >
                    {ALL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Assigned Workstation & Queue
                  </span>
                  <span className="font-semibold text-slate-900 block mt-0.5">
                    {editUserRoleOrderPerm?.stationName || "Standard Operations"}
                  </span>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    Dashboard defaults to this station's active orders queue.
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Orders Page Status Permission
                  </span>
                  <span className="font-semibold text-emerald-700 block mt-0.5">
                    {FRIENDLY_ROLES_CONFIG[selectedEditUserRole.code]?.allowedOrdersNote || "Station-specific transitions only"}
                  </span>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    Other pipeline stages are locked from unauthorized changes.
                  </p>
                </div>
              </div>
            </div>
          )}
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

      {/* MODAL: CHANGE PASSWORD (SUPER ADMIN & STAFF) */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title={`Change Password: ${passwordTargetUser?.full_name || passwordTargetUser?.email || "Staff Member"}`}
        description={
          isSuperAdminUser(passwordTargetUser)
            ? "Update master login password credentials for this protected account."
            : "Update portal login credentials for this staff member."
        }
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={changePasswordMutation.isPending}
              onClick={() => {
                if (!passwordTargetUser) return;
                if (!newPasswordVal || newPasswordVal.trim().length < 6) {
                  toast.warning("Invalid Password", "Password must be at least 6 characters long.");
                  return;
                }
                if (newPasswordVal !== confirmPasswordVal) {
                  toast.error("Password Mismatch", "New password and confirm password do not match.");
                  return;
                }
                changePasswordMutation.mutate({
                  userId: passwordTargetUser.id,
                  password: newPasswordVal.trim(),
                });
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              Update Password
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Security Banner */}
          {isSuperAdminUser(passwordTargetUser) ? (
            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-amber-900">
                <strong className="block text-amber-950 font-bold text-xs mb-0.5">
                  Protected Master Super Admin Account
                </strong>
                Only one Super Admin is permitted in the system. Full name, email, department, and master roles are permanently locked and cannot be edited. Only password credentials may be modified.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200/90 flex items-start gap-2.5">
              <KeyRound className="w-5 h-5 text-[#0073EA] shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-slate-700">
                <strong className="block text-slate-900 font-bold text-xs mb-0.5">
                  Staff Member Password Reset
                </strong>
                Enter a new password for this team member. They will be able to log in immediately with these credentials.
              </div>
            </div>
          )}

          {/* Account Snapshot Info */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-slate-400 block font-medium">Account Email</span>
              <span className="font-semibold text-slate-800 font-mono truncate block mt-0.5">
                {passwordTargetUser?.email}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Designation</span>
              <span className="font-semibold text-amber-800 block mt-0.5">
                {passwordTargetUser?.role_details?.name || "Super Admin"}
              </span>
            </div>
          </div>

          {/* Hidden decoy fields to absorb aggressive browser autofill heuristics */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

          {/* New Password Input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                name="staff_modal_new_password"
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                placeholder="Enter new strong password (min 6 chars)"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 pr-9 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Must contain at least 6 characters.</p>
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <input
              type={showNewPassword ? "text" : "password"}
              name="staff_modal_confirm_password"
              autoComplete="new-password"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              placeholder="Re-type new password"
              value={confirmPasswordVal}
              onChange={(e) => setConfirmPasswordVal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
