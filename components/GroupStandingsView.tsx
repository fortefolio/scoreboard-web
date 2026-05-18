"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Standing {
  group_label: string;
  team_name: string;
  played: number;
  wins: number;
  losses: number;
  total_sets_won: number;
  total_sets_lost: number;
  point_diff: number;
}

// Helper to calculate standings from match history
const calculateStandings = (matches: any[]) => {
  const standings: Record<string, any> = {};

  matches.forEach(match => {
    const groupLabel = match.group_label;
    if (!groupLabel) return;

    match.participants.forEach((p: any, idx: number) => {
      if (!p?.name) return;
      
      const key = `${groupLabel}-${p.name}`;
      if (!standings[key]) {
        standings[key] = { 
          group_label: groupLabel, 
          team_name: p.name, 
          played: 0,
          wins: 0, 
          losses: 0, 
          total_sets_won: 0, 
          total_sets_lost: 0, 
          point_diff: 0 
        };
      }

      if (match.status === 'completed' && match.scores) {
        standings[key].played++;
        const sets = match.scores.sets || [0, 0];
        const isWinner = (idx === 0 && sets[0] > sets[1]) || (idx === 1 && sets[1] > sets[0]);
        
        if (isWinner) standings[key].wins++;
        else standings[key].losses++;

        standings[key].total_sets_won += sets[idx];
        standings[key].total_sets_lost += sets[idx === 0 ? 1 : 0];
        standings[key].point_diff = standings[key].total_sets_won - standings[key].total_sets_lost;
      }
    });
  });

  return Object.values(standings);
};

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
    
    const channel = supabase
      .channel('standings-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchAllData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  if (loading) return <div className="text-gray-500 animate-pulse p-8">Calculating Standings...</div>;

  if (Object.keys(groups).length === 0) {
    return <div className="text-center p-12 text-gray-500 italic">No group standings available for this tournament.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(groups).sort().map(([label, teams]) => (
        <div key={label} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <h3 className="font-bold text-indigo-400">Group {label}</h3>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Standings</span>
          </div>
          
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-[10px] uppercase">
                <th className="px-4 py-2 text-left">Team</th>
                <th className="px-2 py-2">P</th>
                <th className="px-2 py-2">W</th>
                <th className="px-2 py-2">L</th>
                <th className="px-2 py-2">Sets</th>
                <th className="px-2 py-2 text-right pr-4">+/-</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {teams.map((team, idx) => (
                <tr key={team.team_name} className={idx < 2 ? "bg-indigo-500/5" : ""}>
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    {idx < 2 && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="In Qualification Zone" />}
                    {team.team_name}
                  </td>
                  <td className="px-2 py-3 text-center text-gray-400">{team.played}</td>
                  <td className="px-2 py-3 text-center font-bold text-green-400">{team.wins}</td>
                  <td className="px-2 py-3 text-center text-red-400">{team.losses}</td>
                  <td className="px-2 py-3 text-center text-xs text-gray-500">
                    {team.total_sets_won}-{team.total_sets_lost}
                  </td>
                  <td className="px-2 py-3 text-right pr-4 font-mono text-xs">
                    {team.point_diff > 0 ? `+${team.point_diff}` : team.point_diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="p-3 bg-gray-950/50 text-[10px] text-gray-600 italic">
            * Top teams advance to Knockout Stage
          </div>
        </div>
      ))}
    </div>
  );
}
