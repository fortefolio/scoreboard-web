"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calculateStandings, type Standing } from "@/lib/standings/groups";

export default function GroupStandingsView({ tournamentId }: { tournamentId: string }) {
  const [groups, setGroups] = useState<Record<string, Standing[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      // First try to fetch from group_standings view
      const { data: viewData } = await supabase
        .from("group_standings")
        .select("*")
        .eq("tournament_id", tournamentId);

      let finalStandings: Standing[] = [];

      if (viewData && viewData.length > 0) {
        finalStandings = viewData;
      } else {
        // Fallback: Fetch matches and calculate standings client-side
        const { data: matches } = await supabase
          .from("matches")
          .select("*")
          .eq("tournament_id", tournamentId)
          .not("group_label", "is", null);
        
        if (matches) {
          finalStandings = calculateStandings(matches) as Standing[];
        }
      }

      // Group by their group_label (A, B, C...)
      const grouped = finalStandings.reduce((acc: any, row: Standing) => {
        if (!acc[row.group_label]) acc[row.group_label] = [];
        acc[row.group_label].push(row);
        return acc;
      }, {});

      // Sort teams within each group (Wins > Point Diff)
      Object.keys(grouped).forEach(label => {
        grouped[label].sort((a: Standing, b: Standing) => 
          b.wins - a.wins || b.point_diff - a.point_diff
        );
      });

      setGroups(grouped);
      setLoading(false);
    };

    fetchAllData();
    
    let channel: any = null;
    try {
      channel = supabase
        .channel('standings-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
          fetchAllData();
        });

      channel.subscribe();
    } catch (err) {
      console.warn('[GroupStandings] Realtime unavailable:', err);
    }

    return () => { 
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [tournamentId]);

  if (loading) return <div className="text-text-muted text-xs font-medium p-8">Calculating Standings...</div>;

  if (Object.keys(groups).length === 0) {
    return <div className="text-center p-12 text-text-muted text-xs">No group standings available for this tournament.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(groups).sort().map(([label, teams]) => (
          <div key={label} className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
            <div className="bg-surface-container-high/60 px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
              <h3 className="font-medium text-sm text-text-primary">Group {label}</h3>
            </div>
            
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted text-xs border-b border-outline-variant">
                    <th className="pl-4 pr-2 py-2.5 text-center font-medium w-8">#</th>
                    <th className="px-2 py-2.5 text-left font-medium">Team</th>
                    <th className="px-2 py-2.5 text-center font-medium">P</th>
                    <th className="px-2 py-2.5 text-center font-medium">W</th>
                    <th className="px-2 py-2.5 text-center font-medium">L</th>
                    <th className="px-2 py-2.5 text-center font-medium">Sets</th>
                    <th className="px-3 py-2.5 text-right font-medium pr-4">+/-</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-mono tabular-nums">
                  {teams.map((team, idx) => {
                    const isAdvancing = idx < 2;
                    return (
                      <tr
                        key={team.team_name}
                        className={`hover:bg-surface-container-high/40 transition-colors border-l-2 ${
                          isAdvancing ? "border-l-text-primary bg-surface-container-high/20" : "border-l-transparent"
                        }`}
                      >
                        <td
                          className={`pl-3.5 pr-2 py-2.5 text-center ${
                            isAdvancing ? "font-bold text-text-primary" : "font-normal text-text-muted"
                          }`}
                          title={isAdvancing ? "Advancing to Knockout Stage" : undefined}
                        >
                          {idx + 1}
                        </td>
                        <td
                          className={`px-2 py-2.5 font-sans ${
                            isAdvancing ? "font-semibold text-text-primary" : "font-normal text-text-secondary"
                          }`}
                        >
                          <span className="truncate block">{team.team_name}</span>
                        </td>
                        <td className={`px-2 py-2.5 text-center ${team.played > 0 ? "text-text-secondary" : "text-text-muted"}`}>
                          {team.played}
                        </td>
                        <td className={`px-2 py-2.5 text-center ${team.wins > 0 ? "font-semibold text-text-primary" : "text-text-muted"}`}>
                          {team.wins}
                        </td>
                        <td className={`px-2 py-2.5 text-center ${team.losses > 0 ? "text-text-secondary" : "text-text-muted"}`}>
                          {team.losses}
                        </td>
                        <td className="px-2 py-2.5 text-center text-text-muted">
                          {team.total_sets_won}-{team.total_sets_lost}
                        </td>
                        <td className={`px-3 py-2.5 text-right pr-4 ${team.point_diff === 0 ? "text-text-muted" : "text-text-secondary"}`}>
                          {team.point_diff > 0 ? `+${team.point_diff}` : team.point_diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-text-muted pt-1">
        <span className="w-0.5 h-3.5 bg-text-primary rounded-full shrink-0" />
        <span>Highlighted rows advance to Knockout Stage</span>
      </div>
    </div>
  );
}
