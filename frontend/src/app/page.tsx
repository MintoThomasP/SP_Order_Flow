"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const token = localStorage.getItem("silverpoint_access_token");
      const user = localStorage.getItem("silverpoint_user");
      if (token && user) {
        router.replace("/overview");
      } else {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0073EA]" />
        <span className="text-xs text-slate-400 font-medium tracking-wide">
          Verifying session...
        </span>
      </div>
    </div>
  );
}
