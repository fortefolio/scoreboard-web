"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { extractSetsData } from "@/lib/scoring/sets";

const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];

export default function MatchOverlayClient() {
  const { matchId } = useParams();
  const matchIdStr = (Array.isArray(matchId) ? matchId[0] : matchId) || "";
  const searchParams = useSearchParams();

  const [hasMounted, setHasMounted] = useState(false);
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const pos = searchParams.get("pos") || "top";
  const scale = searchParams.get("scale") || "md";
  const showBranding = searchParams.get("brand") !== "0";

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!matchIdStr) return;
    let channel: any;

    const fetchMatch = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, tournaments(*)")
        .eq("id", matchIdStr)
        .maybeSingle();

      if (!error && data) {
        setMatch(data);
      }
      setLoading(false);
    };

    fetchMatch();

    // Subscribe to live score updates
    channel = supabase
      .channel(`broadcast_overlay_${matchIdStr}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchIdStr}`,
        },
        async () => {
          fetchMatch();
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [matchIdStr]);

  if (!hasMounted || loading || !match) {
    return <div className="fixed inset-0 bg-transparent pointer-events-none" />;
  }

  const team1Name = formatTeamOrPlayerName(
    match.team1_name || match.participants?.[0]?.name || "Team 1"
  );
  const team2Name = formatTeamOrPlayerName(
    match.team2_name || match.participants?.[1]?.name || "Team 2"
  );

  const sport = match.sport_type;
  const isTennisOrPadel = sport === "Tennis" || sport === "Padel";
  const isVolleyball = sport === "Volleyball" || sport === "Beach Volleyball";
  const isBasketball = sport === "Basketball";
  const isFootball = sport === "Football";

  // Score extraction
  const setsData = extractSetsData(match.scores) || [];
  const team1SetsWon = setsData.filter((s: any) => (s.team1 ?? s.home ?? 0) > (s.team2 ?? s.away ?? 0)).length;
  const team2SetsWon = setsData.filter((s: any) => (s.team2 ?? s.away ?? 0) > (s.team1 ?? s.home ?? 0)).length;

  // Current tennis/padel games & points
  const currentGames = match.scores?.tennis?.games || [0, 0];
  const rawPoints = match.scores?.tennis?.points || [0, 0];
  const isTiebreak = Boolean(match.scores?.tennis?.in_tiebreak);
  const isGoldenPoint = Boolean(match.scores?.tennis?.is_golden_point);

  const point1 = isTiebreak 
    ? rawPoints[0] 
    : isGoldenPoint && rawPoints[0] === 3 && rawPoints[1] === 3
    ? "GP"
    : TENNIS_POINTS[rawPoints[0]] ?? rawPoints[0];

  const point2 = isTiebreak 
    ? rawPoints[1] 
    : isGoldenPoint && rawPoints[0] === 3 && rawPoints[1] === 3
    ? "GP"
    : TENNIS_POINTS[rawPoints[1]] ?? rawPoints[1];

  const serverIdx = match.scores?.serving_index ?? null;

  // Volleyball current set points
  const volleyPoints = match.scores?.volleyball?.current_set_points || [0, 0];
  const volleyServer = match.scores?.volleyball?.serving_team ?? null;

  // Basketball / Football total scores
  const basketballScore = match.scores?.basketball?.total || [
    match.team1_score ?? match.scores?.home ?? 0,
    match.team2_score ?? match.scores?.away ?? 0,
  ];
  const currentPeriod = match.scores?.basketball?.current_period || "Q1";

  const footballScore = [
    match.team1_score ?? match.scores?.home ?? 0,
    match.team2_score ?? match.scores?.away ?? 0,
  ];

  const isLive = match.status === "ongoing";

  const scaleClasses =
    scale === "sm"
      ? "scale-75 origin-top"
      : scale === "lg"
      ? "scale-125 origin-top"
      : "scale-100 origin-top";

  const positionClasses = pos === "bottom" ? "items-end pb-8" : "items-start pt-6";

  return (
    <div className={`fixed inset-0 pointer-events-none bg-transparent flex justify-center ${positionClasses} font-sans select-none overflow-hidden z-[9999]`}>
      <div className={`transition-transform duration-300 ${scaleClasses}`}>
        {/* Main Broadcast Scoreboard Glass Container */}
        <div className="bg-[#0b101e]/92 backdrop-blur-md border border-white/15 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] text-white overflow-hidden flex flex-col min-w-[540px] max-w-[720px]">
          {/* Top Subtle Info Strip */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-black/40 border-b border-white/10 text-[10px] font-black uppercase tracking-wider">
            <div className="flex items-center gap-2">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-red-400 font-black">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="text-slate-400 font-bold uppercase tracking-widest">
                  {match.status}
                </span>
              )}
              {match.tournaments?.name && (
                <span className="text-slate-400 truncate max-w-[240px]">
                  • {match.tournaments.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-black tracking-widest">{sport}</span>
              {showBranding && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  ScoreBoard
                </span>
              )}
            </div>
          </div>

          {/* Teams & Scores Row */}
          <div className="flex flex-col divide-y divide-white/10">
            {/* Team 1 Row */}
            <div className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                {serverIdx === 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" title="Serving" />
                )}
                {isVolleyball && volleyServer === "team1" && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" title="Serving" />
                )}
                <span className="font-black text-sm text-white tracking-tight truncate">
                  {team1Name}
                </span>
              </div>

              {/* Scores Cluster */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Sets won (for racket/volleyball) */}
                {(isTennisOrPadel || isVolleyball) && (
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs text-indigo-300">
                    {isTennisOrPadel ? team1SetsWon : team1SetsWon}
                  </div>
                )}

                {/* Tennis/Padel current games */}
                {isTennisOrPadel && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                    {currentGames[0]}
                  </div>
                )}

                {/* Tennis/Padel live points */}
                {isTennisOrPadel && (
                  <div className="w-9 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
                    {point1}
                  </div>
                )}

                {/* Volleyball current set points */}
                {isVolleyball && (
                  <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-base shadow-md">
                    {volleyPoints[0]}
                  </div>
                )}

                {/* Basketball / Football score */}
                {isBasketball && (
                  <div className="w-12 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base">
                    {basketballScore[0]}
                  </div>
                )}

                {isFootball && (
                  <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-base">
                    {footballScore[0]}
                  </div>
                )}
              </div>
            </div>

            {/* Team 2 Row */}
            <div className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                {serverIdx === 1 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" title="Serving" />
                )}
                {isVolleyball && volleyServer === "team2" && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" title="Serving" />
                )}
                <span className="font-black text-sm text-white tracking-tight truncate">
                  {team2Name}
                </span>
              </div>

              {/* Scores Cluster */}
              <div className="flex items-center gap-2 shrink-0">
                {(isTennisOrPadel || isVolleyball) && (
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs text-indigo-300">
                    {isTennisOrPadel ? team2SetsWon : team2SetsWon}
                  </div>
                )}

                {isTennisOrPadel && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                    {currentGames[1]}
                  </div>
                )}

                {isTennisOrPadel && (
                  <div className="w-9 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
                    {point2}
                  </div>
                )}

                {isVolleyball && (
                  <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-base shadow-md">
                    {volleyPoints[1]}
                  </div>
                )}

                {isBasketball && (
                  <div className="w-12 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base">
                    {basketballScore[1]}
                  </div>
                )}

                {isFootball && (
                  <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-base">
                    {footballScore[1]}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Game Context Strip */}
          {(isBasketball || isTennisOrPadel) && (
            <div className="px-4 py-1 bg-black/50 border-t border-white/10 flex items-center justify-between text-[9px] font-bold text-slate-400">
              {isBasketball && (
                <span>Period: <strong className="text-white">{currentPeriod}</strong></span>
              )}
              {isTennisOrPadel && setsData.length > 0 && (
                <div className="flex items-center gap-2">
                  <span>Previous Sets:</span>
                  {setsData.map((s: any, idx: number) => (
                    <span key={idx} className="text-slate-300 font-mono">
                      {s.team1 ?? s.home ?? 0}-{s.team2 ?? s.away ?? 0}
                    </span>
                  ))}
                </div>
              )}
              {isGoldenPoint && (
                <span className="text-amber-400 font-black uppercase tracking-wider">
                  ★ Golden Point Active
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
