"use client";

import React from "react";
import Link from "next/link";
import SportIcon from "@/components/SportIcon";
import { SportFavoriteButton } from "@/components/FollowButton";
import { DataTableColumn, EntityStatusCell } from "@/components/DataTable";
import { extractSetsData, countSetsWon } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";

function formatMatchScore(m: any): { score0: number; score1: number } {
  const rawSetData = extractSetsData(m.scores);
  if (m.sport_type === "Football") {
    return {
      score0: m.scores?.football?.goals?.[0] ?? m.scores?.goals?.[0] ?? m.scores?.current?.home ?? 0,
      score1: m.scores?.football?.goals?.[1] ?? m.scores?.goals?.[1] ?? m.scores?.current?.away ?? 0,
    };
  }
  if (m.sport_type === "Basketball") {
    return {
      score0:
        m.scores?.basketball?.total_points?.[0] ??
        m.scores?.total_points?.[0] ??
        m.scores?.current?.home ??
        0,
      score1:
        m.scores?.basketball?.total_points?.[1] ??
        m.scores?.total_points?.[1] ??
        m.scores?.current?.away ??
        0,
    };
  }
  return {
    score0: countSetsWon(rawSetData, 0),
    score1: countSetsWon(rawSetData, 1),
  };
}

function formatShortDate(dateValue?: string | null): string {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTournamentDate(dateValue?: string | null): string {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function renderOrganizerCell(item: any) {
  const username = item.organizer?.username;
  if (!username) {
    return <span className="text-xs text-text-muted">-</span>;
  }
  return (
    <Link
      href={`/user/${encodeURIComponent(username)}`}
      onClick={(e) => e.stopPropagation()}
      className="text-xs font-medium text-text-secondary hover:text-text-primary hover:underline truncate block"
      title={`@${username}`}
    >
      @{username}
    </Link>
  );
}

/**
 * Builds the shared column definitions for Match DataTables.
 */
export function getMatchColumns(
  t: (key: string, params?: Record<string, any>) => string,
  extraColumns: DataTableColumn<any>[] = [],
  options: { showOrganizer?: boolean; showFavorite?: boolean } = {}
): DataTableColumn<any>[] {
  const { showOrganizer = true, showFavorite = true } = options;
  const organizerHeader = t("common.sport") === "Desporto" ? "Organizador" : "Organizer";

  return [
    {
      key: "teams",
      header: t("common.teamsOrPlayers"),
      headerClassName: "px-6",
      cellClassName: "px-6",
      render: (m) => {
        const team0 = formatTeamOrPlayerName(m.participants?.[0]?.name) || "TBD";
        const team1 = formatTeamOrPlayerName(m.participants?.[1]?.name) || "TBD";
        return (
          <div className="flex items-center gap-3 min-w-0">
            {showFavorite ? (
              <SportFavoriteButton
                entityId={m.id}
                entityType="match"
                sport={m.sport_type}
                size="sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
                <SportIcon sport={m.sport_type} className="text-[18px] text-text-secondary" />
              </div>
            )}
            <div className="space-y-1 min-w-0">
              <div className="font-medium text-xs sm:text-sm text-text-primary truncate" title={team0}>
                {team0}
              </div>
              <div className="font-medium text-xs sm:text-sm text-text-primary truncate" title={team1}>
                {team1}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "event",
      header: t("common.event"),
      headerClassName: "px-6",
      cellClassName: "px-6",
      render: (m) => {
        const eventName = m.tournaments?.name || t("home.isolatedMatch");
        return (
          <div className="font-medium text-text-primary text-xs leading-snug truncate" title={eventName}>
            {eventName}
          </div>
        );
      },
    },
    {
      key: "score",
      header: t("common.score"),
      align: "center",
      headerClassName: "w-24",
      cellClassName: "w-24",
      render: (m) => {
        const { score0, score1 } = formatMatchScore(m);
        return (
          <div className="inline-flex flex-col items-center justify-center gap-1 leading-tight font-digital tabular-nums text-base font-semibold text-text-primary">
            <span>{score0}</span>
            <span>{score1}</span>
          </div>
        );
      },
    },
    ...(showOrganizer
      ? [
          {
            key: "organizer",
            header: organizerHeader,
            headerClassName: "hidden lg:table-cell w-36",
            cellClassName: "hidden lg:table-cell w-36",
            render: (m: any) => renderOrganizerCell(m),
          } satisfies DataTableColumn<any>,
        ]
      : []),
    {
      key: "status",
      header: t("common.status"),
      align: "center",
      headerClassName: "w-28",
      cellClassName: "w-28",
      render: (m) => <EntityStatusCell status={m.status} t={t} />,
    },
    {
      key: "date",
      header: t("common.date"),
      align: "right",
      headerClassName: "w-36 px-6",
      cellClassName: "w-36 px-6 font-mono tabular-nums text-xs text-text-muted whitespace-nowrap",
      render: (m) => formatShortDate(m.scheduled_at || m.created_at),
    },
    ...extraColumns,
  ];
}

/**
 * Builds the shared column definitions for Tournament DataTables.
 */
export function getTournamentColumns(
  t: (key: string, params?: Record<string, any>) => string,
  extraColumns: DataTableColumn<any>[] = [],
  options: { showOrganizer?: boolean } = {}
): DataTableColumn<any>[] {
  const { showOrganizer = true } = options;
  const organizerHeader = t("common.sport") === "Desporto" ? "Organizador" : "Organizer";

  return [
    {
      key: "event",
      header: t("common.event"),
      headerClassName: "px-3 md:px-6",
      cellClassName: "px-3 md:px-6",
      render: (tItem) => (
        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
          <SportFavoriteButton
            entityId={tItem.id}
            entityType="tournament"
            sport={tItem.sport_type}
            size="sm"
          />
          <div
            className="font-medium text-xs sm:text-sm text-text-primary leading-snug truncate"
            title={tItem.name}
          >
            {tItem.name}
          </div>
        </div>
      ),
    },
    {
      key: "format",
      header: t("common.format"),
      headerClassName: "hidden md:table-cell w-44",
      cellClassName: "hidden md:table-cell w-44 text-xs text-text-secondary truncate",
      render: (tItem) =>
        tItem.settings?.stage_1?.type === "groups"
          ? t("tournament.groupStage")
          : tItem.settings?.stage_1?.type === "double_elimination"
          ? t("tournament.doubleElimination")
          : t("tournament.singleElimination"),
    },
    ...(showOrganizer
      ? [
          {
            key: "organizer",
            header: organizerHeader,
            headerClassName: "hidden lg:table-cell w-36",
            cellClassName: "hidden lg:table-cell w-36",
            render: (tItem: any) => renderOrganizerCell(tItem),
          } satisfies DataTableColumn<any>,
        ]
      : []),
    {
      key: "status",
      header: t("common.status"),
      align: "center",
      headerClassName: "w-24 md:w-28 px-2 md:px-4",
      cellClassName: "w-24 md:w-28 px-2 md:px-4",
      render: (tItem) => <EntityStatusCell status={tItem.status} t={t} />,
    },
    {
      key: "date",
      header: t("common.date"),
      align: "right",
      headerClassName: "w-24 md:w-36 px-3 md:px-6",
      cellClassName: "w-24 md:w-36 px-3 md:px-6 font-mono tabular-nums text-[11px] md:text-xs text-text-muted whitespace-nowrap",
      render: (tItem) => formatTournamentDate(tItem.start_date),
    },
    ...extraColumns,
  ];
}
