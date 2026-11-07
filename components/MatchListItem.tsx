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
    <div className="w-full bg-[#151b2d]/80 backdrop-blur-md rounded-2xl border border-white/5 p-3.5 flex items-center justify-between gap-3 hover:border-primary/30 transition-all duration-300 shadow-md">
      <Link href={`/match/${match.id}`} className="flex items-center gap-3 min-w-0 flex-1">
        {/* Sport Icon Box */}
        <div className="w-10 h-10 rounded-xl bg-surface-container-high/40 border border-white/5 flex items-center justify-center shrink-0">
          <SportIcon sport={match.sport_type} className="text-primary text-[16px]" />
        </div>

        {/* Teams and Scores Column */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {/* Team 0 */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-bold text-on-surface truncate">
                {name0}
              </span>
            </div>
            <span className="font-mono text-sm font-black text-on-surface pl-2">
              {score0}
            </span>
          </div>

          {/* Team 1 */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-on-surface truncate">
                {name1}
              </span>
            </div>
            <span className="font-mono text-sm font-black text-on-surface pl-2">
              {score1}
            </span>
          </div>
        </div>
      </Link>

      {/* Right: Status Pill & Follow Button */}
      <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-white/5">
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            isOngoing
              ? "bg-primary/20 text-primary border border-primary/30 animate-pulse"
              : isCompleted
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-white/5 text-on-surface-variant/70 border border-white/10"
          }`}
        >
          {isOngoing
            ? t("status.live")
            : isCompleted
            ? t("status.completed")
            : t("status.scheduled")}
        </span>
        <FollowButton entityId={match.id} entityType="match" variant="icon" className="w-7 h-7" />
      </div>
    </div>
  );
}
