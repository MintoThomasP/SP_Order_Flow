import React from "react";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F6F7FB]">
      <div className="flex flex-col items-center max-w-sm text-center px-4">
        {/* Animated Brand Logo with Spinning Ring */}
        <div className="relative w-20 h-20 flex items-center justify-center mb-5">
          {/* Subtle Outer Ping */}
          <div className="absolute inset-0 rounded-3xl bg-[#0073EA]/10 animate-ping opacity-60" />

          {/* Smooth Spinning Gradient Ring */}
          <div className="absolute inset-0 rounded-3xl border-3 border-transparent border-t-[#0073EA] border-r-[#00C875] animate-spin" />

          {/* Central Logo Box */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0073EA] to-[#38BDF8] flex items-center justify-center text-white shadow-lg shadow-[#0073EA]/25">
            <span className="font-extrabold text-xl tracking-wider font-mono">SP</span>
          </div>
        </div>

        {/* Brand Title */}
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          ORDERFLOW
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Loading print operations workspace...
        </p>

        {/* Modern Indeterminate Progress Line */}
        <div className="w-48 bg-slate-200/80 rounded-full h-1.5 mt-4 overflow-hidden relative">
          <div className="absolute inset-y-0 bg-gradient-to-r from-[#0073EA] to-[#00C875] w-1/2 rounded-full animate-pulse" />
        </div>

        <span className="text-[10px] font-mono text-slate-400 mt-3">
          Silver Point POD Gateway
        </span>
      </div>
    </div>
  );
}
