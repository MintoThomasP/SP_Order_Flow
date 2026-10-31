"use client";

import React, { useState, Suspense } from "react";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { LoaderProvider } from "@/context/loader-context";
import { NotificationProvider, showErrorToast } from "@/context/notification-context";
import { LiveEventsProvider } from "@/context/live-events-context";
import { TopLoader } from "@/components/layout/top-loader";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error: any, _variables, _context, mutation) => {
            if ((mutation.meta as any)?.disableGlobalErrorToast) return;
            const errorMsg =
              error?.response?.data?.detail ||
              error?.response?.data?.message ||
              error?.message ||
              "An error occurred while executing the operation.";
            showErrorToast("Operation Failed", errorMsg);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <LiveEventsProvider>
          <LoaderProvider>
            <Suspense fallback={null}>
              <TopLoader />
            </Suspense>
            {children}
          </LoaderProvider>
        </LiveEventsProvider>
      </NotificationProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
