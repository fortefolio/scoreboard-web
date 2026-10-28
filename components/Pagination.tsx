"use client";

import { useTranslation } from "@/lib/i18n";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showSummary?: boolean;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showSummary = true,
  className = "",
}: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  // Determine which page numbers to display with ellipsis
  const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => {
    return p === 1 || p === totalPages || Math.abs(p - safePage) <= 1;
  });

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 pt-6 mt-8 ${className}`}
      aria-label="Pagination"
    >
      {showSummary && (
        <span className="text-xs font-label text-on-surface-variant/60 font-bold uppercase tracking-wider self-center sm:self-auto">
          {t("common.pageOf", { current: safePage, total: totalPages })}
        </span>
      )}

      <div className="flex items-center gap-1 self-center sm:self-auto">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          aria-label={t("common.previous")}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 border border-white/5"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            chevron_left
          </span>
          {t("common.previous")}
        </button>

        {/* Page Number Buttons */}
        {visiblePages.map((p, pIdx, arr) => {
          const prevP = arr[pIdx - 1];
          const hasGap = prevP && p - prevP > 1;

          return (
            <div key={p} className="flex items-center">
              {hasGap && (
                <span className="px-1 text-on-surface-variant/40 text-xs font-bold" aria-hidden>
                  ...
                </span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={safePage === p ? "page" : undefined}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                  safePage === p
                    ? "bg-primary text-on-primary shadow-md shadow-primary/20 font-black"
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-white/5"
                }`}
              >
                {p}
              </button>
            </div>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          aria-label={t("common.next")}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 border border-white/5"
        >
          {t("common.next")}
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
}
