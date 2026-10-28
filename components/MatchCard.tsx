"use client";

import { useEffect, useState } from "react";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import Link from "next/link";
import SportIcon from "@/components/SportIcon";

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

  const getMainScore = (idx: number) => {
    if (isPointsBased) {
      return match.scores?.current?.[idx === 0 ? 'home' : 'away'] ?? 0;
    }
    return setsWon[idx];
  };

  return (
    <Link href={`/match/${match.id}`} className="w-full max-w-[288px] group shrink-0">
      <div className="bg-[#151b2d]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all duration-500 shadow-2xl relative overflow-hidden flex flex-col h-full group-hover:scale-[1.01]">
        {/* Header */}
        <div className="flex justify-between items-center gap-2 mb-6 relative z-10 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <SportIcon sport={match.sport_type} className="text-primary text-[14px]" />
            <span 
              className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70 truncate block"
              title={match.tournaments?.name || match.sport_type}
            >
              {match.tournaments?.name || match.sport_type}
            </span>
          </div>

          {isOngoingDisplay ? (
            <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              {match.sport_type === 'Basketball'
                ? (match.scores?.basketball?.period || "Live")
                : match.sport_type !== 'Football'
                ? `Set ${currentSetNum}`
                : "Live"}
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/40 shrink-0">
              {match.status === 'completed' || isMatchFinished ? 'Final' : match.status}
            </span>
          )}
        </div>

        {/* Participants */}
        <div className="space-y-4 flex-1 relative z-10">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              {/* Left: Avatar + Team Name + Set Scores underneath */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Avatar */}
                <div className={`relative w-8 h-8 shrink-0 rounded-lg bg-surface-container-high/40 flex items-center justify-center border border-white/5 group-hover:bg-primary/20 transition-all duration-500 ${isOngoingDisplay && !isPointsBased && match.scores?.serving_index === i ? 'after:absolute after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-0.5 after:bg-yellow-400 after:rounded-full after:shadow-[0_0_8px_rgba(250,204,21,0.6)]' : ''}`}>
                  <span className="font-headline font-black text-[12px] text-on-surface-variant/70">
                    {getInitials(match.participants?.[i]?.name)}
                  </span>
                </div>

                {/* Name + Sets underneath */}
                <div className="flex flex-col min-w-0 flex-1 justify-center">
                  <span className="text-[11px] font-black uppercase tracking-wider text-on-surface truncate">
                    {formatTeamOrPlayerName(match.participants?.[i]?.name) || "TBD"}
                  </span>

                  {/* Set / Quarter scores under the team name */}
                  {match.sport_type === 'Basketball' ? (
                    match.scores?.basketball?.quarters?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px]">
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
                                className={pScore > oScore ? "font-bold text-on-surface" : "text-on-surface-variant/50"}
                              >
                                {pScore}
                              </span>
                            );
                          })}
                      </div>
                    )
                  ) : match.sport_type !== 'Football' && (
                    <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px]">
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
                                    ? "font-bold text-on-surface"
                                    : "text-on-surface-variant/50"
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
                        <span className="font-bold text-primary flex items-center gap-1">
                          {setScores.length > 0 && (
                            <span className="text-on-surface-variant/30">•</span>
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

              {/* Right: Main Match Score (Goals for Football, Sets Won for Volleyball/Tennis) */}
              <div className="flex items-center shrink-0">
                <span className="text-xl font-headline font-black w-6 text-right text-on-surface">
                  {getMainScore(i)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
