"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PackageCheck,
  FileCheck2,
  Printer,
  Truck,
  Globe2,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  ScanLine,
  Receipt,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { NAVIGATION_ITEMS, NavigationItem, getRoleAllowedSlugs } from "./navigation-config";
import { authApi } from "@/services/api";

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  PackageCheck: <PackageCheck className="w-4 h-4" />,
  FileCheck2: <FileCheck2 className="w-4 h-4" />,
  Printer: <Printer className="w-4 h-4" />,
  Layers: <Layers className="w-4 h-4" />,
  ScanLine: <ScanLine className="w-4 h-4" />,
  Truck: <Truck className="w-4 h-4" />,
  Receipt: <Receipt className="w-4 h-4" />,
  Globe2: <Globe2 className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  ShieldAlert: <ShieldAlert className="w-4 h-4" />,
  SlidersHorizontal: <SlidersHorizontal className="w-4 h-4" />,
};

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("silverpoint_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleLogout = async () => {
    await authApi.logout();
    router.push("/login");
  };

  const userRole = currentUser?.role?.code || currentUser?.role_code || "SUPER_ADMIN";
  const allowedSlugs = getRoleAllowedSlugs(userRole);
  const staffName = currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim() : (currentUser?.username || "Platform Admin");
  const avatarLetter = (currentUser?.first_name?.[0] || currentUser?.email?.[0] || "R").toUpperCase();

  const filteredItems = NAVIGATION_ITEMS.filter((item) => allowedSlugs.includes(item.slug));

  return (
    <div className="flex h-screen shrink-0 select-none">
      {/* 1. Left-most Narrow Dark Navy Rail (Matching Screenshot 1) */}
      <aside className="w-16 bg-[#111C44] flex flex-col items-center justify-between py-4 border-r border-[#1B2754] z-20">
        
        {/* Top: Window Dots & Active Launcher Icon */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* macOS Window Controls */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
          </div>

          {/* Active Primary App Launcher (Vibrant Royal Blue #0073EA) */}
          <Link
            href="/overview"
            className="w-10 h-10 rounded-xl bg-[#0073EA] flex items-center justify-center text-white shadow-md shadow-[#0073EA]/30 transition-transform active:scale-95 p-1.5"
            title="ORDERFLOW Command Center"
          >
            <img src="/logo-icon-white.png" alt="ORDERFLOW" className="w-6 h-6 object-contain" />
          </Link>

          {/* Quick Rail Nav Icons */}
          <div className="flex flex-col items-center gap-2 pt-2 w-full px-2">
            {filteredItems.slice(0, 6).map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.slug}
                  href={item.path}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                  title={item.name}
                >
                  {iconMap[item.icon] || <Layers className="w-4 h-4" />}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Rail: Logout Action & User Avatar Initial */}
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            type="button"
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Sign Out of Portal"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <Link
            href="/login"
            className="w-9 h-9 rounded-full bg-[#0073EA] text-white font-extrabold text-xs flex items-center justify-center shadow-md shadow-[#0073EA]/20 ring-2 ring-white/10 hover:ring-white/30 transition-all cursor-pointer"
            title={`${staffName} (${userRole.replace(/_/g, " ")})`}
          >
            {avatarLetter}
          </Link>
        </div>
      </aside>

      {/* 2. Main White Sidebar Panel (Matching Screenshot 1) */}
      <aside className="w-60 bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen">
        
        {/* Top Header & Navigation Links */}
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Top Brand Logo matching uploaded design */}
          <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between">
            <Link href="/overview" className="flex items-center">
              <img
                src="/logo.png"
                alt="ORDERFLOW - The Order Management System"
                className="h-7 w-auto object-contain max-w-[155px]"
              />
            </Link>
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/80 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            {/* User Mode Pill */}
            <div className="px-3 py-2 rounded-xl bg-[#F6F7FB] border border-slate-200/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0073EA] flex items-center justify-center text-white shrink-0 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-xs font-bold text-[#1E2229] truncate leading-tight">
                  {userRole === "SUPER_ADMIN" ? "Platform Admin" : staffName}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium truncate leading-tight">
                  {userRole === "SUPER_ADMIN" ? "Super Admin Mode" : userRole.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                MENU
              </p>
              
              <div className="space-y-1">
                {filteredItems.map((item) => {
                  const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);

                  return (
                    <Link
                      key={item.slug}
                      href={item.path}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#EFF6FF] text-[#0073EA] font-semibold"
                          : "text-[#676879] hover:text-[#1E2229] hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={isActive ? "text-[#0073EA]" : "text-slate-400 group-hover:text-slate-600"}>
                          {iconMap[item.icon] || <Layers className="w-4 h-4" />}
                        </span>
                        <span>{item.name}</span>
                      </div>

                      {/* Small Blue Indicator Dot for Active Item (matching screenshot) */}
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-[#0073EA] shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Footer Section */}
          <div className="p-3 border-t border-slate-100 bg-[#F8FAFC]/80">
            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </aside>
    </div>
  );
};
