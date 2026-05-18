"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import RuleModal from "./RuleModal";
import { countSetsWon } from "@/lib/scoring/sets";

const MatchCard = ({ match, tournament }: { match: any, tournament: any }) => {
  if (!match) return null;

  const hasStarted = match.status === 'completed' || match.status === 'ongoing';
  const roundDate = tournament?.settings?.round_dates?.[`bracket_${match.round_number}`];

  return (
    <Link href={`/match/${match.id}`} className="block group">
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-3 shadow-xl group-hover:border-primary/40 transition-all duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        {roundDate && (
          <div className="flex items-center gap-1 text-[7px] font-black uppercase tracking-[0.2em] text-secondary mb-2 relative z-10">
            <span className="material-symbols-outlined text-[10px]">calendar_today</span>
            {new Date(roundDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        )}

        <div className="space-y-2 relative z-10">
          {[0, 1].map((i) => {
            const participant = match.participants?.[i];
            const sourceMatch = match.source_matches?.[i];
            
            return (
              <div key={i} className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                  <span className={`text-xs font-bold tracking-tight truncate ${participant ? 'text-on-surface' : 'text-on-surface-variant opacity-50 italic'}`}>
                    {participant?.name || (sourceMatch ? `Winner of Match ${sourceMatch.global_match_order}` : "TBD")}
                  </span>
                  {match.status === 'ongoing' && match.scores?.serving_index === i && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" title="Serving"></span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[6px] font-black uppercase text-on-surface-variant opacity-40 leading-none mb-0.5">S</span>
                    <span className="text-[10px] font-bold text-on-surface-variant leading-none">
                      {countSetsWon(match.scores?.sets, i as 0 | 1)}
                    </span>
                  </div>
                  {match.status === 'ongoing' && match.scores && (
                    <>
                      {match.sport_type === 'Tennis' && match.scores.tennis && (
                        <div className="flex flex-col items-end">
                          <span className="text-[6px] font-black uppercase text-indigo-400/60 leading-none mb-0.5">G</span>
                          <span className="text-[10px] font-bold text-indigo-400 leading-none">{match.scores.tennis.games?.[i] ?? 0}</span>
                        </div>
                      )}
                      <div className="flex flex-col items-end min-w-[15px]">
                        <span className="text-[6px] font-black uppercase text-primary/60 leading-none mb-0.5">P</span>
                        <span className="text-[10px] font-bold text-primary leading-none">
                          {(() => {
                            if (match.sport_type === 'Tennis' && match.scores.tennis) {
                              const p = match.scores.tennis.points?.[i] ?? 0;
                              const opp = match.scores.tennis.points?.[i === 0 ? 1 : 0] ?? 0;
                              const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];
                              if (p >= 3 && opp >= 3) {
                                return p > opp ? "AD" : (p === opp ? "40" : "40");
                              }
                              return TENNIS_POINTS[p] || "0";
                            }
                            return match.scores.current?.[i === 0 ? 'home' : 'away'] ?? 0;
                          })()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-outline-variant/5 text-[8px] text-on-surface-variant flex justify-between font-label uppercase tracking-widest relative z-10">
          <div className="flex items-center gap-2">
            <span className="opacity-50 font-black">Match {match.global_match_order}</span>
            {match.court && (
              <>
                <span className="opacity-20">•</span>
                <span className="text-indigo-400 font-black">{match.court}</span>
              </>
            )}
          </div>
          <span className={`px-1.5 py-0.5 rounded-full font-black ${
            match.status === 'completed' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
          }`}>{match.status}</span>
        </div>
      </div>
    </Link>
  );
};

const BracketTree = ({ 
  matches, 
  tournament, 
  onSaveOverride,
  onSaveScheduledDate
}: { 
  matches: any[], 
  tournament: any, 
  onSaveOverride: (roundNum: number, sets: number, points: number, cap: number | null) => void,
  onSaveScheduledDate: (key: string, date: string) => void
}) => {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  if (matches.length === 0) return null;

  const rounds = matches.reduce((acc: any, match) => {
    const roundNum = match.round_number;
    if (!acc[roundNum]) acc[roundNum] = [];
    acc[roundNum].push(match);
    return acc;
  }, {});

  const roundKeys = Object.keys(rounds).sort((a, b) => parseInt(a) - parseInt(b));
  const maxRound = Math.max(...roundKeys.map(Number));

  return (
    <div className="flex gap-16 min-w-max justify-start p-4 pb-12">
      {roundKeys.map((roundNum) => {
        const roundInt = parseInt(roundNum);
        const rules = tournament?.settings?.overrides?.[roundInt] || tournament?.settings?.default || { max_sets: 3, points_per_set: 21 };

        // Determine Round Name
        let roundName = `Round ${roundNum}`;
        const roundsToFinal = maxRound - roundInt;
        
        if (roundsToFinal === 0) roundName = "Final";
        else if (roundsToFinal === 1) roundName = "Semi-Finals";
        else if (roundsToFinal === 2) roundName = "Quarter-Finals";
        else if (roundsToFinal === 3) roundName = "Round of 16";
        else if (roundsToFinal === 4) roundName = "Round of 32";

        return (
          <div key={roundNum} className="flex flex-col w-72 relative">
            <div className="text-center group mb-8 h-32 flex flex-col items-center justify-start shrink-0">
              <div className="inline-block px-4 py-1 bg-surface-container-highest/50 rounded-full border border-outline-variant/10 mb-2">
                 <h3 className="font-label text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">
                   {roundName}
                 </h3>
              </div>
              
              <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/10 mb-2">
                <span className="material-symbols-outlined text-[12px] text-on-surface-variant">calendar_today</span>
                <input 
                  type="date"
                  className="bg-transparent text-[9px] font-black uppercase tracking-widest text-on-surface outline-none w-24"
                  value={tournament?.settings?.round_dates?.[`bracket_${roundInt}`] || ""}
                  onChange={(e) => onSaveScheduledDate(`bracket_${roundInt}`, e.target.value)}
                />
              </div>

              <div className="text-[10px] text-primary font-black uppercase tracking-widest opacity-70">
                {rules.max_sets} Sets • {rules.points_per_set} Pts {rules.point_cap ? `• Cap ${rules.point_cap}` : ""}
              </div>
              
              <div className="h-8 flex items-center justify-center">
                <button 
                  onClick={() => setSelectedRound(roundInt)}
                  className="opacity-0 group-hover:opacity-100 text-[9px] bg-primary text-on-primary px-3 py-1 rounded-full transition-all font-black uppercase tracking-tighter hover:scale-105 active:scale-95"
                >
                  Edit Rules
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
               {rounds[roundNum].map((match: any, idx: number) => {
                 const isEven = (idx + 1) % 2 === 0;
                 return (
                   <div key={match.id} className="flex-1 flex flex-col justify-center relative py-6">
                     {/* Left Connector */}
                     {roundInt > 1 && (
                       <div className="absolute right-full top-1/2 w-8 border-t-2 border-dotted border-outline-variant/40 -translate-y-1/2" />
                     )}

                     <MatchCard match={match} tournament={tournament} />

                     {/* Right Connector */}
                     {roundInt < maxRound && (
                       <div className={`absolute left-full top-1/2 w-8 border-dotted border-outline-variant/40 ${
                         !isEven 
                           ? "border-t-2 border-r-2 h-1/2 rounded-tr-2xl" 
                           : "border-b-2 border-r-2 h-1/2 -translate-y-full rounded-br-2xl"
                       }`} />
                     )}
                   </div>
                 );
               })}
            </div>
          </div>
        );
      })}

      {selectedRound && (
        <RuleModal 
          roundNum={selectedRound}
          initialRules={tournament?.settings?.overrides?.[selectedRound] || tournament?.settings?.default || { max_sets: 3, points_per_set: 21, point_cap: null }}
          isOpen={!!selectedRound}
          onClose={() => setSelectedRound(null)}
          onSave={(sets, points, cap) => onSaveOverride(selectedRound, sets, points, cap)}
          sportType={tournament?.sport_type}
        />
      )}
    </div>
  );
};

export default function TournamentBracket({ 
  tournamentId, 
  tournamentFromParent, 
  onSaveOverrideFromParent,
  onSaveScheduledDate
}: { 
  tournamentId: string, 
  tournamentFromParent: any, 
  onSaveOverrideFromParent: (roundNum: number, sets: number, points: number, cap: number | null) => void,
  onSaveScheduledDate: (key: string, date: string) => void
}) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<any>(tournamentFromParent);
  const [isGeneratingKnockout, setIsGeneratingKnockout] = useState(false);
  const [round1Complete, setRound1Complete] = useState(false);

  useEffect(() => {
    setTournament(tournamentFromParent);
  }, [tournamentFromParent]);

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
        const groupMatches = mData.filter((m: any) => m.group_label !== null);
        if (groupMatches.length > 0) {
          const allDone = groupMatches.every((m: any) => m.status === 'completed');
          setRound1Complete(allDone);
        }
      }
      setLoading(false);
    };

    if (tournamentId) loadData();

    const channel = supabase
      .channel(`bracket-updates-${tournamentId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  // Enrich matches with global ordering and source info
  const enrichedMatches = useMemo(() => {
    let bracketOnly = matches.filter(m => m.group_label === null);
    
    // If it's a group tournament and no bracket matches exist yet,
    // generate a virtual bracket structure for preview.
    if (bracketOnly.length === 0 && tournament?.settings?.stage_1?.type === 'groups') {
      const groupLabels = Array.from(new Set(matches.filter(m => m.group_label).map(m => m.group_label))).sort();
      if (groupLabels.length > 0) {
        const advancePerGroup = tournament.settings.stage_1.advance_per_group || 2;
        const totalAdvancing = groupLabels.length * advancePerGroup;
        
        // Find nearest power of 2 for the bracket
        let bracketSize = 2;
        while (bracketSize < totalAdvancing) bracketSize *= 2;
        
        const numRounds = Math.log2(bracketSize);
        const virtualMatches: any[] = [];
        let globalOrder = 1;

        for (let r = 1; r <= numRounds; r++) {
          const matchesInRound = bracketSize / Math.pow(2, r);
          for (let m = 1; m <= matchesInRound; m++) {
            let participants = [null, null] as any[];
            
            // Round 1 special labels for groups
            if (r === 1) {
              // Simple mapping logic: 1st A vs 2nd B, 1st B vs 2nd A, etc.
              // This is a common pattern, though actual logic might vary.
              const groupIdx = Math.floor((m - 1) / (advancePerGroup / 2)) % groupLabels.length;
              const nextGroupIdx = (groupIdx + 1) % groupLabels.length;
              
              if (m % 2 !== 0) {
                participants[0] = { name: `1st Group ${groupLabels[groupIdx]}` };
                participants[1] = { name: `2nd Group ${groupLabels[nextGroupIdx]}` };
              } else {
                participants[0] = { name: `1st Group ${groupLabels[nextGroupIdx]}` };
                participants[1] = { name: `2nd Group ${groupLabels[groupIdx]}` };
              }
            }

            virtualMatches.push({
              id: `virtual-${r}-${m}`,
              round_number: r,
              match_order: m,
              status: 'scheduled',
              participants,
              scores: { sets: [0, 0] },
              global_match_order: globalOrder++,
              is_virtual: true
            });
          }
        }
        
        // Link virtual matches for source_matches
        return virtualMatches.map(vm => {
          const source_matches = [null, null] as any[];
          if (vm.round_number > 1) {
            const prevRound = virtualMatches.filter(pvm => pvm.round_number === vm.round_number - 1);
            source_matches[0] = prevRound.find(pvm => pvm.match_order === (vm.match_order * 2) - 1) || null;
            source_matches[1] = prevRound.find(pvm => pvm.match_order === (vm.match_order * 2)) || null;
          }
          return { ...vm, source_matches };
        });
      }
    }

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
  }, [matches, tournament]);

  const handleGenerateKnockout = async () => {
    setIsGeneratingKnockout(true);
    const { error } = await supabase.functions.invoke('advance-to-knockout', {
      body: { tournamentId }
    });

    if (error) {
      toast.error("Error generating bracket: " + error.message);
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
        <div className="text-center p-16 bg-surface-container-low rounded-[3rem] border border-outline-variant/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50"></div>
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-6 opacity-20 block group-hover:scale-110 transition-transform duration-700">hourglass_empty</span>
          <p className="text-on-surface-variant text-sm italic font-medium relative z-10">
            No matches generated for this tournament yet.
          </p>
        </div>
      </div>
    );
  }

  const isDoubleElimination = enrichedMatches.some(m => m.bracket_type === 'winners' || m.bracket_type === 'losers');

  return (
    <div className="max-w-full overflow-x-auto pb-8 space-y-12">
      {round1Complete && enrichedMatches.some(m => m.is_virtual) && (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-primary-container/10 border border-primary/20 p-8 rounded-[2rem] flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                 <span className="material-symbols-outlined text-2xl text-on-primary-container">bolt</span>
              </div>
              <div className="text-left">
                <h3 className="text-on-surface text-lg font-black uppercase tracking-tighter">Initialize Knockout</h3>
                <p className="text-on-surface-variant text-[10px] font-medium leading-relaxed">Groups finalized. Ready to assign teams.</p>
              </div>
            </div>
            <button
              onClick={handleGenerateKnockout}
              disabled={isGeneratingKnockout}
              className="bg-primary-container hover:brightness-110 text-on-primary-container px-6 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-primary/20"
            >
              {isGeneratingKnockout ? "Initializing..." : "Generate Bracket"}
            </button>
          </div>
        </div>
      )}

      {isDoubleElimination ? (
        <div className="space-y-32">
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
              onSaveOverride={onSaveOverrideFromParent}
              onSaveScheduledDate={onSaveScheduledDate}
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
              onSaveOverride={onSaveOverrideFromParent}
              onSaveScheduledDate={onSaveScheduledDate}
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
              <MatchCard match={enrichedMatches.find(m => m.bracket_type === 'grand_final')} tournament={tournament} />
            </div>
          </section>
        </div>
      ) : (
        <BracketTree 
          matches={enrichedMatches} 
          tournament={tournament}
          onSaveOverride={onSaveOverrideFromParent}
          onSaveScheduledDate={onSaveScheduledDate}
        />
      )}
    </div>
  );
}
