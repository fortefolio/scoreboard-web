"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ScoreboardHeader,
  ScoreboardMainCard,
  ScoreboardSummaryCard,
  ScoreboardFinalizeButton,
  ScoreboardActionButton,
  ScoreboardTeamColumn,
} from "@/components/scoreboard/ScoreboardLayout";
import { recordMatchEventAtomic } from "@/lib/scoring/atomicScoring";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

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
  const { t, translations, locale } = useTranslation();
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

  const renderTeamColumn = (side: "home" | "away") => {
    const isHome = side === "home";
    const teamName = isHome ? teamHome : teamAway;
    const fouls = isHome ? teamFouls.home : teamFouls.away;
    const teamTimeouts = isHome ? timeouts.home : timeouts.away;
    const score = isHome ? scores.home : scores.away;

    return (
      <ScoreboardTeamColumn
        teamName={teamName}
        subLabel={
          fouls >= 5 ? (
            <span className="inline-flex items-center gap-1.5 text-xs compact:text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              {translations.scoreboard.basketball.bonus}
            </span>
          ) : (
            <span className="inline-flex items-center text-text-muted text-xs compact:text-[11px] font-medium px-2 py-0.5">
              {isHome ? (locale === "pt" ? "Casa" : "Home") : (locale === "pt" ? "Visitante" : "Away")}
            </span>
          )
        }
        score={score}
        pills={
          <>
            <span
              className={`px-2 py-0.5 rounded-md border font-medium ${
                fouls >= 5
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : "bg-surface-container-high text-text-secondary border-outline-variant"
              }`}
            >
              {translations.scoreboard.foulsShort} <span className="font-digital text-sm compact:text-xs text-text-primary">{fouls}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
              {translations.scoreboard.timeoutShort} <span className="font-digital text-sm compact:text-xs text-text-primary">{teamTimeouts}</span>
            </span>
          </>
        }
      />
    );
  };

  const renderTeamActions = (side: "home" | "away") => {
    const isHome = side === "home";
    const teamTimeouts = isHome ? timeouts.home : timeouts.away;

    return (
      <div className="flex flex-col items-center gap-2 landscape-compact:gap-1 w-full mt-3 landscape-compact:mt-0">
        <div className="grid grid-cols-4 landscape-compact:grid-cols-1 gap-1.5 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="primary"
            onClick={() => handleScore(side, 1)}
            title="+1"
          >
            +1
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="primary"
            onClick={() => handleScore(side, 2)}
            title="+2"
          >
            +2
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="primary"
            onClick={() => handleScore(side, 3)}
            title="+3"
          >
            +3
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleScore(side, -1)}
            title={translations.scoreboard.undo}
          >
            <span className="material-symbols-outlined text-[14px] landscape-compact:text-[13px]">undo</span>
            <span>{translations.scoreboard.undo}</span>
          </ScoreboardActionButton>
        </div>

        <div className="flex landscape-compact:flex-col items-center gap-2 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => addFoul(side)}
            className="flex-1"
            title={translations.scoreboard.basketball.plusFoul}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.basketball.plusFoul}</span>
            <span className="hidden landscape-compact:inline">+F</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => useTimeout(side)}
            disabled={teamTimeouts <= 0}
            className="flex-1"
            title={translations.scoreboard.timeout}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.timeout}</span>
            <span className="hidden landscape-compact:inline">{locale === "pt" ? "Desc" : "TO"}</span>
          </ScoreboardActionButton>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center flex-1 min-h-0">
      {/* Top Banner / Match Info */}
      <ScoreboardHeader
        sportType="Basketball"
        sportLabel={getSportTranslation("Basketball", t)}
        eventName={matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match")}
        teamHome={teamHome}
        teamAway={teamAway}
        rightSlot={
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
        }
      />

      {/* Main Scoreboard Display */}
      <ScoreboardMainCard
        compactHeader={{
          sportType: "Basketball",
          sportLabel: getSportTranslation("Basketball", t),
          eventName: matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match"),
          statusBadge: currentPeriod,
          onFinish: canEdit ? handleFinalizeMatch : undefined,
        }}
        left={renderTeamColumn("home")}
        leftActions={canEdit ? renderTeamActions("home") : undefined}
        center={
          <div className="flex flex-col items-center text-center order-1 md:order-2 py-4 compact:py-0">
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
                <span>{translations.scoreboard.basketball.possession}:</span>
                <span
                  className={`font-digital text-base ${
                    shotClock <= 5 ? "text-rose-400" : "text-text-primary"
                  }`}
                >
                  {shotClock}
                  <span className="font-sans text-[11px] ml-0.5">s</span>
                </span>
              </div>

              {canEdit && (
                <div className="flex gap-1">
                  <button
                    onClick={() => resetShotClock(24)}
                    className="h-7 px-2.5 text-xs font-medium bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary rounded-md border border-outline-variant transition-colors cursor-pointer"
                    title="Reset 24s"
                  >
                    <span className="font-digital">24</span>s
                  </button>
                  <button
                    onClick={() => resetShotClock(14)}
                    className="h-7 px-2.5 text-xs font-medium bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary rounded-md border border-outline-variant transition-colors cursor-pointer"
                    title="Reset 14s"
                  >
                    <span className="font-digital">14</span>s
                  </button>
                </div>
              )}
            </div>

            {/* Timer controls */}
            {canEdit && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={toggleClock}
                  className={`h-8 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isClockRunning
                      ? "bg-surface-container-high text-text-primary border border-outline-variant"
                      : "bg-text-primary text-surface-container-lowest hover:opacity-90"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isClockRunning ? "pause" : "play_arrow"}
                  </span>
                  {isClockRunning ? (locale === "pt" ? "Pausar" : "Pause") : (locale === "pt" ? "Iniciar" : "Start")}
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
        }
        right={renderTeamColumn("away")}
        rightActions={canEdit ? renderTeamActions("away") : undefined}
      />

      {/* Quarter by Quarter Breakdown Table */}
      <ScoreboardSummaryCard title="Resumo por Período">
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
                <th className="py-2.5 px-4 font-semibold text-text-primary">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-digital text-base">
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium">
                  {teamHome}
                </td>
                <td className="py-3 px-3 text-text-secondary">{quarters[0]?.home ?? 0}</td>
                <td className="py-3 px-3 text-text-secondary">{quarters[1]?.home ?? 0}</td>
                <td className="py-3 px-3 text-text-secondary">{quarters[2]?.home ?? 0}</td>
                <td className="py-3 px-3 text-text-secondary">{quarters[3]?.home ?? 0}</td>
                {quarters.length > 4 && <td className="py-3 px-3 text-text-secondary">{quarters[4]?.home ?? 0}</td>}
                <td className="py-3 px-4 font-semibold text-text-primary">{scores.home}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium">
                  {teamAway}
                </td>
                <td className="py-3 px-3 text-text-secondary">{quarters[0]?.away ?? 0}</td>
                <td className="py-3 px-3 text-text-secondary">{quarters[1]?.away ?? 0}</td>
                <td className="py-3 px-3 text-text-secondary">{quarters[2]?.away ?? 0}</td>
                <td className="py-3 px-3 text-text-secondary">{quarters[3]?.away ?? 0}</td>
                {quarters.length > 4 && <td className="py-3 px-3 text-text-secondary">{quarters[4]?.away ?? 0}</td>}
                <td className="py-3 px-4 font-semibold text-text-primary">{scores.away}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ScoreboardSummaryCard>

      {/* Bottom Controls / Finalize */}
      {canEdit && (
        <ScoreboardFinalizeButton onClick={handleFinalizeMatch} label={translations.scoreboard.endMatch} />
      )}
    </div>
  );
}
