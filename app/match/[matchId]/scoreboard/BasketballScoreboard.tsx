"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import SportIcon from "@/components/SportIcon";

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

    // Save event
    const { error } = await supabase.from("match_events").insert([
      {
        match_id: matchData.id,
        event_data: {
          type: "point_scored",
          side,
          points,
          period: currentPeriod,
        },
      },
    ]);

    if (error) {
      console.error("Error updating score:", error);
      toast.error("Erro ao gravar pontuação");
    }

    // Persist basketball context in match scores
    await supabase
      .from("matches")
      .update({
        scores: {
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
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchData.id);
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

    await supabase
      .from("matches")
      .update({
        scores: {
          ...matchData.scores,
          basketball: {
            period,
            quarters,
            fouls: { home: 0, away: 0 },
            timeouts,
            quarter_seconds: defaultQuarterMinutes * 60,
            is_clock_running: false,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchData.id);

    toast.info(`Início de ${period}`);
  };

  // Add foul
  const addFoul = async (side: "home" | "away") => {
    if (!canEdit) return;
    const newFouls = { ...teamFouls, [side]: teamFouls[side] + 1 };
    setTeamFouls(newFouls);

    await supabase
      .from("matches")
      .update({
        scores: {
          ...matchData.scores,
          basketball: {
            period: currentPeriod,
            quarters,
            fouls: newFouls,
            timeouts,
            quarter_seconds: quarterSeconds,
            is_clock_running: isClockRunning,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchData.id);

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

    await supabase
      .from("matches")
      .update({
        scores: {
          ...matchData.scores,
          basketball: {
            period: currentPeriod,
            quarters,
            fouls: teamFouls,
            timeouts: newTimeouts,
            quarter_seconds: quarterSeconds,
            is_clock_running: false,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchData.id);

    toast.info(`Desconto de tempo pedido por ${side === "home" ? teamHome : teamAway}`);
  };

  // Finalize match
  const handleFinalizeMatch = async () => {
    if (!canEdit) return;
    if (confirm("Tens a certeza que queres terminar este jogo de Basquetebol?")) {
      const { error } = await supabase
        .from("matches")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchData.id);

      if (!error) {
        toast.success("Jogo terminado!");
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {/* Top Banner / Match Info */}
      <div className="w-full flex items-center justify-between py-3 px-6 bg-surface-container-low rounded-2xl border border-white/5 mb-6">
        <div className="flex items-center gap-2.5">
          <SportIcon sport="Basketball" className="text-secondary text-[20px]" />
          <div>
            <span className="text-[10px] font-label font-black uppercase tracking-widest text-secondary block">
              Basquetebol Oficial
            </span>
            <span className="text-sm font-bold text-on-surface">
              {matchData.tournaments?.name || "Jogo Isolado"}
            </span>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-xl border border-white/5">
          {["Q1", "Q2", "Q3", "Q4", "OT"].map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
              disabled={!canEdit}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                currentPeriod === p
                  ? "bg-primary text-on-primary shadow-md"
                  : "text-on-surface-variant hover:text-on-surface"
              } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scoreboard Display */}
      <div className="w-full bg-[#0d1424] rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* HOME TEAM */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <h2 className="text-xl md:text-2xl font-headline font-black text-white truncate max-w-[240px]">
                {teamHome}
              </h2>
            </div>

            {/* Home Score */}
            <div className="text-7xl md:text-8xl font-mono font-black text-white tracking-tighter my-2 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              {scores.home}
            </div>

            {/* Home Fouls & Timeouts */}
            <div className="flex items-center gap-3 text-xs mt-2">
              <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold ${
                teamFouls.home >= 5
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
                  : "bg-surface-container text-on-surface-variant border-white/5"
              }`}>
                Faltas: {teamFouls.home} {teamFouls.home >= 5 && "(BÓNUS)"}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-white/5 font-mono">
                Descontos: {timeouts.home}
              </span>
            </div>

            {/* Quick Scoring Buttons for Home */}
            {canEdit && (
              <div className="grid grid-cols-4 gap-2 w-full max-w-[260px] mt-6">
                <button
                  onClick={() => handleScore("home", 1)}
                  className="py-2.5 bg-surface-container hover:bg-primary/20 text-on-surface hover:text-primary font-mono font-black rounded-xl border border-white/10 transition-all text-sm"
                  title="Lance Livre (+1)"
                >
                  +1
                </button>
                <button
                  onClick={() => handleScore("home", 2)}
                  className="py-2.5 bg-primary-container hover:brightness-110 text-on-primary-container font-mono font-black rounded-xl shadow-lg shadow-primary/20 transition-all text-sm"
                  title="Cesto (+2)"
                >
                  +2
                </button>
                <button
                  onClick={() => handleScore("home", 3)}
                  className="py-2.5 bg-secondary hover:brightness-110 text-on-secondary font-mono font-black rounded-xl shadow-lg shadow-secondary/20 transition-all text-sm"
                  title="Triplo (+3)"
                >
                  +3
                </button>
                <button
                  onClick={() => handleScore("home", -1)}
                  className="py-2.5 bg-surface-container-high hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 font-mono font-bold rounded-xl border border-white/5 transition-all text-xs"
                  title="Corrigir (-1)"
                >
                  -1
                </button>
              </div>
            )}

            {/* Foul & Timeout actions */}
            {canEdit && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => addFoul("home")}
                  className="px-3 py-1 bg-surface-container hover:bg-white/10 text-xs text-on-surface-variant rounded-lg border border-white/5"
                >
                  + Falta
                </button>
                <button
                  onClick={() => useTimeout("home")}
                  disabled={timeouts.home <= 0}
                  className="px-3 py-1 bg-surface-container hover:bg-white/10 text-xs text-on-surface-variant rounded-lg border border-white/5 disabled:opacity-40"
                >
                  Desconto
                </button>
              </div>
            )}
          </div>

          {/* CENTER: CLOCK & PERIOD */}
          <div className="flex flex-col items-center justify-center py-4 border-y md:border-y-0 md:border-x border-white/10 px-4">
            <span className="text-secondary font-label text-xs font-black uppercase tracking-[0.3em] mb-2">
              {currentPeriod}
            </span>

            {/* Game Clock */}
            <div
              onClick={toggleClock}
              className={`text-5xl md:text-6xl font-mono font-black tracking-tight cursor-pointer select-none py-2 px-5 rounded-2xl border transition-all ${
                isClockRunning
                  ? "text-primary border-primary/40 bg-primary/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                  : "text-white border-white/10 bg-surface-container/60 hover:border-white/30"
              }`}
              title="Clique para Iniciar/Pausar o Relógio"
            >
              {formatClock(quarterSeconds)}
            </div>

            {/* Shot Clock (24s / 14s) */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[10px] font-label uppercase font-black text-on-surface-variant/70">
                  Posse:
                </span>
                <span
                  className={`font-mono text-xl font-black ${
                    shotClock <= 5 ? "text-rose-400 animate-pulse" : "text-amber-400"
                  }`}
                >
                  {shotClock}s
                </span>
              </div>

              {canEdit && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => resetShotClock(24)}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold bg-surface-container-high hover:bg-amber-400/20 text-on-surface rounded-lg border border-white/10"
                    title="Reset 24 segundos"
                  >
                    24s
                  </button>
                  <button
                    onClick={() => resetShotClock(14)}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold bg-surface-container-high hover:bg-amber-400/20 text-on-surface rounded-lg border border-white/10"
                    title="Reset 14 segundos (Ressalto Ofensivo)"
                  >
                    14s
                  </button>
                </div>
              )}
            </div>

            {/* Timer controls */}
            {canEdit && (
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={toggleClock}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isClockRunning
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-primary text-on-primary shadow-md"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isClockRunning ? "pause" : "play_arrow"}
                  </span>
                  {isClockRunning ? "Pausar" : "Iniciar"}
                </button>
                <button
                  onClick={() => setQuarterSeconds(10 * 60)}
                  className="px-2.5 py-1.5 bg-surface-container hover:bg-white/10 text-on-surface-variant text-xs rounded-xl border border-white/5"
                  title="Repor 10:00"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                </button>
              </div>
            )}
          </div>

          {/* AWAY TEAM */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-secondary" />
              <h2 className="text-xl md:text-2xl font-headline font-black text-white truncate max-w-[240px]">
                {teamAway}
              </h2>
            </div>

            {/* Away Score */}
            <div className="text-7xl md:text-8xl font-mono font-black text-white tracking-tighter my-2 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              {scores.away}
            </div>

            {/* Away Fouls & Timeouts */}
            <div className="flex items-center gap-3 text-xs mt-2">
              <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold ${
                teamFouls.away >= 5
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
                  : "bg-surface-container text-on-surface-variant border-white/5"
              }`}>
                Faltas: {teamFouls.away} {teamFouls.away >= 5 && "(BÓNUS)"}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-white/5 font-mono">
                Descontos: {timeouts.away}
              </span>
            </div>

            {/* Quick Scoring Buttons for Away */}
            {canEdit && (
              <div className="grid grid-cols-4 gap-2 w-full max-w-[260px] mt-6">
                <button
                  onClick={() => handleScore("away", 1)}
                  className="py-2.5 bg-surface-container hover:bg-primary/20 text-on-surface hover:text-primary font-mono font-black rounded-xl border border-white/10 transition-all text-sm"
                  title="Lance Livre (+1)"
                >
                  +1
                </button>
                <button
                  onClick={() => handleScore("away", 2)}
                  className="py-2.5 bg-primary-container hover:brightness-110 text-on-primary-container font-mono font-black rounded-xl shadow-lg shadow-primary/20 transition-all text-sm"
                  title="Cesto (+2)"
                >
                  +2
                </button>
                <button
                  onClick={() => handleScore("away", 3)}
                  className="py-2.5 bg-secondary hover:brightness-110 text-on-secondary font-mono font-black rounded-xl shadow-lg shadow-secondary/20 transition-all text-sm"
                  title="Triplo (+3)"
                >
                  +3
                </button>
                <button
                  onClick={() => handleScore("away", -1)}
                  className="py-2.5 bg-surface-container-high hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 font-mono font-bold rounded-xl border border-white/5 transition-all text-xs"
                  title="Corrigir (-1)"
                >
                  -1
                </button>
              </div>
            )}

            {/* Foul & Timeout actions */}
            {canEdit && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => addFoul("away")}
                  className="px-3 py-1 bg-surface-container hover:bg-white/10 text-xs text-on-surface-variant rounded-lg border border-white/5"
                >
                  + Falta
                </button>
                <button
                  onClick={() => useTimeout("away")}
                  disabled={timeouts.away <= 0}
                  className="px-3 py-1 bg-surface-container hover:bg-white/10 text-xs text-on-surface-variant rounded-lg border border-white/5 disabled:opacity-40"
                >
                  Desconto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quarter by Quarter Breakdown Table */}
      <div className="w-full bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden p-5 mb-6">
        <h3 className="font-headline font-black text-xs uppercase tracking-wider text-on-surface-variant mb-4">
          Resumo por Período
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm font-mono">
            <thead>
              <tr className="border-b border-white/5 text-on-surface-variant/70 text-xs uppercase font-label">
                <th className="py-2 px-4 text-left font-bold">Equipa</th>
                <th className="py-2 px-3">Q1</th>
                <th className="py-2 px-3">Q2</th>
                <th className="py-2 px-3">Q3</th>
                <th className="py-2 px-3">Q4</th>
                {quarters.length > 4 && <th className="py-2 px-3">OT</th>}
                <th className="py-2 px-4 font-black text-secondary">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-3 px-4 text-left font-bold font-sans text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {teamHome}
                </td>
                <td className="py-3 px-3">{quarters[0]?.home ?? 0}</td>
                <td className="py-3 px-3">{quarters[1]?.home ?? 0}</td>
                <td className="py-3 px-3">{quarters[2]?.home ?? 0}</td>
                <td className="py-3 px-3">{quarters[3]?.home ?? 0}</td>
                {quarters.length > 4 && <td className="py-3 px-3">{quarters[4]?.home ?? 0}</td>}
                <td className="py-3 px-4 font-black text-secondary text-base">{scores.home}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-bold font-sans text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  {teamAway}
                </td>
                <td className="py-3 px-3">{quarters[0]?.away ?? 0}</td>
                <td className="py-3 px-3">{quarters[1]?.away ?? 0}</td>
                <td className="py-3 px-3">{quarters[2]?.away ?? 0}</td>
                <td className="py-3 px-3">{quarters[3]?.away ?? 0}</td>
                {quarters.length > 4 && <td className="py-3 px-3">{quarters[4]?.away ?? 0}</td>}
                <td className="py-3 px-4 font-black text-secondary text-base">{scores.away}</td>
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
