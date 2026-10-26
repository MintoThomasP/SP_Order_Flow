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
    name: "Peecho Settings",
    slug: "peecho",
    path: "/peecho",
    icon: "Globe2",
    badge: "API",
    group: "Integrations",
    description: "Manage API keys, connection settings, and order notifications.",
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
    name: "Status & Roles",
    slug: "lookups",
    path: "/lookups",
    icon: "ShieldAlert",
    group: "System Control",
    description: "Customize order statuses and role permissions.",
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

// RBAC Navigation Mapping per Operational Role
export const ROLE_ALLOWED_SLUGS: Record<string, string[]> = {
  SUPER_ADMIN: [
    "overview",
    "orders",
    "prepress",
    "production",
    "dispatch",
    "finance",
    "peecho",
    "staff",
    "lookups",
    "settings",
  ],
  ADMIN: [
    "overview",
    "orders",
    "prepress",
    "production",
    "dispatch",
    "finance",
    "peecho",
    "staff",
    "lookups",
    "settings",
  ],
  PREPRESS_SPECIALIST: ["overview", "orders", "prepress"],
  PRODUCTION_MANAGER: ["overview", "orders", "prepress", "production"],
  SHOPFLOOR_OPERATOR: ["overview", "orders", "production"],
  DISPATCH_FINANCE_SPECIALIST: ["overview", "orders", "dispatch", "finance"],
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
      return "/orders";
    case "DISPATCH_FINANCE_SPECIALIST":
      return "/dispatch";
    case "SUPER_ADMIN":
    case "ADMIN":
    default:
      return "/overview";
  }
}

