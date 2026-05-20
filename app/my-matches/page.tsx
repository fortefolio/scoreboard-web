"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { countSetsWon } from "@/lib/scoring/sets";

function MyMatchesContent() {
  const { user, supabase } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [userTournaments, setUserTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [sportType, setSportType] = useState("Tennis");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [matchDate, setMatchDate] = useState("");

  const fetchUserTournaments = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("organizer_id", userId);
    if (data) setUserTournaments(data);
  }, [supabase]);

  const fetchMyMatches = useCallback(async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("matches")
      .select("*, tournaments(name)")
      .or(`umpire_id.eq.${userId},organizer_id.eq.${userId}`)
      .is("tournament_id", null)
      .order("created_at", { ascending: false });

    if (data) setMatches(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([fetchMyMatches(user.id), fetchUserTournaments(user.id)]);
  }, [user, fetchMyMatches, fetchUserTournaments]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my-matches-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => { fetchMyMatches(user.id); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchMyMatches]);

  const handleCreateMatch = async () => {
    if (!user) {
      toast.error("You must be logged in to create a match");
      return;
    }
    if (!team1 || !team2) {
      toast.error("Please enter both team names");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalDate = new Date().toISOString();
      if (matchDate) {
        const parsedDate = new Date(matchDate);
        if (isNaN(parsedDate.getTime())) {
          toast.error("Invalid match date format");
          setIsSubmitting(false);
          return;
        }
        finalDate = parsedDate.toISOString();
      }

      const { error } = await supabase.from("matches").insert({
        organizer_id: user.id,
        sport_type: sportType,
        participants: [{ name: team1 }, { name: team2 }],
        tournament_id: selectedTournamentId || null,
        status: "scheduled",
        created_at: finalDate,
      }).select();

      if (!error) {
        toast.success("Match created successfully!");
        setShowModal(false);
        setTeam1("");
        setTeam2("");
        fetchMyMatches(user.id);
      } else {
        toast.error(`Error creating match: ${error.message}`);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-background text-on-background p-8 pt-24 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-black uppercase tracking-widest text-xs opacity-60">Initializing your account...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-on-background p-8 pt-24 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter leading-none mb-4">
            My <span className="text-primary">Matches</span>
          </h1>
          <p className="text-on-surface-variant text-xl max-w-xl">Matches assigned to you for scoring or participation.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="relative z-50 bg-primary-container text-on-primary-container px-8 py-4 rounded-full font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          New Match
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-on-surface-variant font-label uppercase tracking-widest text-[10px]">Synchronizing Matches...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {matches.map((match) => (
            <Link key={match.id} href={`/match/${match.id}`} className="group">
              <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10 hover:border-primary/40 transition-all duration-500 shadow-xl relative overflow-hidden flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-widest">{match.tournaments?.name || match.sport_type}</span>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      match.status === 'completed' ? 'bg-secondary/10 text-secondary' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {match.status}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {[0, 1].map((i) => {
                      const side = i === 0 ? 'home' : 'away';
                      let livePoints: string | number = 0;
                      let games: number | null = null;
                      const sets = countSetsWon(match.scores?.sets, i as 0 | 1);

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
                        <div key={i} className="flex justify-between items-center pr-2">
                          <div className="flex items-center gap-2 truncate max-w-[180px]">
                            <span className="text-lg font-bold text-on-surface truncate">{match.participants?.[i]?.name || "TBD"}</span>
                            {match.status === 'ongoing' && match.scores?.serving_index === i && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Serving"></span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] font-black uppercase text-on-surface-variant opacity-40 leading-none mb-1">Sets</span>
                              <span className="text-xs font-bold text-on-surface-variant">{sets}</span>
                            </div>
                            {games !== null && (
                              <div className="flex flex-col items-end">
                                <span className="text-[8px] font-black uppercase text-indigo-400/60 leading-none mb-1">Games</span>
                                <span className="text-xs font-bold text-indigo-400">{games}</span>
                              </div>
                            )}
                            {match.status === 'ongoing' && (
                              <div className="flex flex-col items-end min-w-[30px]">
                                <span className="text-[8px] font-black uppercase text-primary/60 leading-none mb-1">Pts</span>
                                <span className="text-xl font-digital text-primary">{livePoints}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-outline-variant/10 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    {match.round_number ? `Round ${match.round_number}` : new Date(match.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2 text-primary group-hover:translate-x-1 transition-transform">
                    <span className="text-[10px] font-black uppercase tracking-widest">Enter Arena</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          
          {matches.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-outline-variant/20 rounded-[2.5rem] p-20 flex flex-col items-center justify-center text-on-surface-variant bg-surface-container-low/30">
              <span className="material-symbols-outlined text-5xl mb-6 opacity-20">sports_tennis</span>
              <p className="font-black uppercase tracking-widest text-sm mb-2">No matches found</p>
              <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">You haven't been assigned to any matches yet.</p>
            </div>
          )}
        </div>
      )}

      {/* CREATE MATCH MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container-high rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <h2 className="text-3xl font-headline font-black mb-8 italic tracking-tighter text-white">NEW MATCH</h2>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Team 1</label>
                  <input 
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors" 
                    placeholder="Team Alpha"
                    value={team1}
                    onChange={e => setTeam1(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Team 2</label>
                  <input 
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors" 
                    placeholder="Team Beta"
                    value={team2}
                    onChange={e => setTeam2(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Sport Type</label>
                  <select 
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors appearance-none"
                    value={sportType}
                    onChange={e => setSportType(e.target.value)}
                  >
                    <option value="Tennis">Tennis</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Football">Football</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Tournament (Optional)</label>
                  <select 
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors appearance-none"
                    value={selectedTournamentId}
                    onChange={e => setSelectedTournamentId(e.target.value)}
                  >
                    <option value="">No Tournament</option>
                    {userTournaments.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Match Date</label>
                <input 
                  type="datetime-local"
                  className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors"
                  value={matchDate}
                  onChange={e => setMatchDate(e.target.value)}
                />
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-4 text-on-surface-variant font-black uppercase tracking-widest text-xs hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateMatch} 
                  disabled={isSubmitting}
                  className="flex-1 bg-primary-container text-on-primary-container py-4 rounded-full font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Create Match"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyMatchesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-on-surface-variant font-label uppercase tracking-widest text-[10px]">Synchronizing Matches...</p>
      </div>
    }>
      <MyMatchesContent />
    </Suspense>
  );
}
