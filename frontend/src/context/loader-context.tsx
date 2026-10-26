"use client";

import React, { createContext, useContext, useState, useCallback, useTransition } from "react";
import { Loader2, RefreshCw, Zap } from "lucide-react";

interface LoaderContextType {
  isLoading: boolean;
  message: string;
  showLoader: (message?: string) => void;
  hideLoader: () => void;
  withLoader: <T>(action: () => Promise<T>, message?: string) => Promise<T>;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [message, setMessage] = useState("Loading operations data...");

  const showLoader = useCallback((msg?: string) => {
    if (msg) setMessage(msg);
    setLoadingCount((prev) => prev + 1);
  }, []);

  const hideLoader = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const withLoader = useCallback(
    async <T,>(action: () => Promise<T>, msg?: string): Promise<T> => {
      showLoader(msg);
      try {
        return await action();
      } finally {
        hideLoader();
      }
    },
    [showLoader, hideLoader]
  );

  const isLoading = loadingCount > 0;

  return (
    <LoaderContext.Provider
      value={{
        isLoading,
        message,
        showLoader,
        hideLoader,
        withLoader,
      }}
    >
      {children}

      {/* Global Full-Screen Loader Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative p-6 sm:p-8 rounded-3xl bg-white/95 border border-slate-200/80 shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200">
            {/* Spinning & Pulsing Brand Icon */}
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
              {/* Outer Pulsing Glow */}
              <div className="absolute inset-0 rounded-2xl bg-[#0073EA]/15 animate-ping opacity-75" />
              
              {/* Rotating Outer Ring */}
              <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[#0073EA] border-r-[#00C875] animate-spin" />

              {/* Central Branded Box */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#0073EA] to-[#38BDF8] flex items-center justify-center text-white shadow-md shadow-[#0073EA]/30">
                <span className="font-extrabold text-lg tracking-wider font-mono">SP</span>
              </div>
            </div>

            {/* Title & Dynamic Status Message */}
            <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-1">
              ORDERFLOW Engine
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mb-3">
              {message}
            </p>

            {/* Visual Mini Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#0073EA] to-[#00C875] w-2/3 rounded-full animate-pulse" />
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Peecho Gateway Live</span>
            </div>
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
}

export function useLoader() {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error("useLoader must be used within a LoaderProvider");
  }
  return context;
}
