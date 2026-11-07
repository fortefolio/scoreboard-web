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
        <div className="w-full bg-primary-container/20 border border-primary-container/30 rounded-2xl p-4 flex flex-col items-center mb-6 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary text-sm animate-bounce">paid</span>
            <span className="text-[10px] font-label font-black text-primary uppercase tracking-[0.2em]">
              Selecionar Servidor Inicial
            </span>
          </div>
          <div className="flex gap-4 w-full max-w-md">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                onClick={() => handleToss(idx)}
                disabled={isTossing || !canEdit}
                className="flex-1 bg-primary-container hover:brightness-110 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                {matchData.participants?.[idx]?.name || `Equipa ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Banner / Match Info */}
      <div className="w-full flex items-center justify-between py-3 px-6 bg-surface-container-low rounded-2xl border border-white/5 mb-6">
        <div className="flex items-center gap-2.5">
          <SportIcon sport={matchData.sport_type} className="text-secondary text-[20px]" />
          <div>
            <span className="text-[10px] font-label font-black uppercase tracking-widest text-secondary block">
              {isBeachVolleyball ? "Voleibol de Praia" : "Voleibol Oficial"}
            </span>
            <span className="text-sm font-bold text-on-surface">
              {matchData.tournaments?.name || "Jogo Isolado"}
            </span>
          </div>
        </div>

        {/* Set Tabs / Indicators */}
        <div className="flex items-center gap-2 bg-surface-container p-1 rounded-xl border border-white/5">
          {Array.from({ length: defaultMaxSets }).map((_, idx) => {
            const setNum = idx + 1;
            const isCurrent = setNum === currentSetNum;
            const isCompleted = setNum < currentSetNum;
            return (
              <span
                key={setNum}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                  isCurrent
                    ? "bg-primary text-on-primary shadow-md"
                    : isCompleted
                    ? "bg-surface-container-high text-secondary"
                    : "text-on-surface-variant/40"
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
        <div className="w-full mb-6 space-y-3">
          {isCourtSwitch && (
            <div className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
              <span className="material-symbols-outlined text-amber-400">sync_alt</span>
              <p className="text-amber-300 text-xs font-black uppercase tracking-widest">
                Troca de Campo Obrigatória aos {isBeachVolleyball ? "múltiplos de 7 pontos" : "8 pontos na negra"}!
              </p>
            </div>
          )}
          {isDeuce && (
            <div className="bg-amber-500/10 border border-amber-500/40 p-3 rounded-2xl flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-400">warning</span>
              <p className="text-amber-300 text-xs font-black uppercase tracking-widest">
                Vantagens (Deuce): Diferença de 2 pontos necessária!
              </p>
            </div>
          )}
          {isAdvantage && (
            <div className="bg-emerald-500/10 border border-emerald-500/40 p-3 rounded-2xl flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-400">sports_score</span>
              <p className="text-emerald-300 text-xs font-black uppercase tracking-widest">
                Ponto de Set (Set Point)!
              </p>
            </div>
          )}
          {isHardCapReached && (
            <div className="bg-rose-500/10 border border-rose-500/40 p-3 rounded-2xl flex items-center gap-3">
              <span className="material-symbols-outlined text-rose-400">report</span>
              <p className="text-rose-300 text-xs font-black uppercase tracking-widest">
                Limite de Pontos ({pointCap}): Ponto seguinte vence o set!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Scoreboard Display (3 Columns) */}
      <div className="w-full bg-[#0d1424] rounded-2xl sm:rounded-3xl border border-white/10 p-4 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          {/* HOME TEAM */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <h2 className="text-xl md:text-2xl font-headline font-black text-white truncate max-w-[240px]">
                {teamHome}
              </h2>
            </div>

            {/* Serving indicator */}
            {serverIdx === 0 && (
              <span className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-widest bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 animate-pulse mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                A Servir
              </span>
            )}

            {/* Home Score (Points in current set) */}
            <div className="text-7xl md:text-8xl font-digital text-white tracking-tighter my-2 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              {currentPoints.home}
            </div>

            {/* Sets Won & Timeouts */}
            <div className="flex items-center gap-3 text-xs mt-2">
              <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-white/5 font-bold">
                Sets: <span className="font-digital text-base text-primary font-black">{setsWon.home}</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-white/5">
                Descontos: <span className="font-digital text-sm">{timeouts.home}/2</span>
              </span>
            </div>

            {/* Quick Scoring & Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-[260px] mt-6">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePoint("home")}
                    className="py-3 bg-primary-container hover:brightness-110 text-on-primary-container font-black rounded-xl shadow-lg shadow-primary/20 transition-all text-sm flex items-center justify-center gap-1.5"
                    title="Ponto para Equipa da Casa"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    +1 Ponto
                  </button>
                  <button
                    onClick={() => handleUndoPoint("home")}
                    className="py-3 bg-surface-container-high hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 font-bold rounded-xl border border-white/5 transition-all text-xs"
                    title="Corrigir Ponto (-1)"
                  >
                    -1 Corrigir
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTimeout("home")}
                    disabled={timeouts.home <= 0}
                    className="py-1.5 bg-surface-container hover:bg-white/10 text-on-surface-variant rounded-lg border border-white/5 text-[11px] disabled:opacity-40"
                  >
                    Desconto
                  </button>
                  <button
                    onClick={() => setServerIdx(0)}
                    className="py-1.5 bg-surface-container hover:bg-white/10 text-on-surface-variant rounded-lg border border-white/5 text-[11px]"
                  >
                    Marcar Serviço
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: CURRENT SET & TARGET */}
          <div className="flex flex-col items-center justify-center py-4 border-y md:border-y-0 md:border-x border-white/10 px-4">
            <span className="text-secondary font-label text-xs font-black uppercase tracking-[0.3em] mb-2">
              {isDecidingSet ? "Set Decisivo (Negra)" : `Set ${currentSetNum}`}
            </span>

            {/* Target Points in Digital Font */}
            <div className="text-5xl md:text-6xl font-digital text-secondary tracking-tight py-2 px-5 rounded-2xl border border-secondary/30 bg-secondary/10 shadow-[0_0_20px_rgba(78,222,163,0.15)] mb-2">
              {activeLimit}
            </div>
            <span className="text-[10px] font-label uppercase font-black text-on-surface-variant/70 tracking-widest">
              Pontos Alvo
            </span>

            {/* Set Match Status Info */}
            <div className="flex items-center gap-3 mt-4 text-xs font-bold text-on-surface-variant/70">
              <span>Melhor de {defaultMaxSets} Sets</span>
              <span>•</span>
              <span>Diferença 2 Pts</span>
            </div>
          </div>

          {/* AWAY TEAM */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-secondary" />
              <h2 className="text-xl md:text-2xl font-headline font-black text-white truncate max-w-[240px]">
                {teamAway}
              </h2>
            </div>

            {/* Serving indicator */}
            {serverIdx === 1 && (
              <span className="flex items-center gap-1.5 text-secondary text-[10px] font-black uppercase tracking-widest bg-secondary/10 px-2.5 py-0.5 rounded-full border border-secondary/20 animate-pulse mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                A Servir
              </span>
            )}

            {/* Away Score (Points in current set) */}
            <div className="text-7xl md:text-8xl font-digital text-secondary tracking-tighter my-2 drop-shadow-[0_0_20px_rgba(78,222,163,0.15)]">
              {currentPoints.away}
            </div>

            {/* Sets Won & Timeouts */}
            <div className="flex items-center gap-3 text-xs mt-2">
              <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-white/5 font-bold">
                Sets: <span className="font-digital text-base text-secondary font-black">{setsWon.away}</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-white/5">
                Descontos: <span className="font-digital text-sm">{timeouts.away}/2</span>
              </span>
            </div>

            {/* Quick Scoring & Actions */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-[260px] mt-6">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePoint("away")}
                    className="py-3 bg-secondary hover:brightness-110 text-on-secondary font-black rounded-xl shadow-lg shadow-secondary/20 transition-all text-sm flex items-center justify-center gap-1.5"
                    title="Ponto para Equipa Visitante"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    +1 Ponto
                  </button>
                  <button
                    onClick={() => handleUndoPoint("away")}
                    className="py-3 bg-surface-container-high hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 font-bold rounded-xl border border-white/5 transition-all text-xs"
                    title="Corrigir Ponto (-1)"
                  >
                    -1 Corrigir
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTimeout("away")}
                    disabled={timeouts.away <= 0}
                    className="py-1.5 bg-surface-container hover:bg-white/10 text-on-surface-variant rounded-lg border border-white/5 text-[11px] disabled:opacity-40"
                  >
                    Desconto
                  </button>
                  <button
                    onClick={() => setServerIdx(1)}
                    className="py-1.5 bg-surface-container hover:bg-white/10 text-on-surface-variant rounded-lg border border-white/5 text-[11px]"
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
      <div className="w-full bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden p-5 mb-6">
        <h3 className="font-headline font-black text-xs uppercase tracking-wider text-on-surface-variant mb-4">
          Resumo por Set
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-white/5 text-on-surface-variant/70 text-xs uppercase font-label">
                <th className="py-2 px-4 text-left font-bold">Equipa</th>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => (
                  <th key={idx} className="py-2 px-3">S{idx + 1}</th>
                ))}
                <th className="py-2 px-4 font-black text-secondary">Sets</th>
                <th className="py-2 px-4 font-black text-on-surface">Total Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-digital text-base">
              <tr>
                <td className="py-3 px-4 text-left font-bold font-sans text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {teamHome}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.home : (setHistory[idx]?.home ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-primary font-black" : ""}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-black text-primary text-xl">{setsWon.home}</td>
                <td className="py-3 px-4 font-black text-on-surface text-lg">
                  {setHistory.reduce((sum, s) => sum + s.home, 0) + currentPoints.home}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-bold font-sans text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  {teamAway}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.away : (setHistory[idx]?.away ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-secondary font-black" : ""}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-black text-secondary text-xl">{setsWon.away}</td>
                <td className="py-3 px-4 font-black text-on-surface text-lg">
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
            className="px-5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Terminar Jogo
          </button>
        </div>
      )}
    </div>
  );
}
