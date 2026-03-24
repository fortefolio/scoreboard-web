"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function TournamentBracket() {
  const { id } = useParams();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<any>(null);

  // Fetch tournament details and matches
  useEffect(() => {
    const loadData = async () => {
      // Fetch Tournament Metadata
      const { data: tData } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .single();
      setTournament(tData);

      // Fetch Matches
      const { data: mData } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", id)
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });
      if (mData) setMatches(mData);
      
      setLoading(false);
    };

    if (id) {
      loadData();
    }
  }, [id]);

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
      .eq('id', id);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings });
    } else {
      alert(`Error updating Round ${roundNum}: ${error.message}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-white bg-gray-900 h-screen">Loading Bracket...</div>;

  // Group matches by round
  const rounds = matches.reduce((acc: any, match) => {
    const roundNum = match.round_number;
    if (!acc[roundNum]) acc[roundNum] = [];
    acc[roundNum].push(match);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 overflow-x-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-black tracking-tighter">{tournament?.name || "Tournament"}</h1>
        <p className="text-indigo-400 uppercase tracking-widest text-xs font-bold mt-1">
          {tournament?.sport_type} • Bracket View
        </p>
      </div>

      <div className="flex gap-12 min-w-max justify-center">
        {Object.keys(rounds).map((roundNum) => {
          const roundInt = parseInt(roundNum);
          const rules = tournament?.settings?.overrides?.[roundInt] || tournament?.settings?.default || { max_sets: 3, points_per_set: 21 };

          return (
            <div key={roundNum} className="flex flex-col justify-around gap-8 w-64">
              <div className="text-center group relative mb-4">
                <h3 className="font-bold text-gray-400 uppercase tracking-widest text-sm">
                  Round {roundNum}
                </h3>
                {/* Display Active Rules */}
                <div className="text-[10px] text-indigo-400 font-bold">
                  {rules.max_sets} Sets | {rules.points_per_set} Pts {rules.point_cap ? `| Cap ${rules.point_cap}` : ""}
                </div>
                
                {/* Simple inline button to trigger an override */}
                <button 
                  onClick={() => {
                    const s = prompt("Max Sets for this round?", rules.max_sets);
                    const p = prompt("Points per set for this round?", rules.points_per_set);
                    const c = prompt("Point Cap? (Leave blank for no cap)", rules.point_cap || "");

                    if (s && p) {
                      saveOverride(roundInt, parseInt(s), parseInt(p), c ? parseInt(c) : null);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[10px] bg-indigo-600 px-2 py-0.5 rounded mt-1 transition-opacity font-bold uppercase"
                >
                  Edit Rules
                </button>
              </div>

              {rounds[roundNum].map((match: any) => (
                <Link key={match.id} href={`/match/${match.id}`} className="block">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl hover:border-indigo-500/50 transition-colors cursor-pointer">
                    <div className="space-y-3">
                      {match.participants && match.participants.length > 0 ? (
                        match.participants.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between items-center border-b border-gray-700 pb-1 last:border-0">
                            <span className="text-sm font-medium">{p.name || "TBD"}</span>
                            <span className="text-indigo-400 font-mono text-xs">0</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-500 text-xs text-center py-2 italic">Waiting for winners...</div>
                      )}
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-700/50 text-[10px] text-gray-500 flex justify-between font-mono">
                      <span>M-{match.match_order}</span>
                      <span className="capitalize px-1.5 bg-gray-900 rounded text-gray-400">{match.status}</span>
                    </div>
                  </div>
                </Link>
              ))}            </div>
          );
        })}
      </div>
    </div>
  );
}
