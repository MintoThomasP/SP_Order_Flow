import React from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Page Title & Actions Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-200/70 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-slate-200 rounded-xl" />
          <div className="h-9 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-slate-200 rounded" />
              <div className="w-8 h-8 rounded-xl bg-slate-100" />
            </div>
            <div className="h-7 w-20 bg-slate-200 rounded-md" />
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Area with Centered Loader */}
      <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center min-h-[360px] text-center">
        {/* Animated Brand Spinner */}
        <div className="relative w-14 h-14 flex items-center justify-center mb-4">
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[#0073EA] border-r-[#00C875] animate-spin" />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0073EA] to-[#38BDF8] flex items-center justify-center text-white shadow-md shadow-[#0073EA]/20">
            <span className="font-extrabold text-sm tracking-wider font-mono">SP</span>
          </div>
        </div>

        <p className="font-bold text-slate-800 text-sm">
          Loading Station Data...
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Synchronizing operational pipeline and real-time Peecho status.
        </p>

        {/* Shimmering Row Placeholders */}
        <div className="w-full max-w-md mt-6 space-y-2.5">
          <div className="h-3 bg-slate-100 rounded-full w-full" />
          <div className="h-3 bg-slate-100 rounded-full w-5/6 mx-auto" />
          <div className="h-3 bg-slate-100 rounded-full w-3/4 mx-auto" />
        </div>
      </div>
    </div>
  );
}
