"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import OfflineSyncBadge from "@/components/OfflineSyncBadge";
import { initOfflineNetworkSync } from "@/lib/offline/offlineQueue";
import TennisScoreboard from "./TennisScoreboard";
import VolleyballScoreboard from "./VolleyballScoreboard";
import FootballScoreboard from "./FootballScoreboard";
import BasketballScoreboard from "./BasketballScoreboard";
import MatchAtmosphereBackground from "@/components/match/MatchAtmosphereBackground";

function ScoreboardContent() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);

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
        const isVolleyball = mData.sport_type === 'Volleyball' || mData.sport_type === 'Beach Volleyball';
        const baseDefaults = { 
          max_sets: isVolleyball ? (mData.sport_type === 'Beach Volleyball' ? 3 : 5) : 3, 
          points_per_set: mData.sport_type === 'Beach Volleyball' ? 21 : (isVolleyball ? 25 : 21),
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
        // In local/demo or umpire match, allow editing if user is umpire or if umpire_id is not set
        setCanEdit(isUmpire || !mData.umpire_id);
      }
    };
    fetchAll();

    const unsubSync = initOfflineNetworkSync(supabase);

    const channel = supabase
      .channel(`match-${matchIdStr}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload: any) => {
        if (payload.new && payload.new.id === matchIdStr) {
          setMatch((prev: any) => ({ ...prev, ...payload.new }));
        }
      })
      .subscribe();

    return () => {
      unsubSync();
      supabase.removeChannel(channel);
    };
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

  return (
    <div className="min-h-screen bg-transparent text-on-background p-4 md:p-6 flex flex-col items-center relative">
      <MatchAtmosphereBackground
        sportType={match.sport_type}
        mode={canEdit ? "umpire" : "spectator"}
      />
      <div className="w-full max-w-5xl mb-6 flex items-center justify-between relative z-10">
        <button 
          onClick={() => router.push(`/match/${matchIdStr}`)}
          className="text-slate-500 hover:text-indigo-300 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Match Overview
        </button>
        <OfflineSyncBadge matchId={matchIdStr} />
      </div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col items-center">
        {match.sport_type === 'Basketball' && (
          <BasketballScoreboard 
            matchData={match} 
            canEdit={canEdit} 
            rules={rules} 
          />
        )}

        {match.sport_type === 'Football' && (
          <FootballScoreboard 
            matchData={match} 
            canEdit={canEdit} 
          />
        )}

        {(match.sport_type === 'Tennis' || match.sport_type === 'Padel') && (
          <TennisScoreboard 
            matchData={match} 
            rules={rules}
            canEdit={canEdit} 
          />
        )}

        {match.sport_type !== 'Basketball' && 
         match.sport_type !== 'Football' && 
         match.sport_type !== 'Tennis' && 
         match.sport_type !== 'Padel' && (
          <VolleyballScoreboard 
            matchData={match} 
            rules={rules} 
            canEdit={canEdit} 
          />
        )}
      </div>
    </div>
  );
}

export default function UmpireMatchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white bg-gray-950 min-h-screen text-center">Loading Scoreboard...</div>}>
      <ScoreboardContent />
    </Suspense>
  );
}
