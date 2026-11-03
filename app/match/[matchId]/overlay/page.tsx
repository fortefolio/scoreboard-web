"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { extractSetsData } from "@/lib/scoring/sets";

const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];

function MatchOverlayContent() {
  const { matchId } = useParams();
  const matchIdStr = (Array.isArray(matchId) ? matchId[0] : matchId) || "";
  const searchParams = useSearchParams();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const pos = searchParams.get("pos") || "top";
  const scale = searchParams.get("scale") || "md";
  const showBranding = searchParams.get("brand") !== "0";

  useEffect(() => {
    let channel: any;

    const fetchMatch = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          tournaments (name),
          participants:match_participants (id, name, is_team)
        `)
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
          // Re-fetch match to ensure participants & computed states are clean
          fetchMatch();
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [matchIdStr, supabase]);

  if (loading || !match) {
    return <div className="min-h-screen bg-transparent" />;
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
    <div className={`fixed inset-0 pointer-events-none bg-transparent flex justify-center ${positionClasses} font-sans select-none overflow-hidden`}>
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
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
                {(isTennisOrPadel && serverIdx === 0) || (isVolleyball && volleyServer === 0) ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shadow-sm" title="Serving" />
                ) : (
                  <span className="w-2 h-2 rounded-full opacity-0" />
                )}
                <span className="text-sm font-black text-slate-100 truncate tracking-wide">
                  {team1Name}
                </span>
              </div>

              {/* Score Units */}
              <div className="flex items-center gap-1 shrink-0 font-mono">
                {isTennisOrPadel && (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                      {team1SetsWon}
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-black text-sm text-indigo-200">
                      {currentGames[0]}
                    </div>
                    <div className={`w-10 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                      point1 === "GP" ? "bg-amber-500 text-slate-950 font-black animate-pulse" : "bg-emerald-500 text-slate-950"
                    }`}>
                      {point1}
                    </div>
                  </>
                )}

                {isVolleyball && (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                      {team1SetsWon}
                    </div>
                    <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-sm">
                      {volleyPoints[0]}
                    </div>
                  </>
                )}

                {isBasketball && (
                  <div className="w-12 h-8 rounded-lg bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center font-black text-sm text-white">
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
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
                {(isTennisOrPadel && serverIdx === 1) || (isVolleyball && volleyServer === 1) ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shadow-sm" title="Serving" />
                ) : (
                  <span className="w-2 h-2 rounded-full opacity-0" />
                )}
                <span className="text-sm font-black text-slate-100 truncate tracking-wide">
                  {team2Name}
                </span>
              </div>

              {/* Score Units */}
              <div className="flex items-center gap-1 shrink-0 font-mono">
                {isTennisOrPadel && (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                      {team2SetsWon}
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-black text-sm text-indigo-200">
                      {currentGames[1]}
                    </div>
                    <div className={`w-10 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                      point2 === "GP" ? "bg-amber-500 text-slate-950 font-black animate-pulse" : "bg-emerald-500 text-slate-950"
                    }`}>
                      {point2}
                    </div>
                  </>
                )}

                {isVolleyball && (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                      {team2SetsWon}
                    </div>
                    <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-sm">
                      {volleyPoints[1]}
                    </div>
                  </>
                )}

                {isBasketball && (
                  <div className="w-12 h-8 rounded-lg bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center font-black text-sm text-white">
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

export default function MatchOverlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <MatchOverlayContent />
    </Suspense>
  );
}
