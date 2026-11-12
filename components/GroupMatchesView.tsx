"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RuleModal from "./RuleModal";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { useTranslation } from "@/lib/i18n";

interface Match {
  id: string;
  round_number: number;
  match_order: number;
  status: string;
  group_label: string;
  sport_type?: string;
  participants: { name: string }[];
  scores: any | null;
}

export default function GroupMatchesView({ 
  tournamentId, 
  tournament, 
  onSaveOverride,
  onSaveScheduledDate
}: { 
  tournamentId: string, 
  tournament: any,
  onSaveOverride: (roundNum: number, sets: number, points: number, cap: number | null) => void,
  onSaveScheduledDate: (key: string, date: string) => void
}) {
  const { t } = useTranslation();
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

    let channel: any = null;
    try {
      channel = supabase
        .channel('group-matches-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
          fetchMatches();
        });

      channel.subscribe();
    } catch (err) {
      console.warn('[GroupMatches] Realtime unavailable:', err);
    }

    return () => { 
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [tournamentId]);

  if (loading) return (
    <div className="flex flex-col items-center py-20 opacity-50">
       <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
       <p className="mt-4 font-label text-[10px] uppercase tracking-widest">Loading Group Matches...</p>
    </div>
  );

  if (Object.keys(groups).length === 0) {
    return <div className="text-center p-8 text-text-muted text-xs bg-surface-container rounded-xl border border-outline-variant">No group stage matches generated yet.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface-container rounded-xl p-4 sm:p-5 border border-outline-variant gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-surface-container-high rounded-lg flex items-center justify-center text-text-muted border border-outline-variant">
            <span className="material-symbols-outlined text-base">settings</span>
          </div>
          <div>
            <h3 className="text-text-primary font-semibold text-sm">Group Stage Config</h3>
            <p className="text-text-muted text-xs font-mono">
              {tournament?.sport_type === "Tennis"
                ? `Best of ${tournament?.settings?.overrides?.[1]?.max_sets || tournament?.settings?.default?.max_sets || 3} Sets`
                : `${tournament?.settings?.overrides?.[1]?.max_sets || tournament?.settings?.default?.max_sets || 3} Sets • ${tournament?.settings?.overrides?.[1]?.points_per_set || tournament?.settings?.default?.points_per_set || 21} Points`}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-lg border border-outline-variant flex-1 sm:flex-none">
            <span className="material-symbols-outlined text-[13px] text-text-muted">calendar_today</span>
            <input 
              type="date"
              className="bg-transparent text-xs font-mono text-text-primary outline-none"
              value={tournament?.settings?.round_dates?.['group_stage'] || ""}
              onChange={(e) => onSaveScheduledDate('group_stage', e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsRuleModalOpen(true)}
            className="bg-text-primary hover:bg-white text-surface-container-lowest px-3.5 py-1.5 rounded-lg font-medium text-xs transition-colors flex-1 sm:flex-none cursor-pointer"
          >
            Edit Rules
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Object.entries(groups).sort().map(([label, matches]) => (
          <div key={label} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-text-primary font-semibold text-sm border border-outline-variant">
                {label}
              </div>
              <h3 className="text-base font-semibold text-text-primary">Group {label} Matches</h3>
            </div>

            <div className="grid gap-3">
              {matches.map((match) => {
                const roundDate = tournament?.settings?.round_dates?.['group_stage'];
                return (
                  <Link key={match.id} href={`/match/${match.id}`} className="block group">
                    <div className="bg-surface-container border border-outline-variant rounded-xl p-3.5 hover:border-outline hover:bg-surface-container-high/40 transition-colors relative overflow-hidden">
                      {roundDate && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-text-secondary mb-2">
                          <span className="material-symbols-outlined text-[13px] text-text-muted">calendar_today</span>
                          {new Date(roundDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        {[0, 1].map((i) => {
                          const side = i === 0 ? 'home' : 'away';
                          let livePoints: string | number = 0;
                          let games: number | null = null;
                          const setsList = extractSetsData(match.scores);
                          const sets = countSetsWon(setsList, i as 0 | 1);

                          if (match.status === 'ongoing' && match.scores) {
                            if (match.sport_type === 'Tennis' && match.scores.tennis) {
                              const p = match.scores.tennis.points?.[i] ?? 0;
                              const opp = match.scores.tennis.points?.[i === 0 ? 1 : 0] ?? 0;
                              games = match.scores.tennis.games?.[i] ?? 0;
                              const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];
                              if (p >= 3 && opp >= 3) {
                                livePoints = p > opp ? "AD" : (p === opp ? "40" : "40");
                              } else {
                                livePoints = TENNIS_POINTS[p] || "0";
                              }
                            } else {
                              livePoints = match.scores.current?.[side] ?? 0;
                            }
                          }

                          return (
                            <div key={i} className="flex justify-between items-center pr-3">
                              <div className="flex items-center gap-2 truncate max-w-[140px]">
                                <span className={`text-xs font-medium truncate ${match.participants?.[i] ? 'text-text-primary' : 'text-text-muted italic'}`}>
                                  {formatTeamOrPlayerName(match.participants?.[i]?.name) || "TBD"}
                                </span>
                                {match.status === 'ongoing' && match.scores?.serving_index === i && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Serving"></span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5">
                                {setsList.map((s: any, sIdx: number) => {
                                  const pScore = i === 0 ? (s.home ?? s.team1 ?? 0) : (s.away ?? s.team2 ?? 0);
                                  const oScore = i === 0 ? (s.away ?? s.team2 ?? 0) : (s.home ?? s.team1 ?? 0);
                                  const tbVal = s.tiebreak ? (i === 0 ? s.tiebreak.home : s.tiebreak.away) : null;
                                  return (
                                    <span
                                      key={sIdx}
                                      className={`text-xs font-mono tabular-nums min-w-[14px] text-right ${
                                        pScore > oScore ? "font-semibold text-text-primary" : "text-text-muted"
                                      }`}
                                    >
                                      {pScore}
                                      {tbVal !== null && tbVal !== undefined && (
                                        <sup className="text-[9px] text-primary ml-0.5">{tbVal}</sup>
                                      )}
                                    </span>
                                  );
                                })}
                                <div className="flex items-center justify-end pl-1.5 border-l border-outline-variant min-w-[16px]">
                                  <span className="text-xs font-mono tabular-nums font-semibold text-text-primary">{sets}</span>
                                </div>
                                {games !== null && (
                                  <span className="text-xs font-mono tabular-nums font-medium text-text-secondary min-w-[14px] text-right">{games}</span>
                                )}
                                {match.status === 'ongoing' && (
                                  <span className="text-xs font-digital font-semibold text-primary min-w-[18px] text-right">{livePoints}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="pl-3 border-l border-outline-variant flex flex-col items-center justify-center gap-1 min-w-[70px]">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border border-outline-variant ${
                          match.status === 'completed' ? 'bg-surface-container-high text-text-muted' :
                          match.status === 'ongoing' ? 'bg-surface-container text-text-primary inline-flex items-center gap-1.5' :
                          'bg-surface-container-high text-text-secondary'
                        }`}>
                          {match.status === 'ongoing' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          )}
                          {match.status === 'completed'
                            ? t("status.final")
                            : match.status === 'ongoing'
                            ? t("status.live")
                            : t("status.scheduled")}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">
                          {t("common.roundCount", { round: match.round_number })}
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
        sportType={tournament?.sport_type}
      />
    </div>
  );
}
