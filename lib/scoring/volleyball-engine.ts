export interface VolleyballRules {
  sport_type?: "Volleyball" | "Beach Volleyball" | "volleyball" | "beach_volleyball";
  max_sets?: number;
  match_format?: "best_of_1" | "best_of_3" | "best_of_5";
  points_per_set?: number;
  deciding_set_points?: number;
  point_cap?: number | null;
  deciding_set_cap?: number | null;
}

export interface VolleyballRallyLogEntry {
  rally_number: number;
  server: 0 | 1;
  winner: 0 | 1;
  is_sideout: boolean;
  is_break_point: boolean;
  score_after: { home: number; away: number };
}

export interface VolleyballSetResult {
  team1: number;
  team2: number;
  home: number;
  away: number;
  rallies_history?: VolleyballRallyLogEntry[];
  points_progression?: string[];
}

export interface VolleyballScoresState {
  current: { home: number; away: number };
  sets: VolleyballSetResult[];
  set_scores: VolleyballSetResult[];
  final_sets: [number, number];
  current_set: number;
  serving_index: 0 | 1;
  match_won: boolean;
  volleyball: {
    current_set_rallies: VolleyballRallyLogEntry[];
    current_set_points: string[];
    last_rally_sideout: boolean;
    change_ends: boolean;
    technical_timeout: boolean;
    is_deciding_set: boolean;
  };
}

export interface VolleyballSetScoreSpec {
  home: number;
  away: number;
}

export function createInitialVolleyballScores(initialServer: 0 | 1 = 0): VolleyballScoresState {
  return {
    current: { home: 0, away: 0 },
    sets: [],
    set_scores: [],
    final_sets: [0, 0],
    current_set: 1,
    serving_index: initialServer,
    match_won: false,
    volleyball: {
      current_set_rallies: [],
      current_set_points: [],
      last_rally_sideout: false,
      change_ends: false,
      technical_timeout: false,
      is_deciding_set: false,
    },
  };
}

/**
 * TypeScript mirror of PostgreSQL `public.calculate_volleyball_score(p_scores, v_side, v_rules)`
 */
export function calculateVolleyballScore(
  prevScores: VolleyballScoresState,
  side: "home" | "away",
  rules: VolleyballRules = {}
): VolleyballScoresState {
  if (prevScores.match_won) {
    return prevScores;
  }

  const sportLower = (rules.sport_type || "Volleyball").toLowerCase();
  const isBeach = sportLower === "beach_volleyball" || sportLower === "beach volleyball";
  const maxSets =
    rules.max_sets ??
    (rules.match_format === "best_of_5" ? 5 : rules.match_format === "best_of_1" ? 1 : 3);
  const setsToWin = Math.ceil(maxSets / 2);

  const sets: VolleyballSetResult[] = [...(prevScores.sets ?? prevScores.set_scores ?? [])];
  const currentSet = prevScores.current_set ?? sets.length + 1;
  const isDecidingSet = maxSets > 1 && sets.length === maxSets - 1;

  const targetPoints = isDecidingSet
    ? rules.deciding_set_points ?? 15
    : rules.points_per_set ?? (isBeach ? 21 : 25);

  const pointCap =
    isDecidingSet && rules.deciding_set_cap !== undefined
      ? rules.deciding_set_cap
      : rules.point_cap ?? null;

  let p1Current = prevScores.current?.home ?? 0;
  let p2Current = prevScores.current?.away ?? 0;
  const prevServer: 0 | 1 = prevScores.serving_index ?? 0;
  const winnerIdx: 0 | 1 = side === "home" ? 0 : 1;

  if (side === "home") {
    p1Current += 1;
  } else {
    p2Current += 1;
  }

  const isSideout = winnerIdx !== prevServer;
  const servingIdx: 0 | 1 = winnerIdx;
  const totalPts = p1Current + p2Current;

  const currentSetPoints = [
    ...(prevScores.volleyball?.current_set_points ?? []),
    `${p1Current}-${p2Current}`,
  ];
  const currentSetRallies: VolleyballRallyLogEntry[] = [
    ...(prevScores.volleyball?.current_set_rallies ?? []),
    {
      rally_number: (prevScores.volleyball?.current_set_rallies?.length ?? 0) + 1,
      server: prevServer,
      winner: winnerIdx,
      is_sideout: isSideout,
      is_break_point: !isSideout,
      score_after: { home: p1Current, away: p2Current },
    },
  ];

  let setWon = false;
  if (pointCap !== null && (p1Current >= pointCap || p2Current >= pointCap)) {
    setWon = true;
  } else if (
    (p1Current >= targetPoints || p2Current >= targetPoints) &&
    Math.abs(p1Current - p2Current) >= 2
  ) {
    setWon = true;
  }

  // FIVB Court Switch (change_ends) & Technical Timeout
  let changeEnds = false;
  let techTimeout = false;

  if (isBeach) {
    if (setWon) {
      changeEnds = true;
    } else if (isDecidingSet && totalPts > 0 && totalPts % 5 === 0) {
      changeEnds = true;
    } else if (!isDecidingSet && totalPts > 0 && totalPts % 7 === 0) {
      changeEnds = true;
    }

    if (!isDecidingSet && !setWon && totalPts === 21) {
      techTimeout = true;
    }
  } else {
    if (setWon) {
      changeEnds = true;
    } else if (
      isDecidingSet &&
      Math.max(p1Current, p2Current) === 8 &&
      Math.min(p1Current, p2Current) < 8 &&
      ((side === "home" && p1Current === 8) || (side === "away" && p2Current === 8))
    ) {
      changeEnds = true;
    }
  }

  if (setWon) {
    sets.push({
      team1: p1Current,
      team2: p2Current,
      home: p1Current,
      away: p2Current,
      rallies_history: currentSetRallies,
      points_progression: currentSetPoints,
    });

    let setsP1 = 0;
    let setsP2 = 0;
    for (const s of sets) {
      if ((s.home ?? s.team1) > (s.away ?? s.team2)) {
        setsP1 += 1;
      } else {
        setsP2 += 1;
      }
    }

    const matchWon = setsP1 >= setsToWin || setsP2 >= setsToWin;

    return {
      current: { home: 0, away: 0 },
      sets,
      set_scores: sets,
      final_sets: [setsP1, setsP2],
      current_set: matchWon ? currentSet : currentSet + 1,
      serving_index: servingIdx,
      match_won: matchWon,
      volleyball: {
        current_set_rallies: [],
        current_set_points: [],
        last_rally_sideout: isSideout,
        change_ends: changeEnds,
        technical_timeout: false,
        is_deciding_set: !matchWon && maxSets > 1 && sets.length === maxSets - 1,
      },
    };
  }

  let setsP1 = 0;
  let setsP2 = 0;
  for (const s of sets) {
    if ((s.home ?? s.team1) > (s.away ?? s.team2)) {
      setsP1 += 1;
    } else {
      setsP2 += 1;
    }
  }

  return {
    current: { home: p1Current, away: p2Current },
    sets,
    set_scores: sets,
    final_sets: [setsP1, setsP2],
    current_set: currentSet,
    serving_index: servingIdx,
    match_won: false,
    volleyball: {
      current_set_rallies: currentSetRallies,
      current_set_points: currentSetPoints,
      last_rally_sideout: isSideout,
      change_ends: changeEnds,
      technical_timeout: techTimeout,
      is_deciding_set: isDecidingSet,
    },
  };
}

/**
 * Replays an OpenVolley / DataVolley rally sequence string where:
 *  - 'S' = Serving team wins the rally (Break Point)
 *  - 'R' = Receiving team wins the rally (Side-out)
 */
export function playDataVolleyRallyString(
  initialState: VolleyballScoresState,
  rallyString: string,
  rules: VolleyballRules = {}
): VolleyballScoresState {
  let state = initialState;
  for (const ch of rallyString) {
    if (ch !== "S" && ch !== "R") continue;
    const serverIdx = state.serving_index;
    const winnerIdx: 0 | 1 = ch === "S" ? serverIdx : ((1 - serverIdx) as 0 | 1);
    const side: "home" | "away" = winnerIdx === 0 ? "home" : "away";
    state = calculateVolleyballScore(state, side, rules);
  }
  return state;
}

/**
 * Generates a realistic rally-by-rally sequence (`("home" | "away")[]`) that produces
 * the exact target set score `(spec.home, spec.away)` without prematurely triggering
 * a set win before the deuce/advantage extension is reached.
 */
export function generateRallySequenceForSet(
  spec: VolleyballSetScoreSpec,
  targetPoints: number = 21
): ("home" | "away")[] {
  const rallies: ("home" | "away")[] = [];
  const winnerSide: "home" | "away" = spec.home > spec.away ? "home" : "away";
  const loserSide: "home" | "away" = winnerSide === "home" ? "away" : "home";
  const winnerPts = Math.max(spec.home, spec.away);
  const loserPts = Math.min(spec.home, spec.away);

  let w = 0;
  let l = 0;

  // If the set went to deuce / overtime (e.g. 26-24 in 25-pt set, or 23-21 in 21-pt set, or 19-17 in 15-pt set)
  if (loserPts >= targetPoints - 1) {
    const deuceBase = targetPoints - 1;
    // Interleave points up to (targetPoints - 1) - (targetPoints - 1), e.g., 20-20 or 24-24 or 14-14
    while (w < deuceBase || l < deuceBase) {
      if (w < deuceBase) {
        rallies.push(winnerSide);
        w++;
      }
      if (l < deuceBase) {
        rallies.push(loserSide);
        l++;
      }
    }
    // Now at deuceBase - deuceBase (e.g. 20-20). Alternate advantage + deuce until loser reaches loserPts
    while (l < loserPts) {
      rallies.push(winnerSide);
      w++;
      rallies.push(loserSide);
      l++;
    }
    // Finally winner scores the winning 1 or 2 points (e.g. 2 points for win-by-2, or 1 point if hard cap)
    while (w < winnerPts) {
      rallies.push(winnerSide);
      w++;
    }
  } else {
    // Standard regulation set win (loserPts <= targetPoints - 2):
    // Interleave side-outs and small runs up to loserPts, holding winner at (targetPoints - 1) until loser has all points
    const maxSafeWinnerBeforeLoserDone = Math.min(winnerPts - 1, targetPoints - 1);
    while (l < loserPts) {
      if (w < maxSafeWinnerBeforeLoserDone) {
        rallies.push(winnerSide);
        w++;
      }
      rallies.push(loserSide);
      l++;
    }
    while (w < winnerPts) {
      rallies.push(winnerSide);
      w++;
    }
  }

  return rallies;
}

/**
 * Generates the complete rally-by-rally sequence for a multi-set Volleyball or Beach Volleyball match.
 */
export function generateRallySequenceForMatch(
  sets: VolleyballSetScoreSpec[],
  rules: VolleyballRules = {}
): ("home" | "away")[] {
  const sportLower = (rules.sport_type || "Volleyball").toLowerCase();
  const isBeach = sportLower === "beach_volleyball" || sportLower === "beach volleyball";
  const maxSets =
    rules.max_sets ??
    (rules.match_format === "best_of_5" ? 5 : rules.match_format === "best_of_1" ? 1 : 3);

  const allRallies: ("home" | "away")[] = [];
  sets.forEach((setSpec, idx) => {
    const isDeciding = maxSets > 1 && idx === maxSets - 1;
    const target = isDeciding
      ? rules.deciding_set_points ?? 15
      : rules.points_per_set ?? (isBeach ? 21 : 25);
    allRallies.push(...generateRallySequenceForSet(setSpec, target));
  });

  return allRallies;
}
