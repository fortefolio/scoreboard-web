"use client";

import SportFilterBar from "@/components/SportFilterBar";
import SelectField from "@/components/SelectField";
import { useTranslation } from "@/lib/i18n";

export interface WorkspaceControlsBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  sportFilter: string;
  onSportChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  dateSort: "desc" | "asc";
  onDateSortChange: (value: "desc" | "asc") => void;
  onClearFilters: () => void;
  viewMode: "list" | "cards";
  onViewModeChange: (mode: "list" | "cards") => void;
  newAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Shared sport strip + search/status/date/view-mode toolbar used across the
 * My Workspace pages (My Matches, My Tournaments, Umpiring), matching Home.
 */
export function WorkspaceControlsBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  sportFilter,
  onSportChange,
  statusFilter,
  onStatusChange,
  dateSort,
  onDateSortChange,
  onClearFilters,
  viewMode,
  onViewModeChange,
  newAction,
}: WorkspaceControlsBarProps) {
  const { t } = useTranslation();
  const hasActiveFilters =
    sportFilter !== "all" ||
    statusFilter !== "all" ||
    searchQuery !== "" ||
    dateSort !== "desc";

  return (
    <>
      {/* Precision Controls Toolbar */}
      <div className="relative z-20 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4 bg-surface-container/70 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-outline-variant shadow-sm">
        {/* Top (mobile) / Left (desktop): Search */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 shrink-0">
          <div className="relative flex items-center w-full sm:w-64 md:w-80 lg:w-96">
            <span className="material-symbols-outlined absolute left-3.5 text-[17px] text-text-muted pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-surface-container-lowest text-text-primary text-xs sm:text-[13px] font-medium pl-10 pr-10 py-2 rounded-lg border border-outline-variant outline-none focus:border-text-secondary transition-colors placeholder:text-text-muted"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSearchChange("")}
                aria-label={t("common.clearFilters")}
                className="absolute right-3.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  cancel
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom (mobile) / Right (desktop): Dropdowns on left, Action + Toggle on right */}
        <div className="flex items-center justify-between sm:flex-1 gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="hidden sm:block h-6 w-px bg-outline-variant/60 shrink-0" />

            <SelectField
              variant="inline"
              label={t("common.status")}
              value={statusFilter}
              onChange={onStatusChange}
              options={[
                { value: "all", label: t("status.all") },
                { value: "ongoing", label: t("status.live") },
                { value: "scheduled", label: t("status.scheduled") },
                { value: "completed", label: t("status.completed") },
              ]}
            />

            <div className="hidden sm:block h-6 w-px bg-outline-variant/60 shrink-0" />

            <SelectField
              variant="inline"
              label={t("common.date")}
              value={dateSort}
              onChange={(val) => onDateSortChange(val as "desc" | "asc")}
              options={[
                { value: "desc", label: t("common.recentFirst") },
                { value: "asc", label: t("common.oldestFirst") },
              ]}
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                title={t("common.clearFilters")}
                className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
                <span className="hidden md:inline">{t("common.clearFilters")}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {newAction && (
              <button
                type="button"
                onClick={newAction.onClick}
                aria-label={newAction.label}
                title={newAction.label}
                className="h-8 w-8 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span className="hidden sm:inline">{newAction.label}</span>
              </button>
            )}

            <div className="flex items-center gap-0.5 bg-surface-container-high/50 p-1 rounded-xl border border-outline-variant shrink-0">
              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                title={t("common.viewList")}
                className={`p-1.5 rounded-lg transition-colors flex items-center cursor-pointer ${
                  viewMode === "list"
                    ? "bg-surface-container-highest text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("cards")}
                title={t("common.viewCards")}
                className={`p-1.5 rounded-lg transition-colors flex items-center cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-surface-container-highest text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Sport Filter Bar */}
      <div className="mb-5 sm:mb-6">
        <SportFilterBar selectedSport={sportFilter} onSelectSport={onSportChange} />
      </div>
    </>
  );
}

function matchesSportFilter(sportType: string | null | undefined, sportFilter: string): boolean {
  if (sportFilter === "all") return true;
  if (sportFilter === "Beach Volleyball") {
    return sportType === "Beach Volleyball" || sportType === "beach_volleyball";
  }
  return sportType === sportFilter;
}

function matchesStatusFilter(status: string | null | undefined, statusFilter: string): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "scheduled") {
    return status === "scheduled" || status === "pending";
  }
  return status === statusFilter;
}

export function filterAndSortMatches<T extends Record<string, any>>(
  items: T[],
  {
    sportFilter,
    statusFilter,
    searchQuery,
    dateSort,
  }: {
    sportFilter: string;
    statusFilter: string;
    searchQuery: string;
    dateSort: "desc" | "asc";
  }
): T[] {
  const query = searchQuery.trim().toLowerCase();
  const userQuery = query.startsWith("@") ? query.slice(1) : query;

  return items
    .filter((m) => {
      if (!matchesSportFilter(m.sport_type, sportFilter)) return false;
      if (!matchesStatusFilter(m.status, statusFilter)) return false;

      if (query) {
        const p1 = (m.participants?.[0]?.name || "").toLowerCase();
        const p2 = (m.participants?.[1]?.name || "").toLowerCase();
        const tName = (m.tournaments?.name || "").toLowerCase();
        const sport = (m.sport_type || "").toLowerCase();
        const org = (m.organizer?.username || "").toLowerCase();
        if (
          !p1.includes(query) &&
          !p2.includes(query) &&
          !tName.includes(query) &&
          !sport.includes(query) &&
          !(userQuery && org.includes(userQuery))
        ) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.scheduled_at || a.created_at).getTime();
      const dateB = new Date(b.scheduled_at || b.created_at).getTime();
      return dateSort === "desc" ? dateB - dateA : dateA - dateB;
    });
}

export function filterAndSortTournaments<T extends Record<string, any>>(
  items: T[],
  {
    sportFilter,
    statusFilter,
    searchQuery,
    dateSort,
  }: {
    sportFilter: string;
    statusFilter: string;
    searchQuery: string;
    dateSort: "desc" | "asc";
  }
): T[] {
  const query = searchQuery.trim().toLowerCase();

  return items
    .filter((tItem) => {
      if (!matchesSportFilter(tItem.sport_type, sportFilter)) return false;
      if (!matchesStatusFilter(tItem.status, statusFilter)) return false;

      if (query) {
        const name = (tItem.name || "").toLowerCase();
        const sport = (tItem.sport_type || "").toLowerCase();
        if (!name.includes(query) && !sport.includes(query)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.start_date || a.created_at).getTime();
      const dateB = new Date(b.start_date || b.created_at).getTime();
      return dateSort === "desc" ? dateB - dateA : dateA - dateB;
    });
}
