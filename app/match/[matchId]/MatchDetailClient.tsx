"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import RuleModal from "@/components/RuleModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import SportIcon from "@/components/SportIcon";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";

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



const CountdownTimer = ({ scheduledAt }: { scheduledAt?: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!scheduledAt) {
      setTimeLeft("STARTING");
      setIsReady(true);
      return;
    }
    
    const target = new Date(scheduledAt).getTime();
    if (isNaN(target)) {
      setTimeLeft("STARTING");
      setIsReady(true);
      return;
    }

    const update = () => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        setIsReady(true);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
      setIsReady(true);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  return (
    <div className="flex flex-col items-center">
      <div className="font-label text-[12px] sm:text-[14px] font-black uppercase tracking-[0.4em] text-on-surface-variant/20 mb-3">vs</div>
      <div className="bg-[#1a2035]/60 backdrop-blur-xl w-32 sm:w-56 py-3 sm:py-4 rounded-[1.25rem] border border-white/5 flex flex-col items-center shadow-[0_0_40px_-12px_rgba(0,0,0,0.5)]">
        <div className="font-label text-[8px] font-black uppercase tracking-[0.3em] text-on-surface-variant/30 mb-1">
          {timeLeft === "STARTING" ? "SOON" : "Starts In"}
        </div>
        <div className={`font-headline font-black tracking-tight text-on-surface ${timeLeft === "STARTING" ? "text-lg sm:text-xl pb-1" : "text-2xl sm:text-4xl"}`}>
          {timeLeft}
        </div>
      </div>
    </div>
  );
};

const renderLivePoint = (match: any, idx: number) => {
  if ((match.sport_type === "Tennis" || match.sport_type === "Padel") && match.scores?.tennis) {
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expandedSets, setExpandedSets] = useState<Record<number, boolean>>({ 1: true });
  const [matchEvents, setMatchEvents] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"progress" | "rules" | "official">("progress");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const toggleSetExpanded = (setNumber: number) => {
    setExpandedSets((prev) => ({
      ...prev,
      [setNumber]: !prev[setNumber],
    }));
  };

  // Search state
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Dynamically update browser tab title with abbreviated names
  useEffect(() => {
    if (match?.participants) {
      const p1 = formatTeamOrPlayerName(match.participants[0]?.name) || "TBD";
      const p2 = formatTeamOrPlayerName(match.participants[1]?.name) || "TBD";
      const tournamentName = match.tournaments?.name ? ` | ${match.tournaments.name}` : " | ScoreBoard";
      document.title = `${p1} vs ${p2}${tournamentName}`;
    }
  }, [match?.participants, match?.tournaments?.name]);

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

        let organizerData = null;
        const ownerId = mData.organizer_id || mData.tournaments?.organizer_id;
        if (ownerId) {
          const { data: oData } = await supabase
            .from("users")
            .select("id, username, email")
            .eq("id", ownerId)
            .single();
          organizerData = oData;
        }

        const matchWithUmpire = { ...mData, umpire: umpireData, organizer: organizerData };
        setMatch(matchWithUmpire);

        // Fetch scoring events
        const { data: evData } = await supabase
          .from("match_events")
          .select("*")
          .eq("match_id", matchIdStr)
          .order("created_at", { ascending: true });
        if (evData) setMatchEvents(evData);
        
        // Resolve Rules Hierarchy (sport-aware)
        const isVolleyball = mData.sport_type === 'Volleyball';
        const isBasketball = mData.sport_type === 'Basketball';
        const isFootball = mData.sport_type === 'Football';
        const isTennis = mData.sport_type === 'Tennis';
        const isPadel = mData.sport_type === 'Padel';

        let baseDefaults: Record<string, any>;
        if (isBasketball) {
          baseDefaults = {
            quarter_minutes: 10,
            quarters_count: 4,
            shot_clock_seconds: 24,
            overtime_minutes: 5,
            fouls_bonus: 5,
          };
        } else if (isFootball) {
          baseDefaults = {
            half_minutes: 45,
            extra_time_minutes: 15,
          };
        } else if (isTennis || isPadel) {
          baseDefaults = {
            max_sets: 3,
            set_type: 'tiebreak',
            match_format: 'best_of_3',
            points_per_set: 6,
            no_ad: isPadel,
          };
        } else {
          baseDefaults = {
            max_sets: isVolleyball ? 5 : 3,
            points_per_set: isVolleyball ? 25 : 21,
            point_cap: null,
          };
        }

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
        const isMatchOrganizer = Boolean(
          currUser && (
            currUser.id === mData.organizer_id ||
            currUser.id === mData.tournaments?.organizer_id
          )
        );
        setIsOrganizer(isMatchOrganizer);
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
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        (payload: any) => {
          if (payload.new && payload.new.id === matchIdStr) {
            setMatch((prev: any) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
        },
        (payload: any) => {
          if (payload.new && payload.new.match_id === matchIdStr) {
            setMatchEvents((prev) => [...prev, payload.new]);
          }
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
      setMatch({ ...match, umpire_id: selectedUser.id, umpire: selectedUser });
      setUserSearch("");
      setSearchResults([]);
      toast.success(`${selectedUser.username} appointed as umpire!`);
    }
  };
  const handleSaveRules = async (
    rulesOrSets: Record<string, any> | number,
    pointsOrCourt?: any,
    cap?: number | null,
    court?: string | null,
    noAd?: boolean
  ) => {
    let newRules: Record<string, any>;
    let targetCourt: string | null = null;

    if (typeof rulesOrSets === "object") {
      newRules = { ...rules, ...rulesOrSets };
      targetCourt = pointsOrCourt !== undefined ? pointsOrCourt : match.court;
    } else {
      newRules = { 
        ...rules, 
        max_sets: rulesOrSets, 
        points_per_set: pointsOrCourt, 
        point_cap: cap,
        ...(noAd !== undefined ? { no_ad: noAd } : {})
      };
      targetCourt = court !== undefined ? court : match.court;
    }

    const { error } = await supabase
      .from("matches")
      .update({ 
        settings: newRules,
        court: targetCourt
      })
      .eq("id", matchIdStr);

    if (!error) {
      setRules(newRules);
      setMatch({ ...match, settings: newRules, court: targetCourt });
      toast.success("Match rules updated!");
      setIsRuleModalOpen(false);
    } else {
      toast.error("Error updating rules: " + error.message);
    }
  };

  const handleShare = async () => {
    const p1 = formatTeamOrPlayerName(match?.participants?.[0]?.name) || "TBD";
    const p2 = formatTeamOrPlayerName(match?.participants?.[1]?.name) || "TBD";
    const shareData = {
      title: `${p1} vs ${p2}`,
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

  const handleDeleteMatch = async () => {
    const { error } = await supabase.from("matches").delete().eq("id", matchIdStr);
    if (error) {
      toast.error("Failed to delete match: " + error.message);
    } else {
      toast.success("Match deleted successfully!");
      if (match?.tournament_id) {
        router.push(`/tournament/${match.tournament_id}`);
      } else {
        router.push("/my-matches");
      }
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

  const isPointsBased = match.sport_type === 'Football' || match.sport_type === 'Basketball';
  const setsData = extractSetsData(match.scores);
  const sets = [
    isPointsBased ? (match.scores?.current?.home ?? 0) : countSetsWon(setsData, 0),
    isPointsBased ? (match.scores?.current?.away ?? 0) : countSetsWon(setsData, 1)
  ];
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
        <div className="relative bg-[#0c1324] rounded-[2.5rem] p-6 sm:p-12 overflow-hidden border border-white/5">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ 
              background: `
                radial-gradient(circle at 20% -10%, rgba(79,70,229,0.15), transparent 40%),
                radial-gradient(circle at 80% -10%, rgba(16,185,129,0.1), transparent 40%),
                radial-gradient(circle at 50% 110%, rgba(79,70,229,0.05), transparent 50%)
              `
            }}
          />
          
          {/* Stadium Light Glows */}
          <div className="absolute top-0 left-1/4 w-32 h-1 bg-white/20 blur-2xl rounded-full" />
          <div className="absolute top-0 right-1/4 w-32 h-1 bg-white/20 blur-2xl rounded-full" />

          {/* Top Bar: Chips (Sport -> Author -> Status) & Options Menu */}
          <div className="relative z-20 flex items-start justify-between gap-3 mb-6 sm:mb-8">
            {/* Left Chips: Sport -> Author -> Status */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Sport Pill */}
              <div className="h-7 px-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm inline-flex items-center gap-1.5">
                <SportIcon sport={match.sport_type} className="text-secondary text-[13px] leading-none" />
                <span className="font-label text-[10px] font-black uppercase tracking-widest text-on-surface-variant/90 leading-none">
                  {match.sport_type || "Tennis"}
                </span>
              </div>

              {/* 2. Author / Owner Pill */}
              {(match.organizer?.username || match.organizer?.email) && (
                <Link
                  href={`/user/${encodeURIComponent(match.organizer.username || match.organizer.email.split("@")[0])}`}
                  className="h-7 px-3 rounded-full bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-sm border border-white/5 hover:border-white/15 text-on-surface-variant/70 hover:text-on-surface transition-all duration-300 inline-flex items-center gap-1.5 cursor-pointer shadow-sm group"
                  title={`Ver perfil de @${match.organizer.username || match.organizer.email.split("@")[0]}`}
                >
                  <span className="material-symbols-outlined text-[13px] leading-none text-on-surface-variant/50 group-hover:text-primary transition-colors">person</span>
                  <span className="font-label text-[10px] font-black uppercase tracking-widest leading-none group-hover:text-on-surface transition-colors">
                    @{match.organizer.username || match.organizer.email.split("@")[0]}
                  </span>
                </Link>
              )}

              {/* 3. Status Badge */}
              <span
                className={`h-7 px-3 rounded-full font-label text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/10 inline-flex items-center gap-1.5 shadow-sm leading-none ${
                  isCompleted
                    ? "bg-secondary-container/20 text-secondary"
                    : match.status === "ongoing"
                    ? "bg-primary-container/20 text-primary border-primary/30"
                    : "bg-white/5 text-on-surface-variant"
                }`}
              >
                {match.status === "ongoing" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                )}
                {match.status}
              </span>
            </div>

            {/* Top-Right: 3-Dots Dropdown Menu */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((prev) => !prev)}
                title="Opções do Jogo"
                className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md text-on-surface-variant hover:text-on-surface border border-white/10 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
              >
                <span className="material-symbols-outlined text-[22px]">more_vert</span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-12 w-48 py-1.5 bg-[#151c2f]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleShare();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-on-surface hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">share</span>
                    Partilhar
                  </button>

                  {isOrganizer && (
                    match.tournament_id ? (
                      <button
                        disabled
                        title="Jogos pertencentes a um torneio não podem ser eliminados individualmente"
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-400/40 cursor-not-allowed flex items-center gap-2.5 border-t border-white/5 select-none"
                      >
                        <span className="material-symbols-outlined text-[18px] opacity-40">delete</span>
                        <span className="flex-1 opacity-50">Remover</span>
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40" title="Bloqueado por pertencer a um torneio">lock</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-white/5"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                        Remover
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tournament Pill (Centered) */}
          {match.tournaments?.name && (
            <div className="relative flex justify-center mb-8 sm:mb-10">
              {match.tournament_id ? (
                <Link
                  href={`/tournament/${match.tournament_id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 backdrop-blur-md border border-primary/20 hover:border-primary/40 text-primary transition-all duration-300 max-w-[85vw] sm:max-w-md shadow-sm group"
                  title={match.tournaments.name}
                >
                  <span className="material-symbols-outlined text-[15px] text-primary shrink-0 group-hover:scale-110 transition-transform">emoji_events</span>
                  <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] truncate">
                    {match.tournaments.name}
                  </span>
                </Link>
              ) : (
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-md border border-primary/20 text-primary max-w-[85vw] sm:max-w-md shadow-sm"
                  title={match.tournaments.name}
                >
                  <span className="material-symbols-outlined text-[15px] text-primary shrink-0">emoji_events</span>
                  <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] truncate">
                    {match.tournaments.name}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="relative flex flex-col items-center">
            <div className="w-full max-w-xl sm:max-w-2xl grid grid-cols-[1fr_auto_1fr] gap-4 sm:gap-8 items-center mb-4">
              {/* Left Team Box */}
              <div className="flex flex-col items-center gap-6">
                <div className="w-24 h-24 sm:w-44 sm:h-44 rounded-full bg-[#1a2035]/80 border-[4px] border-[#c3c0ff]/20 flex items-center justify-center shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.02]">
                  {match.status === "scheduled" ? (
                    <span className="font-headline font-black text-4xl sm:text-7xl text-on-surface-variant/70 tracking-tight">
                      {getInitials(match.participants?.[0]?.name)}
                    </span>
                  ) : (
                    <span className="font-label font-black text-5xl sm:text-8xl text-primary score-shadow-indigo">
                      {sets[0]}
                    </span>
                  )}
                </div>
                <h2 className="font-headline font-black uppercase text-xl sm:text-3xl text-center text-on-surface max-w-[160px] sm:max-w-[280px] leading-[1.1] tracking-tight">
                  {formatTeamOrPlayerName(match.participants?.[0]?.name) || "TBD"}
                </h2>
              </div>

              {/* Center - Countdown or VS */}
              <div className="flex flex-col items-center justify-center min-w-[60px] sm:min-w-[100px]">
                {match.status !== "ongoing" && match.status !== "completed" ? (
                  <CountdownTimer scheduledAt={match.scheduled_at} />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="font-label text-[11px] font-bold lowercase tracking-[0.3em] text-on-surface-variant/30">vs</div>
                    {match.status === "ongoing" && (
                      <div className="px-4 py-2 rounded-full bg-primary-container/20 border border-primary/20 backdrop-blur-md flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="font-label text-[10px] font-black uppercase tracking-[0.25em] text-primary">LIVE</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Team Box */}
              <div className="flex flex-col items-center gap-6">
                <div className="w-24 h-24 sm:w-44 sm:h-44 rounded-full bg-[#1a2035]/80 border-[4px] border-[#4edea3]/20 flex items-center justify-center shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.02]">
                  {match.status === "scheduled" ? (
                    <span className="font-headline font-black text-4xl sm:text-7xl text-secondary tracking-tight">
                      {getInitials(match.participants?.[1]?.name)}
                    </span>
                  ) : (
                    <span className="font-label font-black text-5xl sm:text-8xl text-primary score-shadow-indigo">
                      {sets[1]}
                    </span>
                  )}
                </div>
                <h2 className="font-headline font-black uppercase text-xl sm:text-3xl text-center text-on-surface max-w-[160px] sm:max-w-[280px] leading-[1.1] tracking-tight">
                  {formatTeamOrPlayerName(match.participants?.[1]?.name) || "TBD"}
                </h2>
              </div>
            </div>

            {/* SCOREBOARD TABLE (QUARTERS FOR BASKETBALL, SETS FOR VOLLEYBALL/TENNIS) */}
            {match.sport_type === "Basketball" ? (
              <div className="w-full mt-8 pt-6 border-t border-white/10">
                <div className="bg-[#131b31]/80 backdrop-blur-md rounded-2xl border border-white/10 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                      <tr>
                        <th className="py-2.5 px-4 text-left font-normal">Equipa</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px]">Q1</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px]">Q2</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px]">Q3</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px]">Q4</th>
                        {(match.scores?.basketball?.quarters?.length || 0) > 4 && (
                          <th className="py-2.5 px-3 text-center min-w-[44px]">OT</th>
                        )}
                        <th className="py-2.5 px-4 text-center text-secondary font-black min-w-[50px] bg-white/[0.03]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[0, 1].map((pIdx) => {
                        const playerName = formatTeamOrPlayerName(match.participants?.[pIdx]?.name) || `Equipa ${pIdx + 1}`;
                        const bQuarters = match.scores?.basketball?.quarters || [];
                        const totalScore = match.scores?.current?.[pIdx === 0 ? "home" : "away"] ?? 0;
                        const oppTotal = match.scores?.current?.[pIdx === 0 ? "away" : "home"] ?? 0;
                        const isMatchWinner = isCompleted && totalScore > oppTotal;

                        return (
                          <tr key={pIdx} className={isMatchWinner ? "bg-white/[0.03]" : ""}>
                            <td className="py-3.5 px-4 font-headline font-bold text-on-surface flex items-center gap-2.5">
                              <span className={isMatchWinner ? "text-white font-black" : "text-on-surface/80"}>
                                {playerName}
                              </span>
                              {isMatchWinner && (
                                <span className="material-symbols-outlined text-secondary text-[16px]" title="Winner">
                                  emoji_events
                                </span>
                              )}
                            </td>
                            {[0, 1, 2, 3].map((qIdx) => (
                              <td key={qIdx} className="py-3.5 px-3 text-center font-mono text-base font-medium text-on-surface-variant/80">
                                {bQuarters[qIdx]?.[pIdx === 0 ? "home" : "away"] ?? 0}
                              </td>
                            ))}
                            {bQuarters.length > 4 && (
                              <td className="py-3.5 px-3 text-center font-mono text-base font-medium text-on-surface-variant/80">
                                {bQuarters[4]?.[pIdx === 0 ? "home" : "away"] ?? 0}
                              </td>
                            )}
                            <td className="py-3.5 px-4 text-center font-mono font-black text-base text-secondary bg-white/5">
                              {totalScore}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (setsData.length > 0 || match.status === "ongoing") && (
              <div className="w-full mt-8 pt-6 border-t border-white/10">
                <div className="bg-[#131b31]/80 backdrop-blur-md rounded-2xl border border-white/10 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                      <tr>
                        <th className="py-2.5 px-4 text-left font-normal">Equipa</th>
                        {setsData.map((_: any, idx: number) => (
                          <th key={idx} className="py-2.5 px-3 text-center font-normal min-w-[44px]">
                            Set {idx + 1}
                          </th>
                        ))}
                        {match.status === "ongoing" && (
                          (match.sport_type === "Tennis" || match.sport_type === "Padel") ? (
                            <>
                              <th className="py-2.5 px-3 text-center text-indigo-400 font-bold min-w-[44px]">
                                Jogos
                              </th>
                              <th className="py-2.5 px-3 text-center text-primary font-bold min-w-[44px] bg-primary/5">
                                Pontos
                              </th>
                            </>
                          ) : (
                            <th className="py-2.5 px-3 text-center text-primary font-bold min-w-[50px] bg-primary/5">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                Set {setsData.length + 1}
                              </span>
                            </th>
                          )
                        )}
                        <th className="py-2.5 px-4 text-center text-secondary font-black min-w-[50px] bg-white/[0.03]">
                          Sets
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[0, 1].map((pIdx) => {
                        const playerName = formatTeamOrPlayerName(match.participants?.[pIdx]?.name) || `Player ${pIdx + 1}`;
                        const isServing = match.status === "ongoing" && match.scores?.serving_index === pIdx;
                        const isMatchWinner = isCompleted && sets[pIdx] > sets[pIdx === 0 ? 1 : 0];

                        return (
                          <tr key={pIdx} className={isMatchWinner ? "bg-white/[0.03]" : ""}>
                            <td className="py-3.5 px-4 font-headline font-bold text-on-surface flex items-center gap-2.5">
                              <span className={isMatchWinner ? "text-white font-black" : "text-on-surface/80"}>
                                {playerName}
                              </span>
                              {isServing && (
                                <span
                                  className="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0"
                                  title="Serving"
                                />
                              )}
                              {isMatchWinner && (
                                <span className="material-symbols-outlined text-secondary text-[16px]" title="Winner">
                                  emoji_events
                                </span>
                              )}
                            </td>
                            {setsData.map((s: any, sIdx: number) => {
                              const pScore = pIdx === 0 ? (s.home ?? s.team1 ?? 0) : (s.away ?? s.team2 ?? 0);
                              const oScore = pIdx === 0 ? (s.away ?? s.team2 ?? 0) : (s.home ?? s.team1 ?? 0);
                              const wonSet = pScore > oScore;
                              const tbVal = s.tiebreak
                                ? pIdx === 0
                                  ? s.tiebreak.home
                                  : s.tiebreak.away
                                : null;

                              return (
                                <td
                                  key={sIdx}
                                  className={`py-3.5 px-3 text-center font-mono text-base ${
                                    wonSet ? "font-black text-white" : "font-medium text-on-surface-variant/60"
                                  }`}
                                >
                                  <span>{pScore}</span>
                                  {tbVal !== null && tbVal !== undefined && (
                                    <sup className="text-[10px] font-bold text-primary ml-0.5">{tbVal}</sup>
                                  )}
                                </td>
                              );
                            })}
                            {match.status === "ongoing" && (
                              (match.sport_type === "Tennis" || match.sport_type === "Padel") ? (
                                <>
                                  <td className="py-3.5 px-3 text-center font-mono font-bold text-indigo-400">
                                    {match.scores?.tennis?.games?.[pIdx] ?? 0}
                                  </td>
                                  <td className="py-3.5 px-3 text-center font-mono font-black text-primary bg-primary/5">
                                    {renderLivePoint(match, pIdx)}
                                  </td>
                                </>
                              ) : (
                                <td className="py-3.5 px-3 text-center font-mono font-black text-base text-primary bg-primary/5">
                                  {match.scores?.current?.[pIdx === 0 ? "home" : "away"] ?? 0}
                                </td>
                              )
                            )}
                            <td className="py-3.5 px-4 text-center font-mono font-black text-base text-secondary bg-white/5">
                              {sets[pIdx]}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DETAIL TABS (Score Progress, Match Rules, Match Official) */}
        <div className="flex items-center justify-center gap-2 mt-8 mb-4 border-b border-white/5 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveDetailTab("progress")}
            className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeDetailTab === "progress"
                ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            Score Progress
          </button>
          <button
            type="button"
            onClick={() => setActiveDetailTab("rules")}
            className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeDetailTab === "rules"
                ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Match Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveDetailTab("official")}
            className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeDetailTab === "official"
                ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            Match Official
          </button>
        </div>

        {/* TAB 1: SCORE PROGRESS */}
        {activeDetailTab === "progress" && (
          <div>
            {/* BASKETBALL QUARTER & POINT-BY-POINT BREAKDOWN */}
            {match.sport_type === "Basketball" && (() => {
          const bQuarters = match.scores?.basketball?.quarters || [];
          const currentPeriod = match.scores?.basketball?.period || "Q1";
          const periodOrder = ["Q1", "Q2", "Q3", "Q4", "OT"];
          const currentPeriodIdx = periodOrder.indexOf(currentPeriod);

          // Compute cumulative score across all scoring events
          let cumHome = 0;
          let cumAway = 0;
          const scoringEvents = (matchEvents || [])
            .filter((e: any) =>
              ["point_scored", "score", "point_won", "goal"].includes(e.event_data?.type)
            )
            .map((e: any, idx: number) => {
              const side = e.event_data?.side === "away" || e.event_data?.winner === 1 ? "away" : "home";
              const points = Number(e.event_data?.points || 1);
              if (side === "home") cumHome += points;
              else cumAway += points;

              return {
                id: e.id || idx,
                basketIndex: idx + 1,
                side,
                points,
                period: e.event_data?.period || "Q1",
                desc: e.event_data?.desc,
                scoreAfter: { home: cumHome, away: cumAway },
              };
            });

          // Quarters specs to display
          const totalQuartersCount = Math.max(4, bQuarters.length);
          const quartersList: any[] = [];

          for (let qIdx = 0; qIdx < totalQuartersCount; qIdx++) {
            const qLabel = qIdx < 4 ? `Q${qIdx + 1}` : "OT";
            const qData = bQuarters[qIdx] || { home: 0, away: 0 };
            const qBaskets = scoringEvents.filter((ev: any) => ev.period === qLabel);

            // Calculate quarter points from data or from events
            const qHome = qData.home ?? qBaskets.filter((b) => b.side === "home").reduce((acc, b) => acc + b.points, 0);
            const qAway = qData.away ?? qBaskets.filter((b) => b.side === "away").reduce((acc, b) => acc + b.points, 0);
            
            const hasStarted = (qHome > 0 || qAway > 0) || qBaskets.length > 0 || (match.status === "ongoing" && qIdx <= (currentPeriodIdx >= 0 ? currentPeriodIdx : 0));
            const isLive = match.status === "ongoing" && currentPeriod === qLabel;

            if (hasStarted || match.status === "completed") {
              const threesCount = qBaskets.filter((b: any) => b.points === 3).length;
              const twosCount = qBaskets.filter((b: any) => b.points === 2).length;
              const onesCount = qBaskets.filter((b: any) => b.points === 1).length;

              quartersList.push({
                quarterNumber: qIdx + 1,
                quarterLabel: qLabel,
                quarterName: qIdx < 4 ? `${qIdx + 1}º Quarto` : "Prolongamento (OT)",
                home: qHome,
                away: qAway,
                isLive,
                baskets: qBaskets,
                threesCount,
                twosCount,
                onesCount,
                totalBaskets: qBaskets.length,
              });
            }
          }

          if (quartersList.length === 0) return null;

          const allExpanded = quartersList.every((q) => expandedSets[q.quarterNumber]);
          const toggleAllQuarters = () => {
            const nextState: Record<number, boolean> = {};
            quartersList.forEach((q) => {
              nextState[q.quarterNumber] = !allExpanded;
            });
            setExpandedSets(nextState);
          };

          return (
            <div className="bg-surface-container-low rounded-3xl p-6 mt-4 border border-white/5">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-secondary text-[20px]">analytics</span>
                  <div>
                    <h3 className="font-headline font-bold text-sm text-on-surface">
                      Quarter & Point-by-Point Breakdown
                    </h3>
                    <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                      Clica num quarto para expandir a evolução detalhada dos pontos
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleAllQuarters}
                  className="font-label text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  {allExpanded ? "Recolher Todos" : "Expandir Todos"}
                </button>
              </div>

              {/* List of Quarters */}
              <div className="space-y-3">
                {quartersList.map((q) => {
                  const isExpanded = Boolean(expandedSets[q.quarterNumber]);

                  return (
                    <div
                      key={q.quarterNumber}
                      className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden transition-all duration-300"
                    >
                      {/* Collapsed Quarter Header */}
                      <button
                        type="button"
                        onClick={() => toggleSetExpanded(q.quarterNumber)}
                        className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        {/* Left: Quarter and Score */}
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-lg bg-surface-container-high font-mono text-xs font-black text-on-surface">
                            {q.quarterLabel}
                          </span>
                          <span className="font-headline text-xs font-bold text-on-surface-variant/80 uppercase">
                            {q.quarterName}
                          </span>
                          <span className="font-mono text-base font-black text-secondary">
                            {q.home} - {q.away}
                          </span>
                          {q.isLive && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                              LIVE
                            </span>
                          )}
                        </div>

                        {/* Right: Quick Stats & Chevron */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            {q.threesCount > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[11px]"
                                title="Triplos convertidos"
                              >
                                {q.threesCount} 3PT
                              </span>
                            )}
                            {q.twosCount > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold border border-primary/20 text-[11px]"
                                title="Cestos de 2 pontos convertidos"
                              >
                                {q.twosCount} 2PT
                              </span>
                            )}
                            {q.onesCount > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 text-[11px]"
                                title="Lances livres convertidos"
                              >
                                {q.onesCount} FT
                              </span>
                            )}
                            {q.totalBaskets > 0 && (
                              <span className="text-[11px] text-on-surface-variant/60 font-label">
                                ({q.totalBaskets} lançamentos)
                              </span>
                            )}
                          </div>

                          <span
                            className={`material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-300 ml-1 ${
                              isExpanded ? "rotate-180 text-primary" : ""
                            }`}
                          >
                            expand_more
                          </span>
                        </div>
                      </button>

                      {/* Expanded Section: Evolution of Baskets */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-white/5">
                          {q.baskets.length > 0 ? (
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center gap-2">
                                <span className="font-label text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50">
                                  Evolução do Marcador:
                                </span>
                              </div>

                              {/* Progression Pills */}
                              <div className="flex flex-wrap items-center gap-2">
                                {q.baskets.map((b: any, bIdx: number) => {
                                  const isLast = bIdx === q.baskets.length - 1;
                                  const isHome = b.side === "home";
                                  const teamName = isHome
                                    ? match.participants?.[0]?.name || "Home"
                                    : match.participants?.[1]?.name || "Away";

                                  return (
                                    <div
                                      key={bIdx}
                                      title={
                                        b.desc
                                          ? `${teamName}: ${b.desc} (Placar: ${b.scoreAfter.home} - ${b.scoreAfter.away})`
                                          : `${teamName} (+${b.points} pts)`
                                      }
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs transition-all cursor-default border ${
                                        isLast && !q.isLive
                                          ? "bg-primary-container text-on-primary-container font-black shadow-md shadow-primary-container/20 border-primary"
                                          : isHome
                                          ? "bg-surface-container-high text-on-surface border-primary/30 hover:border-primary/60"
                                          : "bg-surface-container-high text-on-surface border-secondary/30 hover:border-secondary/60"
                                      }`}
                                    >
                                      {/* Points Badge */}
                                      <span
                                        className={`px-1 rounded text-[10px] font-black ${
                                          b.points === 3
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : b.points === 2
                                            ? "bg-primary/20 text-primary"
                                            : "bg-amber-500/20 text-amber-400"
                                        }`}
                                      >
                                        +{b.points}
                                      </span>

                                      {/* Team Indicator */}
                                      <span className={`text-[10px] font-headline font-bold uppercase truncate max-w-[80px] ${
                                        isHome ? "text-primary/80" : "text-secondary/80"
                                      }`}>
                                        {teamName.split(" ")[0]}
                                      </span>

                                      {/* Score After */}
                                      <span className="font-bold text-white tracking-tight">
                                        {b.scoreAfter.home}-{b.scoreAfter.away}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="pt-2 text-xs text-on-surface-variant">
                              Quarto concluído com parcial de{" "}
                              <strong className="text-on-surface font-mono">
                                {q.home} - {q.away}
                              </strong>
                              .
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* SET, GAME & POINT-BY-POINT BREAKDOWN (VOLLEYBALL & TENNIS) */}
        {match.sport_type !== "Basketball" && match.sport_type !== "Football" && (() => {
          const completedSetsWithGames = setsData.map((s: any, idx: number) => ({
            setNumber: idx + 1,
            home: s.home ?? s.team1 ?? 0,
            away: s.away ?? s.team2 ?? 0,
            tiebreak: s.tiebreak,
            gamesHistory: Array.isArray(s.games_history) ? s.games_history : [],
            ralliesHistory: Array.isArray(s.rallies_history) ? s.rallies_history : [],
            pointsProgression: Array.isArray(s.points_progression) ? s.points_progression : [],
            isLive: false,
          }));

          const liveSetGames = Array.isArray(match.scores?.tennis?.current_set_games)
            ? match.scores.tennis.current_set_games
            : [];
          const liveGamePoints = Array.isArray(match.scores?.tennis?.current_game_points)
            ? match.scores.tennis.current_game_points
            : [];
          const liveVballRallies = Array.isArray(match.scores?.volleyball?.current_set_rallies)
            ? match.scores.volleyball.current_set_rallies
            : [];
          const liveVballPoints = Array.isArray(match.scores?.volleyball?.current_set_points)
            ? match.scores.volleyball.current_set_points
            : [];

          if (
            match.status === "ongoing" &&
            (liveSetGames.length > 0 || liveGamePoints.length > 0 || liveVballRallies.length > 0)
          ) {
            completedSetsWithGames.push({
              setNumber: completedSetsWithGames.length + 1,
              home:
                match.sport_type === "Tennis" || match.sport_type === "Padel"
                  ? match.scores?.tennis?.games?.[0] ?? 0
                  : match.scores?.current?.home ?? 0,
              away:
                match.sport_type === "Tennis" || match.sport_type === "Padel"
                  ? match.scores?.tennis?.games?.[1] ?? 0
                  : match.scores?.current?.away ?? 0,
              tiebreak: null,
              gamesHistory: [
                ...liveSetGames,
                ...(liveGamePoints.length > 0
                  ? [
                      {
                        game_number: liveSetGames.length + 1,
                        server: match.scores?.serving_index ?? 0,
                        winner: null,
                        is_break: false,
                        is_tiebreak: Boolean(match.scores?.tennis?.is_tiebreak),
                        games_after: {
                          home: match.scores?.tennis?.games?.[0] ?? 0,
                          away: match.scores?.tennis?.games?.[1] ?? 0,
                        },
                        points_progression: liveGamePoints,
                        is_in_progress: true,
                      },
                    ]
                  : []),
              ],
              ralliesHistory: liveVballRallies,
              pointsProgression: liveVballPoints,
              isLive: true,
            });
          }

          if (completedSetsWithGames.length === 0) return null;

          const isVolleyballLike =
            match.sport_type === "Volleyball" ||
            match.sport_type === "Beach Volleyball" ||
            match.sport_type === "beach_volleyball";

          const allExpanded = completedSetsWithGames.every(
            (s) => expandedSets[s.setNumber]
          );

          const toggleAll = () => {
            const nextState: Record<number, boolean> = {};
            completedSetsWithGames.forEach((s) => {
              nextState[s.setNumber] = !allExpanded;
            });
            setExpandedSets(nextState);
          };

          return (
            <div className="bg-surface-container-low rounded-3xl p-6 mt-4 border border-white/5">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
                  <div>
                    <h3 className="font-headline font-bold text-sm text-on-surface">
                      {isVolleyballLike
                        ? "Set, Rally & Point-by-Point Breakdown"
                        : "Set, Game & Point-by-Point Breakdown"}
                    </h3>
                    <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                      {isVolleyballLike
                        ? "Clica num set para expandir a evolução detalhada dos pontos"
                        : "Clica num set para expandir a progressão de cada jogo"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleAll}
                  className="font-label text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                >
                  {allExpanded ? "Recolher Todos" : "Expandir Todos"}
                </button>
              </div>

              {/* Expandable/Collapsible List of Sets */}
              <div className="space-y-3">
                {completedSetsWithGames.map((s) => {
                  const isExpanded = Boolean(expandedSets[s.setNumber]);
                  const ralliesCount = s.ralliesHistory.length;
                  const sideoutsCount = s.ralliesHistory.filter((r: any) => r.is_sideout).length;
                  const servicePointsCount = s.ralliesHistory.filter((r: any) => !r.is_sideout).length;

                  return (
                    <div
                      key={s.setNumber}
                      className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden transition-all duration-300"
                    >
                      {/* Collapsed Set Header (Clickable) */}
                      <button
                        type="button"
                        onClick={() => toggleSetExpanded(s.setNumber)}
                        className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Left: Set and Score */}
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-lg bg-surface-container-high font-mono text-xs font-black text-on-surface">
                            SET {s.setNumber}
                          </span>
                          <span className="font-mono text-base font-black text-secondary">
                            {s.home} - {s.away}
                          </span>
                          {s.tiebreak && (
                            <span className="text-[10px] font-mono text-primary">
                              [{Math.min(s.tiebreak.home, s.tiebreak.away)}]
                            </span>
                          )}
                          {s.isLive && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                              Live
                            </span>
                          )}
                        </div>

                        {/* Right: Rallies, Side-outs, Pontos no Serviço */}
                        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                          {isVolleyballLike ? (
                            <>
                              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high font-mono text-xs font-black text-on-surface">
                                {ralliesCount} Rallies
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-label text-[9px] font-black uppercase tracking-widest">
                                {sideoutsCount} Side-outs
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-label text-[9px] font-black uppercase tracking-widest">
                                {servicePointsCount} Pontos no Serviço
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high font-mono text-xs font-black text-on-surface">
                                {s.gamesHistory.length} Games
                              </span>
                              {s.gamesHistory.filter((g: any) => g.is_break).length > 0 && (
                                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-label text-[9px] font-black uppercase tracking-widest">
                                  {s.gamesHistory.filter((g: any) => g.is_break).length} Breaks
                                </span>
                              )}
                            </>
                          )}

                          {/* Chevron Icon */}
                          <span
                            className={`material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-300 ml-1 ${
                              isExpanded ? "rotate-180 text-primary" : ""
                            }`}
                          >
                            expand_more
                          </span>
                        </div>
                      </button>

                      {/* Expanded Section: Evolution of the score */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-white/5">
                          {isVolleyballLike ? (
                            s.pointsProgression.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                                <span className="font-label text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 mr-1">
                                  Evolução:
                                </span>
                                {s.pointsProgression.map((pt: string, ptIdx: number) => {
                                  const isLast = ptIdx === s.pointsProgression.length - 1;
                                  const r = s.ralliesHistory[ptIdx];
                                  const isServicePoint = r ? !r.is_sideout : false;
                                  const scorerName = r
                                    ? match.participants?.[r.winner]?.name || `Team ${r.winner + 1}`
                                    : "";

                                  return (
                                    <span
                                      key={ptIdx}
                                      title={
                                        r
                                          ? `Rally #${r.rally_number}: ${scorerName} (${
                                              r.is_sideout ? "Side-out" : "Ponto no Serviço"
                                            })`
                                          : pt
                                      }
                                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-all cursor-default ${
                                        isLast && !s.isLive
                                          ? "bg-primary-container text-on-primary-container font-black shadow-md shadow-primary-container/20"
                                          : isServicePoint
                                          ? "bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/30"
                                          : "bg-surface-container-high text-on-surface-variant font-medium hover:text-on-surface"
                                      }`}
                                    >
                                      {pt}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="pt-2 text-xs text-on-surface-variant">
                                Set concluído{" "}
                                <strong className="text-on-surface font-mono">
                                  {s.home} - {s.away}
                                </strong>
                                .
                              </div>
                            )
                          ) : (
                            /* Tennis Games History */
                            s.gamesHistory.length > 0 ? (
                              <div className="space-y-3 pt-2">
                                {s.gamesHistory.map((g: any, gIdx: number) => {
                                  const serverName =
                                    formatTeamOrPlayerName(match.participants?.[g.server]?.name) ||
                                    `Player ${(g.server ?? 0) + 1}`;
                                  const winnerName =
                                    g.winner !== null && g.winner !== undefined
                                      ? formatTeamOrPlayerName(match.participants?.[g.winner]?.name) ||
                                        `Player ${g.winner + 1}`
                                      : "In Progress";

                                  return (
                                    <div
                                      key={gIdx}
                                      className="bg-surface-container-low rounded-xl p-3 border border-white/5 flex flex-col gap-2"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded-lg bg-surface-container-high font-mono text-xs font-black text-on-surface">
                                            {g.is_tiebreak ? "TIEBREAK" : `Game ${g.game_number}`}
                                          </span>
                                          <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px] text-secondary">
                                              sports_tennis
                                            </span>
                                            {serverName} serving
                                          </span>
                                          {g.is_break && (
                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-label text-[9px] font-black uppercase tracking-widest">
                                              Break
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-[11px] font-bold text-on-surface-variant">
                                            Won by <strong className="text-on-surface">{winnerName}</strong>
                                          </span>
                                          <span className="px-2.5 py-0.5 rounded-lg bg-[#0c1324] border border-white/10 font-mono text-xs font-black text-primary">
                                            {g.games_after?.home ?? 0} - {g.games_after?.away ?? 0}
                                          </span>
                                        </div>
                                      </div>

                                      {Array.isArray(g.points_progression) &&
                                        g.points_progression.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <span className="font-label text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 mr-1">
                                              Points:
                                            </span>
                                            {g.points_progression.map((pt: string, ptIdx: number) => {
                                              const isLast = ptIdx === g.points_progression.length - 1;
                                              const isDeuceOrAd =
                                                pt === "40-40" || pt === "AD-40" || pt === "40-AD";
                                              return (
                                                <span
                                                  key={ptIdx}
                                                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] ${
                                                    isLast && !g.is_in_progress
                                                      ? "bg-primary-container text-on-primary-container font-black"
                                                      : isDeuceOrAd
                                                      ? "bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30"
                                                      : "bg-surface-container-high text-on-surface-variant font-medium"
                                                  }`}
                                                >
                                                  {pt}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="pt-2 text-xs text-on-surface-variant">
                                Set concluído{" "}
                                <strong className="text-on-surface font-mono">
                                  {s.home} - {s.away}
                                </strong>
                                .
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
          </div>
        )}

        {/* TAB 2: MATCH RULES */}
        {activeDetailTab === "rules" && (
          <div className="bg-surface-container-low rounded-3xl p-6 sm:p-8 border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
                <h3 className="font-headline font-bold text-sm">Match Rules</h3>
              </div>
              {isOrganizer && !match.tournament_id && (
                <button
                  onClick={() => setIsRuleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all font-label text-[10px] font-black uppercase tracking-widest cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">edit</span>
                  Edit Rules
                </button>
              )}
            </div>

            {match.sport_type === "Basketball" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Format</p>
                  <p className="font-headline font-bold text-sm text-on-surface">
                    {rules?.quarters_count || 4} Quarters ({rules?.quarter_minutes || 10} min)
                  </p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Shot Clock</p>
                  <p className="font-headline font-bold text-sm text-on-surface">
                    {rules?.shot_clock_seconds || 24} Seconds
                  </p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Overtime</p>
                  <p className="font-headline font-bold text-sm text-on-surface">
                    {rules?.overtime_minutes || 5} Minutes
                  </p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Team Fouls Bonus</p>
                  <p className="font-headline font-bold text-sm text-on-surface">
                    {rules?.fouls_bonus || 5} Fouls / Quarter
                  </p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4 col-span-2">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Venue / Court</p>
                  <p className="font-headline font-bold text-sm text-on-surface">{match.court || "TBD"}</p>
                </div>
              </div>
            ) : match.sport_type === "Football" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Format</p>
                  <p className="font-headline font-bold text-sm text-on-surface">
                    2 Halves ({rules?.half_minutes || 45} min)
                  </p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Total Duration</p>
                  <p className="font-headline font-bold text-sm text-on-surface">90 min + Stoppage</p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4 col-span-2">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Venue / Stadium</p>
                  <p className="font-headline font-bold text-sm text-on-surface">{match.court || "TBD"}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Format</p>
                  <p className="font-headline font-bold text-sm text-on-surface">Best of {rules?.max_sets || 3} Sets</p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Score Target</p>
                  <p className="font-headline font-bold text-sm text-on-surface">
                    {match.sport_type === "Tennis" || match.sport_type === "Padel"
                      ? "6 Games (Tiebreak)"
                      : `${rules?.points_per_set || 21} Points`}
                  </p>
                </div>
                {(match.sport_type === "Padel" || rules?.no_ad !== undefined) && (
                  <div className="bg-surface-container rounded-2xl p-4 col-span-2">
                    <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Regra de Vantagem</p>
                    <p className="font-headline font-bold text-sm text-on-surface flex items-center gap-1.5 text-amber-400">
                      <span className="material-symbols-outlined text-[16px]">stars</span>
                      {rules?.no_ad ? "Ponto de Ouro (Golden Point - Sem Vantagens)" : "Com Vantagens (Ad standard)"}
                    </p>
                  </div>
                )}
                <div className="bg-surface-container rounded-2xl p-4 col-span-2">
                  <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 mb-1.5">Venue / Court</p>
                  <p className="font-headline font-bold text-sm text-on-surface">{match.court || "TBD"}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MATCH OFFICIAL */}
        {activeDetailTab === "official" && (
          <div className="w-full bg-surface-container-low rounded-3xl p-6 sm:p-8 border border-white/5 shadow-xl">
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
                    className="p-1.5 -mr-1 rounded-lg text-on-surface-variant/40 hover:text-error hover:bg-error-container/20 transition-all cursor-pointer"
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
                          className="w-full px-4 py-3 text-left hover:bg-primary-container/20 transition-colors flex flex-col cursor-pointer"
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
        )}

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
              className="w-full py-5 rounded-full bg-primary-container hover:brightness-110 text-on-primary-container font-headline font-black uppercase tracking-[0.2em] text-sm transition-all active:scale-[0.99] flex items-center justify-center gap-3 shadow-[0_0_60px_-15px_rgba(79,70,229,0.6)]"
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

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteMatch}
        title="Delete Match"
        message="Are you sure you want to permanently delete this match? All recorded scores, set histories, and event logs for this match will be removed."
        confirmText="Delete Match"
        isDanger={true}
      />
    </div>
  );
}
