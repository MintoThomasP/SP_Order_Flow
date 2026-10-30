import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { RBACAccessGuard } from "@/components/layout/access-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RBACAccessGuard>
      <div className="flex h-screen w-screen overflow-hidden bg-[#F6F7FB]">
        {/* Dynamic Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 lg:px-8">
            <div className="w-full space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </RBACAccessGuard>
  );
}
