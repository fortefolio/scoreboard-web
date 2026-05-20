"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function FootballScoreboard({ 
  matchData, 
  canEdit 
}: { 
  matchData: any; 
  canEdit: boolean;
}) {
  // Scoring & Match State
  const [goals, setGoals] = useState({ home: 0, away: 0 });
  const [period, setPeriod] = useState("1st Half");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isClockRunning, setIsClockRunning] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state when matchData updates via real-time
  useEffect(() => {
    if (matchData?.scores) {
      setGoals({
        home: matchData.scores.current?.home || 0,
        away: matchData.scores.current?.away || 0
      });
      
      const football = matchData.scores.football || {};
      setPeriod(football.period || "1st Half");
      setElapsedSeconds(football.elapsed_seconds || 0);
      setIsClockRunning(football.is_clock_running || false);
    }
  }, [matchData?.scores]);

  // Local Clock Logic
  useEffect(() => {
    if (isClockRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGoal = async (side: 'home' | 'away') => {
    if (!canEdit) return;

    // Optimistic UI update
    setGoals(prev => ({ ...prev, [side]: prev[side] + 1 }));

    const { error } = await supabase
      .from('match_events')
      .insert([{
        match_id: matchData.id,
        event_data: { 
          type: 'goal', 
          side: side 
        }
      }]);

    if (error) {
      console.error("Error recording goal:", error);
      toast.error("Failed to record goal");
    }
  };

  const toggleClock = async () => {
    if (!canEdit) return;

    const nextRunningState = !isClockRunning;
    setIsClockRunning(nextRunningState);

    const { error } = await supabase
      .from('match_events')
      .insert([{
        match_id: matchData.id,
        event_data: { 
          type: 'clock_toggle', 
          is_running: nextRunningState,
          elapsed_seconds: elapsedSeconds
        }
      }]);

    if (error) {
      toast.error("Failed to update clock");
      setIsClockRunning(!nextRunningState);
    }
  };

  const changePeriod = async () => {
    if (!canEdit) return;

    const periods = ["1st Half", "Half Time", "2nd Half", "Full Time"];
    const currentIndex = periods.indexOf(period);
    const nextPeriod = periods[(currentIndex + 1) % periods.length];

    setPeriod(nextPeriod);
    
    // Auto-pause clock on period change if it's not a live half
    const shouldRun = nextPeriod === "1st Half" || nextPeriod === "2nd Half";
    if (!shouldRun && isClockRunning) setIsClockRunning(false);

    const { error } = await supabase
      .from('match_events')
      .insert([{
        match_id: matchData.id,
        event_data: { 
          type: 'period_change', 
          period: nextPeriod,
          is_running: shouldRun ? isClockRunning : false,
          elapsed_seconds: elapsedSeconds
        }
      }]);

    if (error) toast.error("Failed to change period");
  };

  return (
    <div className="min-h-screen bg-[#0c1324] text-on-surface font-sans overflow-x-hidden pb-32">
      <main className="px-4 md:px-8 max-w-[1400px] mx-auto pt-8">
        
        {/* Dashboard Header */}
        <header className="mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary-container/10 text-primary-container px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-primary-container/20">Live Arena</span>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Football Match • {matchData.tournaments?.name || "Independent"}</span>
            </div>
            <h1 className="text-4xl font-headline font-extrabold tracking-tight italic text-white uppercase">Umpire Control Panel</h1>
          </div>

          {/* Match Status Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-3xl flex items-center gap-8 shadow-2xl">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Current Period</span>
              <span className="text-xl font-headline font-black text-primary italic uppercase">{period}</span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Match Clock</span>
              <span className={`text-2xl font-mono font-black ${isClockRunning ? 'text-secondary animate-pulse' : 'text-white/40'}`}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </div>
        </header>

        {/* Scoring Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          {/* Home Team */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-container/20 to-transparent rounded-[3rem] blur-xl opacity-50 transition duration-1000 group-hover:opacity-100"></div>
            <div className="relative bg-[#1a2035]/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 flex flex-col items-center shadow-2xl">
              <span className="absolute top-8 right-10 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Home Team</span>
              <h2 className="text-2xl font-headline font-black text-white mb-12 tracking-tight uppercase italic">{matchData.participants?.[0]?.name || "Home"}</h2>
              
              <div className="font-headline text-[12rem] md:text-[16rem] leading-none font-black text-primary-container score-shadow-indigo mb-12 tracking-tighter">
                {goals.home}
              </div>

              {canEdit && (
                <button 
                  onClick={() => handleGoal('home')}
                  className="w-full bg-primary-container hover:bg-primary-container/80 text-white py-12 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-primary-container/20 group/btn"
                >
                  <span className="material-symbols-outlined text-6xl font-black transition-transform group-hover/btn:scale-110">add_circle</span>
                  <span className="text-sm font-black uppercase tracking-[0.2em]">Record Goal</span>
                </button>
              )}
            </div>
          </div>

          {/* Away Team */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-secondary-container/20 to-transparent rounded-[3rem] blur-xl opacity-50 transition duration-1000 group-hover:opacity-100"></div>
            <div className="relative bg-[#1a2035]/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 flex flex-col items-center shadow-2xl">
              <span className="absolute top-8 right-10 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Away Team</span>
              <h2 className="text-2xl font-headline font-black text-white mb-12 tracking-tight uppercase italic">{matchData.participants?.[1]?.name || "Away"}</h2>
              
              <div className="font-headline text-[12rem] md:text-[16rem] leading-none font-black text-secondary score-shadow-emerald mb-12 tracking-tighter">
                {goals.away}
              </div>

              {canEdit && (
                <button 
                  onClick={() => handleGoal('away')}
                  className="w-full bg-secondary hover:bg-secondary/80 text-[#0c1324] py-12 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-secondary/20 group/btn"
                >
                  <span className="material-symbols-outlined text-6xl font-black transition-transform group-hover/btn:scale-110">add_circle</span>
                  <span className="text-sm font-black uppercase tracking-[0.2em]">Record Goal</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Umpire Controls */}
        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={toggleClock}
              className={`flex items-center justify-center gap-4 py-8 rounded-3xl font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${
                isClockRunning 
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' 
                : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              <span className="material-symbols-outlined text-3xl">
                {isClockRunning ? 'pause_circle' : 'play_circle'}
              </span>
              {isClockRunning ? 'Pause Match Clock' : 'Start Match Clock'}
            </button>

            <button 
              onClick={changePeriod}
              className="flex items-center justify-center gap-4 py-8 rounded-3xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-3xl">forward_media</span>
              Next Period: {period === "Full Time" ? "Reset" : "Advance"}
            </button>
          </div>
        )}

      </main>

      {/* Background Decorative Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-primary-container/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary-container/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
    </div>
  );
}
