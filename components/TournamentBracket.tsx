"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const MatchCard = ({ match }: { match: any }) => {
  if (!match) return null;

  return (
    <Link href={`/match/${match.id}`} className="block group">
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 shadow-xl group-hover:border-primary/40 transition-all duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="space-y-4 relative z-10">
          {[0, 1].map((i) => {
            const participant = match.participants?.[i];
            const sourceMatch = match.source_matches?.[i];
            
            return (
              <div key={i} className="flex justify-between items-center">
                <span className={`text-sm font-bold tracking-tight truncate max-w-[140px] ${participant ? 'text-on-surface' : 'text-on-surface-variant opacity-50 italic'}`}>
                  {participant?.name || (sourceMatch ? `Winner of Match ${sourceMatch.global_match_order}` : "TBD")}
                </span>
                <span className="text-primary font-label text-lg font-bold">
                  {match.current_score?.final_sets?.[i] || 0}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-outline-variant/5 text-[9px] text-on-surface-variant flex justify-between font-label uppercase tracking-widest relative z-10">
          <span className="opacity-50 font-black">Match {match.global_match_order}</span>
          <span className={`px-2 py-0.5 rounded-full font-black ${
            match.status === 'completed' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
          }`}>{match.status}</span>
        </div>
      </div>
    </Link>
  );
};

const BracketTree = ({ matches, tournament, onSaveOverride }: { matches: any[], tournament: any, onSaveOverride: any }) => {
  if (matches.length === 0) return null;

  const rounds = matches.reduce((acc: any, match) => {
    const roundNum = match.round_number;
    if (!acc[roundNum]) acc[roundNum] = [];
    acc[roundNum].push(match);
    return acc;
  }, {});

  return (
    <div className="flex gap-16 min-w-max justify-start p-4 pb-12">
      {Object.keys(rounds).sort((a, b) => parseInt(a) - parseInt(b)).map((roundNum) => {
        const roundInt = parseInt(roundNum);
        const rules = tournament?.settings?.overrides?.[roundInt] || tournament?.settings?.default || { max_sets: 3, points_per_set: 21 };

        return (
          <div key={roundNum} className="flex flex-col justify-around gap-12 w-72 relative">
            <div className="text-center group mb-8">
              <div className="inline-block px-4 py-1 bg-surface-container-highest/50 rounded-full border border-outline-variant/10 mb-2">
                 <h3 className="font-label text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">
                   Round {roundNum}
                 </h3>
              </div>
              <div className="text-[10px] text-primary font-black uppercase tracking-widest opacity-70">
                {rules.max_sets} Sets • {rules.points_per_set} Pts {rules.point_cap ? `• Cap ${rules.point_cap}` : ""}
              </div>
              
              <button 
                onClick={() => {
                  const s = prompt("Max Sets for this round?", rules.max_sets);
                  const p = prompt("Points per set for this round?", rules.points_per_set);
                  const c = prompt("Point Cap? (Leave blank for no cap)", rules.point_cap || "");
                  if (s && p) {
                    onSaveOverride(roundInt, parseInt(s), parseInt(p), c ? parseInt(c) : null);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 text-[9px] bg-primary text-on-primary px-3 py-1 rounded-full mt-3 transition-all font-black uppercase tracking-tighter hover:scale-105 active:scale-95"
              >
                Edit Rules
              </button>
            </div>

            <div className="flex flex-col gap-12">
               {rounds[roundNum].map((match: any) => (
                 <MatchCard key={match.id} match={match} />
               ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function TournamentBracket({ tournamentId }: { tournamentId: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<any>(null);
  const [isGeneratingKnockout, setIsGeneratingKnockout] = useState(false);
  const [round1Complete, setRound1Complete] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: tData } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single();
      setTournament(tData);

      const { data: mData } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });
      
      if (mData) {
        setMatches(mData);
        const groupMatches = mData.filter(m => m.group_label !== null);
        if (groupMatches.length > 0) {
          const allDone = groupMatches.every(m => m.status === 'completed');
          setRound1Complete(allDone);
        }
      }
      setLoading(false);
    };

    if (tournamentId) loadData();
  }, [tournamentId]);

  // Enrich matches with global ordering and source info
  const enrichedMatches = useMemo(() => {
    const bracketOnly = matches.filter(m => m.group_label === null);
    
    // Sort primarily by round, then by order to assign sequential numbers
    const sorted = [...bracketOnly].sort((a, b) => {
      if (a.round_number !== b.round_number) return a.round_number - b.round_number;
      return a.match_order - b.match_order;
    });

    const withOrder = sorted.map((m, idx) => ({
      ...m,
      global_match_order: idx + 1
    }));

    // Link matches to their sources (which matches feed into this one)
    return withOrder.map(m => {
      const source_matches = [null, null] as any[];
      if (m.round_number > 1) {
        // Find the matches from the previous round that feed into this one
        // Standard single-elimination logic: match N in round R comes from matches 2N-1 and 2N in round R-1
        const prevRound = withOrder.filter(pm => pm.round_number === m.round_number - 1);
        source_matches[0] = prevRound.find(pm => pm.match_order === (m.match_order * 2) - 1) || null;
        source_matches[1] = prevRound.find(pm => pm.match_order === (m.match_order * 2)) || null;
      }
      return { ...m, source_matches };
    });
  }, [matches]);

  const saveOverride = async (roundNum: number, sets: number, points: number, cap: number | null) => {
    const newSettings = {
      ...tournament.settings,
      overrides: {
        ...(tournament.settings?.overrides || {}),
        [roundNum]: { max_sets: sets, points_per_set: points, point_cap: cap }
      }
    };

    const { error } = await supabase
      .from('tournaments')
      .update({ settings: newSettings })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings });
    } else {
      alert(`Error updating Round ${roundNum}: ${error.message}`);
    }
  };

  const handleGenerateKnockout = async () => {
    setIsGeneratingKnockout(true);
    const { error } = await supabase.functions.invoke('advance-to-knockout', {
      body: { tournamentId }
    });

    if (error) {
      alert("Error generating bracket: " + error.message);
    } else {
      const { data: mData } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });
      if (mData) setMatches(mData);
    }
    setIsGeneratingKnockout(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center py-20 opacity-50">
       <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
       <p className="mt-4 font-label text-[10px] uppercase tracking-widest">Synchronizing Bracket...</p>
    </div>
  );

  if (enrichedMatches.length === 0) {
    return (
      <div className="mt-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
        {round1Complete ? (
          <div className="bg-primary-container/10 border border-primary/20 p-12 rounded-[3rem] flex flex-col items-center gap-8 shadow-2xl text-center">
            <div className="w-20 h-20 bg-primary-container rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
               <span className="material-symbols-outlined text-4xl text-on-primary-container">bolt</span>
            </div>
            <div>
              <h3 className="text-on-surface text-2xl font-black uppercase tracking-tighter">Group Stage Finalized</h3>
              <p className="text-on-surface-variant text-sm mt-3 font-medium leading-relaxed max-w-xs mx-auto">All scores have been verified. You can now initialize the high-stakes knockout phase.</p>
            </div>
            <button
              onClick={handleGenerateKnockout}
              disabled={isGeneratingKnockout}
              className="w-full bg-primary-container hover:brightness-110 text-on-primary-container py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-primary/20"
            >
              {isGeneratingKnockout ? "Initializing..." : "Generate Knockout Bracket"}
            </button>
          </div>
        ) : (
          <div className="text-center p-16 bg-surface-container-low rounded-[3rem] border border-outline-variant/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50"></div>
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-6 opacity-20 block group-hover:scale-110 transition-transform duration-700">hourglass_empty</span>
            <p className="text-on-surface-variant text-sm italic font-medium relative z-10">
              The knockout bracket will be available once all Group Stage matches are completed.
            </p>
          </div>
        )}
      </div>
    );
  }

  const isDoubleElimination = enrichedMatches.some(m => m.bracket_type === 'winners' || m.bracket_type === 'losers');

  if (isDoubleElimination) {
    return (
      <div className="space-y-32 max-w-full overflow-x-auto">
        <section>
          <div className="flex items-center gap-6 mb-12 border-b border-outline-variant/10 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
               <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-on-surface">Winners Bracket</h2>
          </div>
          <BracketTree 
            matches={enrichedMatches.filter(m => m.bracket_type === 'winners')} 
            tournament={tournament}
            onSaveOverride={saveOverride}
          />
        </section>

        <section>
          <div className="flex items-center gap-6 mb-12 border-b border-outline-variant/10 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
               <span className="material-symbols-outlined text-tertiary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-on-surface">Losers Bracket</h2>
          </div>
          <BracketTree 
            matches={enrichedMatches.filter(m => m.bracket_type === 'losers')} 
            tournament={tournament}
            onSaveOverride={saveOverride}
          />
        </section>

        <section className="flex flex-col items-center bg-surface-container-high/30 p-20 rounded-[4rem] border border-outline-variant/10 shadow-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent opacity-30 group-hover:opacity-50 transition-opacity duration-1000"></div>
          <div className="text-center mb-12 relative z-10">
            <span className="text-6xl mb-6 block group-hover:scale-110 transition-transform duration-700">👑</span>
            <h2 className="text-5xl font-black uppercase tracking-tighter text-on-surface leading-none">Grand Final</h2>
            <div className="h-1 w-24 bg-primary mx-auto mt-6 rounded-full opacity-50"></div>
          </div>
          <div className="w-80 relative z-10">
            <MatchCard match={enrichedMatches.find(m => m.bracket_type === 'grand_final')} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto pb-8">
      <BracketTree 
        matches={enrichedMatches} 
        tournament={tournament}
        onSaveOverride={saveOverride}
      />
    </div>
  );
}
