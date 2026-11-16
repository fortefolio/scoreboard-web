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

export default function FootballScoreboard({ 
  matchData, 
  canEdit 
}: { 
  matchData: any; 
  canEdit: boolean;
}) {
  const { t, translations, locale } = useTranslation();
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

  const renderTeamColumn = (side: "home" | "away") => {
    const isHome = side === "home";
    const teamName = isHome ? teamHome : teamAway;
    const teamGoals = isHome ? goals.home : goals.away;
    const teamYellows = isHome ? yellowCards.home : yellowCards.away;
    const teamReds = isHome ? redCards.home : redCards.away;
    const teamCorners = isHome ? corners.home : corners.away;
    const teamFouls = isHome ? fouls.home : fouls.away;

    return (
      <ScoreboardTeamColumn
        teamName={teamName}
        subLabel={
          <span className="inline-flex items-center text-text-muted text-xs font-medium px-2 py-0.5">
            {isHome ? (locale === "pt" ? "Casa" : "Home") : (locale === "pt" ? "Visitante" : "Away")}
          </span>
        }
        score={teamGoals}
        pills={
          <>
            {teamYellows > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                <span className="w-2 h-3 bg-amber-400 rounded-xs inline-block" />
                <span className="font-digital text-sm compact:text-xs">{teamYellows}</span>
              </span>
            )}
            {teamReds > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium flex items-center gap-1">
                <span className="w-2 h-3 bg-rose-500 rounded-xs inline-block" />
                <span className="font-digital text-sm compact:text-xs">{teamReds}</span>
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
              {locale === "pt" ? "Cantos:" : "Corners:"} <span className="font-digital text-sm compact:text-xs text-text-primary">{teamCorners}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
              {translations.scoreboard.foulsShort} <span className="font-digital text-sm compact:text-xs text-text-primary">{teamFouls}</span>
            </span>
          </>
        }
      />
    );
  };

  const renderTeamActions = (side: "home" | "away") => {
    const teamGoals = side === "home" ? goals.home : goals.away;
    return (
      <div className="flex flex-col items-center gap-2 landscape-compact:gap-1 w-full mt-3 landscape-compact:mt-0">
        <div className="flex landscape-compact:flex-col items-center gap-2 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="primary"
            onClick={() => handleGoal(side, 1)}
            className="flex-1"
            title={translations.scoreboard.football.plusGoal}
          >
            <span className="material-symbols-outlined text-[14px] landscape-compact:text-[13px]" aria-hidden="true">add</span>
            <span className="landscape-compact:hidden">{translations.scoreboard.football.plusGoal}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">{locale === "pt" ? "Golo" : "Goal"}</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleGoal(side, -1)}
            disabled={teamGoals <= 0}
            title={translations.scoreboard.undo}
          >
            <span className="material-symbols-outlined text-[14px] landscape-compact:text-[13px]" aria-hidden="true">undo</span>
            <span>{translations.scoreboard.undo}</span>
          </ScoreboardActionButton>
        </div>

        <div className="grid grid-cols-4 landscape-compact:grid-cols-1 gap-1.5 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="warning"
            onClick={() => handleCard(side, "yellow")}
            title={translations.scoreboard.football.yellowCard}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.football.yellowCard}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">{locale === "pt" ? "Am" : "YC"}</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="danger"
            onClick={() => handleCard(side, "red")}
            title={translations.scoreboard.football.redCard}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.football.redCard}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">{locale === "pt" ? "Vm" : "RC"}</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleStat(side, "corner")}
            title={translations.scoreboard.football.plusCorner}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.football.plusCorner}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">+C</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleStat(side, "foul")}
            title={translations.scoreboard.football.plusFoul}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.football.plusFoul}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">+F</span>
          </ScoreboardActionButton>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center flex-1 min-h-0">
      {/* Top Banner / Match Info */}
      <ScoreboardHeader
        sportType="Football"
        sportLabel={getSportTranslation("Football", t)}
        eventName={matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match")}
        teamHome={teamHome}
        teamAway={teamAway}
        rightSlot={
          <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-lg border border-outline-variant">
            {["1ª Parte", "Intervalo", "2ª Parte", "Prol.", "Penáltis", "Fim"].map((p) => (
              <button
                key={p}
                onClick={() => changePeriod(p === "Prol." ? "Prolongamento" : p)}
                disabled={!canEdit}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === p || (p === "Prol." && period === "Prolongamento")
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

      {/* Main Scoreboard Display (3 Columns) */}
      <ScoreboardMainCard
        compactHeader={{
          sportType: "Football",
          sportLabel: getSportTranslation("Football", t),
          eventName: matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match"),
          statusBadge: period,
          onFinish: canEdit ? handleFinalizeMatch : undefined,
        }}
        left={renderTeamColumn("home")}
        leftActions={canEdit ? renderTeamActions("home") : undefined}
        center={
          <div className="flex flex-col items-center text-center order-1 md:order-2 py-4 compact:py-0">
            <span className="text-xs font-medium text-text-muted mb-1.5">
              {period}
            </span>

            {/* Match Clock */}
            <div className="flex items-center gap-3 my-2">
              <div
                onClick={toggleClock}
                className="text-3xl md:text-4xl font-digital text-text-primary py-2 px-6 rounded-xl bg-surface-container-high border border-outline-variant tracking-wide cursor-pointer select-none"
                title="Clique para Iniciar/Pausar o Cronómetro"
              >
                {formatTime(elapsedSeconds)}
              </div>
            </div>

            {/* Stoppage Time Badge */}
            {stoppageMinutes > 0 && (
              <span className="mt-1 text-xs font-digital text-text-secondary bg-surface-container-high px-2.5 py-0.5 rounded-md border border-outline-variant">
                {translations.scoreboard.football.stoppageShort.replace("{min}", String(stoppageMinutes))}
              </span>
            )}

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
                  onClick={() => {
                    const nextStoppage = (stoppageMinutes + 1) % 10;
                    setStoppageMinutes(nextStoppage);
                    persistFootballState({ stoppageMinutes: nextStoppage });
                  }}
                  className="h-8 px-2.5 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary text-xs font-medium rounded-lg border border-outline-variant transition-colors cursor-pointer"
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
                  className="h-8 px-2.5 bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary rounded-lg border border-outline-variant transition-colors cursor-pointer flex items-center justify-center"
                  title="Repor Tempo Base"
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

      {/* Match Statistics & Summary Table */}
      <ScoreboardSummaryCard title="Estatísticas Oficiais do Encontro">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-text-muted text-xs font-medium">
                <th className="py-2.5 px-4 text-left">Equipa</th>
                <th className="py-2.5 px-3">Golos</th>
                <th className="py-2.5 px-3">Amarelos</th>
                <th className="py-2.5 px-3">Vermelhos</th>
                <th className="py-2.5 px-3">Cantos</th>
                <th className="py-2.5 px-3">Faltas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-digital text-base">
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium">
                  {teamHome}
                </td>
                <td className="py-3 px-3 text-text-primary font-semibold text-lg">{goals.home}</td>
                <td className="py-3 px-3 text-text-secondary">{yellowCards.home}</td>
                <td className="py-3 px-3 text-text-secondary">{redCards.home}</td>
                <td className="py-3 px-3 text-text-secondary">{corners.home}</td>
                <td className="py-3 px-3 text-text-secondary">{fouls.home}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium">
                  {teamAway}
                </td>
                <td className="py-3 px-3 text-text-primary font-semibold text-lg">{goals.away}</td>
                <td className="py-3 px-3 text-text-secondary">{yellowCards.away}</td>
                <td className="py-3 px-3 text-text-secondary">{redCards.away}</td>
                <td className="py-3 px-3 text-text-secondary">{corners.away}</td>
                <td className="py-3 px-3 text-text-secondary">{fouls.away}</td>
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
