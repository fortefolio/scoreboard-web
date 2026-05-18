"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import RuleModal from "@/components/RuleModal";

const getInitials = (name?: string) => {
  if (!name) return "?";
  const cleaned = name.replace(/\(.+?\)/g, "").trim();
  if (!cleaned) return "?";
  return cleaned
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getSportIcon = (sport?: string) => {
  switch (sport) {
    case "Volleyball":
      return "sports_volleyball";
    case "Tennis":
    default:
      return "sports_tennis";
  }
};

const renderLivePoint = (match: any, idx: number) => {
  if (match.sport_type === "Tennis" && match.scores?.tennis) {
    const p = match.scores.tennis.points?.[idx] ?? 0;
    const opp = match.scores.tennis.points?.[idx === 0 ? 1 : 0] ?? 0;
    const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];
    if (p >= 3 && opp >= 3) return p > opp ? "AD" : "40";
    return TENNIS_POINTS[p] || "0";
  }
  return match.scores?.current?.[idx === 0 ? "home" : "away"] ?? 0;
};

export default function MatchDetailClient() {
  const { matchId } = useParams();
  const matchIdStr = Array.isArray(matchId) ? matchId[0] : matchId;
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [canStart, setCanStart] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // Search state
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      console.log("Fetching match for ID:", matchIdStr);
      const { data: { user: currUser } } = await supabase.auth.getUser();
      setUser(currUser);

      // Fetch match and tournament first
      const { data: mData, error: mError } = await supabase
        .from("matches")
        .select("*, tournaments(*)")
        .eq("id", matchIdStr)
        .single();
      
      if (mError) {
        console.error("Supabase Error fetching match:", mError);
        toast.error(`Error fetching match: ${mError.message}`);
        setLoading(false);
        return;
      }

      if (mData) {
        let umpireData = null;
        if (mData.umpire_id) {
          const { data: uData } = await supabase
            .from("users")
            .select("id, username, email")
            .eq("id", mData.umpire_id)
            .single();
          umpireData = uData;
        }

        const matchWithUmpire = { ...mData, umpire: umpireData };
        setMatch(matchWithUmpire);
        
        // Resolve Rules Hierarchy (consistent with Scoreboard)
        const isVolleyball = mData.sport_type === 'Volleyball';
        const baseDefaults = { 
          max_sets: 3, 
          points_per_set: isVolleyball ? 25 : 21,
          point_cap: null 
        };

        let resolvedRules;
        if (mData.tournament_id) {
          const tournamentSettings = mData.tournaments?.settings || {};
          const roundOverrides = tournamentSettings.overrides?.[mData.round_number] || {};
          const tournamentDefault = tournamentSettings.default || {};
          
          resolvedRules = {
            ...baseDefaults,
            ...tournamentDefault,
            ...roundOverrides
          };
        } else {
          resolvedRules = {
            ...baseDefaults,
            ...(mData.settings || {})
          };
        }

        setRules(resolvedRules);
        
        // Only the invited umpire can start the scoreboard
        const isUmpire = currUser?.id === mData.umpire_id;
        setCanStart(isUmpire);
        setIsOrganizer(currUser?.id === mData.organizer_id);
      }
      setLoading(false);
    };
    fetchAll();

    // Set up real-time subscription
    const channel = supabase
      .channel(`match-detail-${matchIdStr}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchIdStr}`
        },
        (payload: any) => {
          setMatch((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        .select("id, username, email")
        .or(`username.ilike.%${userSearch}%,email.ilike.%${userSearch}%`)
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
          body: `You have been invited to score the match between ${match?.participants?.[0]?.name || "TBD"} and ${match?.participants?.[1]?.name || "TBD"} in ${match?.tournaments?.name || "Independent Match"}.`,
          data: { matchId: matchIdStr, type: 'umpire_assignment' }
        });

      setMatch({ ...match, umpire_id: selectedUser.id, umpire: selectedUser });
      setUserSearch("");
      setSearchResults([]);
      toast.success(`${selectedUser.username} appointed as umpire!`);
    }
  };

  const handleSaveRules = async (sets: number, points: number, cap: number | null, court?: string | null) => {
    const newRules = { max_sets: sets, points_per_set: points, point_cap: cap };
    const { error } = await supabase
      .from("matches")
      .update({ 
        settings: newRules,
        court: court
      })
      .eq("id", matchIdStr);

    if (!error) {
      setRules(newRules);
      setMatch({ ...match, settings: newRules, court: court });
      toast.success("Match rules updated!");
      setIsRuleModalOpen(false);
    } else {
      toast.error("Error updating rules: " + error.message);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `${match?.participants?.[0]?.name || "TBD"} vs ${match?.participants?.[1]?.name || "TBD"}`,
      text: `Follow the live score for ${match?.tournaments?.name || "this match"}!`,
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

  if (loading) return (
    <div className="min-h-screen bg-surface text-on-surface-variant flex items-center justify-center font-label text-xs font-bold uppercase tracking-[0.2em]">
      Loading Match Details
    </div>
  );
  if (!match) return (
    <div className="min-h-screen bg-surface text-on-surface-variant flex items-center justify-center font-label text-xs font-bold uppercase tracking-[0.2em]">
      Match Not Found
    </div>
  );

  const sets = match.scores?.sets || [0, 0];
  const isCompleted = match.status === 'completed';

  // Determine back tab
  const backTab = match.group_label ? 'group_matches' : 'bracket';

  return (
    <div className="min-h-screen bg-surface text-on-surface px-4 sm:px-6 py-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="mb-6">
          <Link
            href={match.tournament_id ? `/tournament/${match.tournament_id}?tab=${backTab}` : "/my-matches"}
            className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 hover:text-on-surface inline-flex items-center gap-2 transition-colors"
          >
            <span aria-hidden>←</span>
            {match.tournament_id ? "Back to Tournament" : "Back to My Matches"}
          </Link>
        </div>

        {/* HERO */}
        <div className="relative bg-surface-container-low rounded-3xl p-6 sm:p-10 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,70,229,0.18), transparent 65%)" }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1/2 pointer-events-none opacity-40"
            style={{ background: "linear-gradient(180deg, rgba(46,52,71,0.45), transparent)" }}
          />

          <button
            onClick={handleShare}
            title="Share Match"
            className="absolute top-5 left-5 z-10 w-9 h-9 rounded-xl bg-surface-container-high/70 backdrop-blur-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>

          <div className="absolute top-5 right-5 z-10">
            <span
              className={`px-3 py-1.5 rounded-full font-label text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${
                isCompleted
                  ? "bg-secondary-container text-on-secondary-container"
                  : match.status === "ongoing"
                  ? "bg-primary-container/80 text-on-primary-container"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {match.status}
            </span>
          </div>

          <div className="relative flex justify-center pt-2 mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high/70 backdrop-blur-md">
              <span className="material-symbols-outlined text-secondary text-[16px]">
                {getSportIcon(match.sport_type)}
              </span>
              <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                {match.sport_type || "Tennis"}
                {match.tournament_id && match.tournaments?.name ? ` • ${match.tournaments.name}` : ""}
              </span>
            </div>
          </div>

          <div className="relative grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-6 items-center">
            {/* Left mark */}
            <div className="flex sm:justify-end justify-center">
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-surface-container ring-1 ring-outline-variant/15 flex items-center justify-center">
                {match.status === "scheduled" ? (
                  <span className="font-headline font-black text-4xl sm:text-5xl text-on-surface-variant/50">
                    {getInitials(match.participants?.[0]?.name)}
                  </span>
                ) : (
                  <span className="font-label font-black text-5xl sm:text-6xl text-primary score-shadow-indigo">
                    {sets[0]}
                  </span>
                )}
                {match.status === "ongoing" && (
                  <div className="absolute -top-2 -right-2 bg-primary-container text-on-primary-container font-label text-[11px] font-black w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-surface-container-low animate-pulse">
                    {renderLivePoint(match, 0)}
                  </div>
                )}
              </div>
            </div>

            {/* Center */}
            <div className="flex flex-col items-center gap-2 min-w-[72px] sm:min-w-[100px]">
              <div className="font-headline font-black text-2xl sm:text-3xl text-on-surface-variant/40">VS</div>
              {match.status === "ongoing" && (
                <div className="px-2.5 py-1 rounded-full bg-primary-container/30 backdrop-blur-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="font-label text-[9px] font-black uppercase tracking-widest text-primary">LIVE</span>
                </div>
              )}
              {isCompleted && (
                <div className="px-2.5 py-1 rounded-full bg-secondary-container/40 backdrop-blur-md">
                  <span className="font-label text-[9px] font-black uppercase tracking-widest text-secondary">FINAL</span>
                </div>
              )}
            </div>

            {/* Right mark */}
            <div className="flex sm:justify-start justify-center">
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-surface-container ring-1 ring-outline-variant/15 flex items-center justify-center">
                {match.status === "scheduled" ? (
                  <span className="font-headline font-black text-4xl sm:text-5xl text-secondary/60">
                    {getInitials(match.participants?.[1]?.name)}
                  </span>
                ) : (
                  <span className="font-label font-black text-5xl sm:text-6xl text-primary score-shadow-indigo">
                    {sets[1]}
                  </span>
                )}
                {match.status === "ongoing" && (
                  <div className="absolute -top-2 -right-2 bg-primary-container text-on-primary-container font-label text-[11px] font-black w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-surface-container-low animate-pulse">
                    {renderLivePoint(match, 1)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-3 sm:gap-6 mt-6 sm:mt-8">
            {[0, 1].map((idx) => (
              <h2
                key={idx}
                className="font-headline font-black uppercase text-2xl sm:text-4xl leading-[0.95] text-center text-on-surface"
              >
                {match.participants?.[idx]?.name || "TBD"}
              </h2>
            ))}
          </div>
        </div>

        {/* INFO CARDS */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="bg-surface-container-low rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
                <h3 className="font-headline font-bold text-sm">Match Rules</h3>
              </div>
              {isOrganizer && !match.tournament_id && (
                <button
                  onClick={() => setIsRuleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all font-label text-[10px] font-black uppercase tracking-widest"
                >
                  <span className="material-symbols-outlined text-[12px]">edit</span>
                  Edit Rules
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container rounded-2xl p-4">
                <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Format</p>
                <p className="font-headline font-bold text-sm text-on-surface">Best of {rules?.max_sets} Sets</p>
              </div>
              <div className="bg-surface-container rounded-2xl p-4">
                <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Score Target</p>
                <p className="font-headline font-bold text-sm text-on-surface">{rules?.points_per_set} Points</p>
              </div>
              <div className="bg-surface-container rounded-2xl p-4 col-span-2">
                <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Venue / Court</p>
                <p className="font-headline font-bold text-sm text-on-surface">{match.court || "TBD"}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-primary text-[20px]">gavel</span>
              <h3 className="font-headline font-bold text-sm">Match Official</h3>
            </div>

            {match.umpire ? (
              <div className="bg-surface-container rounded-2xl p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary-container/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[22px]">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-sm text-on-surface truncate">
                    {match.umpire.username || "Unknown"}
                  </p>
                  <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                    Official Umpire
                  </p>
                </div>
                <span className="material-symbols-outlined text-secondary text-[20px]" aria-hidden>check_circle</span>
                {isOrganizer && (
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from("matches").update({ umpire_id: null }).eq("id", matchIdStr);
                      if (!error) {
                        setMatch({ ...match, umpire_id: null, umpire: null });
                        toast.success("Umpire unassigned.");
                      } else {
                        toast.error("Error unassigning: " + error.message);
                      }
                    }}
                    className="p-1.5 -mr-1 rounded-lg text-on-surface-variant/40 hover:text-error hover:bg-error-container/20 transition-all"
                    title="Unassign Umpire"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_remove</span>
                  </button>
                )}
              </div>
            ) : isOrganizer ? (
              <div className="space-y-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">person_search</span>
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    className="w-full pl-11 pr-10 py-3 bg-surface-container rounded-2xl text-sm font-body text-on-surface outline-none placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary-container/50 transition-all"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-high rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => appointUmpire(u)}
                          className="w-full px-4 py-3 text-left hover:bg-primary-container/20 transition-colors flex flex-col"
                        >
                          <span className="font-headline font-bold text-sm text-on-surface">{u.username || "No Name"}</span>
                          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 truncate">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-tertiary">No Umpire Assigned</p>
              </div>
            ) : (
              <div className="bg-surface-container rounded-2xl p-5 text-center">
                <p className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                  Awaiting Umpire Assignment
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          {canStart && !isCompleted ? (
            <button
              onClick={async () => {
                const { error } = await supabase
                  .from("matches")
                  .update({ status: "ongoing" })
                  .eq("id", matchIdStr);
                if (error) {
                  toast.error("Failed to start match: " + error.message);
                } else {
                  router.push(`/match/${matchIdStr}/scoreboard`);
                }
              }}
              className="w-full py-5 rounded-3xl bg-primary-container hover:brightness-110 text-on-primary-container font-headline font-black uppercase tracking-[0.2em] text-sm transition-all active:scale-[0.99] flex items-center justify-center gap-3 shadow-[0_0_60px_-15px_rgba(79,70,229,0.6)]"
            >
              <span className="material-symbols-outlined text-[22px]">play_circle</span>
              Start Scoreboard
            </button>
          ) : isCompleted ? (
            <div className="w-full py-5 rounded-3xl bg-surface-container-low text-on-surface-variant text-center font-headline font-black uppercase tracking-[0.2em] text-sm">
              Match Completed
            </div>
          ) : (
            <div className="w-full py-5 rounded-3xl bg-surface-container-low text-on-surface-variant/60 text-center font-label font-bold uppercase tracking-[0.2em] text-xs px-6">
              Waiting for Umpire to Start Scoring
            </div>
          )}
        </div>
      </div>

      <RuleModal
        roundNum={match.round_number || 1}
        initialRules={rules}
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        onSave={handleSaveRules}
        sportType={match.sport_type}
        initialCourt={match.court}
      />
    </div>
  );
}
