"use client";

import { useEffect, useRef, useState } from "react";
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
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { recordMatchEventAtomic } from "@/lib/scoring/atomicScoring";
import { extractSetsData } from "@/lib/scoring/sets";
import {
  calculateTennisScore,
  createInitialTennisScores,
  TennisRules,
  TennisScoresState,
} from "@/lib/scoring/tennis-engine";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

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
  const { t, translations, locale } = useTranslation();
  const isPadel = matchData?.sport_type === "Padel";
  const defaultMaxSets = rules?.max_sets || 3;
  const setsToWin = Math.ceil(defaultMaxSets / 2);
  const isGoldenPoint = isPadel || rules?.golden_point || rules?.no_ad || false; // Padel traditionally plays golden point at 40-40
  const effectiveRules: TennisRules = { ...rules, no_ad: isGoldenPoint };

  const getInitialSets = (data: any) => {
    const raw = extractSetsData(data?.scores);
    return Array.isArray(raw)
      ? raw.map((s: any) => ({
          home: s.team1 ?? s.home ?? 0,
          away: s.team2 ?? s.away ?? 0,
        }))
      : [];
  };

  const normalizeScoresState = (raw: any): TennisScoresState => {
    const base = createInitialTennisScores((raw?.serving_index ?? 0) as 0 | 1);
    const tData = raw?.tennis || {};
    const g: [number, number] = tData.games || [0, 0];
    return {
      ...base,
      ...(raw || {}),
      serving_index: (raw?.serving_index ?? 0) as 0 | 1,
      match_won: Boolean(raw?.match_won),
      tennis: {
        ...base.tennis,
        ...tData,
        points: tData.points || [0, 0],
        games: g,
        sets: tData.sets || [],
        current_set: tData.current_set ?? (tData.sets?.length || 0) + 1,
        is_tiebreak: Boolean(tData.is_tiebreak ?? (g[0] === 6 && g[1] === 6 && rules?.set_type !== "advantage")),
      },
    };
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
  const [isTiebreakState, setIsTiebreakState] = useState<boolean>(
    Boolean(
      matchData?.scores?.tennis?.is_tiebreak ??
        ((matchData?.scores?.tennis?.games?.[0] ?? 0) === 6 &&
          (matchData?.scores?.tennis?.games?.[1] ?? 0) === 6 &&
          rules?.set_type !== "advantage")
    )
  );
  const [isTossing, setIsTossing] = useState(false);
  const [aces, setAces] = useState({ home: 0, away: 0 });
  const [doubleFaults, setDoubleFaults] = useState({ home: 0, away: 0 });
  const scoresRef = useRef<TennisScoresState>(normalizeScoresState(matchData?.scores));
  const serverIdxRef = useRef<number | null>(matchData?.scores?.serving_index ?? null);

  const teamHome = matchData?.participants?.[0]?.name || "Jogador 1";
  const teamAway = matchData?.participants?.[1]?.name || "Jogador 2";

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData?.scores) {
      const normalized = normalizeScoresState(matchData.scores);
      scoresRef.current = normalized;
      serverIdxRef.current = matchData.scores.serving_index ?? null;
      setPoints(normalized.tennis.points);
      setGames(normalized.tennis.games);
      setSetHistory(getInitialSets(matchData));
      setServerIdx(matchData.scores.serving_index ?? null);
      setIsTiebreakState(normalized.tennis.is_tiebreak);

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

  const isTiebreak = isTiebreakState;

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
    serverIdxRef.current = selectedIdx;
    scoresRef.current = {
      ...scoresRef.current,
      serving_index: selectedIdx as 0 | 1,
    };
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
    if (serverIdxRef.current === null && serverIdx === null) {
      toast.error("Por favor seleciona o primeiro servidor!");
      return;
    }

    const side = winnerIdx === 0 ? "home" : "away";

    const prevState = scoresRef.current;
    const nextScores = calculateTennisScore(prevState, winnerIdx as 0 | 1, effectiveRules);
    const existingStats = (prevState.tennis as any)?.stats;
    if (existingStats) {
      (nextScores.tennis as any).stats = existingStats;
    }

    scoresRef.current = nextScores;
    serverIdxRef.current = nextScores.serving_index;
    setPoints(nextScores.tennis.points);
    setGames(nextScores.tennis.games);
    setSetHistory(
      nextScores.tennis.sets.map((s) => ({
        home: s.team1 ?? s.home ?? 0,
        away: s.team2 ?? s.away ?? 0,
      }))
    );
    setServerIdx(nextScores.serving_index);
    setIsTiebreakState(nextScores.tennis.is_tiebreak);

    const { error } = await recordMatchEventAtomic(supabase, {
      matchId: matchData.id,
      newScores: nextScores,
      newStatus: nextScores.match_won ? "completed" : "ongoing",
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
    const currentPoints = scoresRef.current.tennis.points;
    if (currentPoints[idx] <= 0) return;

    const newPoints: [number, number] = [...currentPoints];
    newPoints[idx] = Math.max(0, newPoints[idx] - 1);
    const updatedScores: TennisScoresState = {
      ...scoresRef.current,
      tennis: {
        ...scoresRef.current.tennis,
        points: newPoints,
      },
    };
    scoresRef.current = updatedScores;
    setPoints(newPoints);

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
    const newIdx = (serverIdxRef.current ?? serverIdx) === 0 ? 1 : 0;
    serverIdxRef.current = newIdx;
    const updated: TennisScoresState = {
      ...scoresRef.current,
      serving_index: newIdx as 0 | 1,
    };
    scoresRef.current = updated;
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

  const renderTeamColumn = (idx: 0 | 1) => {
    const teamName = formatTeamOrPlayerName(idx === 0 ? teamHome : teamAway);
    const setsWon = idx === 0 ? homeSetsWon : awaySetsWon;
    const isServing = serverIdx === idx;

    return (
      <ScoreboardTeamColumn
        teamName={teamName}
        subLabel={
          isServing ? (
            <span className="inline-flex items-center gap-1.5 text-xs compact:text-[11px] font-medium text-text-primary bg-surface-container-high px-2.5 compact:px-2 py-0.5 rounded-md border border-outline-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-text-primary" />
              {translations.scoreboard.serving}
            </span>
          ) : (
            <span className="inline-flex items-center text-text-muted text-xs compact:text-[11px] font-medium px-2 py-0.5">
              {locale === "pt" ? "Recetor" : "Receiver"}
            </span>
          )
        }
        score={formatPoint(idx)}
        pills={
          <>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
              {translations.scoreboard.setsShort} <span className="font-digital text-sm compact:text-xs text-text-primary">{setsWon}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-medium">
              {translations.scoreboard.gamesShort} <span className="font-digital text-sm compact:text-xs text-text-primary">{games[idx]}</span>
            </span>
          </>
        }
      />
    );
  };

  const renderTeamActions = (idx: 0 | 1) => {
    const isServing = serverIdx === idx;
    return (
      <div className="flex flex-col items-center gap-2 compact:gap-1 landscape-compact:gap-1 w-full mt-2 compact:mt-1 landscape-compact:mt-0">
        <div className="flex landscape-compact:flex-col items-center gap-2 compact:gap-1.5 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="primary"
            onClick={() => handlePoint(idx)}
            className="flex-1"
            title={translations.scoreboard.point}
          >
            <span className="material-symbols-outlined text-[14px] landscape-compact:text-[13px]" aria-hidden="true">add</span>
            <span className="landscape-compact:hidden">{translations.scoreboard.point}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">{locale === "pt" ? "Pt" : "Pt"}</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleCorrectPoint(idx)}
            disabled={points[idx] <= 0}
            title={translations.scoreboard.undo}
          >
            <span className="material-symbols-outlined text-[14px] landscape-compact:text-[13px]" aria-hidden="true">undo</span>
            <span>{translations.scoreboard.undo}</span>
          </ScoreboardActionButton>
        </div>

        <div className="flex landscape-compact:flex-col items-center gap-2 compact:gap-1.5 landscape-compact:gap-1 w-full landscape-compact:w-auto">
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleAce(idx)}
            disabled={!isServing}
            className="flex-1 min-w-0"
            title={translations.scoreboard.tennis.ace}
          >
            <span className="material-symbols-outlined text-[13px] landscape-compact:text-[12px] text-text-muted shrink-0" aria-hidden="true">bolt</span>
            <span className="truncate">{locale === "pt" ? "Ás" : "Ace"}</span>
          </ScoreboardActionButton>
          <ScoreboardActionButton
            variant="secondary"
            onClick={() => handleDoubleFault(idx)}
            disabled={!isServing}
            className="flex-1 min-w-0"
            title={translations.scoreboard.tennis.doubleFault}
          >
            <span className="material-symbols-outlined text-[13px] landscape-compact:text-[12px] text-text-muted shrink-0" aria-hidden="true">close</span>
            <span className="truncate landscape-compact:hidden">{translations.scoreboard.tennis.doubleFault}</span>
            <span className="hidden landscape-compact:inline" aria-hidden="true">{locale === "pt" ? "FD" : "DF"}</span>
          </ScoreboardActionButton>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center flex-1 min-h-0">
      {/* First Server Selector Pop-up Modal */}
      {serverIdx === null && canEdit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="select-first-server-title"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm bg-surface-container rounded-2xl shadow-2xl border border-outline-variant p-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center mx-auto mb-3 text-text-primary">
              <span className="material-symbols-outlined text-lg">paid</span>
            </div>
            <h3 id="select-first-server-title" className="text-base font-semibold text-text-primary">
              Select First Server
            </h3>
            <p className="text-xs text-text-muted mt-1 mb-5">
              Choose who serves first to start the match
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              {[0, 1].map((idx) => (
                <button
                  key={idx}
                  onClick={() => handleToss(idx)}
                  disabled={isTossing || !canEdit}
                  className="flex-1 bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 px-4 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer truncate"
                >
                  {formatTeamOrPlayerName(idx === 0 ? teamHome : teamAway)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Banner / Match Info (Desktop) */}
      <ScoreboardHeader
        sportType={isPadel ? "Padel" : "Tennis"}
        sportLabel={getSportTranslation(isPadel ? "Padel" : "Tennis", t)}
        eventName={matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match")}
        teamHome={formatTeamOrPlayerName(teamHome)}
        teamAway={formatTeamOrPlayerName(teamAway)}
        rightSlot={
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
        }
      />

      {/* Main 3-Column Command Center Scoreboard */}
      <ScoreboardMainCard
        compactHeader={{
          sportType: isPadel ? "Padel" : "Tennis",
          sportLabel: getSportTranslation(isPadel ? "Padel" : "Tennis", t),
          eventName: matchData?.tournaments?.name || (locale === "pt" ? "Jogo Isolado" : "Single Match"),
          statusBadge: `Set ${setHistory.length + 1}`,
          onFinish: canEdit ? handleFinalizeMatch : undefined,
        }}
        left={renderTeamColumn(0)}
        leftActions={canEdit ? renderTeamActions(0) : undefined}
        center={
          <div className="flex flex-col items-center text-center">
            {/* Set & Game Status */}
            <div className="text-xs font-medium text-text-muted mb-1">
              {isTiebreak ? (
                <span className="text-text-primary font-semibold">Deciding Tie-Break</span>
              ) : (
                `Set ${setHistory.length + 1} • Game ${totalGamesInSet + 1}`
              )}
            </div>

            {/* Current Games Board */}
            <div className="flex items-center gap-3 my-2 compact:my-0.5">
              <div className="text-3xl md:text-4xl compact:text-2xl font-digital text-text-primary py-2 compact:py-1 px-6 compact:px-4 rounded-xl bg-surface-container-high border border-outline-variant tracking-wide">
                {games[0]} - {games[1]}
              </div>
            </div>

            {/* Server Court Side Indicator */}
            <div className="flex items-center gap-1.5 text-xs compact:text-[11px] text-text-muted mt-1 compact:mt-0.5">
              <span className="material-symbols-outlined text-[15px] compact:text-[14px]">swap_horiz</span>
              <span>{locale === "pt" ? "Lado:" : "Side:"} <strong className="text-text-secondary font-medium">{isDeuceCourt ? translations.scoreboard.tennis.rightDeuceSide : translations.scoreboard.tennis.leftAdvantageSide}</strong></span>
            </div>

            {/* Technical Match Context Alerts */}
            {(isBreakPoint || isDeuceAlert || isChangeOfEnds) && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3 compact:mt-1.5 w-full max-w-xs">
                {isBreakPoint && (
                  <div className="bg-surface-container-high border border-outline-variant text-text-primary py-0.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-rose-400">warning</span>
                    {translations.scoreboard.tennis.breakPoint}
                  </div>
                )}

                {isDeuceAlert && (
                  <div className="bg-surface-container-high border border-outline-variant text-text-secondary py-0.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-text-muted">hourglass_empty</span>
                    {isGoldenPoint ? translations.scoreboard.tennis.goldenPoint : `${translations.scoreboard.tennis.deuce} (40 - 40)`}
                  </div>
                )}

                {isChangeOfEnds && (
                  <div className="bg-surface-container-high border border-outline-variant text-text-secondary py-0.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">sync_alt</span>
                    {translations.scoreboard.courtSwitch}
                  </div>
                )}
              </div>
            )}

            {/* Server Toggle Button */}
            {canEdit && (
              <button
                onClick={toggleServer}
                className="mt-3 compact:mt-1.5 text-xs compact:text-[11px] font-medium text-text-secondary hover:text-text-primary bg-surface-container-high hover:bg-surface-container-highest px-3 py-1.5 compact:py-1 rounded-lg border border-outline-variant transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">sync</span>
                {translations.scoreboard.tennis.toggleServer}
              </button>
            )}
          </div>
        }
        right={renderTeamColumn(1)}
        rightActions={canEdit ? renderTeamActions(1) : undefined}
      />

      {/* Set-by-Set Breakdown Table */}
      <ScoreboardSummaryCard
        title="Set Summary & Statistics"
        subtitle={`Best of ${defaultMaxSets} sets (${setsToWin} to win)`}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-text-muted border-b border-outline-variant text-xs font-medium">
              <th className="py-2.5">Team / Player</th>
              {Array.from({ length: defaultMaxSets }).map((_, i) => (
                <th key={i} className="py-2.5 text-center">
                  S{i + 1}
                </th>
              ))}
              <th className="py-2.5 text-center">Games</th>
              <th className="py-2.5 text-center">Points</th>
              <th className="py-2.5 text-center">Aces</th>
              <th className="py-2.5 text-center">Double Faults</th>
              <th className="py-2.5 text-center text-text-primary font-semibold">Sets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {[0, 1].map((idx) => {
              const teamName = formatTeamOrPlayerName(idx === 0 ? teamHome : teamAway);
              const setsWon = idx === 0 ? homeSetsWon : awaySetsWon;
              const teamAces = idx === 0 ? aces.home : aces.away;
              const teamDfs = idx === 0 ? doubleFaults.home : doubleFaults.away;
              return (
                <tr key={idx}>
                  <td className="py-3 font-medium text-text-primary">
                    {teamName}
                  </td>
                  {Array.from({ length: defaultMaxSets }).map((_, i) => {
                    const set = setHistory[i];
                    const isCurrent = i === setHistory.length;
                    const myVal = idx === 0 ? set?.home : set?.away;
                    const oppVal = idx === 0 ? set?.away : set?.home;
                    return (
                      <td
                        key={i}
                        className={`py-3 text-center font-digital text-base ${
                          set && (myVal ?? 0) > (oppVal ?? 0)
                            ? "text-text-primary font-semibold"
                            : set
                            ? "text-text-muted"
                            : isCurrent
                            ? "text-text-primary"
                            : "text-text-muted/30"
                        }`}
                      >
                        {set ? myVal : isCurrent ? games[idx] : "-"}
                      </td>
                    );
                  })}
                  <td className="py-3 text-center font-digital text-base text-text-primary">
                    {games[idx]}
                  </td>
                  <td className="py-3 text-center font-digital text-base text-text-secondary">
                    {formatPoint(idx)}
                  </td>
                  <td className="py-3 text-center font-digital text-base text-text-secondary">
                    {teamAces}
                  </td>
                  <td className="py-3 text-center font-digital text-base text-text-secondary">
                    {teamDfs}
                  </td>
                  <td className="py-3 text-center font-digital text-xl font-semibold text-text-primary">
                    {setsWon}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScoreboardSummaryCard>

      {/* Finalize Match Button */}
      {canEdit && (
        <ScoreboardFinalizeButton onClick={handleFinalizeMatch} label={translations.scoreboard.endMatch} />
      )}
    </div>
  );
}
