"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];

export default function TennisScoreboard({ matchData }: { matchData: any }) {
  // Local state for snappy UI updates before Supabase sync
  const [points, setPoints] = useState(matchData.current_game_points || [0, 0]);
  const [games, setGames] = useState([0, 0]); // Current set games
  const [sets, setSets] = useState(matchData.set_scores || []);

  const formatPoint = (playerIdx: number) => {
    const p = points[playerIdx];
    const opp = points[playerIdx === 0 ? 1 : 0];

    // Deuce/Advantage Logic
    if (p >= 3 && opp >= 3) {
      if (p === opp) return "40"; // Deuce
      return p > opp ? "AD" : "40";
    }
    return TENNIS_POINTS[p] || "0";
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#020617] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Set History Header */}
      <div className="flex justify-center gap-4 py-4 bg-gray-900/50 border-b border-gray-800">
        {sets.map((set: any, i: number) => (
          <div key={i} className="text-xs font-mono bg-gray-800 px-3 py-1 rounded-full text-gray-400">
            S{i + 1}: <span className="text-white">{set.t1}-{set.t2}</span>
          </div>
        ))}
      </div>

      {/* Main Scoring Area */}
      <div className="p-8 space-y-8">
        {[0, 1].map((idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white uppercase tracking-tight">
                {matchData.participants[idx].name}
              </span>
              <span className="text-indigo-500 text-xs font-bold uppercase tracking-widest">
                Serving {idx === 0 ? "●" : ""}
              </span>
            </div>

            <div className="flex items-center gap-6">
              {/* Games in current set */}
              <div className="text-4xl font-light text-gray-500 w-12 text-center">
                {games[idx]}
              </div>
              
              {/* Live Points (The 15, 30, 40, AD) */}
              <div className="relative">
                <div className="w-24 h-24 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                  <span className="text-5xl font-black text-white italic">
                    {formatPoint(idx)}
                  </span>
                </div>
                <button 
                  className="absolute -top-2 -right-2 w-8 h-8 bg-white text-black rounded-full font-bold shadow-lg hover:scale-110 transition-transform"
                  onClick={() => {/* Logic to increment & check for game/set win */}}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Social Context Footer */}
      <div className="p-4 bg-indigo-950/20 text-center border-t border-gray-800">
        <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-[0.2em]">
          Live Pulse: {matchData.tournament_name} • Court 1
        </p>
      </div>
    </div>
  );
}

export const handleTennisPoint = async (
  matchId: string, 
  winnerIdx: 0 | 1, 
  currentState: any
) => {
  let [p1, p2] = currentState.tennis_points;
  let [g1, g2] = currentState.tennis_games;
  let eventType = 'point_won';

  const opponentIdx = winnerIdx === 0 ? 1 : 0;

  // 1. Logic for Point -> Game
  // Standard win: Winner has 3 points (40) and opponent has < 3
  if (currentState.tennis_points[winnerIdx] === 3 && currentState.tennis_points[opponentIdx] < 3) {
    return completeGame(matchId, winnerIdx, g1, g2);
  }

  // Deuce Logic: Winner has 3+ points and is 2 points ahead
  if (currentState.tennis_points[winnerIdx] >= 3 && currentState.tennis_points[opponentIdx] >= 3) {
    if (currentState.tennis_points[winnerIdx] > currentState.tennis_points[opponentIdx]) {
      return completeGame(matchId, winnerIdx, g1, g2);
    }
  }

  // 2. Increment Point
  const newPoints = [...currentState.tennis_points];
  newPoints[winnerIdx]++;
  
  // 3. Update Supabase & Log to Social Feed
  await supabase.rpc('update_tennis_score', { 
    m_id: matchId, 
    new_p: newPoints 
  });

  await supabase.from('activity_feed').insert({
    tournament_id: currentState.tournament_id,
    event_type: 'point_won',
    content: `Point to ${currentState.participants[winnerIdx].name}!`,
    metadata: { score: `${newPoints[0]}-${newPoints[1]}` }
  });
};

async function completeGame(matchId: string, winnerIdx: number, g1: number, g2: number) {
  const newGames = [g1, g2];
  newGames[winnerIdx]++;
  
  // Reset points for the next game
  await supabase.from('matches').update({
    tennis_points: [0, 0],
    tennis_games: newGames
  }).eq('id', matchId);

  // Post the "Hype" to the Social Feed
  await supabase.from('activity_feed').insert({
    event_type: 'game_won',
    content: `GAME! ${newGames[0]}-${newGames[1]} in the current set.`
  });
}
