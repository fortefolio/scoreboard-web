"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import NotificationBell from "@/components/NotificationBell";

export default function MatchDetailsPage() {
  const { matchId } = useParams();
  const matchIdStr = Array.isArray(matchId) ? matchId[0] : matchId;
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [canStart, setCanStart] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search state
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      console.log("Fetching match for ID:", matchIdStr);
      const { data: { user: currUser } } = await supabase.auth.getUser();
      setUser(currUser);

      const { data: mData, error: mError } = await supabase
        .from("matches")
        .select("*, tournaments(*)")
        .eq("id", matchIdStr)
        .single();
      
      if (mError) {
        console.error("Supabase Error fetching match:", mError);
        setLoading(false);
        return;
      }

      console.log("Match data found:", mData);

      if (mData) {
        setMatch(mData);
        const tRules = mData.tournaments.settings?.overrides?.[mData.round_number] || mData.tournaments.settings?.default || { max_sets: 3, points_per_set: 21 };
        setRules(tRules);
        
        // Only the invited umpire can start the scoreboard
        const isUmpire = currUser?.id === mData.umpire_id;
        setCanStart(isUmpire);
        setIsOrganizer(currUser?.id === mData.tournaments.organizer_id);
      }
      setLoading(false);
    };
    fetchAll();
  }, [matchIdStr]);

  useEffect(() => {
    const searchUsers = async () => {
      if (userSearch.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .or(`name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`)
        .limit(5);

      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [userSearch]);

  const appointUmpire = async (selectedUser: any) => {
    const { error } = await supabase
      .from("matches")
      .update({ umpire_id: selectedUser.id })
      .eq("id", matchIdStr);

    if (error) {
      toast.error("Failed to appoint umpire: " + error.message);
    } else {
      // Create notification for the umpire
      await supabase
        .from("notifications")
        .insert({
          user_id: selectedUser.id,
          title: "Umpire Invitation",
          body: `You have been invited to score the match between ${match.participants?.[0]?.name || "TBD"} and ${match.participants?.[1]?.name || "TBD"} in ${match.tournaments?.name}.`,
          data: { matchId: matchIdStr, type: 'umpire_assignment' }
        });

      setMatch({ ...match, umpire_id: selectedUser.id, umpire: selectedUser });
      setUserSearch("");
      setSearchResults([]);
      toast.success(`${selectedUser.name} appointed as umpire!`);
    }
  };

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
        toast.success("Link copied to clipboard!");
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

          <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
             <NotificationBell />
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
            {isOrganizer && (
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Umpire Management</h3>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${match.umpire_id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {match.umpire_id ? "Umpire Assigned" : "No Umpire"}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {match.umpire && (
                    <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-indigo-400">person</span>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{match.umpire.name || "Unknown User"}</p>
                        <p className="text-indigo-400/60 text-[10px] uppercase font-black tracking-widest">{match.umpire.email}</p>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/50 text-sm">person_search</span>
                      <input 
                        type="text"
                        placeholder="Search by name or email..."
                        className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-gray-600"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                      {isSearching && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {searchResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => appointUmpire(u)}
                            className="w-full px-4 py-3 text-left hover:bg-indigo-500/10 transition-colors border-b last:border-b-0 border-gray-800 flex flex-col"
                          >
                            <span className="text-white font-bold text-xs">{u.name || "No Name"}</span>
                            <span className="text-gray-500 text-[9px] uppercase font-black tracking-tighter">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {match.umpire_id && (
                    <button 
                      onClick={async () => {
                        const { error } = await supabase.from('matches').update({ umpire_id: null }).eq('id', matchIdStr);
                        if (!error) {
                          setMatch({ ...match, umpire_id: null, umpire: null });
                          toast.success("Umpire unassigned.");
                        } else {
                          toast.error("Error unassigning: " + error.message);
                        }
                      }}
                      className="w-full py-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                    >
                      Unassign Umpire
                    </button>
                  )}
                </div>
              </div>
            )}

            {canStart && !isCompleted ? (
              <button
                onClick={() => router.push(`/match/${matchIdStr}/scoreboard`)}
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
           <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">Match ID: {matchIdStr}</p>
        </div>
      </div>
    </div>
  );
}
