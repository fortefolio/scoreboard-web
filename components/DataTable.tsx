"use client";

import React from "react";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
  stopRowClick?: boolean;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  hideOnMobile?: boolean;
  className?: string;
}

const ALIGN_CLASS: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Shared responsive table shell used across Matches, Tournaments, Following,
 * My Matches, My Tournaments, and User Profile lists.
 */
export default function DataTable<T>({
  data,
  columns,
  getRowKey,
  onRowClick,
  hideOnMobile = true,
  className = "",
}: DataTableProps<T>) {
  return (
    <div
      className={`${
        hideOnMobile ? "hidden md:block " : ""
      }w-full bg-surface-container rounded-xl border border-outline-variant overflow-hidden ${className}`}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full md:min-w-[700px] table-fixed text-left border-collapse">
          <thead className="border-b border-outline-variant bg-surface-container-high/60 text-xs font-medium text-text-muted">
            <tr>
              {columns.map((col) => {
                const align = col.align ?? "left";
                return (
                  <th
                    key={col.key}
                    className={`py-3 px-4 ${ALIGN_CLASS[align]} ${col.headerClassName ?? ""}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-sm">
            {data.map((row) => {
              const key = getRowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={
                    onRowClick
                      ? "hover:bg-surface-container-high/40 transition-colors cursor-pointer group"
                      : "hover:bg-surface-container-high/40 transition-colors group"
                  }
                >
                  {columns.map((col) => {
                    const align = col.align ?? "left";
                    return (
                      <td
                        key={col.key}
                        onClick={col.stopRowClick ? (e) => e.stopPropagation() : undefined}
                        className={`py-3.5 px-4 ${ALIGN_CLASS[align]} ${col.cellClassName ?? ""}`}
                      >
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Shared status indicator cell for matches and tournaments.
 */
export function EntityStatusCell({
  status,
  t,
}: {
  status?: string | null;
  t: (key: string) => string;
}) {
  if (status === "ongoing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        {t("status.live")}
      </span>
    );
  }

  return (
    <span className="text-xs text-text-muted">
      {status === "completed" ? t("status.completed") : t("status.scheduled")}
    </span>
  );
}
