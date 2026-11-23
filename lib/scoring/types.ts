import type { TennisSetResult, TennisGameLogEntry } from "./tennis-engine";
import type { VolleyballSetResult, VolleyballRallyLogEntry } from "./volleyball-engine";

export type SetScoreEntry =
  | [number, number]
  | {
      home?: number;
      away?: number;
      team1?: number;
      team2?: number;
      tiebreak?: { home: number; away: number };
      games_history?: TennisGameLogEntry[];
      rallies_history?: VolleyballRallyLogEntry[];
    };

export interface FootballScoresSlice {
  goals?: [number, number] | { home: number; away: number };
  yellow_cards?: { home: number; away: number };
  red_cards?: { home: number; away: number };
  corners?: { home: number; away: number };
  shots?: { home: number; away: number };
  period?: string | number;
  elapsed_seconds?: number;
  is_clock_running?: boolean;
}

export interface BasketballScoresSlice {
  total_points?: [number, number];
  quarters?: Array<{ home: number; away: number }>;
  period?: string;
  fouls?: { home: number; away: number };
  timeouts?: { home: number; away: number };
  quarter_seconds?: number;
  is_clock_running?: boolean;
}

export interface TennisScoresSlice {
  points: [number, number];
  games: [number, number];
  sets: TennisSetResult[] | SetScoreEntry[];
  current_set?: number;
  is_tiebreak?: boolean;
  tiebreak_initial_server?: 0 | 1 | null;
  current_set_games?: TennisGameLogEntry[];
  current_game_points?: string[];
  server_side?: "deuce" | "ad";
  serving_team?: 0 | 1 | "home" | "away";
}

export interface VolleyballScoresSlice {
  sets?: VolleyballSetResult[] | SetScoreEntry[];
  current_points?: [number, number];
  current_set?: number;
  current_set_rallies?: VolleyballRallyLogEntry[];
  serving_team?: 0 | 1 | "home" | "away";
}

export interface MatchScores {
  current?: { home: number; away: number };
  sets?: SetScoreEntry[];
  set_scores?: SetScoreEntry[];
  serving_index?: 0 | 1;
  match_won?: boolean;
  goals?: [number, number];
  total_points?: [number, number];
  tennis?: TennisScoresSlice;
  volleyball?: VolleyballScoresSlice;
  football?: FootballScoresSlice;
  basketball?: BasketballScoresSlice;
}
