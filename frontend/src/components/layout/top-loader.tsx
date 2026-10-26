"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Complete progress on route change
  useEffect(() => {
    if (isVisible) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on internal links to start progress bar instantly
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");

      // Only handle internal links that aren't open in new tab
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        (!targetAttr || targetAttr === "_self") &&
        href !== pathname
      ) {
        setIsVisible(true);
        setProgress(25);

        // Simulate fast progressive loading
        setTimeout(() => setProgress(65), 100);
        setTimeout(() => setProgress(85), 300);
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, [pathname]);

  if (!isVisible && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      {/* Animated Top Progress Bar */}
      <div
        className="h-[3px] bg-gradient-to-r from-[#0073EA] via-[#38BDF8] to-[#00C875] transition-all duration-300 ease-out shadow-[0_0_12px_rgba(0,115,234,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "width 150ms ease-out, opacity 250ms ease-in" : "width 300ms ease-out",
        }}
      />
      {/* Trailing Glow Dot */}
      {progress > 0 && progress < 100 && (
        <div
          className="absolute top-0 w-8 h-[3px] bg-white blur-[2px] transition-all duration-300 pointer-events-none"
          style={{
            left: `calc(${progress}% - 32px)`,
          }}
        />
      )}
    </div>
  );
}
