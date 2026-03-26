"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import TennisScoreboard from "./TennisScoreboard";

export default function UmpireMatchPage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scoring State
  const [currentSetScores, setCurrentSetScores] = useState({ team1: 0, team2: 0 });
  const [setHistory, setSetHistory] = useState<{ team1: number; team2: number }[]>([]);

  const tournamentId = match?.tournament_id;
  const matchIdStr = Array.isArray(matchId) ? matchId[0] : matchId;

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { user: currUser } } = await supabase.auth.getUser();
      setUser(currUser);

      const { data: mData } = await supabase
        .from("matches")
        .select("*, tournaments(*)")
        .eq("id", matchIdStr)
        .single();
      
      if (mData) {
        setMatch(mData);
        const tRules = mData.tournaments.settings?.overrides?.[mData.round_number] || mData.tournaments.settings?.default || { max_sets: 3, points_per_set: 21 };
        setRules(tRules);
        
        // Only the invited umpire can edit/score the match
        const isUmpire = currUser?.id === mData.umpire_id;
        setCanEdit(isUmpire);
      }
    };
    fetchAll();
  }, [matchIdStr]);

  // Determine the point limit for THIS specific set
  const isDecidingSet = rules && setHistory.length === Math.floor(rules.max_sets / 2);
  const activeLimit = rules ? (isDecidingSet ? (rules.deciding_set_points || rules.points_per_set) : rules.points_per_set) : 21;

  const handlePoint = (team: 'team1' | 'team2') => {
    if (!canEdit || isSubmitting) return;

    const p1 = currentSetScores.team1;
    const p2 = currentSetScores.team2;
    const cap = rules.point_cap;

    // 1. HARD BLOCK: If someone already hit the cap, stop everything.
    if (cap && (p1 >= cap || p2 >= cap)) return;

    setCurrentSetScores(prev => {
      const next = { ...prev, [team]: prev[team] + 1 };
      const winnerScore = Math.max(next.team1, next.team2);
      const loserScore = Math.min(next.team1, next.team2);
      const lead = winnerScore - loserScore;

      // 2. AUTOMATIC END: Reached Cap OR Reached Target with 2-point lead
      const hitCap = cap && winnerScore === cap;
      const hitStandardWin = winnerScore >= activeLimit && lead >= 2;

      if (hitCap || hitStandardWin) {
        confirmSet(next.team1, next.team2);
        return { team1: 0, team2: 0 };
      }
      
      return next;
    });
  };

  const confirmSet = (s1: number, s2: number) => {
    const newHistory = [...setHistory, { team1: s1, team2: s2 }];
    setSetHistory(newHistory);

    // Check if Match is Over (Winner has more than half of max_sets)
    const t1Wins = newHistory.filter(s => s.team1 > s.team2).length;
    const t2Wins = newHistory.filter(s => s.team2 > s.team1).length;
    const setsToWin = Math.ceil(rules.max_sets / 2);

    if (t1Wins >= setsToWin || t2Wins >= setsToWin) {
      finalizeMatch(newHistory);
    }
  };

  const finalizeMatch = async (finalHistory: any[]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const { error } = await supabase.functions.invoke('finalize-match', {
      body: { 
        matchId: matchIdStr, 
        setHistory: finalHistory 
      }
    });

    if (error) {
      toast.error("🚨 SECURITY REJECTION: " + (error.message || "Invalid Match Data"));
      setIsSubmitting(false);
    } else {
      toast.success("✅ Match Verified & Advanced!");
      router.push(`/tournament/${match.tournament_id}`);
    }
  };

  if (!match || !rules) return <div className="p-10 text-white bg-gray-950 min-h-screen">Loading...</div>;

  // IF TENNIS, RENDER SPECIALIZED SCOREBOARD
  if (match.sport_type === 'Tennis') {
    return (
      <div className="min-h-screen bg-[#0c1324] text-on-background p-6 flex flex-col items-center">
        <div className="w-full max-w-2xl mb-8">
          <button 
            onClick={() => router.push(`/match/${matchIdStr}`)}
            className="text-slate-500 hover:text-indigo-300 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Match Overview
          </button>
        </div>
        
        <header className="mb-12 text-center">
           <p className="text-secondary font-label text-[10px] font-black uppercase tracking-[0.3em] mb-3">Live Scoring Session</p>
           <h1 className="text-3xl font-headline font-black tracking-tight text-white">{match.tournaments?.name}</h1>
        </header>

        <TennisScoreboard matchData={match} />

        <div className="mt-12 p-6 bg-surface-container-low rounded-3xl border border-outline-variant/10 max-w-lg w-full text-center">
           <div className="flex items-center justify-center gap-2 text-indigo-400 mb-2">
              <span className="material-symbols-outlined text-sm">shield</span>
              <span className="font-label text-[10px] font-black uppercase tracking-widest">Secure Umpire Link</span>
           </div>
           <p className="text-on-surface-variant text-[11px] leading-relaxed">
             This scoreboard is linked directly to the Kinetic Vault pulse feed. Every point update will be broadcasted to all followers in real-time.
           </p>
        </div>
      </div>
    );
  }

  // DEFAULT SCOREBOARD (Volleyball, Football, etc.)
  const cap = rules.point_cap;
/*   const isNearCap = cap && (currentSetScores.team1 >= cap - 2 || currentSetScores.team2 >= cap - 2);

  const isDeuce = 
    currentSetScores.team1 >= activeLimit - 1 && 
    currentSetScores.team2 >= activeLimit - 1 &&
    currentSetScores.team1 === currentSetScores.team2;

  const isAdvantage = 
    (currentSetScores.team1 >= activeLimit || currentSetScores.team2 >= activeLimit) && 
    Math.abs(currentSetScores.team1 - currentSetScores.team2) < 2; */
  
  // Replace your existing alert logic with this:

  // 1. The Win-by-Two rule is only "suspended" if reaching the cap 
  // is the ONLY way to end the game.
  const isNearCap = cap && 
    currentSetScores.team1 >= cap - 1 && 
    currentSetScores.team2 >= cap - 1;

  // 2. Adjust Deuce logic to respect the cap
  const isDeuce = 
    currentSetScores.team1 >= activeLimit - 1 && 
    currentSetScores.team2 >= activeLimit - 1 &&
    currentSetScores.team1 === currentSetScores.team2 &&
    (!cap || currentSetScores.team1 < cap - 1);

  // 3. Adjust Advantage logic
  const isAdvantage = 
    (currentSetScores.team1 >= activeLimit || currentSetScores.team2 >= activeLimit) && 
    Math.abs(currentSetScores.team1 - currentSetScores.team2) === 1 &&
    (!cap || (currentSetScores.team1 < cap && currentSetScores.team2 < cap));

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans selection:bg-primary-container selection:text-white overflow-x-hidden pb-32">
      {/* TopNavBar */}
      <nav className="w-full z-50 bg-surface/80 backdrop-blur-xl flex justify-between items-center px-6 py-4 border-b border-white/5 mb-8">
        <div className="flex items-center gap-8">
          <div className="text-xl font-digital text-primary-container tracking-tighter flex items-center gap-2">
            <span className="w-2 h-6 bg-primary-container skew-x-[-15deg]"></span>
            SCORE:BOARD
          </div>
          <div className="hidden md:flex gap-6 items-center text-xs font-bold uppercase tracking-widest text-slate-500">
            <button onClick={() => router.push(`/tournament/${match.tournament_id}`)} className="hover:text-primary-container transition-colors cursor-pointer">Live Bracket</button>
            <span className="text-on-surface border-b-2 border-primary-container pb-1">Umpire Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!canEdit && (
             <div className="bg-warning/20 text-warning px-3 py-1.5 rounded-full border border-warning/30 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-tighter">View Only</span>
             </div>
          )}
          {canEdit && (
            <div className="bg-surface-variant px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-tighter hidden sm:block">Live Transmission</span>
            </div>
          )}
        </div>
      </nav>

      <main className="px-4 md:px-8 max-w-[1600px] mx-auto">
        {/* Dashboard Header */}
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary-container/10 text-primary-container px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-primary-container/20">Round {match.round_number}</span>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Match {match.match_order} • {match.sport_type}</span>
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
          {isSubmitting && (
            <div className="absolute inset-0 bg-surface/50 rounded-[2rem] flex items-center justify-center z-50 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-4">
                 <div className="w-12 h-12 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
                 <p className="font-label text-primary-container uppercase tracking-widest text-xs font-black animate-pulse">Finalizing & Advancing...</p>
              </div>
            </div>
          )}

          {/* Team 1 Card */}
          <div className={`xl:col-span-5 glass-card rounded-[2rem] p-10 flex flex-col items-center transition-all ${canEdit ? 'hover:border-primary-container/40' : ''} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-6">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Team 1</span>
            </div>
            <h2 className="text-3xl font-headline font-black text-on-surface mb-10 tracking-tighter uppercase italic">{match.participants[0]?.name || "TBD"}</h2>
            <div className="font-mono text-[10rem] md:text-[14rem] leading-none font-black text-primary-container score-shadow-indigo mb-10 tracking-tighter">
              {currentSetScores.team1}
            </div>
            {canEdit && (
              <div className="w-full">
                <button 
                  onClick={() => handlePoint('team1')}
                  disabled={isSubmitting || (cap && (currentSetScores.team1 >= cap || currentSetScores.team2 >= cap))}
                  className="w-full bg-primary-container hover:bg-primary-container/80 text-white py-12 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary-container/20 disabled:opacity-50 disabled:grayscale"
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
            <div className="absolute top-0 right-0 p-6">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Team 2</span>
            </div>
            <h2 className="text-3xl font-headline font-black text-on-surface mb-10 tracking-tighter uppercase italic">{match.participants[1]?.name || "TBD"}</h2>
            <div className="font-mono text-[10rem] md:text-[14rem] leading-none font-black text-success score-shadow-emerald mb-10 tracking-tighter">
              {currentSetScores.team2}
            </div>
            {canEdit && (
              <div className="w-full">
                <button 
                  onClick={() => handlePoint('team2')}
                  disabled={isSubmitting || (cap && (currentSetScores.team1 >= cap || currentSetScores.team2 >= cap))}
                  className="w-full bg-success hover:bg-success/80 text-surface py-12 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-success/20 disabled:opacity-50 disabled:grayscale"
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
