"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RuleModal from "./RuleModal";

interface Match {
  id: string;
  round_number: number;
  match_order: number;
  status: string;
  group_label: string;
  participants: { name: string }[];
  current_score: {
    final_sets: number[];
  } | null;
}

export default function GroupMatchesView({ 
  tournamentId, 
  tournament, 
  onSaveOverride,
  onSaveRoundDate
}: { 
  tournamentId: string, 
  tournament: any,
  onSaveOverride: (roundNum: number, sets: number, points: number, cap: number | null) => void,
  onSaveRoundDate: (roundNum: number, date: string) => void
}) {
  const [groups, setGroups] = useState<Record<string, Match[]>>({});
  const [loading, setLoading] = useState(true);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .not("group_label", "is", null)
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });

      if (matches) {
        const grouped = matches.reduce((acc: Record<string, Match[]>, match: Match) => {
          if (!acc[match.group_label]) acc[match.group_label] = [];
          acc[match.group_label].push(match);
          return acc;
        }, {} as Record<string, Match[]>);
        setGroups(grouped);
      }
      setLoading(false);
    };

    fetchMatches();

    const channel = supabase
      .channel('group-matches-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  if (loading) return (
    <div className="flex flex-col items-center py-20 opacity-50">
       <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
       <p className="mt-4 font-label text-[10px] uppercase tracking-widest">Loading Group Matches...</p>
    </div>
  );

  if (Object.keys(groups).length === 0) {
    return <div className="text-center p-12 text-on-surface-variant italic bg-surface-container-low rounded-[2rem] border border-outline-variant/10">No group stage matches generated yet.</div>;
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container rounded-[2rem] p-6 border border-outline-variant/10 gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-container/20 rounded-2xl flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">settings</span>
          </div>
          <div>
            <h3 className="text-on-surface font-black uppercase tracking-tighter">Group Stage Config</h3>
            <p className="text-on-surface-variant text-[10px] font-label uppercase tracking-widest opacity-60">
              {tournament?.settings?.overrides?.[1]?.max_sets || tournament?.settings?.default?.max_sets || 3} Sets • {tournament?.settings?.overrides?.[1]?.points_per_set || tournament?.settings?.default?.points_per_set || 21} Points
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/10 flex-1 md:flex-none">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">calendar_today</span>
            <input 
              type="date"
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-on-surface outline-none"
              value={tournament?.settings?.round_dates?.[1] || ""}
              onChange={(e) => onSaveRoundDate(1, e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsRuleModalOpen(true)}
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 flex-1 md:flex-none"
          >
            Edit Rules
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {Object.entries(groups).sort().map(([label, matches]) => (
          <div key={label} className="space-y-6">
            <div className="flex items-center gap-4 border-b border-outline-variant/10 pb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary font-black">
                {label}
              </div>
              <h3 className="text-2xl font-headline font-black uppercase tracking-tighter text-on-surface">Group {label} Matches</h3>
            </div>

            <div className="grid gap-4">
              {matches.map((match) => {
                const roundDate = tournament?.settings?.round_dates?.[match.round_number];
                return (
                  <Link key={match.id} href={`/match/${match.id}`} className="block group">
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-4 shadow-xl group-hover:border-primary/40 transition-all duration-300 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      {roundDate && (
                        <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.2em] text-secondary mb-3 relative z-10">
                          <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                          {new Date(roundDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      )}

                      <div className="flex items-center justify-between relative z-10">
                      <div className="flex-1 space-y-2">
                        {[0, 1].map((i) => (
                          <div key={i} className="flex justify-between items-center pr-4">
                            <span className={`text-sm font-bold tracking-tight truncate max-w-[140px] ${match.participants?.[i] ? 'text-on-surface' : 'text-on-surface-variant opacity-50 italic'}`}>
                              {match.participants?.[i]?.name || "TBD"}
                            </span>
                            <span className="text-primary font-label text-base font-bold">
                              {match.current_score?.final_sets?.[i] || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pl-4 border-l border-outline-variant/10 flex flex-col items-center justify-center gap-1 min-w-[80px]">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          match.status === 'completed' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
                        }`}>
                          {match.status}
                        </span>
                        <span className="text-[9px] text-on-surface-variant opacity-50 font-black uppercase">
                          Round {match.round_number}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        ))}
      </div>

      <RuleModal 
        roundNum={1}
        initialRules={tournament?.settings?.overrides?.[1] || tournament?.settings?.default || { max_sets: 3, points_per_set: 21, point_cap: null }}
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        onSave={(sets, points, cap) => onSaveOverride(1, sets, points, cap)}
      />
    </div>
  );
}
