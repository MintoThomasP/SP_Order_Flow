export interface NavigationItem {
  name: string;
  slug: string;
  path: string;
  icon: string;
  badge?: string;
  group: "Operations" | "Integrations" | "System Control";
  description: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    name: "Dashboard",
    slug: "overview",
    path: "/overview",
    icon: "LayoutDashboard",
    group: "Operations",
    description: "Summary of orders, print jobs, shipping progress, and team performance.",
  },
  {
    name: "Orders",
    slug: "orders",
    path: "/orders",
    icon: "PackageCheck",
    badge: "Live",
    group: "Operations",
    description: "View and manage incoming customer orders and delivery deadlines.",
  },
  {
    name: "Artwork & Prepress",
    slug: "prepress",
    path: "/prepress",
    icon: "FileCheck2",
    group: "Operations",
    description: "Review artwork files, check page sizes and bleed, and approve for printing.",
  },
  {
    name: "Print Batches",
    slug: "production",
    path: "/production/batching",
    icon: "Layers",
    badge: "Tickets",
    group: "Operations",
    description: "Group approved orders by paper type and print job tickets.",
  },
  {
    name: "Shipping & Tracking",
    slug: "dispatch",
    path: "/dispatch",
    icon: "Truck",
    group: "Operations",
    description: "Pack orders, create courier labels, and track deliveries.",
  },
  {
    name: "Invoices & Pricing",
    slug: "finance",
    path: "/finance",
    icon: "Receipt",
    badge: "Invoices",
    group: "Operations",
    description: "View monthly customer invoices, price lists, and quote calculator.",
  },
  {
    name: "POD Integration",
    slug: "pod-integration",
    path: "/pod-integration",
    icon: "Globe2",
    badge: "API",
    group: "Integrations",
    description: "Manage Peecho and third-party print-on-demand connections, API credentials, and webhooks.",
  },
  {
    name: "Staff Accounts",
    slug: "staff",
    path: "/staff",
    icon: "Users",
    badge: "Staff",
    group: "System Control",
    description: "Manage team members, roles, station access, and activity logs.",
  },
  {
    name: "System Settings",
    slug: "settings",
    path: "/settings",
    icon: "SlidersHorizontal",
    group: "System Control",
    description: "Database and backend connection settings.",
  },
];

// RBAC Navigation Mapping per Operational Role based on Staff Designations
export const ROLE_ALLOWED_SLUGS: Record<string, string[]> = {
  SUPER_ADMIN: [
    "overview",
    "orders",
    "prepress",
    "production",
    "dispatch",
    "finance",
    "pod-integration",
    "peecho",
    "staff",
    "settings",
  ],
  ADMIN: [
    "overview",
    "orders",
    "prepress",
    "production",
    "dispatch",
    "finance",
    "pod-integration",
    "peecho",
    "staff",
    "settings",
  ],
  PREPRESS_SPECIALIST: ["overview", "orders", "prepress"],
  PRODUCTION_MANAGER: ["overview", "orders", "prepress", "production"],
  SHOPFLOOR_OPERATOR: ["overview", "orders", "production"],
  DISPATCH_SPECIALIST: ["overview", "orders", "dispatch"],
  FINANCE_SPECIALIST: ["overview", "orders", "finance"],
  DISPATCH_FINANCE_SPECIALIST: ["overview", "orders", "dispatch", "finance"],
  INTEGRATION_SPECIALIST: ["overview", "orders", "pod-integration", "peecho", "settings"],
};

export interface RoleAccessProfile {
  code: string;
  title: string;
  designation: string;
  department: string;
  accessBadge: string;
  badgeVariant: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  description: string;
  allowedSlugs: string[];
  capabilities: string[];
}

export const ROLE_ACCESS_PROFILES: Record<string, RoleAccessProfile> = {
  SUPER_ADMIN: {
    code: "SUPER_ADMIN",
    title: "Super Admin",
    designation: "Executive Director / System Administrator",
    department: "Executive Management",
    accessBadge: "Maximum Platform Access (All Modules)",
    badgeVariant: "danger",
    description: "Unrestricted platform privileges: manage team, billing, full production lifecycle, API webhooks, and security audit logs.",
    allowedSlugs: ["overview", "orders", "prepress", "production", "dispatch", "finance", "pod-integration", "staff", "settings"],
    capabilities: ["Full System Admin", "Team RBAC Management", "Artwork Approval/Rejection", "Job Ticket Imposition", "Waybill Generation", "Invoice Management", "API Credentials Config"],
  },
  ADMIN: {
    code: "ADMIN",
    title: "Operations General Manager",
    designation: "Operations General Manager",
    department: "Operations Management",
    accessBadge: "Maximum Operations Access",
    badgeVariant: "primary",
    description: "Comprehensive operational control: oversee orders, prepress approvals, press batching, dispatch pipelines, and team access.",
    allowedSlugs: ["overview", "orders", "prepress", "production", "dispatch", "finance", "pod-integration", "staff", "settings"],
    capabilities: ["Operational Supervision", "Order Priority Overrides", "Batch Imposition", "Carrier Management", "Staff Assignment"],
  },
  PREPRESS_SPECIALIST: {
    code: "PREPRESS_SPECIALIST",
    title: "Prepress Specialist",
    designation: "Prepress & Preflight Lead",
    department: "Prepress & Preflight",
    accessBadge: "Prepress Maximum Access",
    badgeVariant: "warning",
    description: "Dedicated artwork inspection: high-resolution PDF preflight, bleed/trim validation, automated spine calculator, and digital proof approvals.",
    allowedSlugs: ["overview", "orders", "prepress"],
    capabilities: ["Preflight PDF Inspection", "Approve / Reject Proofs", "Spine Width Calculations", "High-Res Asset Download"],
  },
  PRODUCTION_MANAGER: {
    code: "PRODUCTION_MANAGER",
    title: "Production Manager",
    designation: "Production & Imposition Floor Manager",
    department: "Production Shopfloor",
    accessBadge: "Production Maximum Access",
    badgeVariant: "info",
    description: "Shopfloor scheduling: bundle verified orders into production batches, manage target print machines and binding methods, and generate ReportLab QR job tickets.",
    allowedSlugs: ["overview", "orders", "prepress", "production"],
    capabilities: ["Batch Imposition", "Press Scheduling", "Equipment & Binding CRUD", "QR Job Ticket PDF Generation", "Reprint Authorization"],
  },
  SHOPFLOOR_OPERATOR: {
    code: "SHOPFLOOR_OPERATOR",
    title: "Shopfloor Operator",
    designation: "Digital Press & Bindery Operator",
    department: "Digital Press & Bindery",
    accessBadge: "Workstation Access",
    badgeVariant: "neutral",
    description: "Machine-level operations: access active print queues, scan job ticket QR codes, log station progress, and record sheet wastage.",
    allowedSlugs: ["overview", "orders", "production"],
    capabilities: ["Active Queue Inspection", "Job Ticket Barcode Scans", "Press Run Status Logging", "Bindery Execution"],
  },
  DISPATCH_SPECIALIST: {
    code: "DISPATCH_SPECIALIST",
    title: "Shipping Specialist",
    designation: "Shipping & Warehouse Lead",
    department: "Logistics & Shipping",
    accessBadge: "Dispatch Maximum Access",
    badgeVariant: "success",
    description: "Order fulfillment: packaging audit, courier label generation, carrier pickup manifests, and shipping tracking updates.",
    allowedSlugs: ["overview", "orders", "dispatch"],
    capabilities: ["Packaging Verification", "Courier Label Generation", "Carrier Handover Manifests", "Tracking Updates"],
  },
  FINANCE_SPECIALIST: {
    code: "FINANCE_SPECIALIST",
    title: "Finance Specialist",
    designation: "Finance & Accounts Specialist",
    department: "Billing & Finance",
    accessBadge: "Finance Maximum Access",
    badgeVariant: "success",
    description: "Financial operations: generate monthly customer invoices, manage client product pricing tiers, quote calculator, and payment reconciliations.",
    allowedSlugs: ["overview", "orders", "finance"],
    capabilities: ["Invoice Generation", "Price List Management", "Quote Estimator", "Payment Reconciliation"],
  },
  DISPATCH_FINANCE_SPECIALIST: {
    code: "DISPATCH_FINANCE_SPECIALIST",
    title: "Dispatch / Finance Specialist",
    designation: "Logistics & Billing Lead",
    department: "Logistics & Finance",
    accessBadge: "Logistics & Billing Access",
    badgeVariant: "success",
    description: "Combined fulfillment and billing access: package orders, create waybills, invoice accounts, and reconcile deliveries.",
    allowedSlugs: ["overview", "orders", "dispatch", "finance"],
    capabilities: ["Waybills & Labels", "Carrier Tracking", "Invoicing & Billing", "Financial Records"],
  },
  INTEGRATION_SPECIALIST: {
    code: "INTEGRATION_SPECIALIST",
    title: "POD Integration Lead",
    designation: "Technical Integration Specialist",
    department: "Systems & Integrations",
    accessBadge: "Integrations Maximum Access",
    badgeVariant: "info",
    description: "Peecho and third-party print-on-demand connectivity: manage API credentials, webhook payload logs, and sync troubleshooting.",
    allowedSlugs: ["overview", "orders", "pod-integration", "settings"],
    capabilities: ["Peecho Gateway Sync", "Webhook Payload Auditing", "API Secret Management", "Connection Diagnostics"],
  },
};

export function getRoleAllowedSlugs(roleCode: string): string[] {
  return ROLE_ALLOWED_SLUGS[roleCode] || ROLE_ALLOWED_SLUGS.SUPER_ADMIN;
}

export function isPathAllowedForRole(pathname: string, roleCode: string): boolean {
  if (roleCode === "SUPER_ADMIN" || roleCode === "ADMIN") return true;

  const allowedSlugs = getRoleAllowedSlugs(roleCode);
  const matchedItem = NAVIGATION_ITEMS.find(
    (item) => item.path === pathname || pathname.startsWith(`${item.path}/`)
  );

  // If path is not part of navigation items (e.g. unknown or public), default to true or overview
  if (!matchedItem) return true;
  return allowedSlugs.includes(matchedItem.slug);
}

export function getRoleHomePath(roleCode: string): string {
  switch (roleCode) {
    case "PREPRESS_SPECIALIST":
      return "/prepress";
    case "PRODUCTION_MANAGER":
      return "/production/batching";
    case "SHOPFLOOR_OPERATOR":
      return "/production/batching";
    case "DISPATCH_SPECIALIST":
      return "/dispatch";
    case "FINANCE_SPECIALIST":
      return "/finance";
    case "DISPATCH_FINANCE_SPECIALIST":
      return "/dispatch";
    case "INTEGRATION_SPECIALIST":
      return "/pod-integration";
    case "SUPER_ADMIN":
    case "ADMIN":
    default:
      return "/overview";
  }
}

export interface RoleOrderPermission {
  roleName?: string;
  stationName: string;
  department: string;
  allowedTargetStatuses: string[];
  allowedViewStatuses: string[];
  canChangeStatus: boolean;
  canAdvanceSequentially: boolean;
  description: string;
  disallowedNotice: string;
}

export const ROLE_ORDER_PERMISSIONS: Record<string, RoleOrderPermission> = {
  SUPER_ADMIN: {
    roleName: "Super Admin",
    stationName: "Executive Administration",
    department: "Executive Management",
    allowedTargetStatuses: ["ALL"],
    allowedViewStatuses: ["ALL"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Full administrator override permissions across all workflow stages.",
    disallowedNotice: "",
  },
  ADMIN: {
    roleName: "Operations Manager / Admin",
    stationName: "Operations Management",
    department: "Operations Management",
    allowedTargetStatuses: ["ALL"],
    allowedViewStatuses: ["ALL"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Full operational override permissions across all workflow stages.",
    disallowedNotice: "",
  },
  PREPRESS_SPECIALIST: {
    roleName: "Prepress Specialist",
    stationName: "Artwork & Prepress Station",
    department: "Prepress & Preflight",
    allowedTargetStatuses: ["RECEIVED", "PREPRESS_QUEUED", "PREPRESS_PASSED", "EXCEPTION_HOLD"],
    allowedViewStatuses: ["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS", "PREPRESS_PASSED", "EXCEPTION_HOLD"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Restricted to Artwork Verification & Preflight approvals. Cannot transition orders to Production or Shipping stages.",
    disallowedNotice: "Only Prepress & Artwork stages can be transitioned by Prepress Specialists. Production and Shipping stages are locked.",
  },
  PRODUCTION_MANAGER: {
    roleName: "Floor Production Manager",
    stationName: "Print Floor & Imposition",
    department: "Production Shopfloor",
    allowedTargetStatuses: ["BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH", "EXCEPTION_HOLD"],
    allowedViewStatuses: ["PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PRODUCTION_COMPLETED", "PACKED"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Restricted to Batching, Press Execution, Quality Audit, and Packing. Cannot approve prepress artwork or mark orders as shipped/delivered.",
    disallowedNotice: "Only Production and Press stages can be transitioned by Production Managers. Prepress and Shipping transitions are locked.",
  },
  SHOPFLOOR_OPERATOR: {
    roleName: "Press Operator",
    stationName: "Digital Press & Bindery",
    department: "Digital Press & Bindery",
    allowedTargetStatuses: ["IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PACKED"],
    allowedViewStatuses: ["BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PACKED"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Restricted to Machine Run Status, Print Quality, and Packing. Cannot approve artwork or dispatch orders.",
    disallowedNotice: "Only Shopfloor Print and Bindery stages can be updated by Press Operators.",
  },
  DISPATCH_SPECIALIST: {
    roleName: "Shipping & Warehouse Lead",
    stationName: "Shipping & Fulfillment Station",
    department: "Logistics & Shipping",
    allowedTargetStatuses: ["READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"],
    allowedViewStatuses: ["PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Restricted strictly to Shipping, Courier Handover, Tracking, and Delivery. Cannot alter prepress or production statuses.",
    disallowedNotice: "Shipping & Tracking designation allows changes ONLY to Shipping stages (Ready for Dispatch, Dispatched, In Transit, Out for Delivery, Delivered). All Prepress and Production statuses are locked.",
  },
  DISPATCH_FINANCE_SPECIALIST: {
    roleName: "Logistics & Settlement Officer",
    stationName: "Logistics & Billing Station",
    department: "Logistics & Finance",
    allowedTargetStatuses: ["READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"],
    allowedViewStatuses: ["PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Restricted to Packaging, Dispatch, Courier Tracking, and Invoicing.",
    disallowedNotice: "Restricted to Shipping, Tracking, and Invoicing stages. Prepress and production changes are locked.",
  },
  FINANCE_SPECIALIST: {
    roleName: "Finance & Accounts Specialist",
    stationName: "Invoicing & Financial Accounts",
    department: "Billing & Finance",
    allowedTargetStatuses: ["EXCEPTION_HOLD"],
    allowedViewStatuses: ["DISPATCHED", "DELIVERED", "EXCEPTION_HOLD"],
    canChangeStatus: false,
    canAdvanceSequentially: false,
    description: "Restricted to Financial Invoicing and Pricing. Physical factory and shipping transitions are locked.",
    disallowedNotice: "Finance Specialists cannot alter factory production or shipping stages. Order status changes are reserved for shopfloor and logistics teams.",
  },
  INTEGRATION_SPECIALIST: {
    roleName: "API Integration Engineer",
    stationName: "Integration & Intake Hub",
    department: "Systems & Integrations",
    allowedTargetStatuses: ["RECEIVED", "PREPRESS_QUEUED", "EXCEPTION_HOLD"],
    allowedViewStatuses: ["RECEIVED", "PREPRESS_QUEUED", "EXCEPTION_HOLD"],
    canChangeStatus: true,
    canAdvanceSequentially: true,
    description: "Restricted to Order Intake, API Simulation, and Webhooks.",
    disallowedNotice: "Restricted to order intake and API sync. Production and dispatch statuses are locked.",
  },
};

export function getRoleOrderPermission(roleCode: string): RoleOrderPermission {
  return ROLE_ORDER_PERMISSIONS[roleCode] || ROLE_ORDER_PERMISSIONS.SUPER_ADMIN;
}

export function isStatusAllowedForRole(roleCode: string, statusCode: string): boolean {
  if (roleCode === "SUPER_ADMIN" || roleCode === "ADMIN") return true;
  const perm = getRoleOrderPermission(roleCode);
  if (!perm.canChangeStatus) return false;
  if (perm.allowedTargetStatuses.includes("ALL")) return true;
  return perm.allowedTargetStatuses.map((s) => s.toUpperCase()).includes(statusCode.toUpperCase());
}

export function isOrderRelevantForRole(roleCode: string, orderStatusCode: string): boolean {
  if (roleCode === "SUPER_ADMIN" || roleCode === "ADMIN") return true;
  const perm = getRoleOrderPermission(roleCode);
  if (perm.allowedViewStatuses.includes("ALL")) return true;
  return perm.allowedViewStatuses.map((s) => s.toUpperCase()).includes(orderStatusCode.toUpperCase());
}

export interface WorkstationQueueDefinition {
  stationCode: string;
  stationName: string;
  department: string;
  pendingLabel: string;
  pendingSubtitle: string;
  pendingStatuses: string[];
  processedLabel: string;
  processedSubtitle: string;
  processedStatuses: string[];
}

export const WORKSTATION_QUEUES: Record<string, WorkstationQueueDefinition> = {
  PREPRESS_SPECIALIST: {
    stationCode: "PREPRESS",
    stationName: "Artwork & Prepress Station",
    department: "Prepress & Preflight",
    pendingLabel: "Awaiting Artwork Approval",
    pendingSubtitle: "Incoming customer files requiring preflight bleed, spine, and proof check",
    pendingStatuses: ["RECEIVED", "PREPRESS_QUEUED", "PENDING_PREPRESS"],
    processedLabel: "Artwork Processed & Approved",
    processedSubtitle: "Orders approved and released to production floor, or flagged on exception hold",
    processedStatuses: [
      "PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "PRINTING",
      "QUALITY_AUDIT", "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH",
      "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION_HOLD"
    ],
  },
  SHOPFLOOR_OPERATOR: {
    stationCode: "SHOPFLOOR",
    stationName: "Digital Press & Bindery Floor",
    department: "Digital Press & Bindery",
    pendingLabel: "Active Press Queue",
    pendingSubtitle: "Artwork-approved batches assigned to HP Indigo & Canon presses and bindery runs",
    pendingStatuses: ["BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT"],
    processedLabel: "Completed Press Runs",
    processedSubtitle: "Jobs with printing and quality audit finished, packed, and handed to dispatch",
    processedStatuses: [
      "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH",
      "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"
    ],
  },
  PRODUCTION_MANAGER: {
    stationCode: "PRODUCTION",
    stationName: "Production Floor & Imposition Hub",
    department: "Production Shopfloor",
    pendingLabel: "Floor Queue & Scheduling",
    pendingSubtitle: "Artwork-approved orders awaiting imposition batching, press routing, and floor throughput",
    pendingStatuses: ["PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT"],
    processedLabel: "Completed Production",
    processedSubtitle: "Completed factory batches packed and staged for shipping dispatch",
    processedStatuses: [
      "PRODUCTION_COMPLETED", "PACKED", "READY_FOR_DISPATCH",
      "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"
    ],
  },
  DISPATCH_SPECIALIST: {
    stationCode: "DISPATCH",
    stationName: "Shipping & Fulfillment Station",
    department: "Logistics & Shipping",
    pendingLabel: "Awaiting Packaging & Dispatch",
    pendingSubtitle: "Packed factory parcels awaiting parcel verification, carrier waybills (DHL/FedEx), and handover",
    pendingStatuses: ["PACKED", "READY_FOR_DISPATCH"],
    processedLabel: "Dispatched & Delivered History",
    processedSubtitle: "Parcels handed to couriers with live tracking waybills and confirmed deliveries",
    processedStatuses: ["DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"],
  },
  DISPATCH_FINANCE_SPECIALIST: {
    stationCode: "DISPATCH_FINANCE",
    stationName: "Logistics & Settlement Station",
    department: "Logistics & Finance",
    pendingLabel: "Awaiting Dispatch & Billing",
    pendingSubtitle: "Packed parcels requiring carrier labels and invoice preparation",
    pendingStatuses: ["PACKED", "READY_FOR_DISPATCH"],
    processedLabel: "Dispatched & Reconciled",
    processedSubtitle: "Fulfilled shipments with recorded tracking and settled invoicing",
    processedStatuses: ["DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"],
  },
  FINANCE_SPECIALIST: {
    stationCode: "FINANCE",
    stationName: "Invoicing & Financial Accounts",
    department: "Billing & Finance",
    pendingLabel: "Pending Invoice Settlement",
    pendingSubtitle: "Fulfilled and delivered customer orders requiring final financial settlement",
    pendingStatuses: ["DISPATCHED", "DELIVERED"],
    processedLabel: "Settled Invoices",
    processedSubtitle: "Invoiced accounts and reconciled ledger entries",
    processedStatuses: ["SETTLED", "INVOICED", "EXCEPTION_HOLD"],
  },
  INTEGRATION_SPECIALIST: {
    stationCode: "INTEGRATION",
    stationName: "Integration & Intake Hub",
    department: "Systems & Integrations",
    pendingLabel: "Intake & Payload Queue",
    pendingSubtitle: "Incoming webhook order payloads requiring ingestion and initial preflight queuing",
    pendingStatuses: ["RECEIVED", "PREPRESS_QUEUED"],
    processedLabel: "Processed Intake",
    processedSubtitle: "Orders successfully ingested and forwarded to prepress",
    processedStatuses: ["PREPRESS_PASSED", "BATCHED", "IN_PRODUCTION", "DELIVERED", "EXCEPTION_HOLD"],
  },
  ADMIN: {
    stationCode: "ADMIN",
    stationName: "Factory Master Order Flow",
    department: "Operations Management",
    pendingLabel: "Active Factory Pipeline",
    pendingSubtitle: "All live factory orders progressing through intake, prepress, press, and packaging",
    pendingStatuses: [
      "RECEIVED", "PREPRESS_QUEUED", "PREPRESS_PASSED", "BATCHED",
      "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PRODUCTION_COMPLETED",
      "PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"
    ],
    processedLabel: "Delivered & Closed Orders",
    processedSubtitle: "Shipments successfully delivered to customers or closed",
    processedStatuses: ["DELIVERED", "EXCEPTION_HOLD"],
  },
  SUPER_ADMIN: {
    stationCode: "SUPER_ADMIN",
    stationName: "Master Platform Order Flow",
    department: "Executive Management",
    pendingLabel: "Active Factory Pipeline",
    pendingSubtitle: "Comprehensive overview of all live production jobs across all workstations",
    pendingStatuses: [
      "RECEIVED", "PREPRESS_QUEUED", "PREPRESS_PASSED", "BATCHED",
      "IN_PRODUCTION", "PRINTING", "QUALITY_AUDIT", "PRODUCTION_COMPLETED",
      "PACKED", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"
    ],
    processedLabel: "Delivered & Closed Orders",
    processedSubtitle: "Successfully fulfilled shipments across all customer channels",
    processedStatuses: ["DELIVERED", "EXCEPTION_HOLD"],
  },
};

export function getWorkstationQueue(roleCode: string): WorkstationQueueDefinition {
  return WORKSTATION_QUEUES[roleCode] || WORKSTATION_QUEUES.SUPER_ADMIN;
}

