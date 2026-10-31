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
  Volume2,
  VolumeX,
  Radio,
  Compass,
  ArrowRight,
} from "lucide-react";
import { NAVIGATION_ITEMS } from "./navigation-config";
import { authApi, searchApi, GlobalSearchResponse } from "@/services/api";
import { useNotifications, AppNotification } from "@/context/notification-context";
import { useLiveEvents } from "@/context/live-events-context";

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Unified Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  } = useNotifications();

  const {
    isConnected,
    isMuted,
    toggleSound,
    testSound,
    simulateTestOrder,
  } = useLiveEvents();

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
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close search on path change
  useEffect(() => {
    setIsSearchOpen(false);
  }, [pathname]);

  // Global keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleGlobalSlash = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalSlash);
    return () => window.removeEventListener("keydown", handleGlobalSlash);
  }, []);

  // Debounced live search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchApi.globalSearch(searchQuery.trim(), 4);
        setSearchResults(data);
        setIsSearchOpen(true);
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      setIsSearchOpen(false);
      router.push(`/orders?search=${encodeURIComponent(searchQuery.trim())}`);
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  const handleResultClick = (link: string) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    router.push(link);
  };

  const getStatusBadgeClass = (code?: string) => {
    switch (code) {
      case "PREPRESS_PASSED":
      case "IN_PRODUCTION":
      case "PRINTED":
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "PREPRESS_REJECTED":
      case "DAMAGE_REPRINT":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "FILE_UPLOADED":
      case "IN_PREPRESS":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

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

      {/* Center Global Search Pill & Dropdown */}
      <div className="relative hidden md:block w-80 lg:w-96" ref={searchContainerRef}>
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            name="global_nav_search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) {
                setIsSearchOpen(true);
              }
            }}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            placeholder="Search orders, staff, shipments... (↵ Enter)"
            className="w-full bg-[#F4F5F7] hover:bg-slate-100/90 focus:bg-white border border-[#E5E7EB] focus:border-[#0073EA] rounded-full pl-9 pr-8 py-1.5 text-xs text-[#1E2229] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 transition-all shadow-2xs"
          />
          {isSearching ? (
            <RefreshCw className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-[#0073EA] animate-spin pointer-events-none" />
          ) : searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults(null);
                setIsSearchOpen(false);
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 border border-slate-200 bg-white px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
              /
            </kbd>
          )}
        </div>

        {/* Global Search Results Dropdown */}
        {isSearchOpen && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 mt-2 w-[380px] lg:w-[480px] bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col max-h-[75vh]">
            {/* Header / Query Summary */}
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">
                {isSearching ? (
                  <span className="flex items-center gap-1.5 text-[#0073EA]">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Searching across modules...
                  </span>
                ) : (
                  <span>
                    Results for <strong className="text-slate-900">&ldquo;{searchQuery}&rdquo;</strong> ({searchResults?.total || 0})
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400">Press ↵ to view in Orders</span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {/* Quick Navigation Matches */}
              {searchResults?.navigation && searchResults.navigation.length > 0 && (
                <div className="p-2 bg-blue-50/40">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0073EA] flex items-center gap-1">
                    <Compass className="w-3 h-3" />
                    Quick Navigation
                  </div>
                  <div className="space-y-0.5">
                    {searchResults.navigation.map((nav, i) => (
                      <button
                        key={i}
                        onClick={() => handleResultClick(nav.link)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-xs font-semibold text-slate-800 flex items-center justify-between transition-all group cursor-pointer"
                      >
                        <span>{nav.name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#0073EA] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Section */}
              {searchResults?.orders && searchResults.orders.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>POD Orders ({searchResults.orders.length})</span>
                    <button
                      onClick={() => handleResultClick(`/orders?search=${encodeURIComponent(searchQuery)}`)}
                      className="text-[#0073EA] hover:underline normal-case font-medium text-[10.5px] cursor-pointer"
                    >
                      View in Orders &rarr;
                    </button>
                  </div>
                  <div className="space-y-1">
                    {searchResults.orders.map((ord) => (
                      <button
                        key={ord.id}
                        onClick={() => handleResultClick(ord.link)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-[#0073EA] transition-colors">
                              {ord.order_number}
                            </span>
                            <span
                              className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(
                                ord.status_code
                              )}`}
                            >
                              {ord.status_name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {ord.customer_name} {ord.customer_email && `• ${ord.customer_email}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-800">
                            ${ord.total_amount.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Shipments Section */}
              {searchResults?.shipments && searchResults.shipments.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Shipments & Waybills ({searchResults.shipments.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.shipments.map((shp) => (
                      <button
                        key={shp.id}
                        onClick={() => handleResultClick(shp.link)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold font-mono text-slate-900 group-hover:text-[#0073EA]">
                              {shp.tracking_number}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              ({shp.carrier_name})
                            </span>
                          </div>
                          {shp.order_number && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Order: <span className="font-semibold text-slate-700">{shp.order_number}</span>
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-600">
                          {shp.status_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Staff Section */}
              {searchResults?.staff && searchResults.staff.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Staff Members ({searchResults.staff.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.staff.map((st) => (
                      <button
                        key={st.id}
                        onClick={() => handleResultClick(st.link)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-[#0073EA]">
                              {st.name}
                            </span>
                            {st.employee_id && (
                              <span className="text-[9.5px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                {st.employee_id}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {st.role_name} {st.department && `• ${st.department}`}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400">{st.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Production Batches Section */}
              {searchResults?.batches && searchResults.batches.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Printer className="w-3 h-3" />
                    Production Batches ({searchResults.batches.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.batches.map((bt) => (
                      <button
                        key={bt.id}
                        onClick={() => handleResultClick(bt.link)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <span className="text-xs font-bold font-mono text-slate-900 group-hover:text-[#0073EA]">
                            {bt.batch_number}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {bt.paper_stock} • {bt.size_format}
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                          Batch
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isSearching && searchResults && searchResults.total === 0 && (
                <div className="p-6 text-center space-y-2">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Search className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">No exact matches found</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Press <strong className="text-slate-700">Enter</strong> to perform a deep search across the Orders Command Center.
                  </p>
                </div>
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <button
                onClick={() => handleResultClick(`/orders?search=${encodeURIComponent(searchQuery)}`)}
                className="text-[#0073EA] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Search all orders for &ldquo;{searchQuery}&rdquo;</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>↵ Enter to search</span>
                <span>ESC to close</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-2">
        {/* Live Auto-Sync Status Badge */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/90 text-[11px] font-medium shadow-2xs select-none"
          title={
            isConnected
              ? "Live Auto-Sync Active: Order status changes and activities update instantly across users without refresh"
              : "Connecting to real-time auto-sync..."
          }
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span className="text-slate-700 font-semibold text-[10.5px]">
            {isConnected ? "Auto-Sync Live" : "Connecting..."}
          </span>
        </div>

        {/* Sound Toggle Button */}
        <button
          onClick={toggleSound}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            isMuted
              ? "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              : "text-[#0073EA] bg-blue-50/70 hover:bg-blue-100/70"
          }`}
          title={
            isMuted
              ? "Sound alerts are MUTED. Click to unmute."
              : "Sound alerts are ACTIVE. Click to mute sound."
          }
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-slate-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#0073EA]" />
          )}
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`relative p-2 rounded-xl transition-all cursor-pointer ${
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
            <div className="absolute right-0 mt-2 w-96 sm:w-[440px] bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col max-h-[85vh]">
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
                  <button
                    onClick={() => testSound()}
                    className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-[#0073EA] hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    title="Play test audio chime"
                  >
                    <Volume2 className="w-3 h-3 text-[#0073EA]" />
                    <span>Test Sound</span>
                  </button>
                  <button
                    onClick={async () => {
                      await simulateTestOrder();
                    }}
                    className="px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    title="Simulate incoming order"
                  >
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>+ Sim Order</span>
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="px-2 py-1 text-[10px] font-semibold text-[#0073EA] hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Read all</span>
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

