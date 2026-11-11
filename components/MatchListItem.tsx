"use client";

import Link from "next/link";
import SportIcon from "@/components/SportIcon";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import { FollowButton } from "@/components/FollowButton";

export default function MatchListItem({ match }: { match: any }) {
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

  const score0 = getMainScore(0);
  const score1 = getMainScore(1);
  const isOngoing = match.status === "ongoing";
  const isCompleted = match.status === "completed";

  return (
    <div className="w-full bg-surface-container rounded-xl border border-outline-variant p-3 flex items-center justify-between gap-3 hover:bg-surface-container-high/40 transition-colors">
      <Link href={`/match/${match.id}`} className="flex items-center gap-3 min-w-0 flex-1">
        {/* Sport Icon Box */}
        <div className="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
          <SportIcon sport={match.sport_type} className="text-text-muted text-[15px]" />
        </div>

        {/* Teams and Scores Column */}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {/* Team 0 */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-text-primary truncate">
                {name0}
              </span>
            </div>
            <span className="font-mono tabular-nums text-sm font-semibold text-text-primary pl-2">
              {score0}
            </span>
          </div>

          {/* Team 1 */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary/70 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-text-primary truncate">
                {name1}
              </span>
            </div>
            <span className="font-mono tabular-nums text-sm font-semibold text-text-primary pl-2">
              {score1}
            </span>
          </div>
        </div>
      </Link>

      {/* Right: Status Pill & Follow Button */}
      <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-outline-variant">
        {isOngoing ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
            {t("status.live")}
          </span>
        ) : (
          <span className="text-xs text-text-muted">
            {isCompleted ? t("status.completed") : t("status.scheduled")}
          </span>
        )}
        <FollowButton entityId={match.id} entityType="match" variant="icon" className="w-7 h-7 text-text-muted hover:text-text-primary" />
      </div>
    </div>
  );
}
