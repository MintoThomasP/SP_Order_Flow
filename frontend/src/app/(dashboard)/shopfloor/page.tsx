"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShopfloorPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/orders");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0073EA]">
        <PackageCheck className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">Manual Status Updates</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          Barcode scanning is disabled. All order progression and status changes are managed manually in the Orders workspace.
        </p>
      </div>
      <Button
        onClick={() => router.replace("/orders")}
        className="bg-[#0073EA] hover:bg-[#0060B9] text-white flex items-center gap-2"
      >
        <span>Go to Orders</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
