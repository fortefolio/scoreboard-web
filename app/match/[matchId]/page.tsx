"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function MatchDetailsPage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [canStart, setCanStart] = useState(false);
  const [loading, setLoading] = useState(true);

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
        
        // Only the invited umpire can start the scoreboard
        const isUmpire = currUser?.id === mData.umpire_id;
        setCanStart(isUmpire);
      }
      setLoading(false);
    };
    fetchAll();
  }, [matchId]);

  const handleShare = async () => {
    const shareData = {
      title: `${match.participants?.[0]?.name || "TBD"} vs ${match.participants?.[1]?.name || "TBD"}`,
      text: `Follow the live score for ${match.tournaments?.name}!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  if (loading) return <div className="p-10 text-white bg-gray-950 min-h-screen text-center">Loading Match Details...</div>;
  if (!match) return <div className="p-10 text-white bg-gray-950 min-h-screen text-center">Match not found.</div>;

  const currentScore = match.current_score || {};
  const sets = currentScore.final_sets || [0, 0];
  const isCompleted = match.status === 'completed';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <Link 
            href={`/tournament/${match.tournament_id}`}
            className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
          >
            ← Back to Tournament
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4">
            <button 
              onClick={handleShare}
              className="text-indigo-400 hover:text-indigo-300 transition-colors p-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center"
              title="Share Match"
            >
              <span className="material-symbols-outlined text-sm">share</span>
            </button>
          </div>

          <div className="absolute top-0 right-0 p-4">
             <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}`}>
               {match.status}
             </span>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-gray-500 text-xs font-black uppercase tracking-[0.2em] mb-2">Round {match.round_number} Match {match.match_order}</h1>
            <h2 className="text-3xl font-black">{match.tournaments?.name}</h2>
          </div>

          <div className="grid grid-cols-2 gap-8 items-center relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700 font-black text-4xl">VS</div>
            
            {[0, 1].map((idx) => (
              <div key={idx} className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center text-3xl font-bold text-indigo-400 border border-gray-700">
                  {sets[idx]}
                </div>
                <h3 className="text-xl font-bold text-center h-14 flex items-center">{match.participants?.[idx]?.name || "TBD"}</h3>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-800">
                <p className="text-gray-500 uppercase font-bold mb-1">Format</p>
                <p className="font-bold">Best of {rules?.max_sets} Sets</p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-800">
                <p className="text-gray-500 uppercase font-bold mb-1">Score Target</p>
                <p className="font-bold">{rules?.points_per_set} Points</p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-800">
                <p className="text-gray-500 uppercase font-bold mb-1">Court</p>
                <p className="font-bold text-indigo-400">{match.court_number ? `Court ${match.court_number}` : "TBD"}</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            {canStart && !isCompleted ? (
              <button
                onClick={() => router.push(`/match/${matchId}/scoreboard`)}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                ⚡ Start Scoreboard
              </button>
            ) : isCompleted ? (
              <div className="w-full py-4 bg-gray-800 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-center border border-gray-700">
                Match Completed
              </div>
            ) : (
              <div className="w-full py-4 bg-gray-800/30 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-center border border-gray-800 text-xs px-8">
                Waiting for Umpire to start scoring
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
           <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">Match ID: {matchId}</p>
        </div>
      </div>
    </div>
  );
}
