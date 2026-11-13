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

    // Subscribe to live score updates via in-database Realtime Broadcast (sub-100ms, zero DB fetch)
    try {
      channel = supabase
        .channel(`match:${matchIdStr}`)
        .on("broadcast", { event: "score_update" }, (response: any) => {
          const payload = response?.payload;
          if (payload?.match_id === matchIdStr && payload.scores) {
            setMatch((prev: any) => ({
              ...prev,
              scores: payload.scores ?? prev?.scores,
              status: payload.status ?? prev?.status,
            }));
          }
        })
        .on("broadcast", { event: "SCORE_UPDATED" }, (response: any) => {
          const payload = response?.payload;
          if (payload?.match_id === matchIdStr && payload.scores) {
            setMatch((prev: any) => ({
              ...prev,
              scores: payload.scores ?? prev?.scores,
              status: payload.status ?? prev?.status,
            }));
          }
        })
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "matches",
            filter: `id=eq.${matchIdStr}`,
          },
          (payload: any) => {
            if (payload.new) {
              setMatch((prev: any) => ({ ...prev, ...payload.new }));
            }
          }
        );

      channel.subscribe();
    } catch (err) {
      console.warn('[MatchOverlay] Realtime unavailable:', err);
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
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

  const renderTeamRow = (idx: 0 | 1) => {
    const teamName = idx === 0 ? team1Name : team2Name;
    const setsWon = idx === 0 ? team1SetsWon : team2SetsWon;
    const livePoint = idx === 0 ? point1 : point2;
    const isServing =
      serverIdx === idx ||
      (isVolleyball && volleyServer === (idx === 0 ? "team1" : "team2"));

    return (
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
          {isServing && (
            <span className="w-1.5 h-1.5 rounded-full bg-text-primary shrink-0" title="Serving" />
          )}
          <span className="font-medium text-sm text-text-primary truncate">
            {teamName}
          </span>
        </div>

        {/* Scores Cluster */}
        <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
          {(isTennisOrPadel || isVolleyball) && (
            <div className="w-7 h-7 rounded-md bg-surface-container-high flex items-center justify-center font-medium text-xs text-text-secondary border border-outline-variant">
              {setsWon}
            </div>
          )}

          {isTennisOrPadel && (
            <div className="w-8 h-8 rounded-md bg-surface-container-highest text-text-primary flex items-center justify-center font-semibold text-sm border border-outline-variant">
              {currentGames[idx]}
            </div>
          )}

          {isTennisOrPadel && (
            <div className="w-9 h-8 rounded-md bg-text-primary text-surface-container-lowest flex items-center justify-center font-bold text-sm">
              {livePoint}
            </div>
          )}

          {isVolleyball && (
            <div className="w-9 h-8 rounded-md bg-text-primary text-surface-container-lowest flex items-center justify-center font-bold text-sm">
              {volleyPoints[idx]}
            </div>
          )}

          {isBasketball && (
            <div className="w-11 h-8 rounded-md bg-text-primary text-surface-container-lowest flex items-center justify-center font-bold text-sm">
              {basketballScore[idx]}
            </div>
          )}

          {isFootball && (
            <div className="w-9 h-8 rounded-md bg-text-primary text-surface-container-lowest flex items-center justify-center font-bold text-sm">
              {footballScore[idx]}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 pointer-events-none bg-transparent flex justify-center ${positionClasses} font-sans select-none overflow-hidden z-[9999]`}>
      <div className={`transition-transform duration-300 ${scaleClasses}`}>
        {/* Main Broadcast Scoreboard Container */}
        <div className="bg-[#0b0d14]/95 border border-outline-variant rounded-xl text-text-primary overflow-hidden flex flex-col min-w-[500px] max-w-[700px]">
          {/* Top Info Strip */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-surface-container-high/60 border-b border-outline-variant text-xs font-medium">
            <div className="flex items-center gap-2">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-text-primary font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Live
                </span>
              ) : (
                <span className="text-text-muted font-medium capitalize">
                  {match.status}
                </span>
              )}
              {match.tournaments?.name && (
                <span className="text-text-muted truncate max-w-[240px]">
                  • {match.tournaments.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-text-secondary font-medium">{sport}</span>
              {showBranding && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest text-text-secondary font-medium border border-outline-variant">
                  ScoreBoard
                </span>
              )}
            </div>
          </div>

          {/* Teams & Scores Rows */}
          <div className="flex flex-col divide-y divide-outline-variant">
            {renderTeamRow(0)}
            {renderTeamRow(1)}
          </div>

          {/* Bottom Game Context Strip */}
          {(isBasketball || (isTennisOrPadel && (setsData.length > 0 || isGoldenPoint))) && (
            <div className="px-4 py-1.5 bg-surface-container-high/60 border-t border-outline-variant flex items-center justify-between text-[11px] font-medium text-text-muted">
              {isBasketball && (
                <span>
                  Period: <span className="text-text-primary font-semibold">{currentPeriod}</span>
                </span>
              )}
              {isTennisOrPadel && setsData.length > 0 && (
                <div className="flex items-center gap-2">
                  <span>Previous Sets:</span>
                  {setsData.map((s: any, idx: number) => (
                    <span key={idx} className="text-text-secondary font-mono tabular-nums">
                      {s.team1 ?? s.home ?? 0}-{s.team2 ?? s.away ?? 0}
                    </span>
                  ))}
                </div>
              )}
              {isGoldenPoint && (
                <span className="text-text-primary font-medium">
                  Golden Point
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
