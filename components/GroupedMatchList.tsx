"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MatchListItem from "@/components/MatchListItem";
import { SportFavoriteButton } from "@/components/FollowButton";
import { DataTableColumn, EntityStatusCell } from "@/components/DataTable";
import { useTranslation } from "@/lib/i18n";
import { extractSetsData, countSetsWon } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";

export interface MatchGroup {
  key: string;
  tournamentId: string | null;
  tournamentName: string | null;
  sportType: string | null;
  organizerUsername: string | null;
  matches: any[];
}

/**
 * Groups matches by `tournament_id` (or `"__standalone__"` when null) while
 * preserving the order in which each tournament first appears in `matches`.
 */
export function groupMatchesByTournament(matches: any[]): MatchGroup[] {
  const map = new Map<string, MatchGroup>();

  for (const m of matches) {
    const key = m.tournament_id || "__standalone__";
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        tournamentId: m.tournament_id || null,
        tournamentName: m.tournaments?.name || null,
        sportType: m.sport_type || null,
        organizerUsername: m.organizer?.username || null,
        matches: [],
      };
      map.set(key, group);
    }
    group.matches.push(m);
  }

  return Array.from(map.values());
}

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

export interface GroupedMatchListProps {
  matches: any[];
  extraColumns?: DataTableColumn<any>[];
  showOrganizer?: boolean;
  defaultCollapsedKeys?: string[];
}

/**
 * Flashscore-style grouped match list: groups matches under collapsible
 * tournament headers (and a "Standalone Matches" section for isolated games),
 * eliminating repeated Event and Organizer columns on every match row.
 */
export default function GroupedMatchList({
  matches,
  extraColumns = [],
  showOrganizer = true,
  defaultCollapsedKeys = [],
}: GroupedMatchListProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const isPt = locale === "pt";

  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const k of defaultCollapsedKeys) initial[k] = true;
    return initial;
  });

  const groups = useMemo(() => groupMatchesByTournament(matches), [matches]);

  const toggleGroup = (key: string) => {
    setCollapsedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isCollapsed = Boolean(collapsedMap[group.key]);

        return (
          <section
            key={group.key}
            className="bg-surface-container rounded-2xl border border-outline-variant overflow-hidden shadow-sm"
          >
            {/* Tournament / Standalone Group Header */}
            <div className="bg-surface-container-high/60 border-b border-outline-variant px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {group.tournamentId ? (
                  <>
                    <SportFavoriteButton
                      entityId={group.tournamentId}
                      entityType="tournament"
                      sport={group.sportType}
                      size="sm"
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <Link
                        href={`/tournament/${group.tournamentId}`}
                        className="text-xs sm:text-sm font-semibold text-text-primary hover:underline truncate"
                        title={group.tournamentName || undefined}
                      >
                        {group.tournamentName || t("home.tournamentsTab")}
                      </Link>
                      {showOrganizer && group.organizerUsername && (
                        <Link
                          href={`/user/${encodeURIComponent(group.organizerUsername)}`}
                          className="hidden sm:inline-flex text-xs font-medium text-text-muted hover:text-text-primary hover:underline truncate"
                          title={`@${group.organizerUsername}`}
                        >
                          @{group.organizerUsername}
                        </Link>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-text-muted shrink-0">
                      <span className="material-symbols-outlined text-[16px]">sports</span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-text-primary truncate">
                      {isPt ? "Jogos Isolados" : "Standalone Matches"}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isCollapsed}
                  className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  {isCollapsed && (
                    <span>
                      {isPt
                        ? `Jogos (${group.matches.length})`
                        : `Matches (${group.matches.length})`}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[18px]">
                    {isCollapsed ? "expand_more" : "expand_less"}
                  </span>
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <>
                {/* Mobile Match Rows */}
                <div className="md:hidden divide-y divide-outline-variant">
                  {group.matches.map((m) => (
                    <MatchListItem key={m.id} match={m} />
                  ))}
                </div>

                {/* Desktop Table Rows (no redundant Event or Organizer columns) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="border-b border-outline-variant text-text-muted text-[11px] font-medium bg-surface-container-high/20">
                        <th className="py-2.5 px-6">{t("common.teamsOrPlayers")}</th>
                        <th className="py-2.5 px-4 text-center w-24">{t("common.score")}</th>
                        <th className="py-2.5 px-4 text-center w-28">{t("common.status")}</th>
                        <th className="py-2.5 px-6 text-right w-36">{t("common.date")}</th>
                        {extraColumns.map((col) => (
                          <th
                            key={col.key}
                            className={`py-2.5 px-4 ${
                              col.align === "center"
                                ? "text-center"
                                : col.align === "right"
                                ? "text-right"
                                : "text-left"
                            } ${col.headerClassName ?? ""}`}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60 text-sm">
                      {group.matches.map((m) => {
                        const team0 = formatTeamOrPlayerName(m.participants?.[0]?.name) || "TBD";
                        const team1 = formatTeamOrPlayerName(m.participants?.[1]?.name) || "TBD";
                        const { score0, score1 } = formatMatchScore(m);
                        return (
                          <tr
                            key={m.id}
                            onClick={() => router.push(`/match/${m.id}`)}
                            className="hover:bg-surface-container-high/40 transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3 min-w-0">
                                <SportFavoriteButton
                                  entityId={m.id}
                                  entityType="match"
                                  sport={m.sport_type}
                                  size="sm"
                                />
                                <div className="space-y-1 min-w-0">
                                  <div
                                    className="font-medium text-xs sm:text-sm text-text-primary truncate"
                                    title={team0}
                                  >
                                    {team0}
                                  </div>
                                  <div
                                    className="font-medium text-xs sm:text-sm text-text-primary truncate"
                                    title={team1}
                                  >
                                    {team1}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center w-24">
                              <div className="inline-flex flex-col items-center justify-center gap-1 leading-tight font-digital tabular-nums text-base font-semibold text-text-primary">
                                <span>{score0}</span>
                                <span>{score1}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center w-28">
                              <EntityStatusCell status={m.status} t={t} />
                            </td>
                            <td className="py-3.5 px-6 text-right w-36 font-mono tabular-nums text-xs text-text-muted whitespace-nowrap">
                              {formatShortDate(m.scheduled_at || m.created_at)}
                            </td>
                            {extraColumns.map((col) => (
                              <td
                                key={col.key}
                                onClick={col.stopRowClick ? (e) => e.stopPropagation() : undefined}
                                className={`py-3.5 px-4 ${
                                  col.align === "center"
                                    ? "text-center"
                                    : col.align === "right"
                                    ? "text-right"
                                    : "text-left"
                                } ${col.cellClassName ?? ""}`}
                              >
                                {col.render(m)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
