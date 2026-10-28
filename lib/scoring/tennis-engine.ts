export interface TennisRules {
  no_ad?: boolean;
  set_type?: "tiebreak" | "advantage";
  max_sets?: number;
  match_format?: "best_of_1" | "best_of_3" | "best_of_5";
  match_tiebreak?: boolean;
  final_set_tiebreak_points?: number;
}

export interface TennisGameLogEntry {
  game_number: number;
  server: 0 | 1;
  winner: 0 | 1;
  is_break: boolean;
  is_tiebreak: boolean;
  games_after: { home: number; away: number };
  points_progression: string[];
}

export interface TennisSetResult {
  home: number;
  away: number;
  team1?: number;
  team2?: number;
  tiebreak?: { home: number; away: number };
  games_history?: TennisGameLogEntry[];
}

export interface TennisScoresState {
  current: { home: number; away: number };
  sets?: TennisSetResult[];
  final_sets?: [number, number];
  final_history?: TennisSetResult[];
  serving_index: 0 | 1;
  match_won: boolean;
  tennis: {
    points: [number, number];
    games: [number, number];
    sets: TennisSetResult[];
    current_set: number;
    is_tiebreak: boolean;
    tiebreak_initial_server: 0 | 1 | null;
    current_set_games: TennisGameLogEntry[];
    current_game_points: string[];
    server_side: "deuce" | "ad";
    change_ends: boolean;
  };
}

const TENNIS_PT_NAMES = ["0", "15", "30", "40"];

export function createInitialTennisScores(initialServer: 0 | 1 = 0): TennisScoresState {
  return {
    current: { home: 0, away: 0 },
    sets: [],
    final_sets: [0, 0],
    final_history: [],
    serving_index: initialServer,
    match_won: false,
    tennis: {
      points: [0, 0],
      games: [0, 0],
      sets: [],
      current_set: 1,
      is_tiebreak: false,
      tiebreak_initial_server: null,
      current_set_games: [],
      current_game_points: [],
      server_side: "deuce",
      change_ends: false,
    },
  };
}

/**
 * TypeScript mirror of PostgreSQL `public.calculate_tennis_score(p_scores, v_winner_idx, v_rules)`
 */
export function calculateTennisScore(
  prevScores: TennisScoresState,
  winnerIdx: 0 | 1,
  rules: TennisRules = {}
): TennisScoresState {
  if (prevScores.match_won) {
    return prevScores;
  }

  const oppIdx: 0 | 1 = winnerIdx === 0 ? 1 : 0;
  const noAd = Boolean(rules.no_ad);
  const setType = rules.set_type ?? "tiebreak";
  const maxSets =
    rules.max_sets ??
    (rules.match_format === "best_of_5" ? 5 : rules.match_format === "best_of_1" ? 1 : 3);
  const setsToWin = Math.ceil(maxSets / 2);
  const useMatchTb = Boolean(rules.match_tiebreak);
  const finalSetTbPoints = rules.final_set_tiebreak_points ?? 7;

  const points: [number, number] = [
    prevScores.tennis?.points?.[0] ?? 0,
    prevScores.tennis?.points?.[1] ?? 0,
  ];
  const games: [number, number] = [
    prevScores.tennis?.games?.[0] ?? 0,
    prevScores.tennis?.games?.[1] ?? 0,
  ];
  const sets: TennisSetResult[] = [...(prevScores.tennis?.sets ?? [])];
  let currentSetIdx = prevScores.tennis?.current_set ?? 1;
  let isTiebreak = Boolean(prevScores.tennis?.is_tiebreak);
  let servingIdx: 0 | 1 = prevScores.serving_index ?? 0;
  let tbInitServer: 0 | 1 | null = prevScores.tennis?.tiebreak_initial_server ?? null;
  let currentSetGames: TennisGameLogEntry[] = [...(prevScores.tennis?.current_set_games ?? [])];
  let currentGamePoints: string[] = [...(prevScores.tennis?.current_game_points ?? [])];

  const isMatchTiebreak = useMatchTb && currentSetIdx === maxSets && maxSets > 1;

  if ((isTiebreak || isMatchTiebreak) && tbInitServer === null) {
    tbInitServer = servingIdx;
  }

  const wasTiebreakGame = isTiebreak || isMatchTiebreak;
  const gameServer: 0 | 1 = wasTiebreakGame ? (tbInitServer ?? servingIdx) : servingIdx;

  // A. Update Points
  points[winnerIdx] += 1;

  let gameWon = false;
  let setWon = false;
  let matchWon = false;
  let tbScore: { home: number; away: number } | undefined;

  // B. Check for Game Win
  if (wasTiebreakGame) {
    const tbPointsToWin = isMatchTiebreak
      ? 10
      : currentSetIdx === maxSets
      ? finalSetTbPoints
      : 7;

    currentGamePoints.push(`${points[0]}-${points[1]}`);

    if (points[winnerIdx] >= tbPointsToWin && points[winnerIdx] - points[oppIdx] >= 2) {
      gameWon = true;
      tbScore = { home: points[0], away: points[1] };
    } else {
      const totalTbPoints = points[0] + points[1];
      if (totalTbPoints % 2 === 1) {
        servingIdx = (1 - servingIdx) as 0 | 1;
      }
    }
  } else {
    if (noAd) {
      if (points[winnerIdx] >= 4) {
        gameWon = true;
      }
    } else {
      if (points[winnerIdx] >= 4 && points[winnerIdx] - points[oppIdx] >= 2) {
        gameWon = true;
      } else if (points[winnerIdx] === 4 && points[oppIdx] === 4) {
        points[0] = 3;
        points[1] = 3;
      }
    }

    if (gameWon) {
      currentGamePoints.push("Game");
    } else {
      let pointLabel: string;
      if (points[0] >= 3 && points[1] >= 3) {
        pointLabel = points[0] === points[1] ? "40-40" : points[0] > points[1] ? "AD-40" : "40-AD";
      } else {
        pointLabel = `${TENNIS_PT_NAMES[points[0]]}-${TENNIS_PT_NAMES[points[1]]}`;
      }
      currentGamePoints.push(pointLabel);
    }
  }

  // C. Handle Game Won
  if (gameWon) {
    games[winnerIdx] += 1;
    points[0] = 0;
    points[1] = 0;

    currentSetGames.push({
      game_number: currentSetGames.length + 1,
      server: gameServer,
      winner: winnerIdx,
      is_break: !wasTiebreakGame && winnerIdx !== gameServer,
      is_tiebreak: wasTiebreakGame,
      games_after: { home: games[0], away: games[1] },
      points_progression: currentGamePoints,
    });
    currentGamePoints = [];

    if (wasTiebreakGame) {
      servingIdx = (1 - (tbInitServer ?? servingIdx)) as 0 | 1;
      isTiebreak = false;
      tbInitServer = null;
      setWon = true;
    } else {
      servingIdx = (1 - servingIdx) as 0 | 1;

      if (games[winnerIdx] >= 6) {
        if (games[winnerIdx] - games[oppIdx] >= 2) {
          setWon = true;
        } else if (games[0] === 6 && games[1] === 6 && setType === "tiebreak") {
          isTiebreak = true;
          tbInitServer = servingIdx;
        }
      }
    }
  }

  // D. Handle Set Won
  if (setWon) {
    const completedSet: TennisSetResult = {
      home: games[0],
      away: games[1],
      team1: games[0],
      team2: games[1],
      ...(tbScore ? { tiebreak: tbScore } : {}),
      games_history: currentSetGames,
    };
    sets.push(completedSet);
    games[0] = 0;
    games[1] = 0;
    currentSetGames = [];
    currentSetIdx += 1;
  }

  let setsP1 = 0;
  let setsP2 = 0;
  for (const s of sets) {
    if (s.home > s.away) setsP1 += 1;
    else setsP2 += 1;
  }

  if (setsP1 >= setsToWin || setsP2 >= setsToWin) {
    matchWon = true;
  } else if (setWon && useMatchTb && currentSetIdx === maxSets && maxSets > 1) {
    tbInitServer = servingIdx;
  }

  const totalGamesInSet = games[0] + games[1];
  const changeEnds =
    (points[0] === 0 && points[1] === 0 && (totalGamesInSet % 2 === 1 || setWon)) ||
    ((isTiebreak || isMatchTiebreak) && points[0] + points[1] > 0 && (points[0] + points[1]) % 6 === 0);

  return {
    current: { home: games[0], away: games[1] },
    sets,
    final_sets: [setsP1, setsP2],
    final_history: sets,
    serving_index: servingIdx,
    match_won: matchWon,
    tennis: {
      points,
      games,
      sets,
      current_set: currentSetIdx,
      is_tiebreak: isTiebreak,
      tiebreak_initial_server: tbInitServer,
      current_set_games: currentSetGames,
      current_game_points: currentGamePoints,
      server_side: (points[0] + points[1]) % 2 === 0 ? "deuce" : "ad",
      change_ends: changeEnds,
    },
  };
}

/**
 * Generates the exact point-winner sequence (0 = home, 1 = away) needed to produce
 * a given set score (e.g., 6-4, 7-5, 7-6(6), 10-8 advantage set, or [10-8] match tiebreak).
 */
export interface SetScoreSpec {
  home: number;
  away: number;
  /** Loser's points in the tiebreak (e.g., 6 for 7-6(6), 8 for 7-6(8) -> 10-8 tiebreak) */
  tbLoserPoints?: number;
  /** Target points to win the tiebreak (default 7, or 10 for Grand Slam final set super-tiebreak) */
  tbTargetPoints?: number;
  /** True if this set is a 10-point Match Tiebreak (e.g., 10-8) */
  isMatchTiebreak?: boolean;
}

export function generatePointSequenceForSet(spec: SetScoreSpec): (0 | 1)[] {
  const points: (0 | 1)[] = [];

  if (spec.isMatchTiebreak) {
    const winner: 0 | 1 = spec.home > spec.away ? 0 : 1;
    const loser: 0 | 1 = winner === 0 ? 1 : 0;
    const winnerPts = Math.max(spec.home, spec.away);
    const loserPts = Math.min(spec.home, spec.away);

    const common = Math.min(loserPts, winnerPts - 2);
    for (let i = 0; i < common; i++) {
      points.push(winner, loser);
    }
    for (let i = common; i < loserPts; i++) {
      points.push(loser);
    }
    for (let i = common; i < winnerPts; i++) {
      points.push(winner);
    }
    return points;
  }

  const isTiebreakSet =
    (spec.home === 7 && spec.away === 6) || (spec.home === 6 && spec.away === 7);

  const regularHomeGames = isTiebreakSet ? 6 : spec.home;
  const regularAwayGames = isTiebreakSet ? 6 : spec.away;

  // Build game winner order that never finishes the set prematurely
  const gameWinners: (0 | 1)[] = [];
  const commonGames = Math.min(regularHomeGames, regularAwayGames);

  for (let i = 0; i < commonGames; i++) {
    if (spec.home >= spec.away) {
      gameWinners.push(0, 1);
    } else {
      gameWinners.push(1, 0);
    }
  }

  for (let i = commonGames; i < regularHomeGames; i++) {
    gameWinners.push(0);
  }
  for (let i = commonGames; i < regularAwayGames; i++) {
    gameWinners.push(1);
  }

  // Produce realistic game point patterns (40-0, 40-15, 40-30, Deuce -> AD -> Game)
  gameWinners.forEach((gw, gameIdx) => {
    const gl: 0 | 1 = gw === 0 ? 1 : 0;
    const pattern = gameIdx % 4;
    if (pattern === 0) {
      // 40-15 game (e.g., 15-0, 30-0, 30-15, 40-15, Game)
      points.push(gw, gw, gl, gw, gw);
    } else if (pattern === 1) {
      // 40-30 game (e.g., 15-0, 15-15, 30-15, 30-30, 40-30, Game)
      points.push(gw, gl, gw, gl, gw, gw);
    } else if (pattern === 2) {
      // Deuce game (15-0, 15-15, 30-15, 30-30, 40-30, 40-40, AD, Game)
      points.push(gw, gl, gw, gl, gw, gl, gw, gw);
    } else {
      // Love game (15-0, 30-0, 40-0, Game)
      points.push(gw, gw, gw, gw);
    }
  });

  // If 7-6 or 6-7, append the tiebreak point sequence
  if (isTiebreakSet) {
    const tbWinner: 0 | 1 = spec.home > spec.away ? 0 : 1;
    const tbLoser: 0 | 1 = tbWinner === 0 ? 1 : 0;
    const loserPts = spec.tbLoserPoints ?? 4;
    const winnerPts = Math.max(spec.tbTargetPoints ?? 7, loserPts + 2);

    const commonTb = Math.min(loserPts, winnerPts - 2);
    for (let i = 0; i < commonTb; i++) {
      points.push(tbWinner, tbLoser);
    }
    for (let i = commonTb; i < loserPts; i++) {
      points.push(tbLoser);
    }
    for (let i = commonTb; i < winnerPts; i++) {
      points.push(tbWinner);
    }
  }

  return points;
}

export function generatePointSequenceForMatch(sets: SetScoreSpec[]): (0 | 1)[] {
  const allPoints: (0 | 1)[] = [];
  for (const setSpec of sets) {
    allPoints.push(...generatePointSequenceForSet(setSpec));
  }
  return allPoints;
}

/**
 * Replays a MatchChartingProject (JeffSackmann) server/returner point string
 * where 'S' (or 'A' / 'W') = server wins point and 'R' (or 'D') = returner wins point.
 */
export function playMCPGameString(
  scores: TennisScoresState,
  mcpString: string,
  rules: TennisRules = {}
): TennisScoresState {
  let state = scores;
  for (const ch of mcpString) {
    const serverIdx = state.serving_index;
    const returnerIdx: 0 | 1 = serverIdx === 0 ? 1 : 0;
    if (ch === "S" || ch === "A" || ch === "W") {
      state = calculateTennisScore(state, serverIdx, rules);
    } else if (ch === "R" || ch === "D") {
      state = calculateTennisScore(state, returnerIdx, rules);
    }
  }
  return state;
}
