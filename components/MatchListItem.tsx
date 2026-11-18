"use client";

import Link from "next/link";
import SportIcon from "@/components/SportIcon";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import { FollowButton, SportFavoriteButton } from "@/components/FollowButton";

export default function MatchListItem({
  match,
  showFavorite = true,
}: {
  match: any;
  showFavorite?: boolean;
}) {
  const { t } = useTranslation();

  const rawSetData = extractSetsData(match.scores);
  const setsWon = [countSetsWon(rawSetData, 0), countSetsWon(rawSetData, 1)];

  const isPointsBased = match.sport_type === "Football" || match.sport_type === "Basketball";

  const getMainScore = (idx: number) => {
    if (match.sport_type === "Football") {
      return (
        match.scores?.football?.goals?.[idx] ??
        match.scores?.goals?.[idx] ??
        match.scores?.current?.[idx === 0 ? "home" : "away"] ??
        0
      );
    }
    if (match.sport_type === "Basketball") {
      return (
        match.scores?.basketball?.total_points?.[idx] ??
        match.scores?.total_points?.[idx] ??
        match.scores?.current?.[idx === 0 ? "home" : "away"] ??
        0
      );
    }
    return setsWon[idx];
  };

  const name0 =
    formatTeamOrPlayerName(match.participants?.[0]?.name) ||
    t("common.teamDefault", { num: "A" });
  const name1 =
    formatTeamOrPlayerName(match.participants?.[1]?.name) ||
    t("common.teamDefault", { num: "B" });

  const isScheduled = match.status === "scheduled";
  const score0 = isScheduled ? "–" : getMainScore(0);
  const score1 = isScheduled ? "–" : getMainScore(1);
  const isOngoing = match.status === "ongoing";
  const isCompleted = match.status === "completed";

  return (
    <div className="w-full bg-surface-container rounded-xl border border-outline-variant p-3 flex items-center justify-between gap-2.5 hover:bg-surface-container-high/40 transition-colors">
      {showFavorite ? (
        <SportFavoriteButton
          entityId={match.id}
          entityType="match"
          sport={match.sport_type}
          size="md"
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
          <SportIcon sport={match.sport_type} className="text-[22px] text-text-secondary" />
        </div>
      )}

      <Link href={`/match/${match.id}`} className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Teams Column (40px total height to align 1:1 with the sport icon box) */}
        <div className="flex flex-col justify-center gap-1 min-w-0 flex-1">
          <div className="h-[18px] flex items-center min-w-0">
            <span className="text-xs sm:text-sm font-medium text-text-primary truncate leading-none block">
              {name0}
            </span>
          </div>
          <div className="h-[18px] flex items-center min-w-0">
            <span className="text-xs sm:text-sm font-medium text-text-primary truncate leading-none block">
              {name1}
            </span>
          </div>
        </div>
      </Link>

      {/* Right: Fixed-width Status and Far-Right Scores */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-[68px] flex justify-end shrink-0">
          {isOngoing ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-primary whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {t("status.live")}
            </span>
          ) : (
            <span className="text-[11px] text-text-muted whitespace-nowrap truncate">
              {isCompleted ? t("status.completed") : t("status.scheduled")}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end justify-center gap-1 w-8 shrink-0 pl-2 border-l border-outline-variant">
          <div className="leading-tight">
            <span
              className={`font-digital tabular-nums text-base font-semibold ${
                isScheduled ? "text-text-muted font-normal" : "text-text-primary"
              }`}
            >
              {score0}
            </span>
          </div>
          <div className="leading-tight">
            <span
              className={`font-digital tabular-nums text-base font-semibold ${
                isScheduled ? "text-text-muted font-normal" : "text-text-primary"
              }`}
            >
              {score1}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
