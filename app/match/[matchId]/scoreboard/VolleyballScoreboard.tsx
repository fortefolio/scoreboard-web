"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function VolleyballScoreboard({ 
  matchData, 
  rules, 
  canEdit 
}: { 
  matchData: any; 
  rules: any;
  canEdit: boolean;
}) {
  // Scoring State
  const [currentSetScores, setCurrentSetScores] = useState({ team1: 0, team2: 0 });
  const [setHistory, setSetHistory] = useState<{ team1: number; team2: number }[]>([]);
  const [serverIdx, setServerIdx] = useState<number | null>(matchData.scores?.serving_index ?? null);
  const [isTossing, setIsTossing] = useState(false);

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData?.scores) {
      setCurrentSetScores({
        team1: matchData.scores.current?.home || 0,
        team2: matchData.scores.current?.away || 0
      });
      setSetHistory(matchData.scores.set_scores || []);
      setServerIdx(matchData.scores.serving_index ?? null);
    }
  }, [matchData?.scores]);

  const handleToss = async (selectedIdx: number) => {
    if (!canEdit) return;
    
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
      toast.error("Failed to set server");
    }
    setIsTossing(false);
  };

  const handlePoint = async (team: 'team1' | 'team2') => {
    if (!canEdit) return;

    if (serverIdx === null) {
      toast.error("Please select the server first!");
      return;
    }

    // Optimistic UI update
    setCurrentSetScores(prev => ({
      ...prev,
      [team]: prev[team] + 1
    }));

    const { error } = await supabase
      .from('match_events')
      .insert([{
        match_id: matchData.id,
        event_data: { 
          type: 'point_won', 
          side: team === 'team1' ? 'home' : 'away' 
        }
      }]);

    if (error) {
      console.error("Error recording point:", error);
      // Let real-time sync correct it
    }
  };

  // Determine the point limit for THIS specific set
  const isDecidingSet = rules && setHistory.length === (rules.max_sets - 1);
  const activeLimit = rules ? (isDecidingSet ? (rules.deciding_set_points || 15) : rules.points_per_set) : 21;
  const cap = rules.point_cap;

  // Alerts Logic
  const isNearCap = cap && 
    currentSetScores.team1 >= cap - 1 && 
    currentSetScores.team2 >= cap - 1;

  const isDeuce = 
    currentSetScores.team1 >= activeLimit - 1 && 
    currentSetScores.team2 >= activeLimit - 1 &&
    currentSetScores.team1 === currentSetScores.team2 &&
    (!cap || currentSetScores.team1 < cap - 1);

  const isAdvantage = 
    (currentSetScores.team1 >= activeLimit || currentSetScores.team2 >= activeLimit) && 
    Math.abs(currentSetScores.team1 - currentSetScores.team2) === 1 &&
    (!cap || (currentSetScores.team1 < cap && currentSetScores.team2 < cap));

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans selection:bg-primary-container selection:text-white overflow-x-hidden pb-32">
      {/* Non-intrusive Toss Banner */}
      {serverIdx === null && (
        <div className="bg-primary-container/20 border-b border-primary-container/30 p-4 flex flex-col items-center animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary-container text-sm animate-bounce">paid</span>
            <span className="text-[10px] font-black text-primary-container uppercase tracking-[0.2em]">Select First Server</span>
          </div>
          <div className="flex gap-4 w-full max-w-sm">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                onClick={() => handleToss(idx)}
                disabled={isTossing}
                className="flex-1 bg-primary-container hover:bg-primary-container/80 text-on-primary-container py-2 px-4 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                {matchData.participants?.[idx]?.name || `Team ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="px-4 md:px-8 max-w-[1600px] mx-auto pt-8">
        {/* Dashboard Header */}
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary-container/10 text-primary-container px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-primary-container/20">Round {matchData.round_number}</span>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Match {matchData.match_order} • {matchData.sport_type}</span>
            </div>
            <h1 className="text-4xl font-headline font-extrabold tracking-tight italic">UMPIRE CONTROL PANEL</h1>
          </div>
          
          {/* Set History Breadcrumb */}
          <div className="glass-card px-6 py-3 rounded-xl flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Set History</span>
              <div className="flex items-center gap-4 text-xs font-mono font-bold">
                {setHistory.map((set, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-slate-500">S{i+1}</span>
                    <span className={set.team1 > set.team2 ? "text-success" : "text-on-surface"}>{set.team1}-{set.team2}</span>
                    <div className="w-px h-3 bg-white/10 ml-2"></div>
                  </div>
                ))}
                <div className="flex gap-2 items-center">
                  <span className="text-primary-container font-black uppercase tracking-widest text-[10px]">
                    {isDecidingSet ? "Deciding Set" : `S${setHistory.length + 1}`}
                  </span>
                  <span className="text-on-surface animate-pulse">Live</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Alerts */}
        <section className="mb-8 space-y-4">
          {isNearCap && (
            <div className="animate-hardcap bg-critical/10 border border-critical p-5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-critical flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>report</span>
                </div>
                <div>
                  <h4 className="font-headline font-black text-critical uppercase italic tracking-tighter leading-tight text-xl">Hard Point Cap Reached</h4>
                  <p className="text-critical/80 text-xs font-bold uppercase tracking-widest">Win-by-two rule suspended. Match ends at {cap} points.</p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="font-mono text-3xl font-black text-critical">MAX {cap}</div>
              </div>
            </div>
          )}

          {isDeuce && !isNearCap && (
            <div className="bg-warning/10 border border-warning p-4 rounded-xl flex items-center gap-4">
              <span className="material-symbols-outlined text-warning">warning</span>
              <p className="text-warning text-sm font-bold uppercase tracking-widest">Deuce: Win by 2 points required</p>
            </div>
          )}

          {isAdvantage && !isDeuce && !isNearCap && (
            <div className="bg-success/10 border border-success p-4 rounded-xl flex items-center gap-4">
              <span className="material-symbols-outlined text-success">sports_score</span>
              <p className="text-success text-sm font-bold uppercase tracking-widest">Advantage Mode: Win by 2 points required</p>
            </div>
          )}
        </section>

        {/* High-Performance Scoreboard */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8 relative">
          {/* Team 1 Card */}
          <div className={`xl:col-span-5 glass-card rounded-[2rem] p-10 flex flex-col items-center transition-all ${canEdit ? 'hover:border-primary-container/40' : ''} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-6 flex flex-col items-end gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Team 1</span>
              {serverIdx !== null && (
                serverIdx === 0 ? (
                  <span className="flex items-center gap-1.5 text-primary-container text-[8px] font-black uppercase tracking-widest bg-primary-container/10 px-2 py-0.5 rounded-full border border-primary-container/20 animate-pulse">
                    <span className="w-1 h-1 rounded-full bg-primary-container"></span>
                    Serving
                  </span>
                ) : (
                  <span className="text-slate-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5">Receiver</span>
                )
              )}
            </div>
            <h2 className="text-3xl font-headline font-black text-on-surface mb-10 tracking-tighter uppercase italic">{matchData.participants?.[0]?.name || "TBD"}</h2>
            <div className="font-mono text-[10rem] md:text-[14rem] leading-none font-black text-primary-container score-shadow-indigo mb-10 tracking-tighter">
              {currentSetScores.team1}
            </div>
            {canEdit && (
              <div className="w-full">
                <button 
                  onClick={() => handlePoint('team1')}
                  className="w-full bg-primary-container hover:bg-primary-container/80 text-white py-12 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary-container/20"
                >
                  <span className="material-symbols-outlined text-5xl font-black">add</span>
                  <span className="text-xs font-black uppercase tracking-widest">Add Point</span>
                </button>
              </div>
            )}
          </div>

          {/* Center Match Stats */}
          <div className="xl:col-span-2 flex flex-col justify-between gap-6 py-4">
            <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center gap-3">
              <span className="material-symbols-outlined text-primary-container text-4xl">flag</span>
              <div className="font-mono text-4xl font-black text-on-surface tracking-tighter">{activeLimit}</div>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Target Score</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <div className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
              <div className="z-10 bg-surface border-4 border-surface-variant p-6 rounded-full shadow-2xl">
                <span className="text-xl font-black text-slate-500">VS</span>
              </div>
            </div>
            <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center gap-3">
              <span className="material-symbols-outlined text-success text-4xl">rule</span>
              <div className="font-mono text-4xl font-black text-success tracking-tighter">{rules.max_sets}</div>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Max Sets</span>
            </div>
          </div>

          {/* Team 2 Card */}
          <div className={`xl:col-span-5 glass-card rounded-[2rem] p-10 flex flex-col items-center transition-all ${canEdit ? 'hover:border-success/40' : ''} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-6 flex flex-col items-end gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Team 2</span>
              {serverIdx !== null && (
                serverIdx === 1 ? (
                  <span className="flex items-center gap-1.5 text-success text-[8px] font-black uppercase tracking-widest bg-success/10 px-2 py-0.5 rounded-full border border-success/20 animate-pulse">
                    <span className="w-1 h-1 rounded-full bg-success"></span>
                    Serving
                  </span>
                ) : (
                  <span className="text-slate-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5">Receiver</span>
                )
              )}
            </div>
            <h2 className="text-3xl font-headline font-black text-on-surface mb-10 tracking-tighter uppercase italic">{matchData.participants?.[1]?.name || "TBD"}</h2>
            <div className="font-mono text-[10rem] md:text-[14rem] leading-none font-black text-success score-shadow-emerald mb-10 tracking-tighter">
              {currentSetScores.team2}
            </div>
            {canEdit && (
              <div className="w-full">
                <button 
                  onClick={() => handlePoint('team2')}
                  className="w-full bg-success hover:bg-success/80 text-surface py-12 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-success/20"
                >
                  <span className="material-symbols-outlined text-5xl font-black">add</span>
                  <span className="text-xs font-black uppercase tracking-widest">Add Point</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
