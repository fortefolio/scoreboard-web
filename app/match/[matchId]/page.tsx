"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { user: currUser } } = await supabase.auth.getUser();
      setUser(currUser);

      const { data: mData } = await supabase
        .from("matches")
        .select("*, tournaments(*)")
        .eq("id", matchId)
        .single();
      
      if (mData) {
        setMatch(mData);
        const tRules = mData.tournaments.settings?.overrides?.[mData.round_number] || mData.tournaments.settings?.default || { max_sets: 3, points_per_set: 21 };
        setRules(tRules);
        
        const isOrganizer = currUser?.id === mData.tournaments.organizer_id;
        const isUmpire = currUser?.id === mData.umpire_id;
        setCanEdit(isOrganizer || isUmpire);
      }
    };
    fetchAll();
  }, [matchId]);

  // Determine the point limit for THIS specific set
  const isDecidingSet = rules && setHistory.length === Math.floor(rules.max_sets / 2);
  const activeLimit = rules ? (isDecidingSet ? (rules.deciding_set_points || rules.points_per_set) : rules.points_per_set) : 21;

  const handlePoint = (team: 'team1' | 'team2') => {
    if (!canEdit || isSubmitting) return;

    setCurrentSetScores(prev => {
      const next = { ...prev, [team]: prev[team] + 1 };
      
      // Logic: Win set if points reach limit AND lead by 2
      const p1 = next.team1;
      const p2 = next.team2;

      if ((p1 >= activeLimit || p2 >= activeLimit) && Math.abs(p1 - p2) >= 2) {
        confirmSet(p1, p2);
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

    // We call the Edge Function instead of the Table directly
    const { data, error } = await supabase.functions.invoke('finalize-match', {
      body: { 
        matchId: matchId, 
        setHistory: finalHistory 
      }
    });

    if (error) {
      // This is where the "Hacker" gets caught
      alert("🚨 SECURITY REJECTION: " + (error.message || "Invalid Match Data"));
      setIsSubmitting(false);
    } else {
      alert("✅ Match Verified & Advanced!");
      router.push(`/tournament/${match.tournament_id}`);
    }
  };

  if (!match || !rules) return <div className="p-10 text-white bg-gray-950 min-h-screen">Loading...</div>;

  const isDeuce = 
    currentSetScores.team1 >= activeLimit - 1 && 
    currentSetScores.team2 >= activeLimit - 1 &&
    currentSetScores.team1 === currentSetScores.team2;

  const isAdvantage = 
    (currentSetScores.team1 >= activeLimit || currentSetScores.team2 >= activeLimit) && 
    Math.abs(currentSetScores.team1 - currentSetScores.team2) < 2;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 flex flex-col items-center">
      {/* SECURITY BANNER */}
      {!canEdit && (
        <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-200 px-4 py-2 rounded-lg mb-6 text-xs uppercase font-bold tracking-widest">
          View Only Mode (Protected by RLS)
        </div>
      )}

      {/* Set History Bar */}
      <div className="flex gap-2 mb-8">
        {setHistory.map((set, i) => (
          <div key={i} className="bg-gray-800 px-3 py-1 rounded border border-gray-700 text-xs font-mono">
            S{i+1}: {set.team1}-{set.team2}
          </div>
        ))}
        <div className="bg-indigo-900/50 px-3 py-1 rounded border border-indigo-500 text-xs font-bold">
          {isDecidingSet ? "Deciding Set" : `Set ${setHistory.length + 1}`}
        </div>
      </div>

      <div className="flex flex-col items-center w-full max-w-3xl">
        {isDeuce && (
          <div className="mb-6 px-4 py-2 bg-red-900/40 border border-red-500 text-red-200 text-xs font-black uppercase tracking-tighter animate-pulse rounded shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            Deuce: Win by 2 points required
          </div>
        )}

        {isAdvantage && !isDeuce && (
          <div className="mb-6 px-4 py-2 bg-amber-900/40 border border-amber-500 text-amber-200 text-xs font-black uppercase tracking-tighter animate-pulse rounded shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            Advantage Mode: Win by 2 points required
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 w-full">
          {[0, 1].map((idx) => {
            const teamKey = idx === 0 ? 'team1' : 'team2';
            return (
              <div key={idx} className="bg-gray-900 rounded-3xl p-8 border border-gray-800 flex flex-col items-center shadow-2xl relative">
                {isSubmitting && (
                  <div className="absolute inset-0 bg-gray-950/50 rounded-3xl flex items-center justify-center z-10 backdrop-blur-[1px]">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <span className="text-gray-500 text-xs uppercase tracking-widest mb-2">Team {idx + 1}</span>
                <h2 className="text-2xl font-bold mb-6 text-center h-16">{match.participants[idx]?.name || "TBD"}</h2>
                <div className="text-9xl font-mono font-black mb-8 text-indigo-400 tabular-nums">{currentSetScores[teamKey]}</div>
                {canEdit && (
                  <button 
                    onClick={() => handlePoint(teamKey)}
                    disabled={isSubmitting}
                    className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-4xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isSubmitting && (
        <div className="mt-8 text-indigo-400 font-bold animate-pulse">
          Finalizing match and advancing winner...
        </div>
      )}

      <div className="mt-10 text-gray-500 text-sm italic text-center">
        <div>Match Rules: Best of {rules.max_sets} sets</div>
        <div className="text-xs mt-1">
          {isDecidingSet 
            ? `Current Set: Play to ${activeLimit} points` 
            : `Regular Sets: ${rules.points_per_set} pts • Final Set: ${rules.deciding_set_points || rules.points_per_set} pts`
          }
        </div>
      </div>
    </div>
  );
}
