"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Layers,
} from "lucide-react";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { getRoleHomePath } from "@/components/layout/navigation-config";

export default function LoginPage() {
  const router = useRouter();

  // If already logged in, redirect directly to dashboard
  useEffect(() => {
    try {
      const token = localStorage.getItem("silverpoint_access_token");
      const user = localStorage.getItem("silverpoint_user");
      if (token && user) {
        router.replace("/overview");
      }
    } catch {
      // ignore
    }
  }, [router]);

  // Form Fields
  const [email, setEmail] = useState("admin@silverpointpod.com");
  const [password, setPassword] = useState("Admin@123456");
  const [showPassword, setShowPassword] = useState(false);
  const [redirectToWorkstation, setRedirectToWorkstation] = useState(true);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Development Test Accounts matching the sample screenshot
  const testAccounts = [
    {
      role: "Super Admin",
      badge: "Full",
      badgeStyle: "bg-blue-100 text-[#0073EA]",
      email: "admin@silverpointpod.com",
      roleCode: "SUPER_ADMIN",
    },
    {
      role: "Staff / Prepress",
      badge: "Prepress",
      badgeStyle: "bg-emerald-100 text-emerald-700",
      email: "elena.prepress@silverpointpod.com",
      roleCode: "PREPRESS_SPECIALIST",
    },
    {
      role: "Production / PM",
      badge: "Press",
      badgeStyle: "bg-purple-100 text-purple-700",
      email: "marcus.prod@silverpointpod.com",
      roleCode: "PRODUCTION_MANAGER",
    },
    {
      role: "Dispatch / Log.",
      badge: "Dispatch",
      badgeStyle: "bg-amber-100 text-amber-700",
      email: "sarah.dispatch@silverpointpod.com",
      roleCode: "DISPATCH_FINANCE_SPECIALIST",
    },
  ];

  const handleSelectAccount = (acc: (typeof testAccounts)[0]) => {
    setEmail(acc.email);
    setPassword("Admin@123456");
    setErrorMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await authApi.login({ email, password });
      const user: any = response.user;
      const roleCode =
        user?.role_details?.code ||
        user?.role?.code ||
        user?.role_code ||
        (user?.is_superuser ? "SUPER_ADMIN" : "STAFF");

      if (redirectToWorkstation && roleCode !== "SUPER_ADMIN" && roleCode !== "ADMIN") {
        const dest = getRoleHomePath(roleCode);
        router.push(dest);
      } else {
        router.push("/overview");
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || "Invalid work email or password. Please verify your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Floating White Card */}
        <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-6">
          
          {/* Brand Logo & Header */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img
                src="/logo.png"
                alt="ORDERFLOW - The Order Management System"
                className="h-10 sm:h-11 w-auto object-contain"
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1E2229]">
                Log in to your account
              </h1>
              <p className="text-xs sm:text-sm text-[#676879]">
                Enter your work email and password to access your workspaces.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-5" onSubmit={handleLogin}>
            
            {/* Work Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Direct Workstation Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="workstation-redirect"
                type="checkbox"
                checked={redirectToWorkstation}
                onChange={(e) => setRedirectToWorkstation(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#0073EA] focus:ring-[#0073EA] cursor-pointer"
              />
              <label htmlFor="workstation-redirect" className="text-xs text-slate-600 cursor-pointer select-none">
                Open my department workstation directly after login
              </label>
            </div>

            {/* Primary Action Button (Solid Royal Blue matching sample) */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#0073EA] hover:bg-[#0060B9] text-white text-sm font-bold rounded-xl shadow-md shadow-[#0073EA]/25 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? "Signing in..." : "Log In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Development Test Accounts (1-click fill matching sample screenshot) */}
          <div className="pt-5 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <div className="flex items-center gap-1.5 text-amber-500">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span className="text-slate-700 font-bold">Demo Test Accounts</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">1-click fill</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {testAccounts.map((acc) => {
                const isSelected = email === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                      isSelected
                        ? "border-[#0073EA] bg-blue-50/50 shadow-2xs ring-1 ring-[#0073EA]/30"
                        : "border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px] truncate">{acc.role}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${acc.badgeStyle}`}>
                        {acc.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{acc.email}</p>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
