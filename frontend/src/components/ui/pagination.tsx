"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  showPageSizeSelector?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
  showPageSizeSelector = true,
}: PaginationProps) {
  if (totalCount === 0) return null;

  const validTotalPages = Math.max(1, totalPages || Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), validTotalPages);

  const startRecord = (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalCount);

  // Generate visible page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (validTotalPages <= 7) {
      for (let i = 1; i <= validTotalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) {
        pages.push("ellipsis");
      }
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(validTotalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (safeCurrentPage < validTotalPages - 2) {
        pages.push("ellipsis");
      }
      pages.push(validTotalPages);
    }
    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200/90 text-xs text-slate-600 ${className}`}
    >
      {/* Records Count & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <span className="font-semibold text-slate-900">{startRecord}</span> to{" "}
          <span className="font-semibold text-slate-900">{endRecord}</span> of{" "}
          <span className="font-bold text-slate-900">{totalCount}</span> results
        </span>

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-slate-400">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="py-1 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Buttons */}
      <div className="flex items-center gap-1 self-center sm:self-auto">
        {/* Previous Button */}
        <button
          type="button"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent font-medium transition-colors cursor-pointer"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none">
                  …
                </span>
              );
            }
            const isActive = p === safeCurrentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0073EA] text-white shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          disabled={safeCurrentPage >= validTotalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent font-medium transition-colors cursor-pointer"
          title="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
