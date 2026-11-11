"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import SportIcon from "@/components/SportIcon";
import { recordMatchEventAtomic } from "@/lib/scoring/atomicScoring";

export default function VolleyballScoreboard({ 
  matchData, 
  rules, 
  canEdit 
}: { 
  matchData: any; 
  rules?: any;
  canEdit: boolean;
}) {
  const isBeachVolleyball = matchData?.sport_type === "Beach Volleyball";
  const defaultMaxSets = rules?.max_sets || (isBeachVolleyball ? 3 : 5);
  const defaultPointsPerSet = rules?.points_per_set || (isBeachVolleyball ? 21 : 25);
  const defaultDecidingPoints = rules?.deciding_set_points || 15;
  const pointCap = rules?.point_cap || null;

  // Scoring State
  const [currentPoints, setCurrentPoints] = useState({ home: 0, away: 0 });
  const [setsWon, setSetsWon] = useState({ home: 0, away: 0 });
  const [setHistory, setSetHistory] = useState<{ home: number; away: number }[]>([]);
  const [serverIdx, setServerIdx] = useState<number | null>(matchData?.scores?.serving_index ?? null);
  const [timeouts, setTimeouts] = useState({ home: 2, away: 2 });
  const [isTossing, setIsTossing] = useState(false);

  const teamHome = matchData?.participants?.[0]?.name || "Equipa A";
  const teamAway = matchData?.participants?.[1]?.name || "Equipa B";

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData?.scores) {
      setCurrentPoints({
        home: matchData.scores.current?.home ?? 0,
        away: matchData.scores.current?.away ?? 0,
      });

      const rawSets = matchData.scores.set_scores || matchData.scores.sets || [];
      const formattedSets = rawSets.map((s: any) => ({
        home: s.team1 ?? s.home ?? 0,
        away: s.team2 ?? s.away ?? 0,
      }));
      setSetHistory(formattedSets);

      // Count sets won
      let hWins = 0;
      let aWins = 0;
      formattedSets.forEach((s: any) => {
        if (s.home > s.away) hWins++;
        else if (s.away > s.home) aWins++;
      });
      setSetsWon({ home: hWins, away: aWins });

      setServerIdx(matchData.scores.serving_index ?? null);
      if (matchData.scores.volleyball?.timeouts) {
        setTimeouts(matchData.scores.volleyball.timeouts);
      }
    }
  }, [matchData?.scores]);

  const handleToss = async (selectedIdx: number) => {
    if (!canEdit) return;
    setServerIdx(selectedIdx);
    setIsTossing(true);
    
    const { error } = await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      eventData: { type: "start_scoreboard", initial_server_index: selectedIdx },
    });
    
    if (error) {
      console.error("Error setting server:", error);
      toast.error("Erro ao selecionar servidor");
    } else {
      toast.success(`Serviço inicial: ${selectedIdx === 0 ? teamHome : teamAway}`);
    }
    setIsTossing(false);
  };

  const handlePoint = async (side: "home" | "away") => {
    if (!canEdit) return;

    if (serverIdx === null) {
      toast.error("Por favor seleciona quem começa a servir!");
      return;
    }

    // Optimistic UI update
    setCurrentPoints((prev) => ({
      ...prev,
      [side]: prev[side] + 1,
    }));

    const { error } = await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      eventData: { 
        type: "point_won", 
        side,
      },
    });

    if (error) {
      console.error("Error recording point:", error);
      toast.error("Erro ao registar ponto");
    }
  };

  const handleUndoPoint = async (side: "home" | "away") => {
    if (!canEdit || currentPoints[side] <= 0) return;

    const newPoints = {
      ...currentPoints,
      [side]: Math.max(0, currentPoints[side] - 1),
    };
    setCurrentPoints(newPoints);

    const updatedScores = {
      ...matchData.scores,
      current: newPoints,
    };

    await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: updatedScores,
      eventData: {
        type: "correct_score",
        side,
        current: newPoints,
      },
    });

    toast.info("Ponto corrigido (-1)");
  };

  const handleTimeout = async (side: "home" | "away") => {
    if (!canEdit || timeouts[side] <= 0) return;
    const newTimeouts = { ...timeouts, [side]: timeouts[side] - 1 };
    setTimeouts(newTimeouts);

    const updatedScores = {
      ...matchData.scores,
      volleyball: {
        ...(matchData.scores?.volleyball || {}),
        timeouts: newTimeouts,
      },
    };

    await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: updatedScores,
      eventData: {
        type: "timeout",
        side,
        timeouts: newTimeouts,
      },
    });

    toast.info(`Desconto de tempo pedido por ${side === "home" ? teamHome : teamAway}`);
  };

  const handleFinalizeMatch = async () => {
    if (!canEdit) return;
    if (confirm("Tens a certeza que queres terminar este encontro de Voleibol?")) {
      const { error } = await recordMatchEventAtomic(supabase, {
        matchId: matchData.id,
        newStatus: "completed",
        eventData: {
          type: "match_finished",
        },
      });

      if (!error) {
        toast.success("Encontro terminado!");
      }
    }
  };

  const currentSetNum = setHistory.length + 1;
  const isDecidingSet = currentSetNum === defaultMaxSets;
  const activeLimit = isDecidingSet ? defaultDecidingPoints : defaultPointsPerSet;

  // Alerts logic
  const isDeuce = 
    currentPoints.home >= activeLimit - 1 && 
    currentPoints.away >= activeLimit - 1 &&
    currentPoints.home === currentPoints.away &&
    (!pointCap || currentPoints.home < pointCap - 1);

  const isAdvantage = 
    (currentPoints.home >= activeLimit || currentPoints.away >= activeLimit) && 
    Math.abs(currentPoints.home - currentPoints.away) === 1 &&
    (!pointCap || (currentPoints.home < pointCap && currentPoints.away < pointCap));

  const isHardCapReached = pointCap && 
    currentPoints.home >= pointCap - 1 && 
    currentPoints.away >= pointCap - 1;

  // Court switch reminder (e.g. at 8 points in deciding 5th set, or multiples of 7 in beach volleyball)
  const isCourtSwitch = isBeachVolleyball
    ? (currentPoints.home + currentPoints.away) > 0 && (currentPoints.home + currentPoints.away) % 7 === 0
    : isDecidingSet && (currentPoints.home === 8 || currentPoints.away === 8);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {/* Toss Server Banner if serverIdx is null */}
      {serverIdx === null && (
        <div className="w-full bg-primary/10 border border-primary/25 rounded-2xl p-4 flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary text-base">paid</span>
            <span className="text-xs font-semibold text-primary">
              Selecionar Servidor Inicial
            </span>
          </div>
          <div className="flex gap-3 w-full max-w-md">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                onClick={() => handleToss(idx)}
                disabled={isTossing || !canEdit}
                className="flex-1 h-9 bg-primary hover:bg-primary/90 text-on-primary rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {matchData.participants?.[idx]?.name || `Equipa ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Banner / Match Info */}
      <div className="w-full flex items-center justify-between py-3 px-5 bg-surface-container-low rounded-2xl border border-outline-variant mb-6">
        <div className="flex items-center gap-3">
          <SportIcon sport={matchData.sport_type} className="text-secondary text-lg" />
          <div>
            <span className="text-[11px] font-medium text-on-surface-variant block">
              {isBeachVolleyball ? "Voleibol de Praia" : "Voleibol Oficial"}
            </span>
            <span className="text-sm font-semibold text-on-surface">
              {matchData.tournaments?.name || "Jogo Isolado"}
            </span>
          </div>
        </div>

        {/* Set Tabs / Indicators */}
        <div className="flex items-center gap-1 bg-surface-container-high/60 p-1 rounded-xl border border-outline-variant">
          {Array.from({ length: defaultMaxSets }).map((_, idx) => {
            const setNum = idx + 1;
            const isCurrent = setNum === currentSetNum;
            const isCompleted = setNum < currentSetNum;
            return (
              <span
                key={setNum}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isCurrent
                    ? "bg-primary text-on-primary"
                    : isCompleted
                    ? "bg-surface-container-highest text-secondary"
                    : "text-on-surface-variant/50"
                }`}
              >
                S{setNum}
              </span>
            );
          })}
        </div>
      </div>

      {/* Alert Banners */}
      {(isCourtSwitch || isDeuce || isAdvantage || isHardCapReached) && (
        <div className="w-full mb-6 space-y-2.5">
          {isCourtSwitch && (
            <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-base">sync_alt</span>
              <p className="text-amber-200 text-xs font-medium">
                Troca de Campo Obrigatória aos {isBeachVolleyball ? "múltiplos de 7 pontos" : "8 pontos na negra"}
              </p>
            </div>
          )}
          {isDeuce && (
            <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-base">warning</span>
              <p className="text-amber-200 text-xs font-medium">
                Vantagens (Deuce): Diferença de 2 pontos necessária
              </p>
            </div>
          )}
          {isAdvantage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-400 text-base">sports_score</span>
              <p className="text-emerald-200 text-xs font-medium">
                Ponto de Set (Set Point)
              </p>
            </div>
          )}
          {isHardCapReached && (
            <div className="bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2.5">
              <span className="material-symbols-outlined text-rose-400 text-base">report</span>
              <p className="text-rose-200 text-xs font-medium">
                Limite de Pontos ({pointCap}): Ponto seguinte vence o set
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Scoreboard Display (3 Columns) */}
      <div className="w-full bg-surface-container rounded-2xl border border-outline-variant p-6 md:p-8 relative overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          {/* HOME TEAM */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <h2 className="text-lg md:text-xl font-headline font-semibold text-on-surface truncate max-w-[240px]">
                {teamHome}
              </h2>
            </div>

            {/* Serving indicator */}
            {serverIdx === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-primary text-[11px] font-medium bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                A Servir
              </span>
            ) : (
              <span className="h-[23px] mb-1" />
            )}

            {/* Home Score (Points in current set) */}
            <div className="text-6xl md:text-7xl font-mono tabular-nums font-semibold text-on-surface tracking-tight my-2">
              {currentPoints.home}
            </div>

            {/* Sets Won & Timeouts */}
            <div className="flex items-center gap-2 text-xs mt-2">
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant font-medium">
                Sets: <span className="font-mono tabular-nums font-semibold text-on-surface">{setsWon.home}</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant font-medium">
                Descontos: <span className="font-mono tabular-nums">{timeouts.home}/2</span>
              </span>
            </div>

            {/* Quick Scoring & Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-[260px] mt-6">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePoint("home")}
                    className="h-10 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-lg transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer"
                    title="Ponto para Equipa da Casa"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Ponto
                  </button>
                  <button
                    onClick={() => handleUndoPoint("home")}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-rose-400 font-medium rounded-lg border border-outline-variant transition-colors text-xs cursor-pointer"
                    title="Corrigir Ponto (-1)"
                  >
                    -1 Corrigir
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTimeout("home")}
                    disabled={timeouts.home <= 0}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium disabled:opacity-40 cursor-pointer"
                  >
                    Desconto
                  </button>
                  <button
                    onClick={() => setServerIdx(0)}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium cursor-pointer"
                  >
                    Marcar Serviço
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: CURRENT SET & TARGET */}
          <div className="flex flex-col items-center justify-center py-4 border-y md:border-y-0 md:border-x border-outline-variant px-4">
            <span className="text-on-surface-variant text-xs font-medium mb-2">
              {isDecidingSet ? "Set Decisivo (Negra)" : `Set ${currentSetNum}`}
            </span>

            {/* Target Points */}
            <div className="text-4xl md:text-5xl font-mono tabular-nums font-semibold text-secondary py-2 px-5 rounded-xl border border-outline-variant bg-surface-container-high/60 mb-2">
              {activeLimit}
            </div>
            <span className="text-[11px] font-medium text-on-surface-variant/80">
              Pontos Alvo
            </span>

            {/* Set Match Status Info */}
            <div className="flex items-center gap-2 mt-4 text-xs text-on-surface-variant">
              <span>Melhor de {defaultMaxSets} Sets</span>
              <span>•</span>
              <span>Diferença 2 Pts</span>
            </div>
          </div>

          {/* AWAY TEAM */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              <h2 className="text-lg md:text-xl font-headline font-semibold text-on-surface truncate max-w-[240px]">
                {teamAway}
              </h2>
            </div>

            {/* Serving indicator */}
            {serverIdx === 1 ? (
              <span className="inline-flex items-center gap-1.5 text-secondary text-[11px] font-medium bg-secondary/10 px-2.5 py-0.5 rounded-md border border-secondary/20 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                A Servir
              </span>
            ) : (
              <span className="h-[23px] mb-1" />
            )}

            {/* Away Score (Points in current set) */}
            <div className="text-6xl md:text-7xl font-mono tabular-nums font-semibold text-on-surface tracking-tight my-2">
              {currentPoints.away}
            </div>

            {/* Sets Won & Timeouts */}
            <div className="flex items-center gap-2 text-xs mt-2">
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant font-medium">
                Sets: <span className="font-mono tabular-nums font-semibold text-on-surface">{setsWon.away}</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant font-medium">
                Descontos: <span className="font-mono tabular-nums">{timeouts.away}/2</span>
              </span>
            </div>

            {/* Quick Scoring & Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-[260px] mt-6">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePoint("away")}
                    className="h-10 bg-secondary hover:bg-secondary/90 text-on-secondary font-medium rounded-lg transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer"
                    title="Ponto para Equipa Visitante"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Ponto
                  </button>
                  <button
                    onClick={() => handleUndoPoint("away")}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-rose-400 font-medium rounded-lg border border-outline-variant transition-colors text-xs cursor-pointer"
                    title="Corrigir Ponto (-1)"
                  >
                    -1 Corrigir
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTimeout("away")}
                    disabled={timeouts.away <= 0}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium disabled:opacity-40 cursor-pointer"
                  >
                    Desconto
                  </button>
                  <button
                    onClick={() => setServerIdx(1)}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium cursor-pointer"
                  >
                    Marcar Serviço
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Set by Set Breakdown Table */}
      <div className="w-full bg-surface-container-low rounded-2xl border border-outline-variant overflow-hidden p-5 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-4">
          Resumo por Set
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant/80 text-xs font-medium">
                <th className="py-2.5 px-4 text-left">Equipa</th>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => (
                  <th key={idx} className="py-2.5 px-3">S{idx + 1}</th>
                ))}
                <th className="py-2.5 px-4 font-semibold text-secondary">Sets</th>
                <th className="py-2.5 px-4 font-semibold text-on-surface">Total Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 font-mono tabular-nums text-sm">
              <tr>
                <td className="py-3 px-4 text-left font-sans text-on-surface font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {teamHome}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.home : (setHistory[idx]?.home ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-primary font-semibold" : "text-on-surface-variant"}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-semibold text-primary">{setsWon.home}</td>
                <td className="py-3 px-4 font-semibold text-on-surface">
                  {setHistory.reduce((sum, s) => sum + s.home, 0) + currentPoints.home}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-sans text-on-surface font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  {teamAway}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.away : (setHistory[idx]?.away ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-secondary font-semibold" : "text-on-surface-variant"}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-semibold text-secondary">{setsWon.away}</td>
                <td className="py-3 px-4 font-semibold text-on-surface">
                  {setHistory.reduce((sum, s) => sum + s.away, 0) + currentPoints.away}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Controls / Finalize */}
      {canEdit && (
        <div className="w-full flex justify-end gap-3">
          <button
            onClick={handleFinalizeMatch}
            className="h-9 px-4 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            Terminar Jogo
          </button>
        </div>
      )}
    </div>
  );
}
