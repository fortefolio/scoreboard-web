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
      <div className="w-full bg-surface-container rounded-xl border border-outline-variant p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <SportIcon sport={matchData.sport_type} className="w-4 h-4 text-text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">
                {isBeachVolleyball ? "Voleibol de Praia" : "Voleibol"}
              </span>
              <span className="text-xs text-text-muted">
                • {matchData?.tournaments?.name || "Jogo Isolado"}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-text-primary mt-0.5">
              {teamHome} <span className="text-text-muted font-normal">vs</span> {teamAway}
            </h2>
          </div>
        </div>

        {/* Set Navigator Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-lg border border-outline-variant">
          {Array.from({ length: defaultMaxSets }).map((_, idx) => {
            const setNum = idx + 1;
            const isCurrent = setNum === currentSetNum;
            const isCompleted = setNum < currentSetNum;
            return (
              <span
                key={setNum}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isCurrent
                    ? "bg-surface-container text-text-primary shadow-sm border border-outline-variant"
                    : isCompleted
                    ? "text-text-secondary"
                    : "text-text-muted/50"
                }`}
              >
                Set {setNum}
                {isCompleted && setHistory[idx] && (
                  <span className="ml-1.5 font-digital text-xs text-text-muted">
                    {setHistory[idx].home}-{setHistory[idx].away}
                  </span>
                )}
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
          <div className="flex flex-col items-center text-center order-2 md:order-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h2 className="text-lg md:text-xl font-semibold text-text-primary truncate max-w-[240px]">
                {teamHome}
              </h2>
            </div>

            {/* Serving / Receiving Indicator */}
            <div className="h-6 flex items-center mb-3">
              {serverIdx === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-container-high px-2 py-0.5 rounded-md border border-outline-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                  A Servir
                </span>
              ) : (
                <span className="inline-flex items-center text-text-muted text-xs font-medium px-2 py-0.5">
                  Receção
                </span>
              )}
            </div>

            {/* Sets Won & Timeouts Context Pills */}
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Sets: <span className="font-digital text-sm text-text-primary">{setsWon.home}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Descontos: <span className="font-digital text-sm text-text-primary">{timeouts.home}/2</span>
              </span>
            </div>

            {/* Home Big Point Score */}
            <div className="text-7xl sm:text-8xl md:text-9xl font-digital text-text-primary tracking-wider my-2 select-none">
              {currentPoints.home}
            </div>

            {/* Quick Scoring & Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePoint("home")}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 px-3 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    title="Ponto para Equipa da Casa"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Ponto
                  </button>
                  <button
                    onClick={() => handleUndoPoint("home")}
                    disabled={currentPoints.home <= 0}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-2 px-3 rounded-lg font-medium text-xs border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Corrigir Ponto (-1)"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    -1
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTimeout("home")}
                    disabled={timeouts.home <= 0}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Desconto
                  </button>
                  <button
                    onClick={() => setServerIdx(0)}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors cursor-pointer"
                  >
                    Marcar Serviço
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: CURRENT SET & TARGET */}
          <div className="flex flex-col items-center text-center order-1 md:order-2 py-4">
            <span className="text-xs font-medium text-text-muted mb-1.5">
              {isDecidingSet ? "Set Decisivo (Negra)" : `Set ${currentSetNum}`}
            </span>

            {/* Target Points */}
            <div className="flex items-center gap-3 my-2">
              <div className="text-3xl md:text-4xl font-digital text-text-primary py-2 px-6 rounded-xl bg-surface-container-high border border-outline-variant tracking-wide">
                {activeLimit}
              </div>
            </div>
            <span className="text-[11px] text-text-muted mt-1 font-medium">
              Pontos Alvo
            </span>

            {/* Set Match Status Info */}
            <div className="flex items-center gap-2 mt-3 text-xs text-text-muted">
              <span>Melhor de {defaultMaxSets} Sets</span>
              <span>•</span>
              <span>Diferença 2 Pts</span>
            </div>
          </div>

          {/* AWAY TEAM */}
          <div className="flex flex-col items-center text-center order-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <h2 className="text-lg md:text-xl font-semibold text-text-primary truncate max-w-[240px]">
                {teamAway}
              </h2>
            </div>

            {/* Serving / Receiving Indicator */}
            <div className="h-6 flex items-center mb-3">
              {serverIdx === 1 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-container-high px-2 py-0.5 rounded-md border border-outline-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                  A Servir
                </span>
              ) : (
                <span className="inline-flex items-center text-text-muted text-xs font-medium px-2 py-0.5">
                  Receção
                </span>
              )}
            </div>

            {/* Sets Won & Timeouts Context Pills */}
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Sets: <span className="font-digital text-sm text-text-primary">{setsWon.away}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
                Descontos: <span className="font-digital text-sm text-text-primary">{timeouts.away}/2</span>
              </span>
            </div>

            {/* Away Big Point Score */}
            <div className="text-7xl sm:text-8xl md:text-9xl font-digital text-text-primary tracking-wider my-2 select-none">
              {currentPoints.away}
            </div>

            {/* Quick Scoring & Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePoint("away")}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 px-3 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    title="Ponto para Equipa Visitante"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Ponto
                  </button>
                  <button
                    onClick={() => handleUndoPoint("away")}
                    disabled={currentPoints.away <= 0}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-2 px-3 rounded-lg font-medium text-xs border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Corrigir Ponto (-1)"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    -1
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTimeout("away")}
                    disabled={timeouts.away <= 0}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Desconto
                  </button>
                  <button
                    onClick={() => setServerIdx(1)}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors cursor-pointer"
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
      <div className="w-full bg-surface-container rounded-2xl border border-outline-variant overflow-hidden p-5 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
          Resumo por Set
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-text-muted text-xs font-medium">
                <th className="py-2.5 px-4 text-left">Equipa</th>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => (
                  <th key={idx} className="py-2.5 px-3">Set {idx + 1}</th>
                ))}
                <th className="py-2.5 px-4 font-semibold text-secondary">Sets</th>
                <th className="py-2.5 px-4 font-semibold text-text-primary">Total Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-digital text-base">
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {teamHome}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.home : (setHistory[idx]?.home ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-primary font-semibold" : "text-text-secondary"}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-semibold text-primary">{setsWon.home}</td>
                <td className="py-3 px-4 font-semibold text-text-primary">
                  {setHistory.reduce((sum, s) => sum + s.home, 0) + currentPoints.home}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  {teamAway}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.away : (setHistory[idx]?.away ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-secondary font-semibold" : "text-text-secondary"}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-semibold text-secondary">{setsWon.away}</td>
                <td className="py-3 px-4 font-semibold text-text-primary">
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
            className="h-9 px-4 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Terminar Jogo
          </button>
        </div>
      )}
    </div>
  );
}
