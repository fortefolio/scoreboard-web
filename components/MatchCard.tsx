"use client";

import { useEffect, useState } from "react";
import { countSetsWon } from "@/lib/scoring/sets";
import Link from "next/link";

const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];

const getSportIcon = (sport?: string) => {
  switch (sport) {
    case "Volleyball":
      return "sports_volleyball";
    case "Football":
      return "sports_soccer";
    case "Tennis":
    default:
      return "sports_tennis";
  }
};

const getInitials = (name?: string) => {
  if (!name) return "?";
  const cleaned = name.replace(/\(.+?\)/g, "").trim();
  if (!cleaned) return "?";
  return cleaned
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

  const setScores = match.scores?.set_scores || [];
  const currentGames = match.scores?.tennis?.games || [0, 0];
  const currentSetNum = setScores.length + (isOngoing ? 1 : 0);

  const renderPoints = (idx: number) => {
    if (match.sport_type === 'Tennis' && match.scores?.tennis) {
      const p = match.scores.tennis.points?.[idx] ?? 0;
      const opp = match.scores.tennis.points?.[idx === 0 ? 1 : 0] ?? 0;
      if (p >= 3 && opp >= 3) return p > opp ? "AD" : "40";
      return TENNIS_POINTS[p] || "0";
    }
    return match.scores?.current?.[idx === 0 ? 'home' : 'away'] ?? 0;
  };

  return (
    <Link href={`/match/${match.id}`} className="w-full max-w-[288px] group shrink-0">
      <div className="bg-[#151b2d]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all duration-500 shadow-2xl relative overflow-hidden flex flex-col h-full group-hover:scale-[1.01]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[14px]">
              {getSportIcon(match.sport_type)}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">
              {match.sport_type}{match.tournaments?.name ? ` • ${match.tournaments.name}` : ""}
            </span>
          </div>
        </div>

        {/* Participants */}
        <div className="space-y-5 flex-1 relative z-10">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`relative w-8 h-8 rounded-lg bg-surface-container-high/40 flex items-center justify-center border border-white/5 group-hover:bg-primary/20 transition-all duration-500 ${isOngoing && match.sport_type !== 'Football' && match.scores?.serving_index === i ? 'after:absolute after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-0.5 after:bg-yellow-400 after:rounded-full after:shadow-[0_0_8px_rgba(250,204,21,0.6)]' : ''}`}>
                  <span className="font-headline font-black text-[12px] text-on-surface-variant/70">
                    {getInitials(match.participants?.[i]?.name)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-on-surface truncate max-w-[100px]">
                    {match.participants?.[i]?.name || "TBD"}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Historical Sets + Current Games */}
                <div className="flex gap-1.5">
                  {setScores.map((set: any, idx: number) => (
                    <span key={idx} className="text-[10px] font-bold text-on-surface-variant/20">
                      {i === 0 ? set.t1 : set.t2}
                    </span>
                  ))}
                  {isOngoing && (
                    <span className="text-[10px] font-bold text-on-surface-variant/50">
                      {currentGames[i]}
                    </span>
                  )}
                </div>
                {/* Points */}
                <span className={`text-xl font-headline font-black w-8 text-right transition-colors duration-500 ${renderPoints(i) === "AD" || renderPoints(i) === "40" ? 'text-primary' : 'text-on-surface'}`}>
                  {renderPoints(i)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
