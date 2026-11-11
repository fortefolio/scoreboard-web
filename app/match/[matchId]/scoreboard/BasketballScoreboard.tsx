"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import SportIcon from "@/components/SportIcon";
import { recordMatchEventAtomic } from "@/lib/scoring/atomicScoring";

interface QuarterScore {
  home: number;
  away: number;
}

export default function BasketballScoreboard({
  matchData,
  canEdit,
  rules,
}: {
  matchData: any;
  canEdit: boolean;
  rules?: any;
}) {
  const defaultQuarterMinutes = rules?.quarter_minutes || 10;
  const defaultShotClock = rules?.shot_clock_seconds || 24;

  // Score & Game States
  const [scores, setScores] = useState({ home: 0, away: 0 });
  const [currentPeriod, setCurrentPeriod] = useState("Q1");
  const [quarters, setQuarters] = useState<QuarterScore[]>([
    { home: 0, away: 0 },
    { home: 0, away: 0 },
    { home: 0, away: 0 },
    { home: 0, away: 0 },
  ]);
  const [teamFouls, setTeamFouls] = useState({ home: 0, away: 0 });
  const [timeouts, setTimeouts] = useState({ home: 5, away: 5 });

  // Clock
  const [quarterSeconds, setQuarterSeconds] = useState(defaultQuarterMinutes * 60);
  const [isClockRunning, setIsClockRunning] = useState(false);
  const [shotClock, setShotClock] = useState(defaultShotClock);
  const [isShotClockRunning, setIsShotClockRunning] = useState(false);

  const clockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const teamHome = matchData?.participants?.[0]?.name || "Home";
  const teamAway = matchData?.participants?.[1]?.name || "Away";

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData?.scores) {
      setScores({
        home: matchData.scores.current?.home ?? 0,
        away: matchData.scores.current?.away ?? 0,
      });

      const bball = matchData.scores.basketball || {};
      if (bball.period) setCurrentPeriod(bball.period);
      if (Array.isArray(bball.quarters) && bball.quarters.length > 0) {
        setQuarters(bball.quarters);
      }
      if (bball.fouls) setTeamFouls(bball.fouls);
      if (bball.timeouts) setTimeouts(bball.timeouts);
      if (typeof bball.quarter_seconds === "number") setQuarterSeconds(bball.quarter_seconds);
      if (typeof bball.is_clock_running === "boolean") setIsClockRunning(bball.is_clock_running);
    }
  }, [matchData?.scores]);

  // Game Clock countdown interval
  useEffect(() => {
    if (isClockRunning) {
      clockTimerRef.current = setInterval(() => {
        setQuarterSeconds((prev) => {
          if (prev <= 1) {
            setIsClockRunning(false);
            return 0;
          }
          return prev - 1;
        });

        if (isShotClockRunning) {
          setShotClock((prev: number) => {
            if (prev <= 1) {
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (clockTimerRef.current) clearInterval(clockTimerRef.current);
    }

    return () => {
      if (clockTimerRef.current) clearInterval(clockTimerRef.current);
    };
  }, [isClockRunning, isShotClockRunning]);

  const formatClock = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getQuarterIndex = (period: string) => {
    switch (period) {
      case "Q1": return 0;
      case "Q2": return 1;
      case "Q3": return 2;
      case "Q4": return 3;
      case "OT": return 4;
      default: return 0;
    }
  };

  // Record points
  const handleScore = async (side: "home" | "away", points: number) => {
    if (!canEdit) return;

    const newHome = side === "home" ? Math.max(0, scores.home + points) : scores.home;
    const newAway = side === "away" ? Math.max(0, scores.away + points) : scores.away;
    setScores({ home: newHome, away: newAway });

    const qIdx = getQuarterIndex(currentPeriod);
    const updatedQuarters = [...quarters];
    while (updatedQuarters.length <= qIdx) {
      updatedQuarters.push({ home: 0, away: 0 });
    }
    updatedQuarters[qIdx] = {
      home: side === "home" ? Math.max(0, updatedQuarters[qIdx].home + points) : updatedQuarters[qIdx].home,
      away: side === "away" ? Math.max(0, updatedQuarters[qIdx].away + points) : updatedQuarters[qIdx].away,
    };
    setQuarters(updatedQuarters);

    // Reset shot clock on made basket
    setShotClock(24);

    const updatedScores = {
      ...matchData.scores,
      current: { home: newHome, away: newAway },
      basketball: {
        period: currentPeriod,
        quarters: updatedQuarters,
        fouls: teamFouls,
        timeouts,
        quarter_seconds: quarterSeconds,
        is_clock_running: isClockRunning,
      },
    };

    // Save event & score atomically
    const { error } = await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: updatedScores,
      eventData: {
        type: "point_scored",
        side,
        points,
        period: currentPeriod,
      },
    });

    if (error) {
      console.error("Error updating score:", error);
      toast.error("Erro ao gravar pontuação");
    }
  };

  // Toggle clock
  const toggleClock = () => {
    if (!canEdit) return;
    setIsClockRunning((prev) => !prev);
    setIsShotClockRunning((prev) => !prev);
  };

  // Reset shot clock
  const resetShotClock = (seconds: number) => {
    if (!canEdit) return;
    setShotClock(seconds);
  };

  // Change period
  const changePeriod = async (period: string) => {
    if (!canEdit) return;
    setCurrentPeriod(period);
    setQuarterSeconds(defaultQuarterMinutes * 60);
    setShotClock(defaultShotClock);
    setIsClockRunning(false);
    setIsShotClockRunning(false);
    setTeamFouls({ home: 0, away: 0 }); // Team fouls reset each quarter

    const updatedScores = {
      ...matchData.scores,
      basketball: {
        period,
        quarters,
        fouls: { home: 0, away: 0 },
        timeouts,
        quarter_seconds: defaultQuarterMinutes * 60,
        is_clock_running: false,
      },
    };

    await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: updatedScores,
      eventData: {
        type: "period_changed",
        period,
      },
    });

    toast.info(`Início de ${period}`);
  };

  // Add foul
  const addFoul = async (side: "home" | "away") => {
    if (!canEdit) return;
    const newFouls = { ...teamFouls, [side]: teamFouls[side] + 1 };
    setTeamFouls(newFouls);

    const updatedScores = {
      ...matchData.scores,
      basketball: {
        period: currentPeriod,
        quarters,
        fouls: newFouls,
        timeouts,
        quarter_seconds: quarterSeconds,
        is_clock_running: isClockRunning,
      },
    };

    await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: updatedScores,
      eventData: {
        type: "foul",
        side,
        fouls: newFouls,
      },
    });

    if (newFouls[side] >= 5) {
      toast.warning(`BÓNUS: Equipa de ${side === "home" ? teamHome : teamAway} atingiu 5 faltas!`);
    }
  };

  // Use timeout
  const useTimeout = async (side: "home" | "away") => {
    if (!canEdit || timeouts[side] <= 0) return;
    const newTimeouts = { ...timeouts, [side]: timeouts[side] - 1 };
    setTimeouts(newTimeouts);
    setIsClockRunning(false);

    const updatedScores = {
      ...matchData.scores,
      basketball: {
        period: currentPeriod,
        quarters,
        fouls: teamFouls,
        timeouts: newTimeouts,
        quarter_seconds: quarterSeconds,
        is_clock_running: false,
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

  // Finalize match
  const handleFinalizeMatch = async () => {
    if (!canEdit) return;
    if (confirm("Tens a certeza que queres terminar este jogo de Basquetebol?")) {
      const { error } = await recordMatchEventAtomic(supabase, {
        matchId: matchData.id,
        newStatus: "completed",
        eventData: {
          type: "match_finished",
        },
      });

      if (!error) {
        toast.success("Jogo terminado!");
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {/* Top Banner / Match Info */}
      <div className="w-full bg-surface-container rounded-xl border border-outline-variant p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <SportIcon sport="Basketball" className="w-4 h-4 text-text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">
                Basquetebol
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

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-lg border border-outline-variant">
          {["Q1", "Q2", "Q3", "Q4", "OT"].map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
              disabled={!canEdit}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                currentPeriod === p
                  ? "bg-surface-container text-text-primary shadow-sm border border-outline-variant"
                  : "text-text-muted hover:text-text-primary"
              } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scoreboard Display */}
      <div className="w-full bg-surface-container rounded-2xl border border-outline-variant p-6 md:p-8 relative overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* HOME TEAM */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h2 className="text-lg md:text-xl font-semibold text-text-primary truncate max-w-[240px]">
                {teamHome}
              </h2>
            </div>

            {/* Bonus Indicator / Spacing */}
            <div className="h-6 flex items-center mb-3">
              {teamFouls.home >= 5 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  Bónus Faltas
                </span>
              ) : (
                <span className="inline-flex items-center text-text-muted text-xs font-medium px-2 py-0.5">
                  Casa
                </span>
              )}
            </div>

            {/* Home Fouls & Timeouts */}
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className={`px-2.5 py-0.5 rounded-md border text-xs font-medium ${
                teamFouls.home >= 5
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : "bg-surface-container-high text-text-secondary border-outline-variant"
              }`}>
                Faltas: <span className="font-digital text-sm text-text-primary">{teamFouls.home}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant text-xs font-medium">
                Descontos: <span className="font-digital text-sm text-text-primary">{timeouts.home}</span>
              </span>
            </div>

            {/* Home Big Score */}
            <div className="text-7xl sm:text-8xl md:text-9xl font-digital text-text-primary tracking-wider my-2 select-none">
              {scores.home}
            </div>

            {/* Quick Scoring Buttons for Home */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => handleScore("home", 1)}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-text-primary font-digital text-base font-semibold rounded-lg border border-outline-variant transition-colors flex items-center justify-center cursor-pointer"
                    title="Lance Livre (+1)"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => handleScore("home", 2)}
                    className="h-10 bg-primary hover:bg-primary/90 text-on-primary font-digital text-base font-semibold rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                    title="Cesto (+2)"
                  >
                    +2
                  </button>
                  <button
                    onClick={() => handleScore("home", 3)}
                    className="h-10 bg-primary hover:bg-primary/90 text-on-primary font-digital text-base font-semibold rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                    title="Triplo (+3)"
                  >
                    +3
                  </button>
                  <button
                    onClick={() => handleScore("home", -1)}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-rose-400 font-digital text-base font-medium rounded-lg border border-outline-variant transition-colors flex items-center justify-center cursor-pointer"
                    title="Corrigir (-1)"
                  >
                    -1
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => addFoul("home")}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors cursor-pointer"
                  >
                    + Falta
                  </button>
                  <button
                    onClick={() => useTimeout("home")}
                    disabled={timeouts.home <= 0}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Desconto
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: CLOCK & PERIOD */}
          <div className="flex flex-col items-center text-center order-1 md:order-2 py-4">
            <span className="text-xs font-medium text-text-muted mb-1.5">
              {currentPeriod}
            </span>

            {/* Game Clock */}
            <div className="flex items-center gap-3 my-2">
              <div
                onClick={toggleClock}
                className="text-3xl md:text-4xl font-digital text-text-primary py-2 px-6 rounded-xl bg-surface-container-high border border-outline-variant tracking-wide cursor-pointer select-none"
                title="Clique para Iniciar/Pausar o Relógio"
              >
                {formatClock(quarterSeconds)}
              </div>
            </div>

            {/* Shot Clock (24s / 14s) */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="px-3 py-1 rounded-md bg-surface-container-high border border-outline-variant flex items-center gap-1.5 text-xs text-text-muted font-medium">
                <span>Posse:</span>
                <span
                  className={`font-digital text-base ${
                    shotClock <= 5 ? "text-rose-400" : "text-amber-400"
                  }`}
                >
                  {shotClock}s
                </span>
              </div>

              {canEdit && (
                <div className="flex gap-1">
                  <button
                    onClick={() => resetShotClock(24)}
                    className="h-7 px-2.5 text-xs font-digital font-medium bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary rounded-md border border-outline-variant transition-colors cursor-pointer"
                    title="Reset 24 segundos"
                  >
                    24s
                  </button>
                  <button
                    onClick={() => resetShotClock(14)}
                    className="h-7 px-2.5 text-xs font-digital font-medium bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary rounded-md border border-outline-variant transition-colors cursor-pointer"
                    title="Reset 14 segundos"
                  >
                    14s
                  </button>
                </div>
              )}
            </div>

            {/* Timer controls */}
            {canEdit && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={toggleClock}
                  className={`h-8 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
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
                  onClick={() => setQuarterSeconds(defaultQuarterMinutes * 60)}
                  className="h-8 px-2.5 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary rounded-lg border border-outline-variant transition-colors cursor-pointer flex items-center justify-center"
                  title="Repor Tempo"
                >
                  <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                </button>
              </div>
            )}
          </div>

          {/* AWAY TEAM */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right order-3">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-lg md:text-xl font-semibold text-text-primary truncate max-w-[240px]">
                {teamAway}
              </h2>
              <span className="w-2 h-2 rounded-full bg-secondary" />
            </div>

            {/* Bonus Indicator / Spacing */}
            <div className="h-6 flex items-center mb-3">
              {teamFouls.away >= 5 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  Bónus Faltas
                </span>
              ) : (
                <span className="inline-flex items-center text-text-muted text-xs font-medium px-2 py-0.5">
                  Visitante
                </span>
              )}
            </div>

            {/* Away Fouls & Timeouts */}
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant text-xs font-medium">
                Descontos: <span className="font-digital text-sm text-text-primary">{timeouts.away}</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-md border text-xs font-medium ${
                teamFouls.away >= 5
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : "bg-surface-container-high text-text-secondary border-outline-variant"
              }`}>
                Faltas: <span className="font-digital text-sm text-text-primary">{teamFouls.away}</span>
              </span>
            </div>

            {/* Away Big Score */}
            <div className="text-7xl sm:text-8xl md:text-9xl font-digital text-text-primary tracking-wider my-2 select-none">
              {scores.away}
            </div>

            {/* Quick Scoring Buttons for Away */}
            {canEdit && (
              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => handleScore("away", -1)}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-rose-400 font-digital text-base font-medium rounded-lg border border-outline-variant transition-colors flex items-center justify-center cursor-pointer"
                    title="Corrigir (-1)"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => handleScore("away", 3)}
                    className="h-10 bg-primary hover:bg-primary/90 text-on-primary font-digital text-base font-semibold rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                    title="Triplo (+3)"
                  >
                    +3
                  </button>
                  <button
                    onClick={() => handleScore("away", 2)}
                    className="h-10 bg-primary hover:bg-primary/90 text-on-primary font-digital text-base font-semibold rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                    title="Cesto (+2)"
                  >
                    +2
                  </button>
                  <button
                    onClick={() => handleScore("away", 1)}
                    className="h-10 bg-surface-container-high hover:bg-surface-container-highest text-text-primary font-digital text-base font-semibold rounded-lg border border-outline-variant transition-colors flex items-center justify-center cursor-pointer"
                    title="Lance Livre (+1)"
                  >
                    +1
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => useTimeout("away")}
                    disabled={timeouts.away <= 0}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Desconto
                  </button>
                  <button
                    onClick={() => addFoul("away")}
                    className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary py-1.5 px-2 rounded-lg font-medium text-[11px] border border-outline-variant transition-colors cursor-pointer"
                  >
                    + Falta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quarter by Quarter Breakdown Table */}
      <div className="w-full bg-surface-container rounded-2xl border border-outline-variant overflow-hidden p-5 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
          Resumo por Período
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-text-muted text-xs font-medium">
                <th className="py-2.5 px-4 text-left">Equipa</th>
                <th className="py-2.5 px-3">Q1</th>
                <th className="py-2.5 px-3">Q2</th>
                <th className="py-2.5 px-3">Q3</th>
                <th className="py-2.5 px-3">Q4</th>
                {quarters.length > 4 && <th className="py-2.5 px-3">OT</th>}
                <th className="py-2.5 px-4 font-semibold text-secondary">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-digital text-base">
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {teamHome}
                </td>
                <td className="py-3 px-3">{quarters[0]?.home ?? 0}</td>
                <td className="py-3 px-3">{quarters[1]?.home ?? 0}</td>
                <td className="py-3 px-3">{quarters[2]?.home ?? 0}</td>
                <td className="py-3 px-3">{quarters[3]?.home ?? 0}</td>
                {quarters.length > 4 && <td className="py-3 px-3">{quarters[4]?.home ?? 0}</td>}
                <td className="py-3 px-4 font-semibold text-primary">{scores.home}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  {teamAway}
                </td>
                <td className="py-3 px-3">{quarters[0]?.away ?? 0}</td>
                <td className="py-3 px-3">{quarters[1]?.away ?? 0}</td>
                <td className="py-3 px-3">{quarters[2]?.away ?? 0}</td>
                <td className="py-3 px-3">{quarters[3]?.away ?? 0}</td>
                {quarters.length > 4 && <td className="py-3 px-3">{quarters[4]?.away ?? 0}</td>}
                <td className="py-3 px-4 font-semibold text-secondary">{scores.away}</td>
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
