"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Bell,
  UserCheck,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  LogOut,
  ShieldCheck,
  Building2,
  FileCheck2,
  Printer,
  ScanLine,
  Truck,
  CheckCheck,
  Trash2,
  Zap,
  AlertTriangle,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import { NAVIGATION_ITEMS } from "./navigation-config";
import { authApi } from "@/services/api";
import { useNotifications, AppNotification } from "@/context/notification-context";

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  } = useNotifications();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("silverpoint_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, [pathname]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentNav = NAVIGATION_ITEMS.find(
    (item) => item.path === pathname || pathname.startsWith(`${item.path}/`)
  );

  const userRole = currentUser?.role?.code || currentUser?.role_code || "SUPER_ADMIN";
  const staffName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim()
    : currentUser?.username || "Operations Master";
  const employeeId = currentUser?.employee_id || "EMP-1001";
  const department = currentUser?.department || "Executive Management";

  const handleLogout = async () => {
    await authApi.logout();
    window.location.href = "/login";
  };

  const getRelativeTime = (timestamp: string) => {
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return "Recently";
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filterCategory === "ALL") return true;
    if (filterCategory === "STATUS_SYNC") return notif.category === "STATUS_SYNC";
    if (filterCategory === "SLA_ALERT") return notif.category === "SLA_ALERT";
    if (filterCategory === "DISPATCH") return notif.category === "DISPATCH";
    return true;
  });

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Home</span>
        <span className="text-slate-300">/</span>
        <span className="font-bold text-[#1E2229]">
          {currentNav?.name || "Dashboard"}
        </span>
      </div>

      {/* Center Search Pill */}
      <div className="relative hidden md:block w-80 max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name="global_nav_search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          placeholder="Search orders, staff, shipments..."
          className="w-full bg-[#F4F5F7] border border-[#E5E7EB] rounded-full pl-9 pr-4 py-1.5 text-xs text-[#1E2229] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] focus:bg-white transition-all"
        />
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`relative p-2 rounded-xl transition-all ${
              isNotificationsOpen
                ? "bg-blue-50 text-[#0073EA]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
            title="Notifications & Live Auto-Sync Feed"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0073EA] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs animate-in zoom-in-75">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-96 sm:w-[420px] bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#0073EA] flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">Live Notifications</h3>
                    <p className="text-[10px] text-slate-500">Auto-sync & fulfillment alerts</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="px-2 py-1 text-[10px] font-semibold text-[#0073EA] hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      title="Clear notification list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Pills */}
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1 text-[11px] overflow-x-auto bg-white">
                {[
                  { id: "ALL", label: "All", count: notifications.length },
                  { id: "STATUS_SYNC", label: "Status Sync", count: notifications.filter(n => n.category === "STATUS_SYNC").length },
                  { id: "SLA_ALERT", label: "SLA Alerts", count: notifications.filter(n => n.category === "SLA_ALERT").length },
                  { id: "DISPATCH", label: "Dispatch", count: notifications.filter(n => n.category === "DISPATCH").length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterCategory(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                      filterCategory === tab.id
                        ? "bg-[#0073EA] text-white shadow-2xs font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`text-[9px] px-1 py-0.2 rounded-full ${
                        filterCategory === tab.id ? "bg-white/30 text-white" : "bg-slate-200/80 text-slate-600"
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Notification Items List */}
              <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[380px]">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Bell className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">No notifications here</p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      New status transitions and auto-sync events will pop up in real-time.
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={`p-3.5 transition-colors relative flex items-start gap-3 text-xs cursor-pointer group ${
                        !notif.read ? "bg-blue-50/40 hover:bg-blue-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Icon */}
                      <div className="shrink-0 mt-0.5">
                        {notif.category === "STATUS_SYNC" || notif.type === "success" ? (
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 fill-current" />
                          </div>
                        ) : notif.category === "DISPATCH" ? (
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#0073EA] flex items-center justify-center">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                        ) : notif.category === "SLA_ALERT" || notif.type === "warning" ? (
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="font-bold text-slate-900 leading-tight truncate">
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {getRelativeTime(notif.timestamp)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-snug break-words">
                          {notif.message}
                        </p>

                        <div className="flex items-center gap-2 mt-1.5">
                          {notif.orderNumber && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {notif.orderNumber}
                            </span>
                          )}
                          {notif.link && (
                            <Link
                              href={notif.link}
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsNotificationsOpen(false);
                                markAsRead(notif.id);
                              }}
                              className="text-[10px] font-semibold text-[#0073EA] hover:underline flex items-center gap-0.5"
                            >
                              <span>View</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Unread dot or dismiss */}
                      <div className="shrink-0 flex items-center gap-1">
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-[#0073EA] ring-2 ring-blue-100" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notif.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Popover Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium">Peecho Auto-Sync Active</span>
                </div>
                <Link
                  href="/pod-integration"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="font-semibold text-[#0073EA] hover:underline flex items-center gap-1"
                >
                  <span>Gateway Config</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#0073EA] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {(currentUser?.first_name?.[0] || currentUser?.email?.[0] || "R").toUpperCase()}
            </div>
            <div className="text-left hidden lg:block pr-1">
              <p className="text-xs font-bold text-[#1E2229] leading-tight">
                {userRole === "SUPER_ADMIN" ? "Admin" : staffName}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {userRole === "SUPER_ADMIN" ? "Administrator" : userRole.replace(/_/g, " ")}
              </p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3">
              {/* Account summary card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900">{staffName}</p>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-[#0073EA] border border-blue-200 font-semibold">
                    {employeeId}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{currentUser?.email || "admin@silverpointpod.com"}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-[#0073EA] font-semibold pt-1">
                  <span>{department}</span>
                  <span>•</span>
                  <span>{userRole.replace(/_/g, " ")}</span>
                </div>
              </div>

              {/* Quick links */}
              <div className="space-y-1 pt-1 text-xs">
                <Link
                  href="/login"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-[#0073EA] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0073EA]" />
                    <span>Switch User</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">/login</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Log Out</span>
                  </span>
                  <span className="text-[10px] text-rose-400 font-mono">End Session</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Direct Visible Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 transition-colors cursor-pointer shadow-2xs"
          title="Sign Out of ORDERFLOW"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

