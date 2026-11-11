"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import SportIcon from "@/components/SportIcon";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { recordMatchEventAtomic } from "@/lib/scoring/atomicScoring";
import { extractSetsData } from "@/lib/scoring/sets";

const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];

export default function TennisScoreboard({
  matchData,
  rules,
  canEdit = true,
}: {
  matchData: any;
  rules?: any;
  canEdit?: boolean;
}) {
  const isPadel = matchData?.sport_type === "Padel";
  const defaultMaxSets = rules?.max_sets || 3;
  const setsToWin = Math.ceil(defaultMaxSets / 2);
  const isGoldenPoint = isPadel || rules?.golden_point || false; // Padel traditionally plays golden point at 40-40

  const getInitialSets = (data: any) => {
    const raw = extractSetsData(data?.scores);
    return Array.isArray(raw)
      ? raw.map((s: any) => ({
          home: s.team1 ?? s.home ?? 0,
          away: s.team2 ?? s.away ?? 0,
        }))
      : [];
  };

  // State
  const [points, setPoints] = useState<[number, number]>(
    matchData?.scores?.tennis?.points || [0, 0]
  );
  const [games, setGames] = useState<[number, number]>(
    matchData?.scores?.tennis?.games || [0, 0]
  );
  const [setHistory, setSetHistory] = useState<{ home: number; away: number }[]>(
    getInitialSets(matchData)
  );
  const [serverIdx, setServerIdx] = useState<number | null>(
    matchData?.scores?.serving_index ?? null
  );
  const [isTossing, setIsTossing] = useState(false);
  const [aces, setAces] = useState({ home: 0, away: 0 });
  const [doubleFaults, setDoubleFaults] = useState({ home: 0, away: 0 });

  const teamHome = matchData?.participants?.[0]?.name || "Jogador 1";
  const teamAway = matchData?.participants?.[1]?.name || "Jogador 2";

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData?.scores) {
      setPoints(matchData.scores.tennis?.points || [0, 0]);
      setGames(matchData.scores.tennis?.games || [0, 0]);
      setSetHistory(getInitialSets(matchData));
      setServerIdx(matchData.scores.serving_index ?? null);

      if (matchData.scores.tennis?.stats) {
        setAces(matchData.scores.tennis.stats.aces || { home: 0, away: 0 });
        setDoubleFaults(matchData.scores.tennis.stats.double_faults || { home: 0, away: 0 });
      }
    }
  }, [matchData?.scores]);

  // Sets won calculation
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  setHistory.forEach((s) => {
    if (s.home > s.away) homeSetsWon++;
    else if (s.away > s.home) awaySetsWon++;
  });

  const isTiebreak = games[0] === 6 && games[1] === 6;

  // Format tennis point for display
  const formatPoint = (idx: number) => {
    if (isTiebreak) {
      return points[idx].toString();
    }

    const p = points[idx];
    const opp = points[idx === 0 ? 1 : 0];

    if (isGoldenPoint && p >= 3 && opp >= 3) {
      return "40"; // Sudden death at 40-40 in Padel
    }

    if (p >= 3 && opp >= 3) {
      if (p === opp) return "40"; // Deuce
      return p > opp ? "AD" : "40";
    }

    return TENNIS_POINTS[p] ?? "0";
  };

  const handleToss = async (selectedIdx: number) => {
    if (!canEdit) return;
    setServerIdx(selectedIdx);
    setIsTossing(true);

    const { error } = await supabase.from("match_events").insert([
      {
        match_id: matchData.id,
        event_data: { type: "start_scoreboard" },
      },
      {
        match_id: matchData.id,
        event_data: {
          type: "toss_coin",
          winner_index: selectedIdx,
        },
      },
    ]);

    if (error) {
      console.error("Error starting scoreboard:", error);
    }
    setIsTossing(false);
  };

  const handlePoint = async (winnerIdx: number) => {
    if (!canEdit) return;
    if (serverIdx === null) {
      toast.error("Por favor seleciona o primeiro servidor!");
      return;
    }

    const side = winnerIdx === 0 ? "home" : "away";

    // Optimistic UI update
    const newPoints: [number, number] = [...points];
    newPoints[winnerIdx]++;
    setPoints(newPoints);

    const { error } = await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      eventData: {
        type: "point_won",
        side,
      },
    });

    if (error) {
      console.error("Error recording point:", error);
      toast.error("Erro ao registar ponto.");
    }
  };

  const handleAce = async (idx: number) => {
    if (!canEdit) return;
    const side = idx === 0 ? "home" : "away";
    const updated = { ...aces, [side]: aces[side] + 1 };
    setAces(updated);

    // Save ace stat & trigger point
    await handlePoint(idx);

    await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      eventData: {
        type: "tennis_stat",
        stat: "ace",
        side,
      },
    });
    toast.success(`Ás de ${formatTeamOrPlayerName(idx === 0 ? teamHome : teamAway)}!`);
  };

  const handleDoubleFault = async (serverPlayerIdx: number) => {
    if (!canEdit) return;
    const side = serverPlayerIdx === 0 ? "home" : "away";
    const oppIdx = serverPlayerIdx === 0 ? 1 : 0;
    const updated = { ...doubleFaults, [side]: doubleFaults[side] + 1 };
    setDoubleFaults(updated);

    // Double fault gives point to opponent
    await handlePoint(oppIdx);

    await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      eventData: {
        type: "tennis_stat",
        stat: "double_fault",
        side,
      },
    });
    toast.error(`Dupla Falta de ${formatTeamOrPlayerName(serverPlayerIdx === 0 ? teamHome : teamAway)}.`);
  };

  const handleCorrectPoint = async (idx: number) => {
    if (!canEdit) return;
    if (points[idx] <= 0) return;

    const newPoints: [number, number] = [...points];
    newPoints[idx] = Math.max(0, newPoints[idx] - 1);
    setPoints(newPoints);

    // Update matches scores
    const currentScores = matchData?.scores || {};
    const updatedScores = {
      ...currentScores,
      tennis: {
        ...(currentScores.tennis || {}),
        points: newPoints,
      },
    };

    const { error } = await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: updatedScores,
      eventData: {
        type: "correct_point",
        side: idx === 0 ? "home" : "away",
        points: newPoints,
      },
    });

    if (error) {
      toast.error("Erro ao corrigir ponto.");
    } else {
      toast.success("Ponto corrigido.");
    }
  };

  const toggleServer = async () => {
    if (!canEdit) return;
    const newIdx = serverIdx === 0 ? 1 : 0;
    setServerIdx(newIdx);

    const currentScores = matchData?.scores || {};
    await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: { ...currentScores, serving_index: newIdx },
      eventData: {
        type: "server_changed",
        serving_index: newIdx,
      },
    });
  };

  const handleFinalizeMatch = async () => {
    if (!canEdit) return;
    if (confirm(`Tens a certeza que queres terminar este jogo de ${isPadel ? "Padel" : "Ténis"}?`)) {
      const { error } = await recordMatchEventAtomic(supabase, {
        matchId: matchData.id,
        newStatus: "completed",
        eventData: {
          type: "match_finished",
        },
      });

      if (!error) {
        toast.success("Jogo terminado com sucesso!");
      }
    }
  };

  // Court side indicator (Deuce Court / Ad Court)
  const totalPointsInGame = points[0] + points[1];
  const isDeuceCourt = totalPointsInGame % 2 === 0;

  // Alerts logic
  const isDeuceAlert = !isTiebreak && points[0] >= 3 && points[1] >= 3 && points[0] === points[1];
  const isAdvantageHome = !isTiebreak && points[0] >= 3 && points[1] >= 3 && points[0] - points[1] === 1;
  const isAdvantageAway = !isTiebreak && points[0] >= 3 && points[1] >= 3 && points[1] - points[0] === 1;
  
  // Break point alert
  const isBreakPoint =
    !isTiebreak &&
    ((serverIdx === 0 && (points[1] === 3 && points[0] < 3 || isAdvantageAway)) ||
     (serverIdx === 1 && (points[0] === 3 && points[1] < 3 || isAdvantageHome)));

  // Total games played in current set for change of ends
  const totalGamesInSet = games[0] + games[1];
  const isChangeOfEnds =
    !isTiebreak
      ? totalGamesInSet > 0 && totalGamesInSet % 2 === 1 && points[0] === 0 && points[1] === 0
      : totalPointsInGame > 0 && totalPointsInGame % 6 === 0;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {/* Toss Server Banner if serverIdx is null */}
      {serverIdx === null && (
        <div className="w-full bg-primary-container/20 border border-primary-container/30 rounded-2xl p-4 flex flex-col items-center mb-6 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary text-sm animate-bounce">paid</span>
            <span className="text-[10px] font-label font-black text-primary uppercase tracking-[0.2em]">
              Select First Server / Selecionar Servidor
            </span>
          </div>
          <div className="flex gap-4 w-full max-w-md">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                onClick={() => handleToss(idx)}
                disabled={isTossing || !canEdit}
                className="flex-1 bg-primary hover:bg-primary-hover active:scale-95 text-on-primary py-2.5 px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-primary/20"
              >
                {formatTeamOrPlayerName(idx === 0 ? teamHome : teamAway)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Banner / Match Info */}
      <div className="w-full bg-surface-container rounded-xl border border-outline-variant p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <SportIcon sport={isPadel ? "Padel" : "Tennis"} className="w-4 h-4 text-text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">
                {isPadel ? "Padel" : "Tennis"}
              </span>
              <span className="text-xs text-text-muted">
                • {matchData?.tournaments?.name || "Single Match"}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-text-primary mt-0.5">
              {formatTeamOrPlayerName(teamHome)} <span className="text-text-muted font-normal">vs</span> {formatTeamOrPlayerName(teamAway)}
            </h2>
          </div>
        </div>

        {/* Set Navigator Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-lg border border-outline-variant">
          {Array.from({ length: defaultMaxSets }).map((_, i) => {
            const isCompletedSet = i < setHistory.length;
            const isCurrent = i === setHistory.length;
            return (
              <div
                key={i}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isCurrent
                    ? "bg-surface-container text-text-primary shadow-sm border border-outline-variant"
                    : isCompletedSet
                    ? "text-text-secondary"
                    : "text-text-muted/50"
                }`}
              >
                Set {i + 1}
                {isCompletedSet && (
                  <span className="ml-1.5 font-mono text-xs tabular-nums text-text-muted">
                    {setHistory[i].home}-{setHistory[i].away}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 3-Column Command Center Scoreboard */}
      <div className="w-full bg-surface-container rounded-2xl border border-outline-variant p-6 mb-6 relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Left Column: Home Player / Team */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="text-lg md:text-xl font-semibold text-text-primary">
                {formatTeamOrPlayerName(teamHome)}
              </span>
            </div>

            {/* Serving / Receiving Indicator */}
            <div className="mb-3">
              {serverIdx === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-container-high px-2 py-0.5 rounded-md border border-outline-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                  Serving
                </span>
              ) : (
                <span className="inline-flex items-center text-text-muted text-xs font-medium px-2 py-0.5">
                  Receiver
                </span>
              )}
            </div>

            {/* Sets & Games Context Pills */}
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Sets: <span className="font-mono tabular-nums text-text-primary font-semibold">{homeSetsWon}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Games: <span className="font-mono tabular-nums text-text-primary font-semibold">{games[0]}</span>
              </span>
            </div>

            {/* Home Big Point Score */}
            <div className="text-6xl md:text-8xl font-mono tabular-nums font-bold text-text-primary tracking-tight my-2">
              {formatPoint(0)}
            </div>

            {/* Home Quick Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePoint(0)}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 px-3 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Point
                  </button>
                  <button
                    onClick={() => handleCorrectPoint(0)}
                    disabled={points[0] <= 0}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-2 px-3 rounded-lg font-medium text-xs border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Correct / Subtract Point"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    -1
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAce(0)}
                    disabled={serverIdx !== 0}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px] text-amber-400">bolt</span>
                    Ace
                  </button>
                  <button
                    onClick={() => handleDoubleFault(0)}
                    disabled={serverIdx !== 0}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px] text-rose-400">close</span>
                    Double Fault
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Center Column: Status, Games Board, Server Side & Technical Alerts */}
          <div className="flex flex-col items-center text-center order-1 md:order-2 py-4">
            {/* Set & Game Status */}
            <div className="text-xs font-medium text-text-muted mb-1.5">
              {isTiebreak ? (
                <span className="text-amber-400 font-semibold">Deciding Tie-Break</span>
              ) : (
                `Set ${setHistory.length + 1} • Game ${totalGamesInSet + 1}`
              )}
            </div>

            {/* Current Games Board */}
            <div className="flex items-center gap-3 my-2">
              <div className="text-3xl md:text-4xl font-mono tabular-nums font-semibold text-text-primary py-2 px-6 rounded-xl bg-surface-container-high border border-outline-variant">
                {games[0]} - {games[1]}
              </div>
            </div>

            {/* Server Court Side Indicator */}
            <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
              <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
              <span>Side: <strong className="text-text-secondary font-medium">{isDeuceCourt ? "Deuce (Right)" : "Advantage (Left)"}</strong></span>
            </div>

            {/* Technical Match Context Alerts */}
            <div className="flex flex-col gap-1.5 mt-3 w-full max-w-xs">
              {isBreakPoint && (
                <div className="bg-surface-container-high border border-rose-500/30 text-rose-400 py-1 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Break Point
                </div>
              )}

              {isDeuceAlert && (
                <div className="bg-surface-container-high border border-amber-500/30 text-amber-400 py-1 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                  {isGoldenPoint ? "Golden Point (Sudden Death)" : "Deuce (40 - 40)"}
                </div>
              )}

              {isChangeOfEnds && (
                <div className="bg-surface-container-high border border-outline-variant text-text-secondary py-1 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                  Change of Ends
                </div>
              )}
            </div>

            {/* Server Toggle Button */}
            {canEdit && (
              <button
                onClick={toggleServer}
                className="mt-3 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-container-high px-3 py-1.5 rounded-lg border border-outline-variant transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">sync</span>
                Switch Server
              </button>
            )}
          </div>

          {/* Right Column: Away Player / Team */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right order-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg md:text-xl font-semibold text-text-primary">
                {formatTeamOrPlayerName(teamAway)}
              </span>
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
            </div>

            {/* Serving / Receiving Indicator */}
            <div className="mb-3">
              {serverIdx === 1 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-container-high px-2 py-0.5 rounded-md border border-outline-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                  Serving
                </span>
              ) : (
                <span className="inline-flex items-center text-text-muted text-xs font-medium px-2 py-0.5">
                  Receiver
                </span>
              )}
            </div>

            {/* Sets & Games Context Pills */}
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Games: <span className="font-mono tabular-nums text-text-primary font-semibold">{games[1]}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Sets: <span className="font-mono tabular-nums text-text-primary font-semibold">{awaySetsWon}</span>
              </span>
            </div>

            {/* Away Big Point Score */}
            <div className="text-6xl md:text-8xl font-mono tabular-nums font-bold text-text-primary tracking-tight my-2">
              {formatPoint(1)}
            </div>

            {/* Away Quick Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCorrectPoint(1)}
                    disabled={points[1] <= 0}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-2 px-3 rounded-lg font-medium text-xs border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Correct / Subtract Point"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    -1
                  </button>
                  <button
                    onClick={() => handlePoint(1)}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 px-3 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Point
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDoubleFault(1)}
                    disabled={serverIdx !== 1}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px] text-rose-400">close</span>
                    Double Fault
                  </button>
                  <button
                    onClick={() => handleAce(1)}
                    disabled={serverIdx !== 1}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px] text-amber-400">bolt</span>
                    Ace
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Set-by-Set Breakdown Table */}
      <div className="w-full bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden p-5 mb-6">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <span className="text-xs font-label uppercase tracking-widest font-black text-on-surface-variant">
            Resumo dos Sets & Estatísticas
          </span>
          <span className="text-xs text-on-surface-variant/70 font-medium">
            À melhor de {defaultMaxSets} sets ({setsToWin} para vencer)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-on-surface-variant/60 border-b border-white/5 text-xs">
                <th className="py-2.5">Jogador / Equipa</th>
                {Array.from({ length: defaultMaxSets }).map((_, i) => (
                  <th key={i} className="py-2.5 text-center font-bold">
                    S{i + 1}
                  </th>
                ))}
                <th className="py-2.5 text-center font-bold">Jogos</th>
                <th className="py-2.5 text-center font-bold">Pontos</th>
                <th className="py-2.5 text-center font-bold text-amber-300">Áses</th>
                <th className="py-2.5 text-center font-bold text-rose-400">D. Faltas</th>
                <th className="py-2.5 text-center font-black text-primary">Sets Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {/* Home Row */}
              <tr>
                <td className="py-3 font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  {formatTeamOrPlayerName(teamHome)}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, i) => {
                  const set = setHistory[i];
                  const isCurrent = i === setHistory.length;
                  return (
                    <td
                      key={i}
                      className={`py-3 text-center font-digital text-base ${
                        set && set.home > set.away
                          ? "text-primary font-bold"
                          : set
                          ? "text-on-surface-variant/70"
                          : isCurrent
                          ? "text-white font-bold"
                          : "text-on-surface-variant/20"
                      }`}
                    >
                      {set ? set.home : isCurrent ? games[0] : "-"}
                    </td>
                  );
                })}
                <td className="py-3 text-center font-digital text-base text-white">
                  {games[0]}
                </td>
                <td className="py-3 text-center font-digital text-base text-primary">
                  {formatPoint(0)}
                </td>
                <td className="py-3 text-center font-digital text-base text-amber-300">
                  {aces.home}
                </td>
                <td className="py-3 text-center font-digital text-base text-rose-400">
                  {doubleFaults.home}
                </td>
                <td className="py-3 text-center font-digital text-xl font-black text-primary">
                  {homeSetsWon}
                </td>
              </tr>

              {/* Away Row */}
              <tr>
                <td className="py-3 font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  {formatTeamOrPlayerName(teamAway)}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, i) => {
                  const set = setHistory[i];
                  const isCurrent = i === setHistory.length;
                  return (
                    <td
                      key={i}
                      className={`py-3 text-center font-digital text-base ${
                        set && set.away > set.home
                          ? "text-secondary font-bold"
                          : set
                          ? "text-on-surface-variant/70"
                          : isCurrent
                          ? "text-white font-bold"
                          : "text-on-surface-variant/20"
                      }`}
                    >
                      {set ? set.away : isCurrent ? games[1] : "-"}
                    </td>
                  );
                })}
                <td className="py-3 text-center font-digital text-base text-white">
                  {games[1]}
                </td>
                <td className="py-3 text-center font-digital text-base text-secondary">
                  {formatPoint(1)}
                </td>
                <td className="py-3 text-center font-digital text-base text-amber-300">
                  {aces.away}
                </td>
                <td className="py-3 text-center font-digital text-base text-rose-400">
                  {doubleFaults.away}
                </td>
                <td className="py-3 text-center font-digital text-xl font-black text-secondary">
                  {awaySetsWon}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Finalize Match Button */}
      {canEdit && (
        <div className="w-full flex justify-end">
          <button
            onClick={handleFinalizeMatch}
            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            Terminar Jogo
          </button>
        </div>
      )}
    </div>
  );
}
