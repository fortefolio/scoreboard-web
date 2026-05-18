"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];

export default function TennisScoreboard({ matchData }: { matchData: any }) {
  // Local state for snappy UI updates before Supabase sync
  const [points, setPoints] = useState(matchData.scores?.tennis?.points || [0, 0]);
  const [games, setGames] = useState(matchData.scores?.tennis?.games || [0, 0]); // Current set games
  const [sets, setSets] = useState(matchData.scores?.set_scores || []);
  const [serverIdx, setServerIdx] = useState<number | null>(matchData.scores?.serving_index ?? null);
  const [isTossing, setIsTossing] = useState(false);

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData.scores) {
      setPoints(matchData.scores.tennis?.points || [0, 0]);
      setGames(matchData.scores.tennis?.games || [0, 0]);
      setSets(matchData.scores.set_scores || []);
      setServerIdx(matchData.scores.serving_index ?? null);
    }
  }, [matchData.scores]);

  const handleToss = async (selectedIdx: number) => {
    // Optimistic UI update
    setServerIdx(selectedIdx);
    setIsTossing(true);
    
    const { error } = await supabase
      .from('match_events')
      .insert([{
        match_id: matchData.id,
        event_data: { type: 'start_scoreboard', initial_server_index: selectedIdx }
      }]);
    
    if (error) {
      console.error("Error starting scoreboard:", error);
      // Let real-time correct it if it fails
    }
    setIsTossing(false);
  };

  const handlePoint = async (winnerIdx: number) => {
    if (serverIdx === null) {
      toast.error("Please select the server first!");
      return;
    }

    // Optimistic UI update
    const newPoints = [...points];
    newPoints[winnerIdx]++;
    setPoints(newPoints);

    const { error } = await supabase
      .from('match_events')
      .insert([{
        match_id: matchData.id,
        event_data: { 
          type: 'point_won', 
          side: winnerIdx === 0 ? 'home' : 'away' 
        }
      }]);

    if (error) {
      console.error("Error recording point:", error);
      // Revert optimistic update on error? Maybe just let real-time fix it
    }
  };

  const formatPoint = (playerIdx: number) => {
    const p = points[playerIdx];
    const opp = points[playerIdx === 0 ? 1 : 0];

    // Deuce/Advantage Logic - The backend handles this, but we need to display it correctly
    // The backend stores points as numeric values (0, 1, 2, 3, 4, 5...)
    // TENNIS_POINTS = ["0", "15", "30", "40", "AD"]
    
    if (p >= 3 && opp >= 3) {
      if (p === opp) return "40"; // Deuce
      return p > opp ? "AD" : "40";
    }
    return TENNIS_POINTS[p] || "0";
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#020617] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Non-intrusive Toss Banner */}
      {serverIdx === null && (
        <div className="bg-indigo-600/20 border-b border-indigo-500/30 p-4 flex flex-col items-center animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-indigo-400 text-sm animate-bounce">paid</span>
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Select First Server</span>
          </div>
          <div className="flex gap-4 w-full max-w-sm">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                onClick={() => handleToss(idx)}
                disabled={isTossing}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                {matchData.participants[idx].name}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2 mt-1">
                {serverIdx === idx ? (
                  <span className="flex items-center gap-1.5 text-indigo-400 text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    Serving
                  </span>
                ) : (
                  <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest px-2.5 py-1">Receiver</span>
                )}
              </div>
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
                  onClick={() => handlePoint(idx)}
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
          Live Pulse: {matchData.tournaments?.name || "Independent Match"} • {matchData.court || "TBD"}
        </p>
      </div>
    </div>
  );
}
