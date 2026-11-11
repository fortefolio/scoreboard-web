"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import SportIcon from "@/components/SportIcon";
import { recordMatchEventAtomic } from "@/lib/scoring/atomicScoring";

export default function FootballScoreboard({ 
  matchData, 
  canEdit 
}: { 
  matchData: any; 
  canEdit: boolean;
}) {
  // Scoring & Match State
  const [goals, setGoals] = useState({ home: 0, away: 0 });
  const [period, setPeriod] = useState("1ª Parte");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isClockRunning, setIsClockRunning] = useState(false);
  const [stoppageMinutes, setStoppageMinutes] = useState(0);

  // Stats
  const [yellowCards, setYellowCards] = useState({ home: 0, away: 0 });
  const [redCards, setRedCards] = useState({ home: 0, away: 0 });
  const [corners, setCorners] = useState({ home: 0, away: 0 });
  const [fouls, setFouls] = useState({ home: 0, away: 0 });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const teamHome = matchData?.participants?.[0]?.name || "Home";
  const teamAway = matchData?.participants?.[1]?.name || "Away";

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData?.scores) {
      setGoals({
        home: matchData.scores.current?.home ?? matchData.scores.football?.goals?.[0] ?? 0,
        away: matchData.scores.current?.away ?? matchData.scores.football?.goals?.[1] ?? 0,
      });

      const fb = matchData.scores.football || {};
      if (fb.period) setPeriod(fb.period);
      if (typeof fb.elapsed_seconds === "number") setElapsedSeconds(fb.elapsed_seconds);
      if (typeof fb.is_clock_running === "boolean") setIsClockRunning(fb.is_clock_running);
      if (typeof fb.stoppage_minutes === "number") setStoppageMinutes(fb.stoppage_minutes);
      if (fb.yellow_cards) setYellowCards(fb.yellow_cards);
      if (fb.red_cards) setRedCards(fb.red_cards);
      if (fb.corners) setCorners(fb.corners);
      if (fb.fouls) setFouls(fb.fouls);
    }
  }, [matchData?.scores]);

  // Local Clock Logic
  useEffect(() => {
    if (isClockRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isClockRunning]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const persistFootballState = async (updates: any, eventData?: Record<string, any>) => {
    const newGoals = updates.goals || goals;
    const newPeriod = updates.period || period;
    const newElapsed = typeof updates.elapsedSeconds === "number" ? updates.elapsedSeconds : elapsedSeconds;
    const newClockRunning = typeof updates.isClockRunning === "boolean" ? updates.isClockRunning : isClockRunning;
    const newStoppage = typeof updates.stoppageMinutes === "number" ? updates.stoppageMinutes : stoppageMinutes;
    const newYellow = updates.yellowCards || yellowCards;
    const newRed = updates.redCards || redCards;
    const newCorners = updates.corners || corners;
    const newFouls = updates.fouls || fouls;

    const newScores = {
      ...matchData.scores,
      current: { home: newGoals.home, away: newGoals.away },
      goals: [newGoals.home, newGoals.away],
      football: {
        goals: [newGoals.home, newGoals.away],
        period: newPeriod,
        elapsed_seconds: newElapsed,
        is_clock_running: newClockRunning,
        stoppage_minutes: newStoppage,
        yellow_cards: newYellow,
        red_cards: newRed,
        corners: newCorners,
        fouls: newFouls,
      },
    };

    if (eventData) {
      await recordMatchEventAtomic(supabase, {
        matchId: matchData.id,
        newScores,
        eventData,
      });
    } else {
      await supabase
        .from("matches")
        .update({
          scores: newScores,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchData.id);
    }
  };

  const handleGoal = async (side: "home" | "away", delta: number = 1) => {
    if (!canEdit) return;

    const newGoals = {
      ...goals,
      [side]: Math.max(0, goals[side] + delta),
    };
    setGoals(newGoals);

    if (delta > 0) {
      const eventData = { 
        type: "goal", 
        side,
        period,
        minute: Math.floor(elapsedSeconds / 60) + 1,
      };
      toast.success(`GOLO! ${side === "home" ? teamHome : teamAway}`);
      await persistFootballState({ goals: newGoals }, eventData);
    } else {
      await persistFootballState({ goals: newGoals });
    }
  };

  const toggleClock = async () => {
    if (!canEdit) return;
    const nextRunningState = !isClockRunning;
    setIsClockRunning(nextRunningState);

    await supabase.from("match_events").insert([
      {
        match_id: matchData.id,
        event_data: { 
          type: "clock_toggle", 
          is_running: nextRunningState,
          elapsed_seconds: elapsedSeconds,
        },
      },
    ]);

    await persistFootballState({ isClockRunning: nextRunningState, elapsedSeconds });
  };

  const changePeriod = async (newPeriod: string) => {
    if (!canEdit) return;
    setPeriod(newPeriod);

    // Auto-adjust default times
    let newSeconds = elapsedSeconds;
    if (newPeriod === "1ª Parte" && elapsedSeconds === 0) newSeconds = 0;
    if (newPeriod === "2ª Parte" && elapsedSeconds < 45 * 60) newSeconds = 45 * 60;
    if (newPeriod === "Intervalo") setIsClockRunning(false);
    if (newPeriod === "Fim do Jogo") setIsClockRunning(false);

    setElapsedSeconds(newSeconds);

    await supabase.from("match_events").insert([
      {
        match_id: matchData.id,
        event_data: { 
          type: "period_change", 
          period: newPeriod,
          elapsed_seconds: newSeconds,
        },
      },
    ]);

    await persistFootballState({ 
      period: newPeriod, 
      elapsedSeconds: newSeconds,
      isClockRunning: newPeriod === "Intervalo" || newPeriod === "Fim do Jogo" ? false : isClockRunning,
    });
    toast.info(`Período: ${newPeriod}`);
  };

  const handleCard = async (side: "home" | "away", cardType: "yellow" | "red") => {
    if (!canEdit) return;

    if (cardType === "yellow") {
      const updated = { ...yellowCards, [side]: yellowCards[side] + 1 };
      setYellowCards(updated);
      await persistFootballState({ yellowCards: updated });
      toast.warning(`Cartão Amarelo para ${side === "home" ? teamHome : teamAway}`);
    } else {
      const updated = { ...redCards, [side]: redCards[side] + 1 };
      setRedCards(updated);
      await persistFootballState({ redCards: updated });
      toast.error(`CARTÃO VERMELHO para ${side === "home" ? teamHome : teamAway}!`);
    }

    await supabase.from("match_events").insert([
      {
        match_id: matchData.id,
        event_data: { 
          type: "card", 
          card: cardType,
          side,
          period,
          minute: Math.floor(elapsedSeconds / 60) + 1,
        },
      },
    ]);
  };

  const handleStat = async (side: "home" | "away", statType: "corner" | "foul") => {
    if (!canEdit) return;

    if (statType === "corner") {
      const updated = { ...corners, [side]: corners[side] + 1 };
      setCorners(updated);
      await persistFootballState({ corners: updated });
    } else {
      const updated = { ...fouls, [side]: fouls[side] + 1 };
      setFouls(updated);
      await persistFootballState({ fouls: updated });
    }
  };

  const handleFinalizeMatch = async () => {
    if (!canEdit) return;
    if (confirm("Tens a certeza que queres terminar este jogo de Futebol?")) {
      setIsClockRunning(false);
      setPeriod("Fim do Jogo");
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

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {/* Top Banner / Match Info */}
      <div className="w-full flex items-center justify-between py-3 px-5 bg-surface-container-low rounded-2xl border border-outline-variant mb-6">
        <div className="flex items-center gap-3">
          <SportIcon sport="Football" className="text-secondary text-lg" />
          <div>
            <span className="text-[11px] font-medium text-on-surface-variant block">
              Futebol Oficial
            </span>
            <span className="text-sm font-semibold text-on-surface">
              {matchData.tournaments?.name || "Jogo Isolado"}
            </span>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-high/60 p-1 rounded-xl border border-outline-variant">
          {["1ª Parte", "Intervalo", "2ª Parte", "Prolongamento", "Penáltis", "Fim"].map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
              disabled={!canEdit}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

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

            {/* Home Score (Goals) */}
            <div className="text-6xl md:text-7xl font-mono tabular-nums font-semibold text-on-surface tracking-tight my-2">
              {goals.home}
            </div>

            {/* Home Discipline Pills */}
            <div className="flex items-center gap-2 text-xs mt-2">
              {yellowCards.home > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1">
                  <span className="w-2 h-3 bg-amber-400 rounded-xs inline-block" />
                  <span className="font-mono tabular-nums">{yellowCards.home}</span>
                </span>
              )}
              {redCards.home > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1">
                  <span className="w-2 h-3 bg-rose-500 rounded-xs inline-block" />
                  <span className="font-mono tabular-nums">{redCards.home}</span>
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant text-[11px] font-medium">
                Cantos: <span className="font-mono tabular-nums">{corners.home}</span> • Faltas: <span className="font-mono tabular-nums">{fouls.home}</span>
              </span>
            </div>

            {/* Quick Scoring & Action Buttons */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-[260px] mt-6">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleGoal("home", 1)}
                    className="h-10 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Registar Golo (+1)"
                  >
                    <span className="material-symbols-outlined text-base">sports_soccer</span>
                    Golo
                  </button>
                  <button
                    onClick={() => handleGoal("home", -1)}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-rose-400 font-medium rounded-lg border border-outline-variant transition-colors text-xs cursor-pointer"
                    title="Anular Golo (-1)"
                  >
                    -1 Corrigir
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => handleCard("home", "yellow")}
                    className="h-8 bg-surface-container-high hover:bg-amber-500/20 text-amber-300 border border-outline-variant rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    title="Cartão Amarelo"
                  >
                    Amarelo
                  </button>
                  <button
                    onClick={() => handleCard("home", "red")}
                    className="h-8 bg-surface-container-high hover:bg-rose-500/20 text-rose-300 border border-outline-variant rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    title="Cartão Vermelho"
                  >
                    Vermelho
                  </button>
                  <button
                    onClick={() => handleStat("home", "corner")}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium transition-colors cursor-pointer"
                    title="+1 Canto"
                  >
                    + Canto
                  </button>
                  <button
                    onClick={() => handleStat("home", "foul")}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium transition-colors cursor-pointer"
                    title="+1 Falta"
                  >
                    + Falta
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: MATCH CLOCK & PERIOD */}
          <div className="flex flex-col items-center justify-center py-4 border-y md:border-y-0 md:border-x border-outline-variant px-4">
            <span className="text-on-surface-variant text-xs font-medium mb-2">
              {period}
            </span>

            {/* Match Clock */}
            <div
              onClick={toggleClock}
              className={`text-4xl md:text-5xl font-mono tabular-nums font-semibold tracking-tight cursor-pointer select-none py-2 px-5 rounded-xl border transition-colors ${
                isClockRunning
                  ? "text-secondary border-secondary/40 bg-secondary/10"
                  : "text-on-surface border-outline-variant bg-surface-container-high/60 hover:border-outline-variant/80"
              }`}
              title="Clique para Iniciar/Pausar o Cronómetro"
            >
              {formatTime(elapsedSeconds)}
            </div>

            {/* Stoppage Time Badge */}
            {stoppageMinutes > 0 && (
              <span className="mt-2 text-xs font-mono tabular-nums text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                +{stoppageMinutes} min compensação
              </span>
            )}

            {/* Timer controls */}
            {canEdit && (
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={toggleClock}
                  className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isClockRunning
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-primary text-on-primary hover:bg-primary/90"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isClockRunning ? "pause" : "play_arrow"}
                  </span>
                  {isClockRunning ? "Pausar" : "Iniciar"}
                </button>
                
                <button
                  onClick={() => {
                    const nextStoppage = (stoppageMinutes + 1) % 10;
                    setStoppageMinutes(nextStoppage);
                    persistFootballState({ stoppageMinutes: nextStoppage });
                  }}
                  className="h-8 px-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-medium rounded-lg border border-outline-variant transition-colors cursor-pointer"
                  title="Ajustar Minutos de Compensação"
                >
                  +1m
                </button>

                <button
                  onClick={() => {
                    const baseSecs = period === "2ª Parte" ? 45 * 60 : 0;
                    setElapsedSeconds(baseSecs);
                    persistFootballState({ elapsedSeconds: baseSecs });
                  }}
                  className="h-8 px-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant transition-colors cursor-pointer flex items-center justify-center"
                  title="Repor Tempo Base"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                </button>
              </div>
            )}
          </div>

          {/* AWAY TEAM */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              <h2 className="text-lg md:text-xl font-headline font-semibold text-on-surface truncate max-w-[240px]">
                {teamAway}
              </h2>
            </div>

            {/* Away Score (Goals) */}
            <div className="text-6xl md:text-7xl font-mono tabular-nums font-semibold text-on-surface tracking-tight my-2">
              {goals.away}
            </div>

            {/* Away Discipline Pills */}
            <div className="flex items-center gap-2 text-xs mt-2">
              {yellowCards.away > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1">
                  <span className="w-2 h-3 bg-amber-400 rounded-xs inline-block" />
                  <span className="font-mono tabular-nums">{yellowCards.away}</span>
                </span>
              )}
              {redCards.away > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1">
                  <span className="w-2 h-3 bg-rose-500 rounded-xs inline-block" />
                  <span className="font-mono tabular-nums">{redCards.away}</span>
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant text-[11px] font-medium">
                Cantos: <span className="font-mono tabular-nums">{corners.away}</span> • Faltas: <span className="font-mono tabular-nums">{fouls.away}</span>
              </span>
            </div>

            {/* Quick Scoring & Action Buttons */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-[260px] mt-6">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleGoal("away", 1)}
                    className="h-10 bg-secondary hover:bg-secondary/90 text-on-secondary font-medium rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Registar Golo (+1)"
                  >
                    <span className="material-symbols-outlined text-base">sports_soccer</span>
                    Golo
                  </button>
                  <button
                    onClick={() => handleGoal("away", -1)}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-rose-400 font-medium rounded-lg border border-outline-variant transition-colors text-xs cursor-pointer"
                    title="Anular Golo (-1)"
                  >
                    -1 Corrigir
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => handleCard("away", "yellow")}
                    className="h-8 bg-surface-container-high hover:bg-amber-500/20 text-amber-300 border border-outline-variant rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    title="Cartão Amarelo"
                  >
                    Amarelo
                  </button>
                  <button
                    onClick={() => handleCard("away", "red")}
                    className="h-8 bg-surface-container-high hover:bg-rose-500/20 text-rose-300 border border-outline-variant rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    title="Cartão Vermelho"
                  >
                    Vermelho
                  </button>
                  <button
                    onClick={() => handleStat("away", "corner")}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium transition-colors cursor-pointer"
                    title="+1 Canto"
                  >
                    + Canto
                  </button>
                  <button
                    onClick={() => handleStat("away", "foul")}
                    className="h-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant text-[11px] font-medium transition-colors cursor-pointer"
                    title="+1 Falta"
                  >
                    + Falta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Match Statistics & Summary Table */}
      <div className="w-full bg-surface-container-low rounded-2xl border border-outline-variant overflow-hidden p-5 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-4">
          Estatísticas Oficiais do Encontro
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant/80 text-xs font-medium">
                <th className="py-2.5 px-4 text-left">Equipa</th>
                <th className="py-2.5 px-3">Golos</th>
                <th className="py-2.5 px-3">Amarelos</th>
                <th className="py-2.5 px-3">Vermelhos</th>
                <th className="py-2.5 px-3">Cantos</th>
                <th className="py-2.5 px-3">Faltas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 font-mono tabular-nums text-sm">
              <tr>
                <td className="py-3 px-4 text-left font-sans text-on-surface font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {teamHome}
                </td>
                <td className="py-3 px-3 text-primary font-semibold text-base">{goals.home}</td>
                <td className="py-3 px-3 text-amber-400">{yellowCards.home}</td>
                <td className="py-3 px-3 text-rose-400">{redCards.home}</td>
                <td className="py-3 px-3 text-on-surface-variant">{corners.home}</td>
                <td className="py-3 px-3 text-on-surface-variant">{fouls.home}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-sans text-on-surface font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  {teamAway}
                </td>
                <td className="py-3 px-3 text-secondary font-semibold text-base">{goals.away}</td>
                <td className="py-3 px-3 text-amber-400">{yellowCards.away}</td>
                <td className="py-3 px-3 text-rose-400">{redCards.away}</td>
                <td className="py-3 px-3 text-on-surface-variant">{corners.away}</td>
                <td className="py-3 px-3 text-on-surface-variant">{fouls.away}</td>
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
