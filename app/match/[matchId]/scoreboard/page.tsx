"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import TennisScoreboard from "./TennisScoreboard";
import VolleyballScoreboard from "./VolleyballScoreboard";

function ScoreboardContent() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        
        // Resolve Rules Hierarchy
        const isVolleyball = mData.sport_type === 'Volleyball';
        const baseDefaults = { 
          max_sets: isVolleyball ? 3 : 3, 
          points_per_set: isVolleyball ? 25 : 21,
          point_cap: null 
        };

        let resolvedRules;
        if (mData.tournament_id) {
          const tournamentSettings = mData.tournaments?.settings || {};
          const roundOverrides = tournamentSettings.overrides?.[mData.round_number] || {};
          const tournamentDefault = tournamentSettings.default || {};
          resolvedRules = { ...baseDefaults, ...tournamentDefault, ...roundOverrides };
        } else {
          resolvedRules = { ...baseDefaults, ...(mData.settings || {}) };
        }
        setRules(resolvedRules);
        
        const isUmpire = currUser?.id === mData.umpire_id;
        setCanEdit(isUmpire);
      }
    };
    fetchAll();

    const channel = supabase
      .channel(`match-${matchIdStr}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchIdStr}` }, (payload: any) => {
        setMatch((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchIdStr]);

  useEffect(() => {
    if (match?.status === 'completed') {
      toast.success("✅ Match Completed!");
      const backTab = match.group_label ? 'group_matches' : 'bracket';
      const redirectPath = match.tournament_id 
        ? `/tournament/${match.tournament_id}?tab=${backTab}`
        : `/match/${matchIdStr}`;
      router.push(redirectPath);
    }
  }, [match?.status, match?.tournament_id, match?.group_label, matchIdStr, router]);

  if (!match || !rules) return <div className="p-10 text-white bg-gray-950 min-h-screen text-center">Loading...</div>;

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

  return (
    <VolleyballScoreboard 
      matchData={match} 
      rules={rules} 
      canEdit={canEdit} 
    />
  );
}

export default function UmpireMatchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white bg-gray-950 min-h-screen text-center">Loading Scoreboard...</div>}>
      <ScoreboardContent />
    </Suspense>
  );
}
