"use client";

import { useEffect, useState } from "react";
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

export default function VolleyballScoreboard({ 
  matchData, 
  rules, 
  canEdit 
}: { 
  matchData: any; 
  rules?: any;
  canEdit: boolean;
}) {
  const { t, translations, locale } = useTranslation();
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

  const renderTeamColumn = (side: "home" | "away") => {
    const isHome = side === "home";
    const idx = isHome ? 0 : 1;
    const teamName = isHome ? teamHome : teamAway;
    const isServing = serverIdx === idx;
    const points = isHome ? currentPoints.home : currentPoints.away;
    const sets = isHome ? setsWon.home : setsWon.away;
    const teamTimeouts = isHome ? timeouts.home : timeouts.away;

    return (
      <ScoreboardTeamColumn
        teamName={teamName}
        subLabel={
          isServing ? (
            <span className="inline-flex items-center gap-1.5 text-xs compact:text-[11px] font-medium text-text-primary bg-surface-container-high px-2.5 compact:px-2 py-0.5 rounded-md border border-outline-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-text-primary"></span>
              {translations.scoreboard.serving}
            </span>
          ) : (
            <span className="inline-flex items-center text-text-muted text-xs compact:text-[11px] font-medium px-2 py-0.5">
              {locale === "pt" ? "Receção" : "Receiving"}
            </span>
          )
        }
        score={points}
        pills={
          <>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
              {translations.scoreboard.setsShort} <span className="font-digital text-sm compact:text-xs text-text-primary">{sets}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
              {translations.scoreboard.timeoutShort} <span className="font-digital text-sm compact:text-xs text-text-primary">{teamTimeouts}/2</span>
            </span>
          </>
        }
      />
    );
  };

  const renderTeamActions = (side: "home" | "away") => {
    const isHome = side === "home";
    const idx = isHome ? 0 : 1;
    const points = isHome ? currentPoints.home : currentPoints.away;
    const teamTimeouts = isHome ? timeouts.home : timeouts.away;

    return (
      <div className="flex flex-col items-center gap-2 landscape-compact:gap-1 w-full mt-3 landscape-compact:mt-0">
        <div className="flex landscape-compact:flex-col items-center gap-2 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="primary"
            onClick={() => handlePoint(side)}
            className="flex-1"
            title={translations.scoreboard.point}
          >
            <span className="material-symbols-outlined text-[14px] landscape-compact:text-[13px]" aria-hidden="true">add</span>
            <span className="landscape-compact:hidden">{translations.scoreboard.point}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">Pt</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleUndoPoint(side)}
            disabled={points <= 0}
            title={translations.scoreboard.undo}
          >
            <span className="material-symbols-outlined text-[14px] landscape-compact:text-[13px]" aria-hidden="true">undo</span>
            <span>{translations.scoreboard.undo}</span>
          </ScoreboardActionButton>
        </div>

        <div className="flex landscape-compact:flex-col items-center gap-2 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleTimeout(side)}
            disabled={teamTimeouts <= 0}
            className="flex-1"
            title={translations.scoreboard.timeout}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.timeout}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">{locale === "pt" ? "Desc" : "TO"}</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => setServerIdx(idx)}
            className="flex-1"
            title={translations.scoreboard.volleyball.toggleServe}
          >
            <span className="landscape-compact:hidden">{translations.scoreboard.volleyball.toggleServe}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">{locale === "pt" ? "Srv" : "Srv"}</span>
          </ScoreboardActionButton>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center flex-1 min-h-0">
      {/* Toss Server Banner if serverIdx is null */}
      {serverIdx === null && (
        <div className="w-full bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-text-secondary text-base">paid</span>
            <span className="text-xs font-medium text-text-primary">
              Selecionar Servidor Inicial
            </span>
          </div>
          <div className="flex gap-3 w-full max-w-md">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                onClick={() => handleToss(idx)}
                disabled={isTossing || !canEdit}
                className="flex-1 h-9 bg-text-primary hover:opacity-90 text-surface-container-lowest rounded-lg text-xs font-medium transition-opacity cursor-pointer disabled:opacity-50"
              >
                {matchData.participants?.[idx]?.name || `Equipa ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Banner / Match Info */}
      <ScoreboardHeader
        sportType={matchData.sport_type}
        sportLabel={getSportTranslation(matchData.sport_type, t)}
        eventName={matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match")}
        teamHome={teamHome}
        teamAway={teamAway}
        rightSlot={
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
        }
      />

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
      <ScoreboardMainCard
        compactHeader={{
          sportType: matchData.sport_type,
          sportLabel: getSportTranslation(matchData.sport_type, t),
          eventName: matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match"),
          statusBadge: `Set ${currentSetNum}`,
          onFinish: canEdit ? handleFinalizeMatch : undefined,
        }}
        left={renderTeamColumn("home")}
        leftActions={canEdit ? renderTeamActions("home") : undefined}
        center={
          <div className="flex flex-col items-center text-center order-1 md:order-2 py-4 compact:py-0">
            <span className="text-xs font-medium text-text-muted mb-1.5">
              {isDecidingSet
                ? translations.scoreboard.volleyball.setDecider.replace("{set}", String(currentSetNum))
                : `Set ${currentSetNum}`}
            </span>

            {/* Target Points */}
            <div className="flex items-center gap-3 my-2 compact:my-0.5">
              <div className="text-3xl md:text-4xl compact:text-2xl font-digital text-text-primary py-2 compact:py-1 px-6 compact:px-4 rounded-xl bg-surface-container-high border border-outline-variant tracking-wide">
                {activeLimit}
              </div>
            </div>
            <span className="text-[11px] text-text-muted mt-1 font-medium">
              {translations.scoreboard.volleyball.setLimit}
            </span>

            {/* Set Match Status Info */}
            <div className="flex items-center gap-2 mt-3 compact:mt-1.5 text-xs compact:text-[11px] text-text-muted">
              <span>{locale === "pt" ? `Melhor de ${defaultMaxSets} Sets` : `Best of ${defaultMaxSets} Sets`}</span>
              <span>•</span>
              <span>{translations.scoreboard.volleyball.deuceAdv2}</span>
            </div>
          </div>
        }
        right={renderTeamColumn("away")}
        rightActions={canEdit ? renderTeamActions("away") : undefined}
      />

      {/* Set by Set Breakdown Table */}
      <ScoreboardSummaryCard title="Resumo por Set">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-text-muted text-xs font-medium">
                <th className="py-2.5 px-4 text-left">Equipa</th>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => (
                  <th key={idx} className="py-2.5 px-3">Set {idx + 1}</th>
                ))}
                <th className="py-2.5 px-4 font-semibold text-text-primary">Sets</th>
                <th className="py-2.5 px-4 font-semibold text-text-primary">Total Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-digital text-base">
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium">
                  {teamHome}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.home : (setHistory[idx]?.home ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-semibold text-text-primary">{setsWon.home}</td>
                <td className="py-3 px-4 font-semibold text-text-secondary">
                  {setHistory.reduce((sum, s) => sum + s.home, 0) + currentPoints.home}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-left font-sans text-text-primary font-medium">
                  {teamAway}
                </td>
                {Array.from({ length: defaultMaxSets }).map((_, idx) => {
                  const setNum = idx + 1;
                  const pts = setNum === currentSetNum ? currentPoints.away : (setHistory[idx]?.away ?? "-");
                  return (
                    <td key={idx} className={`py-3 px-3 ${setNum === currentSetNum ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                      {pts}
                    </td>
                  );
                })}
                <td className="py-3 px-4 font-semibold text-text-primary">{setsWon.away}</td>
                <td className="py-3 px-4 font-semibold text-text-secondary">
                  {setHistory.reduce((sum, s) => sum + s.away, 0) + currentPoints.away}
                </td>
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
