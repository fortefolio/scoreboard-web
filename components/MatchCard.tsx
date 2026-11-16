"use client";

import { useEffect, useState } from "react";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import Link from "next/link";
import SportIcon from "@/components/SportIcon";
import { FollowButton } from "@/components/FollowButton";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];

const getInitials = (name?: string) => {
  if (!name) return "?";
  const cleaned = name.replace(/\(.+?\)/g, "").trim();
  if (!cleaned) return "?";
  return (
    cleaned
      .split(/[\s/]+/)
      .map((w) => w.replace(/[^a-zA-Z0-9À-ÿ]/g, ""))
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
};

export default function MatchCard({ match }: { match: any }) {
  const { t } = useTranslation();
  const [matchTime, setMatchTime] = useState("0:00:00");
  const isOngoing = match.status === 'ongoing';
  
  useEffect(() => {
    if (!isOngoing || !match.scheduled_at) return;
    
    const update = () => {
      const start = new Date(match.scheduled_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, now - start);
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setMatchTime(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isOngoing, match.scheduled_at]);

  const rawSetData = extractSetsData(match.scores);
  const setScores = Array.isArray(rawSetData) ? rawSetData.map((s: any) => ({
    t1: s.team1 ?? s.home ?? 0,
    t2: s.team2 ?? s.away ?? 0
  })) : [];

  const setsWon = [countSetsWon(rawSetData, 0), countSetsWon(rawSetData, 1)];
  const isBeachVolleyball = match.sport_type === 'Beach Volleyball' || match.sport_type === 'beach_volleyball';
  const setsToWin = isBeachVolleyball ? 2 : 3;
  const isMatchFinished = match.status === 'completed' || 
    (match.sport_type !== 'Football' && (setsWon[0] >= setsToWin || setsWon[1] >= setsToWin));
  const isOngoingDisplay = isOngoing && !isMatchFinished;

  const currentSetNum = Math.min(
    isBeachVolleyball ? 3 : 5,
    setScores.length + (isOngoingDisplay ? 1 : 0)
  );

  const currentGames = match.scores?.tennis?.games || [0, 0];

  const isRacketSport = match.sport_type === 'Tennis' || match.sport_type === 'Padel';

  const renderPoints = (idx: number) => {
    if (isRacketSport && match.scores?.tennis) {
      const p = match.scores.tennis.points?.[idx] ?? 0;
      const opp = match.scores.tennis.points?.[idx === 0 ? 1 : 0] ?? 0;
      if (p >= 3 && opp >= 3) return p > opp ? "AD" : "40";
      return TENNIS_POINTS[p] || "0";
    }
    return match.scores?.current?.[idx === 0 ? 'home' : 'away'] ?? 0;
  };

  const isPointsBased = match.sport_type === 'Football' || match.sport_type === 'Basketball';
  const isScheduled = match.status === 'scheduled' && !isMatchFinished;

  const getMainScore = (idx: number) => {
    if (isScheduled) {
      return "–";
    }
    if (isPointsBased) {
      return match.scores?.current?.[idx === 0 ? 'home' : 'away'] ?? 0;
    }
    return setsWon[idx];
  };

  return (
    <Link href={`/match/${match.id}`} className="w-full group block h-full">
      <div className="bg-surface-container p-4 rounded-xl border border-outline-variant hover:border-outline hover:bg-surface-container-high/40 transition-colors relative flex flex-col justify-between h-full">
        {/* Header: Tournament / Sport & Status */}
        <div className="flex justify-between items-center gap-2 pb-3 mb-3 border-b border-outline-variant/60 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <SportIcon sport={match.sport_type} className="text-text-muted group-hover:text-text-primary text-[15px] shrink-0 transition-colors" />
            <span
              className="text-xs font-medium text-text-secondary truncate block"
              title={match.tournaments?.name || getSportTranslation(match.sport_type, t)}
            >
              {match.tournaments?.name || getSportTranslation(match.sport_type, t)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOngoingDisplay ? (
              <span className="text-xs font-medium text-text-primary flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {match.sport_type === 'Basketball'
                  ? (match.scores?.basketball?.period || t("status.live"))
                  : match.sport_type !== 'Football'
                  ? `Set ${currentSetNum}`
                  : t("status.live")}
              </span>
            ) : (
              <span className="text-xs font-medium text-text-muted shrink-0">
                {match.status === 'completed' || isMatchFinished
                  ? t("status.final")
                  : match.status === 'scheduled'
                  ? t("status.scheduled")
                  : match.status}
              </span>
            )}
            <FollowButton entityId={match.id} entityType="match" variant="icon" className="text-text-muted hover:text-text-primary" />
          </div>
        </div>

        {/* Participants */}
        <div className="space-y-2.5 flex-1 flex flex-col justify-center">
          {[0, 1].map((i) => {
            const participantName = formatTeamOrPlayerName(match.participants?.[i]?.name);
            const isServing = isOngoingDisplay && !isPointsBased && match.scores?.serving_index === i;

            return (
              <div key={i} className="flex items-center justify-between gap-3 min-h-[32px]">
                {/* Left: Avatar + Team Name + Set Scores underneath */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 shrink-0 rounded-md bg-surface-container-high flex items-center justify-center border border-outline-variant">
                    <span className="font-sans font-medium text-[11px] text-text-secondary">
                      {getInitials(match.participants?.[i]?.name)}
                    </span>
                  </div>

                  {/* Name + Sets underneath */}
                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-sm font-medium truncate ${
                          participantName ? "text-text-primary" : "text-text-muted"
                        }`}
                      >
                        {participantName || "TBD"}
                      </span>
                      {isServing && (
                        <span
                          title={t("scoreboard.serving")}
                          className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                        />
                      )}
                    </div>

                  {/* Set / Quarter scores under the team name */}
                  {match.sport_type === 'Basketball' ? (
                    match.scores?.basketball?.quarters?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5 font-mono tabular-nums text-xs">
                        {match.scores.basketball.quarters
                          .filter((q: any, idx: number) => {
                            const currentPeriod = match.scores?.basketball?.period || "Q4";
                            const periodOrder = ["Q1", "Q2", "Q3", "Q4", "OT"];
                            const currentIdx = periodOrder.indexOf(currentPeriod);
                            if (match.status === "completed") return (q.home ?? 0) > 0 || (q.away ?? 0) > 0;
                            return idx <= (currentIdx >= 0 ? currentIdx : 3);
                          })
                          .map((q: any, idx: number) => {
                            const pScore = i === 0 ? (q.home ?? 0) : (q.away ?? 0);
                            const oScore = i === 0 ? (q.away ?? 0) : (q.home ?? 0);
                            return (
                              <span
                                key={idx}
                                className={pScore > oScore ? "font-medium text-text-primary" : "text-text-muted"}
                              >
                                {pScore}
                              </span>
                            );
                          })}
                      </div>
                    )
                  ) : match.sport_type !== 'Football' && (
                    <div className="flex items-center gap-2 mt-0.5 font-mono tabular-nums text-xs">
                      {/* Completed sets */}
                      {setScores.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {setScores.map((set: any, idx: number) => {
                            const pScore = i === 0 ? set.t1 : set.t2;
                            const oScore = i === 0 ? set.t2 : set.t1;
                            return (
                              <span
                                key={idx}
                                className={
                                  pScore > oScore
                                    ? "font-medium text-text-primary"
                                    : "text-text-muted"
                                }
                              >
                                {pScore}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Live current set points / tennis games & points when ongoing */}
                      {isOngoingDisplay && (
                        <span className="font-medium text-text-secondary flex items-center gap-1">
                          {setScores.length > 0 && (
                            <span className="text-text-muted/60">/</span>
                          )}
                          {isRacketSport
                            ? `${currentGames[i]} (${renderPoints(i)})`
                            : renderPoints(i)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Main Match Score (Goals for Football/Basketball, Sets Won for Volleyball/Tennis) */}
              <div className="flex items-center justify-center w-8 shrink-0">
                <span
                  className={`text-lg font-digital tabular-nums font-semibold text-center ${
                    isScheduled ? "text-text-muted font-normal" : "text-text-primary"
                  }`}
                >
                  {getMainScore(i)}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
