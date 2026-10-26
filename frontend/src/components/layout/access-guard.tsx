"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  UserCheck,
  Lock,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NAVIGATION_ITEMS,
  isPathAllowedForRole,
  getRoleAllowedSlugs,
  getRoleHomePath,
} from "./navigation-config";

export function RBACAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem("silverpoint_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, [pathname]);

  if (!isMounted) {
    return <>{children}</>;
  }

  const userRole = currentUser?.role?.code || currentUser?.role_code || "SUPER_ADMIN";
  const staffName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim()
    : currentUser?.username || "Staff Member";

  const isAllowed = isPathAllowedForRole(pathname, userRole);

  if (!isAllowed) {
    const currentNav = NAVIGATION_ITEMS.find(
      (item) => item.path === pathname || pathname.startsWith(`${item.path}/`)
    );
    const allowedSlugs = getRoleAllowedSlugs(userRole);
    const allowedItems = NAVIGATION_ITEMS.filter((item) =>
      allowedSlugs.includes(item.slug)
    );
    const homePath = getRoleHomePath(userRole);

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-rose-200/80 p-8 shadow-xl shadow-rose-500/5 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-md shadow-rose-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>403 Access Denied: Operational Rights Restriction</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Restricted Area: {currentNav?.name || "System Module"}
            </h1>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Your active staff account (
              <strong className="text-slate-800 font-semibold">{staffName}</strong> [
              <span className="font-mono text-[#0073EA] font-semibold">
                {userRole.replace(/_/g, " ")}
              </span>
              ]) does not have accessibility rights to view or operate in this department module.
            </p>
          </div>

          {/* Authorized modules list */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Your Authorized Workstations:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {allowedItems.map((item) => (
                <Link
                  key={item.slug}
                  href={item.path}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 hover:border-[#0073EA] hover:text-[#0073EA] text-slate-700 transition-all font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href={homePath} className="w-full sm:w-auto">
              <Button
                size="sm"
                className="w-full sm:w-auto bg-[#0073EA] hover:bg-[#0060B9] text-white font-semibold text-xs"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Return to Your Workstation
              </Button>
            </Link>

            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto text-xs"
                leftIcon={<UserCheck className="w-4 h-4" />}
              >
                Switch Account / Sign In with Admin Rights
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
