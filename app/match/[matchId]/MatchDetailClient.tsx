"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import RuleModal from "@/components/RuleModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import SportIcon from "@/components/SportIcon";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import { SportFavoriteButton } from "@/components/FollowButton";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import MatchAtmosphereBackground from "@/components/match/MatchAtmosphereBackground";
import StreamOverlayModal from "@/components/match/StreamOverlayModal";
import UpgradeModal from "@/components/subscription/UpgradeModal";

const getStatusTranslation = (status: string, t: (key: string, p?: any) => string) => {
  switch (status) {
    case "completed":
      return t("status.completed");
    case "ongoing":
      return t("status.live");
    case "scheduled":
    case "pending":
      return t("status.scheduled");
    case "cancelled":
      return t("status.cancelled");
    default:
      return status;
  }
};

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
  const { t } = useTranslation();
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
      <div className="text-xs font-medium text-text-muted mb-2">vs</div>
      <div className="bg-surface-container w-28 sm:w-48 py-2.5 sm:py-3 rounded-xl border border-outline-variant flex flex-col items-center">
        <div className="text-[11px] font-medium text-text-muted mb-0.5">
          {timeLeft === "STARTING" ? t("match.soon") : t("match.startsIn")}
        </div>
        <div className="font-mono tabular-nums text-lg sm:text-2xl font-semibold text-text-primary">
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

function resolveMatchRules(mData: any) {
  const isVolleyball = mData.sport_type === "Volleyball";
  const isBasketball = mData.sport_type === "Basketball";
  const isFootball = mData.sport_type === "Football";
  const isTennis = mData.sport_type === "Tennis";
  const isPadel = mData.sport_type === "Padel";

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
      set_type: "tiebreak",
      match_format: "best_of_3",
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

  if (mData.tournament_id) {
    const tournamentSettings = mData.tournaments?.settings || {};
    const roundOverrides = tournamentSettings.overrides?.[mData.round_number] || {};
    const tournamentDefault = tournamentSettings.default || {};

    return {
      ...baseDefaults,
      ...tournamentDefault,
      ...roundOverrides,
    };
  }

  return {
    ...baseDefaults,
    ...(mData.settings || {}),
  };
}

export default function MatchDetailClient({
  initialMatch = null,
  initialEvents = [],
}: {
  initialMatch?: any;
  initialEvents?: any[];
} = {}) {
  const { t, locale } = useTranslation();
  const { matchId } = useParams();
  const matchIdStr = (Array.isArray(matchId) ? matchId[0] : matchId) || "";
  const router = useRouter();
  const { user: authUser, supabase: authSupabase } = useAuth();
  const activeSupabase = authSupabase || supabase;
  const [match, setMatch] = useState<any>(initialMatch);
  const [rules, setRules] = useState<any>(() =>
    initialMatch ? resolveMatchRules(initialMatch) : null
  );
  const [user, setUser] = useState<any>(null);
  const currentUser = authUser || user;
  const [loading, setLoading] = useState(!initialMatch);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expandedSets, setExpandedSets] = useState<Record<number, boolean>>({ 1: true });
  const [matchEvents, setMatchEvents] = useState<any[]>(initialEvents);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"progress" | "rules" | "official">("progress");
  const [prevPath, setPrevPath] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("sb:prevPath");
      if (stored && !stored.startsWith(`/match/${matchIdStr}`)) {
        setPrevPath(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, [matchIdStr]);
  const [isChangingUmpire, setIsChangingUmpire] = useState(false);
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const menuRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const isOrganizer = Boolean(
    currentUser && (
      currentUser.id === match?.organizer_id ||
      currentUser.id === match?.tournaments?.organizer_id
    )
  );
  const isUmpire = Boolean(currentUser && match?.umpire_id === currentUser.id);
  const canManageOfficial = Boolean(isOrganizer || isUmpire);
  const canStart = Boolean(isOrganizer || isUmpire);

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

  const handleOpenStreamOverlay = () => {
    if (canManageOfficial || subscriptionTier === "pro") {
      setIsStreamModalOpen(true);
    } else {
      setIsUpgradeModalOpen(true);
    }
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
    if (!currentUser?.id) {
      setSubscriptionTier("free");
      return;
    }

    let cancelled = false;
    supabase
      .from("users")
      .select("subscription_tier")
      .eq("id", currentUser.id)
      .maybeSingle()
      .then(({ data }: { data: { subscription_tier?: string } | null }) => {
        if (!cancelled && data?.subscription_tier) {
          setSubscriptionTier(data.subscription_tier);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchAll = async () => {
      const [matchRes, eventsRes] = await Promise.all([
        supabase
          .from("matches")
          .select("*, tournaments(*)")
          .eq("id", matchIdStr)
          .single(),
        supabase
          .from("match_events")
          .select("*")
          .eq("match_id", matchIdStr)
          .order("created_at", { ascending: true }),
      ]);

      const { data: mData, error: mError } = matchRes;

      if (mError) {
        console.error("Supabase Error fetching match:", mError);
        toast.error(`Error fetching match: ${mError.message}`);
        setLoading(false);
        return;
      }

      if (eventsRes.data) {
        setMatchEvents(eventsRes.data);
      }

      if (mData) {
        const ownerId = mData.organizer_id || mData.tournaments?.organizer_id;
        const needOrganizerFetch = Boolean(ownerId && ownerId !== mData.umpire_id);

        const [umpireRes, organizerRes] = await Promise.all([
          mData.umpire_id
            ? supabase.from("users").select("id, username").eq("id", mData.umpire_id).single()
            : Promise.resolve({ data: null }),
          needOrganizerFetch
            ? supabase.from("users").select("id, username").eq("id", ownerId).single()
            : Promise.resolve({ data: null }),
        ]);

        const umpireData = umpireRes.data ?? null;
        const organizerData =
          ownerId && ownerId === mData.umpire_id ? umpireData : (organizerRes.data ?? null);

        const matchWithUmpire = { ...mData, umpire: umpireData, organizer: organizerData };
        setMatch(matchWithUmpire);
        setRules(resolveMatchRules(mData));
      }
      setLoading(false);
    };

    if (!initialMatch || initialMatch.id !== matchIdStr) {
      fetchAll();
    }

    // Set up real-time subscription (High-concurrency broadcast + table changes fallback)
    let channel: any = null;
    try {
      channel = supabase
        .channel(`match:${matchIdStr}`)
        .on(
          'broadcast',
          { event: 'score_update' },
          (response: any) => {
            const payload = response?.payload;
            // Guard against unverified client broadcast spoofing
            if (payload && payload.match_id === matchIdStr && typeof payload.scores === 'object') {
              setMatch((prev: any) => {
                if (prev?.status === 'completed') return prev;
                return {
                  ...prev,
                  scores: payload.scores ?? prev?.scores,
                  status: payload.status !== 'completed' ? (payload.status ?? prev?.status) : prev?.status,
                };
              });
              if (payload.event_data && typeof payload.event_data === 'object') {
                setMatchEvents((prev) => [
                  ...prev,
                  {
                    match_id: payload.match_id,
                    event_data: payload.event_data,
                    created_at: new Date().toISOString(),
                  },
                ]);
              }
            }
          }
        )
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
              setMatchEvents((prev) => {
                const exists = prev.some(
                  (e) => e.id && payload.new.id && e.id === payload.new.id
                );
                if (exists) return prev;
                return [...prev, payload.new];
              });
            }
          }
        );

      channel.subscribe();
    } catch (err) {
      console.warn('[MatchDetail] Realtime unavailable:', err);
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [matchIdStr]);

  useEffect(() => {
    const searchUsers = async () => {
      if (userSearch.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const { data, error } = await supabase.rpc("search_umpires", {
        p_query: userSearch.trim()
      });

      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [userSearch]);

  const appointUmpire = async (selectedUser: any | null) => {
    const newUmpireId = selectedUser ? selectedUser.id : null;
    try {
      const { error } = await activeSupabase.rpc("appoint_match_umpire", {
        p_match_id: matchIdStr,
        p_new_umpire_id: newUmpireId,
      });

      if (error) {
        toast.error("Failed to update referee: " + error.message);
      } else {
        setMatch((prev: any) => ({
          ...prev,
          umpire_id: newUmpireId,
          umpire: selectedUser,
          umpire_invite_status: newUmpireId && newUmpireId === currentUser?.id ? "accepted" : "pending",
        }));
        setIsChangingUmpire(false);
        setUserSearch("");
        setSearchResults([]);
        if (selectedUser) {
          const name = selectedUser.username || selectedUser.display_name || "Official";
          toast.success(`${name} ${locale === "pt" ? "designado como árbitro!" : "appointed as referee!"}`);
        } else {
          toast.success(t("match.umpireUnassigned"));
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update referee");
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

  // Determine back destination and label
  const backTab = match.group_label ? 'group_matches' : 'bracket';
  const fallbackHref = match.tournament_id ? `/tournament/${match.tournament_id}?tab=${backTab}` : "/";
  const backHref = prevPath || fallbackHref;

  const getBackLabel = (path: string | null): string => {
    if (!path) return match.tournament_id ? "Back to Tournament" : "Back to Matches";
    if (path.startsWith("/my-matches")) return "Back to My Matches";
    if (path.startsWith("/notifications")) return "Back to Notifications";
    if (path.startsWith("/tournament/")) return "Back to Tournament";
    if (path.startsWith("/user/")) return "Back to Profile";
    if (path.includes("tab=following")) return "Back to Favorites";
    if (path.includes("tab=tournaments")) return "Back to Tournaments";
    return "Back to Matches";
  };

  return (
    <div className="min-h-screen bg-transparent text-on-surface px-4 sm:px-6 py-3 sm:py-6 flex flex-col items-center relative">
      {/* MATCH ATMOSPHERE BACKGROUND */}
      <MatchAtmosphereBackground sportType={match.sport_type} mode="spectator" />

      <div className="w-full max-w-4xl relative z-10">
        {/* HERO / BIG MATCH CARD */}
        <div
          ref={heroRef}
          className="relative bg-surface-container rounded-2xl p-4 sm:p-6 border border-outline-variant shadow-xl overflow-hidden mb-6"
        >
          {/* Top Bar: Back + Author Chip, Tournament Pill, Actions (Sport+Favorite, Options Menu) */}
          <div className="relative z-20 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2.5 mb-4 sm:mb-6">
            {/* Left: Back Button & Owner Pill */}
            <div className="col-start-1 row-start-1 flex items-center gap-2 min-w-0">
              <Link
                href={backHref}
                aria-label={getBackLabel(prevPath)}
                title={getBackLabel(prevPath)}
                className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary inline-flex items-center justify-center transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </Link>
              {(match.organizer?.username || match.organizer?.email) && (
                <Link
                  href={`/user/${encodeURIComponent(match.organizer.username || match.organizer.email.split("@")[0])}`}
                  className="h-7 px-2.5 rounded-md bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary transition-colors inline-flex items-center text-xs font-medium cursor-pointer truncate"
                  title={`@${match.organizer.username || match.organizer.email.split("@")[0]}`}
                >
                  <span className="truncate leading-none">
                    @{match.organizer.username || match.organizer.email.split("@")[0]}
                  </span>
                </Link>
              )}
            </div>

            {/* Top-Right: Compound Sport + Favorite Button & 3-Dots Dropdown Menu */}
            <div className="col-start-2 md:col-start-3 row-start-1 justify-self-end flex items-center gap-2 shrink-0">
              <SportFavoriteButton
                entityId={matchIdStr}
                entityType="match"
                sport={match.sport_type}
                size="sm"
              />

              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  title={t("match.options")}
                  className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary border border-outline-variant transition-colors flex items-center justify-center cursor-pointer"
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen}
                >
                  <span className="material-symbols-outlined text-[18px]">more_vert</span>
                </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-10 w-48 py-1 bg-surface-container-high rounded-xl border border-outline-variant shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleShare();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">share</span>
                    {t("match.shareLink")}
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleOpenStreamOverlay();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container flex items-center gap-2 transition-colors cursor-pointer border-t border-outline-variant"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-muted">podcasts</span>
                    <span className="flex-1">{t("match.streamOverlay")}</span>
                    {subscriptionTier !== "pro" && !canManageOfficial && (
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-surface-container font-medium text-text-secondary border border-outline-variant">
                        PRO
                      </span>
                    )}
                  </button>

                  {isOrganizer && (
                    match.tournament_id ? (
                      <button
                        disabled
                        title={t("match.lockedTournamentMatch")}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-text-muted/40 cursor-not-allowed flex items-center gap-2 border-t border-outline-variant select-none"
                      >
                        <span className="material-symbols-outlined text-[16px] opacity-40">delete</span>
                        <span className="flex-1 opacity-50">{t("common.delete")}</span>
                        <span className="material-symbols-outlined text-[14px] text-text-muted/40" title={t("match.lockedTournamentMatch")}>lock</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer border-t border-outline-variant"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        {t("match.deleteMatch")}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
            </div>

            {match.tournaments?.name && (
              <div className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1 min-w-0 flex justify-center">
                {match.tournament_id ? (
                  <Link
                    href={`/tournament/${match.tournament_id}`}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary transition-colors max-w-full sm:max-w-md"
                    title={match.tournaments.name}
                  >
                    <span className="text-xs font-medium truncate">
                      {match.tournaments.name}
                    </span>
                  </Link>
                ) : (
                  <div
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-surface-container-high border border-outline-variant text-text-secondary max-w-full sm:max-w-md"
                    title={match.tournaments.name}
                  >
                    <span className="text-xs font-medium truncate">
                      {match.tournaments.name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative flex flex-col items-center">
            <div className="w-full max-w-xl sm:max-w-2xl grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-6 md:gap-8 items-center mb-4">
              {/* Left Team Box */}
              <div className="flex flex-col items-center gap-2.5 sm:gap-4">
                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl sm:rounded-3xl bg-surface-container border border-outline-variant flex items-center justify-center">
                  {match.status === "scheduled" ? (
                    <span className="font-sans font-medium text-lg sm:text-2xl md:text-3xl text-text-secondary">
                      {getInitials(match.participants?.[0]?.name)}
                    </span>
                  ) : (
                    <span className="font-digital text-5xl sm:text-7xl md:text-8xl text-text-primary select-none">
                      {sets[0]}
                    </span>
                  )}
                </div>
                <h2 className="font-sans font-medium text-xs sm:text-lg md:text-xl text-center text-text-primary max-w-[120px] sm:max-w-[200px] md:max-w-[280px] leading-tight">
                  {formatTeamOrPlayerName(match.participants?.[0]?.name) || "TBD"}
                </h2>
              </div>

              {/* Center - Countdown or VS + Status & Date */}
              <div className="flex flex-col items-center justify-center gap-1.5 min-w-[60px] sm:min-w-[100px] md:min-w-[120px] text-center">
                {match.status !== "ongoing" && match.status !== "completed" ? (
                  <>
                    <CountdownTimer scheduledAt={match.scheduled_at} />
                    <span className="text-[11px] font-medium text-text-muted">
                      {getStatusTranslation(match.status, t)}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-medium text-text-muted">vs</div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                      {match.status === "ongoing" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span className={match.status === "ongoing" ? "text-text-primary" : "text-text-muted"}>
                        {getStatusTranslation(match.status, t)}
                      </span>
                    </div>
                  </>
                )}
                {(match.scheduled_at || match.created_at) && (
                  <span className="text-[11px] font-mono tabular-nums text-text-muted whitespace-nowrap">
                    {new Date(match.scheduled_at || match.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>

              {/* Right Team Box */}
              <div className="flex flex-col items-center gap-2.5 sm:gap-4">
                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl sm:rounded-3xl bg-surface-container border border-outline-variant flex items-center justify-center">
                  {match.status === "scheduled" ? (
                    <span className="font-sans font-medium text-lg sm:text-2xl md:text-3xl text-text-secondary">
                      {getInitials(match.participants?.[1]?.name)}
                    </span>
                  ) : (
                    <span className="font-digital text-5xl sm:text-7xl md:text-8xl text-text-primary select-none">
                      {sets[1]}
                    </span>
                  )}
                </div>
                <h2 className="font-sans font-medium text-xs sm:text-lg md:text-xl text-center text-text-primary max-w-[120px] sm:max-w-[200px] md:max-w-[280px] leading-tight">
                  {formatTeamOrPlayerName(match.participants?.[1]?.name) || "TBD"}
                </h2>
              </div>
            </div>

            {/* SCOREBOARD TABLE (QUARTERS FOR BASKETBALL, SETS FOR VOLLEYBALL/TENNIS) */}
            {match.sport_type === "Basketball" ? (
              <div className="w-full mt-8 pt-6 border-t border-outline-variant">
                <div className="bg-surface-container-high/30 rounded-xl border border-outline-variant overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-container-high/60 border-b border-outline-variant text-[11px] font-medium text-text-muted">
                      <tr>
                        <th className="py-2.5 px-4 text-left font-normal">{t("common.team")}</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px] font-normal">Q1</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px] font-normal">Q2</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px] font-normal">Q3</th>
                        <th className="py-2.5 px-3 text-center min-w-[44px] font-normal">Q4</th>
                        {(match.scores?.basketball?.quarters?.length || 0) > 4 && (
                          <th className="py-2.5 px-3 text-center min-w-[44px] font-normal">OT</th>
                        )}
                        <th className="py-2.5 px-4 text-center font-semibold text-text-primary min-w-[50px] bg-surface-container-high/40">
                          {t("common.total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {[0, 1].map((pIdx) => {
                        const playerName = formatTeamOrPlayerName(match.participants?.[pIdx]?.name) || t("common.teamDefault", { num: pIdx + 1 });
                        const bQuarters = match.scores?.basketball?.quarters || [];
                        const totalScore = match.scores?.current?.[pIdx === 0 ? "home" : "away"] ?? 0;
                        const oppTotal = match.scores?.current?.[pIdx === 0 ? "away" : "home"] ?? 0;
                        const isMatchWinner = isCompleted && totalScore > oppTotal;

                        return (
                          <tr key={pIdx} className={isMatchWinner ? "bg-surface-container-high/20" : ""}>
                            <td className="py-3 px-4 font-medium text-text-primary flex items-center gap-2">
                              <span className={isMatchWinner ? "font-semibold text-text-primary" : "text-text-secondary"}>
                                {playerName}
                              </span>
                              {isMatchWinner && (
                                <span className="material-symbols-outlined text-text-primary text-[15px]" title="Winner">
                                  emoji_events
                                </span>
                              )}
                            </td>
                            {[0, 1, 2, 3].map((qIdx) => (
                              <td key={qIdx} className="py-3 px-3 text-center font-digital text-base text-text-secondary">
                                {bQuarters[qIdx]?.[pIdx === 0 ? "home" : "away"] ?? 0}
                              </td>
                            ))}
                            {bQuarters.length > 4 && (
                              <td key={4} className="py-3 px-3 text-center font-digital text-base text-text-secondary">
                                {bQuarters[4]?.[pIdx === 0 ? "home" : "away"] ?? 0}
                              </td>
                            )}
                            <td className="py-3 px-4 text-center font-digital font-semibold text-lg text-text-primary bg-surface-container-high/40">
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
              <div className="w-full mt-8 pt-6 border-t border-outline-variant">
                <div className="bg-surface-container-high/30 rounded-xl border border-outline-variant overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-container-high/60 border-b border-outline-variant text-[11px] font-medium text-text-muted">
                      <tr>
                        <th className="py-2.5 px-4 text-left font-normal">{t("common.team")}</th>
                        {setsData.map((_: any, idx: number) => (
                          <th key={idx} className="py-2.5 px-3 text-center font-normal min-w-[44px]">
                            Set {idx + 1}
                          </th>
                        ))}
                        {match.status === "ongoing" && (
                          (match.sport_type === "Tennis" || match.sport_type === "Padel") ? (
                            <>
                              <th className="py-2.5 px-3 text-center text-text-secondary font-medium min-w-[44px]">
                                {t("common.games")}
                              </th>
                              <th className="py-2.5 px-3 text-center text-text-primary font-medium min-w-[44px] bg-surface-container-high/40">
                                {t("common.pointsLabel")}
                              </th>
                            </>
                          ) : (
                            <th className="py-2.5 px-3 text-center text-text-secondary font-medium min-w-[50px] bg-surface-container-high/40">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Set {setsData.length + 1}
                              </span>
                            </th>
                          )
                        )}
                        <th className="py-2.5 px-4 text-center font-semibold text-text-primary min-w-[50px] bg-surface-container-high/40">
                          Sets
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {[0, 1].map((pIdx) => {
                        const playerName = formatTeamOrPlayerName(match.participants?.[pIdx]?.name) || t("common.teamDefault", { num: pIdx + 1 });
                        const isServing = match.status === "ongoing" && match.scores?.serving_index === pIdx;
                        const isMatchWinner = isCompleted && sets[pIdx] > sets[pIdx === 0 ? 1 : 0];

                        return (
                          <tr key={pIdx} className={isMatchWinner ? "bg-surface-container-high/20" : ""}>
                            <td className="py-3 px-4 font-medium text-text-primary flex items-center gap-2">
                              <span className={isMatchWinner ? "font-semibold text-text-primary" : "text-text-secondary"}>
                                {playerName}
                              </span>
                              {isServing && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-text-primary shrink-0"
                                  title="Serving"
                                />
                              )}
                              {isMatchWinner && (
                                <span className="material-symbols-outlined text-text-primary text-[15px]" title="Winner">
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
                                  className={`py-3 px-3 text-center font-digital text-base ${
                                    wonSet ? "font-semibold text-text-primary" : "text-text-muted"
                                  }`}
                                >
                                  <span>{pScore}</span>
                                  {tbVal !== null && tbVal !== undefined && (
                                    <sup className="text-[10px] font-mono font-medium text-text-muted ml-0.5">{tbVal}</sup>
                                  )}
                                </td>
                              );
                            })}
                            {match.status === "ongoing" && (
                              (match.sport_type === "Tennis" || match.sport_type === "Padel") ? (
                                <>
                                  <td className="py-3 px-3 text-center font-digital text-base text-text-secondary">
                                    {match.scores?.tennis?.games?.[pIdx] ?? 0}
                                  </td>
                                  <td className="py-3 px-3 text-center font-digital font-semibold text-base text-text-primary bg-surface-container-high/40">
                                    {renderLivePoint(match, pIdx)}
                                  </td>
                                </>
                              ) : (
                                <td className="py-3 px-3 text-center font-digital font-semibold text-base text-text-primary bg-surface-container-high/40">
                                  {match.scores?.current?.[pIdx === 0 ? "home" : "away"] ?? 0}
                                </td>
                              )
                            )}
                            <td className="py-3 px-4 text-center font-mono tabular-nums font-semibold text-sm text-text-primary bg-surface-container-high/40">
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
        <div className="flex items-center justify-center my-6 overflow-x-auto">
          <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveDetailTab("progress")}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeDetailTab === "progress"
                  ? "bg-surface-container-high text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">analytics</span>
              <span>{t("match.scoreProgress")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDetailTab("rules")}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeDetailTab === "rules"
                  ? "bg-surface-container-high text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              <span>{t("match.matchRules")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDetailTab("official")}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeDetailTab === "official"
                  ? "bg-surface-container-high text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">gavel</span>
              <span>{t("match.matchOfficial")}</span>
            </button>
          </div>
        </div>

        <div className="mb-6">
          {canStart && !isCompleted ? (
            <button
              onClick={async () => {
                const { error } = await activeSupabase
                  .from("matches")
                  .update({ status: "ongoing" })
                  .eq("id", matchIdStr);
                if (error) {
                  toast.error("Failed to start match: " + error.message);
                } else {
                  router.push(`/match/${matchIdStr}/scoreboard`);
                }
              }}
              className="w-full py-3.5 rounded-xl bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              {match.status === "scheduled" ? t("match.startScoreboard") : t("match.openScoreboard")}
            </button>
          ) : isCompleted ? (
            <div className="w-full py-3 rounded-xl bg-surface-container border border-outline-variant text-text-muted text-center text-xs font-medium">
              {t("match.matchCompleted")}
            </div>
          ) : (
            <div className="w-full py-3 rounded-xl bg-surface-container border border-outline-variant text-text-muted text-center text-xs font-medium px-4">
              {t("match.waitingUmpireStart")}
            </div>
          )}
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
              ["point_scored", "score", "point_won", "goal", "correct_score"].includes(e.event_data?.type)
            )
            .map((e: any, idx: number) => {
              const side = e.event_data?.side === "away" || e.event_data?.winner === 1 ? "away" : "home";
              const points = e.event_data?.type === "correct_score" ? -1 : Number(e.event_data?.points || 1);
              if (side === "home") cumHome = Math.max(0, cumHome + points);
              else cumAway = Math.max(0, cumAway + points);

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

              const qQuarterName =
                qIdx === 0
                  ? t("match.quarter1")
                  : qIdx === 1
                  ? t("match.quarter2")
                  : qIdx === 2
                  ? t("match.quarter3")
                  : qIdx === 3
                  ? t("match.quarter4")
                  : t("match.overtime");

              quartersList.push({
                quarterNumber: qIdx + 1,
                quarterLabel: qLabel,
                quarterName: qQuarterName,
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
            <div className="bg-surface-container rounded-2xl p-5 mt-4 border border-outline-variant">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-text-muted text-[18px]">analytics</span>
                  <div>
                    <h3 className="font-semibold text-sm text-text-primary">
                      {t("match.quarterBreakdown")}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {t("match.clickQuarterHint")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleAllQuarters}
                  className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-2 py-1 cursor-pointer"
                >
                  {allExpanded ? t("match.collapseAll") : t("match.expandAll")}
                </button>
              </div>

              {/* List of Quarters */}
              <div className="space-y-3">
                {quartersList.map((q) => {
                  const isExpanded = Boolean(expandedSets[q.quarterNumber]);

                  return (
                    <div
                      key={q.quarterNumber}
                      className="bg-surface-container-high/60 rounded-xl border border-outline-variant overflow-hidden"
                    >
                      {/* Collapsed Quarter Header */}
                      <button
                        type="button"
                        onClick={() => toggleSetExpanded(q.quarterNumber)}
                        className="w-full p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-surface-container-high transition-colors cursor-pointer"
                      >
                        {/* Left: Quarter and Score */}
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-surface-container font-mono text-xs font-semibold text-text-secondary border border-outline-variant">
                            {q.quarterLabel}
                          </span>
                          <span className="text-xs font-medium text-text-muted">
                            {q.quarterName}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-semibold text-text-primary">
                            {q.home} - {q.away}
                          </span>
                          {q.isLive && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-container border border-outline-variant text-text-primary flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Live
                            </span>
                          )}
                        </div>

                        {/* Right: Quick Stats & Chevron */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="flex items-center gap-1.5 text-xs">
                            {q.threesCount > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant font-mono text-text-secondary text-[11px]"
                                title="Triplos convertidos"
                              >
                                {q.threesCount} 3PT
                              </span>
                            )}
                            {q.twosCount > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant font-mono text-text-secondary text-[11px]"
                                title="Cestos de 2 pontos convertidos"
                              >
                                {q.twosCount} 2PT
                              </span>
                            )}
                            {q.onesCount > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant font-mono text-text-secondary text-[11px]"
                                title={t("match.freeThrowsConverted")}
                              >
                                {q.onesCount} FT
                              </span>
                            )}
                            {q.totalBaskets > 0 && (
                              <span className="text-[11px] text-text-muted font-sans ml-1">
                                ({q.totalBaskets} {t("match.shots")})
                              </span>
                            )}
                          </div>

                          <span
                            className={`material-symbols-outlined text-text-muted text-[18px] transition-transform duration-200 ml-1 ${
                              isExpanded ? "rotate-180 text-text-primary" : ""
                            }`}
                          >
                            expand_more
                          </span>
                        </div>
                      </button>

                      {/* Expanded Section: Play-by-Play Table */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-outline-variant">
                          {q.baskets.length > 0 ? (
                            <div className="mt-2 overflow-x-auto rounded-lg border border-outline-variant/60">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-surface-container-high/60 text-[11px] font-medium text-text-muted border-b border-outline-variant/60">
                                  <tr>
                                    <th className="py-2 px-3">{t("common.score")}</th>
                                    <th className="py-2 px-3">{t("common.team")}</th>
                                    <th className="py-2 px-3">{t("common.format")}</th>
                                    <th className="py-2 px-3 text-right">{t("common.pointsLabel")}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/40 font-sans">
                                  {q.baskets.map((b: any, bIdx: number) => {
                                    const isHome = b.side === "home";
                                    const teamName = isHome
                                      ? match.participants?.[0]?.name || "Home"
                                      : match.participants?.[1]?.name || "Away";
                                    const actionType =
                                      b.points === 3
                                        ? "3-Pointer"
                                        : b.points === 2
                                        ? "2-Pointer"
                                        : b.points === 1
                                        ? "Free Throw"
                                        : "Correction";

                                    return (
                                      <tr key={bIdx} className="hover:bg-surface-container-high/40 transition-colors">
                                        <td className="py-2 px-3 font-digital text-sm text-text-primary tracking-wide">
                                          {b.scoreAfter.home} - {b.scoreAfter.away}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-text-primary">
                                          <span>{teamName}</span>
                                        </td>
                                        <td className="py-2 px-3 text-text-muted">
                                          {actionType}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-text-primary">
                                          {b.points > 0 ? `+${b.points}` : b.points}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="pt-2 text-xs text-text-muted">
                              {t("match.quarterFinishedWith")}{" "}
                              <strong className="text-text-primary font-digital text-sm">
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
            <div className="bg-surface-container rounded-2xl p-5 mt-4 border border-outline-variant">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-text-muted text-[18px]">analytics</span>
                  <div>
                    <h3 className="font-semibold text-sm text-text-primary">
                      {isVolleyballLike
                        ? t("match.setBreakdown")
                        : t("match.setGameBreakdown")}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {isVolleyballLike
                        ? t("match.clickSetHint")
                        : t("match.clickGameHint")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-2 py-1 cursor-pointer"
                >
                  {allExpanded ? t("match.collapseAll") : t("match.expandAll")}
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
                      className="bg-surface-container-high/60 rounded-xl border border-outline-variant overflow-hidden"
                    >
                      {/* Collapsed Set Header (Clickable) */}
                      <button
                        type="button"
                        onClick={() => toggleSetExpanded(s.setNumber)}
                        className="w-full p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-surface-container-high transition-colors cursor-pointer"
                      >
                        {/* Left: Set and Score */}
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-surface-container font-mono text-xs font-semibold text-text-secondary border border-outline-variant">
                            SET {s.setNumber}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-semibold text-text-primary">
                            {s.home} - {s.away}
                          </span>
                          {s.tiebreak && (
                            <span className="text-[11px] font-mono text-text-muted font-medium">
                              [{Math.min(s.tiebreak.home, s.tiebreak.away)}]
                            </span>
                          )}
                          {s.isLive && (
                            <span className="px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant text-text-primary text-[11px] font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                              Live
                            </span>
                          )}
                        </div>

                        {/* Right: Rallies, Side-outs, Pontos no Serviço */}
                        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                          {isVolleyballLike ? (
                            <>
                              <span className="px-2.5 py-0.5 rounded-md bg-surface-container font-mono text-xs text-text-secondary border border-outline-variant">
                                {t("match.ralliesCount", { count: ralliesCount })}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-md bg-surface-container font-mono text-xs text-text-secondary border border-outline-variant">
                                {t("match.sideoutsCount", { count: sideoutsCount })}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-md bg-surface-container font-mono text-xs text-text-secondary border border-outline-variant">
                                {t("match.servicePointsCount", { count: servicePointsCount })}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="px-2.5 py-0.5 rounded-md bg-surface-container font-mono text-xs text-text-secondary border border-outline-variant">
                                {t("match.gamesCount", { count: s.gamesHistory.length })}
                              </span>
                              {s.gamesHistory.filter((g: any) => g.is_break).length > 0 && (
                                <span className="px-2.5 py-0.5 rounded-md bg-surface-container font-mono text-xs text-text-secondary border border-outline-variant">
                                  {t("match.breaksCount", { count: s.gamesHistory.filter((g: any) => g.is_break).length })}
                                </span>
                              )}
                            </>
                          )}

                          {/* Chevron Icon */}
                          <span
                            className={`material-symbols-outlined text-text-muted text-[20px] transition-transform duration-200 ml-1 ${
                              isExpanded ? "rotate-180 text-text-primary" : ""
                            }`}
                          >
                            expand_more
                          </span>
                        </div>
                      </button>

                      {/* Expanded Section: Evolution of the score */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-outline-variant">
                          {isVolleyballLike ? (
                            s.pointsProgression.length > 0 ? (
                              <div className="pt-2">
                                <span className="text-[11px] font-medium text-text-muted mb-2 block">
                                  {t("match.scoreEvolution")}
                                </span>
                                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                                  {s.pointsProgression.map((pt: string, ptIdx: number) => {
                                    const isLast = ptIdx === s.pointsProgression.length - 1;
                                    const r = s.ralliesHistory[ptIdx];
                                    const isServicePoint = r ? !r.is_sideout : false;

                                    return (
                                      <span
                                        key={ptIdx}
                                        className={`px-2 py-0.5 rounded text-xs font-digital whitespace-nowrap border ${
                                          isLast
                                            ? "bg-text-primary text-surface-container-lowest font-bold border-text-primary"
                                            : isServicePoint
                                            ? "bg-surface-container border-outline-variant text-text-primary"
                                            : "bg-surface-container-high/40 border-outline-variant/50 text-text-muted"
                                        }`}
                                      >
                                        {pt}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2 text-xs text-text-muted">
                                {t("match.setFinishedWith")}{" "}
                                <strong className="text-text-primary font-digital text-sm">
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
                                      : t("match.inProgress");

                                  return (
                                    <div
                                      key={gIdx}
                                      className="bg-surface-container rounded-xl p-3 border border-outline-variant flex flex-col gap-2"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded-md bg-surface-container-high font-mono text-xs font-semibold text-text-primary border border-outline-variant">
                                            {g.is_tiebreak ? "TIEBREAK" : `Game ${g.game_number}`}
                                          </span>
                                          <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                                            <SportIcon
                                              sport="Tennis"
                                              className="text-text-muted text-[14px]"
                                            />
                                            {serverName} {t("match.serving")}
                                          </span>
                                          {g.is_break && (
                                            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-text-secondary border border-outline-variant font-mono text-[10px] uppercase tracking-wider">
                                              Break
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-text-muted">
                                            {t("match.wonBy")} <strong className="text-text-primary font-medium">{winnerName}</strong>
                                          </span>
                                          <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high border border-outline-variant font-mono text-xs font-semibold text-text-primary">
                                            {g.games_after?.home ?? 0} - {g.games_after?.away ?? 0}
                                          </span>
                                        </div>
                                      </div>

                                      {Array.isArray(g.points_progression) &&
                                        g.points_progression.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted mr-1">
                                              {t("match.points")}:
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
                                                      ? "bg-text-primary text-surface-container-lowest font-bold"
                                                      : isDeuceOrAd
                                                      ? "bg-surface-container-highest text-text-primary border border-outline font-semibold"
                                                      : "bg-surface-container-high text-text-secondary border border-outline-variant font-medium"
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
                              <div className="pt-2 text-xs text-text-muted">
                                {t("match.setFinishedWith")}{" "}
                                <strong className="text-text-primary font-mono">
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

        {/* FOOTBALL MATCH EVENTS & BREAKDOWN */}
        {match.sport_type === "Football" && (() => {
          const footballGoals: any[] = [];
          for (const e of matchEvents || []) {
            const tType = e.event_data?.type;
            if (tType === "goal") {
              footballGoals.push(e);
            } else if (tType === "correct_goal" || tType === "goal_reverted") {
              const revertSide = e.event_data?.side || "home";
              const lastIdx = footballGoals.findLastIndex(
                (g: any) => (g.event_data?.side || "home") === revertSide
              );
              if (lastIdx !== -1) {
                footballGoals.splice(lastIdx, 1);
              }
            }
          }

          return (
            <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SportIcon sport="Football" className="text-text-muted text-[18px]" />
                  <div>
                    <h3 className="font-semibold text-sm text-text-primary">
                      {t("match.scoreProgress")}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {footballGoals.length > 0
                        ? `${footballGoals.length} goal${footballGoals.length > 1 ? "s" : ""} recorded`
                        : "Goals & Match Events Log"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Halves Summary Table */}
              <div className="bg-surface-container-high/30 rounded-xl border border-outline-variant overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-container-high/60 border-b border-outline-variant text-[11px] font-medium text-text-muted">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-normal">{t("common.team")}</th>
                      <th className="py-2.5 px-4 text-center font-semibold text-text-primary min-w-[60px] bg-surface-container-high/40">
                        {t("common.total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {[0, 1].map((pIdx) => {
                      const pName = formatTeamOrPlayerName(match.participants?.[pIdx]?.name) || t("common.teamDefault", { num: pIdx + 1 });
                      const goalsCount = match.scores?.current?.[pIdx === 0 ? "home" : "away"] ?? 0;
                      const oppGoals = match.scores?.current?.[pIdx === 0 ? "away" : "home"] ?? 0;
                      const isWinner = isCompleted && goalsCount > oppGoals;

                      return (
                        <tr key={pIdx} className={isWinner ? "bg-surface-container-high/20" : ""}>
                          <td className="py-3 px-4 font-medium text-text-primary flex items-center gap-2">
                            <span className={isWinner ? "font-semibold text-text-primary" : "text-text-secondary"}>
                              {pName}
                            </span>
                            {isWinner && (
                              <span className="material-symbols-outlined text-text-primary text-[15px]" title="Winner">
                                emoji_events
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-digital font-semibold text-2xl text-text-primary bg-surface-container-high/40">
                            {goalsCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Goals Chronological Feed */}
              {footballGoals.length > 0 ? (
                <div className="border border-outline-variant rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2 bg-surface-container-high/50 border-b border-outline-variant text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    Goals Timeline
                  </div>
                  <div className="divide-y divide-outline-variant font-mono text-xs">
                    {footballGoals.map((g: any, gIdx: number) => {
                      const side = g.event_data?.side || "home";
                      const isHome = side === "home";
                      const minute = g.event_data?.minute ? `${g.event_data.minute}'` : `Goal #${gIdx + 1}`;
                      const teamName = formatTeamOrPlayerName(
                        match.participants?.[isHome ? 0 : 1]?.name
                      ) || (isHome ? "Team 1" : "Team 2");

                      return (
                        <div key={g.id || gIdx} className="px-3.5 py-2.5 flex items-center justify-between hover:bg-surface-container-high/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-text-secondary text-[11px] border border-outline-variant">
                              {minute}
                            </span>
                            <SportIcon sport="Football" className="text-text-muted text-[15px]" />
                            <span className="font-sans font-medium text-text-primary">
                              {teamName}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-surface-container-high text-text-primary border border-outline-variant">
                            GOAL
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-surface-container-high/20 border border-outline-variant text-center text-xs text-text-muted">
                  No individual goal events recorded yet. Score tracking is live.
                </div>
              )}
            </div>
          );
        })()}
          </div>
        )}

        {/* TAB 2: MATCH RULES */}
        {activeDetailTab === "rules" && (
          <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-text-muted text-[18px]">tune</span>
                <h3 className="font-semibold text-sm text-text-primary">{t("match.matchRules")}</h3>
              </div>
              {isOrganizer && !match.tournament_id && (
                <button
                  onClick={() => setIsRuleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary border border-outline-variant transition-colors text-xs font-medium cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  {t("match.editRules")}
                </button>
              )}
            </div>

            {match.sport_type === "Basketball" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("common.format")}</p>
                  <p className="font-semibold text-sm text-text-primary">
                    {rules?.quarters_count || 4} Quarters ({rules?.quarter_minutes || 10} min)
                  </p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.shotClock")}</p>
                  <p className="font-semibold text-sm text-text-primary">
                    {t("match.secondsCount", { count: rules?.shot_clock_seconds || 24 })}
                  </p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.overtime")}</p>
                  <p className="font-semibold text-sm text-text-primary">
                    {t("match.minutesCount", { count: rules?.overtime_minutes || 5 })}
                  </p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.teamFoulsBonus")}</p>
                  <p className="font-semibold text-sm text-text-primary">
                    {t("match.foulsPerQuarter", { count: rules?.fouls_bonus || 5 })}
                  </p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant col-span-2">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.venueCourt")}</p>
                  <p className="font-semibold text-sm text-text-primary">{match.court || "TBD"}</p>
                </div>
              </div>
            ) : match.sport_type === "Football" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("common.format")}</p>
                  <p className="font-semibold text-sm text-text-primary">
                    {t("match.twoHalves", { min: rules?.half_minutes || 45 })}
                  </p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.totalDuration")}</p>
                  <p className="font-semibold text-sm text-text-primary">{t("match.stoppageDuration")}</p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant col-span-2">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.venueStadium")}</p>
                  <p className="font-semibold text-sm text-text-primary">{match.court || "TBD"}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("common.format")}</p>
                  <p className="font-semibold text-sm text-text-primary">{t("match.bestOfSets", { count: rules?.max_sets || 3 })}</p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.scoreTarget")}</p>
                  <p className="font-semibold text-sm text-text-primary">
                    {match.sport_type === "Tennis" || match.sport_type === "Padel"
                      ? t("match.gamesCountTiebreak")
                      : t("match.pointsCount", { count: rules?.points_per_set || 21 })}
                  </p>
                </div>
                {(match.sport_type === "Padel" || rules?.no_ad !== undefined) && (
                  <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant col-span-2">
                    <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.advantageRule")}</p>
                    <p className="font-semibold text-sm text-text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-text-muted text-[16px]">stars</span>
                      {rules?.no_ad ? t("match.goldenPoint") : t("match.standardAd")}
                    </p>
                  </div>
                )}
                <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant col-span-2">
                  <p className="text-[11px] font-medium text-text-muted mb-1">{t("match.venueCourt")}</p>
                  <p className="font-semibold text-sm text-text-primary">{match.court || "TBD"}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MATCH OFFICIAL */}
        {activeDetailTab === "official" && (
          <div className="w-full bg-surface-container rounded-2xl p-6 border border-outline-variant">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-text-muted text-[18px]">gavel</span>
                <h3 className="font-semibold text-sm text-text-primary">{t("match.matchOfficial")}</h3>
              </div>
              {canManageOfficial && !isChangingUmpire && (
                <button
                  type="button"
                  onClick={() => setIsChangingUmpire(true)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary border border-outline-variant text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                  {t("match.changeReferee")}
                </button>
              )}
            </div>

            {/* Current Umpire Card */}
            {match.umpire ? (
              <div className="bg-surface-container-high rounded-xl p-3.5 border border-outline-variant flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-text-secondary text-[18px]">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-text-primary truncate">
                    {match.umpire.username || match.umpire.display_name || "Official"}
                  </p>
                  <p className="text-[11px] font-medium text-text-muted">
                    {t("match.officialUmpire")}
                    {currentUser?.id === match.umpire.id && ` (${locale === "pt" ? "Você" : "You"})`}
                  </p>
                </div>
                <span className="material-symbols-outlined text-text-secondary text-[18px]" aria-hidden>check_circle</span>
              </div>
            ) : (
              <div className="bg-surface-container-high rounded-xl p-5 text-center border border-outline-variant">
                <p className="text-xs font-medium text-text-muted mb-2">
                  {t("match.noUmpireAssigned")}
                </p>
                {canManageOfficial && !isChangingUmpire && (
                  <button
                    type="button"
                    onClick={() => setIsChangingUmpire(true)}
                    className="mt-2 px-3.5 py-1.5 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">person_add</span>
                    {t("match.appointOtherReferee")}
                  </button>
                )}
              </div>
            )}

            {/* CHANGE / APPOINT REFEREE PANEL */}
            {(isChangingUmpire || (!match.umpire && canManageOfficial)) && (
              <div className="mt-4 p-4 rounded-xl bg-surface-container-high border border-outline-variant space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">
                    {t("match.appointOtherRefereeUpper")}
                  </span>
                  {match.umpire && (
                    <button
                      type="button"
                      onClick={() => setIsChangingUmpire(false)}
                      className="text-xs text-text-muted hover:text-text-primary font-medium cursor-pointer"
                    >
                      {locale === "pt" ? "Cancelar" : "Cancel"}
                    </button>
                  )}
                </div>

                {/* Quick Action: Assign Myself as Referee */}
                {currentUser && match.umpire_id !== currentUser.id && (
                  <button
                    type="button"
                    onClick={() =>
                      appointUmpire({
                        id: currentUser.id,
                        username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Me",
                      })
                    }
                    className="w-full py-2 px-3.5 rounded-lg bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-text-primary text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                    {t("match.assignMyselfAsReferee")}
                  </button>
                )}

                {/* Search Umpires Input */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
                    person_search
                  </span>
                  <input
                    type="text"
                    placeholder={t("match.searchUmpirePlaceholder")}
                    className="w-full pl-9 pr-8 py-2 bg-surface-container rounded-lg text-xs text-text-primary placeholder:text-text-muted outline-none border border-outline-variant focus:border-outline-focus transition-colors"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-container rounded-xl shadow-xl border border-outline-variant z-50 overflow-hidden divide-y divide-outline-variant">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => appointUmpire(u)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-surface-container-high transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-xs text-text-primary">
                              {u.username || "No Name"}
                            </span>
                            <span className="text-[11px] text-text-muted truncate">
                              {u.email}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-text-primary">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unassign Option */}
                {match.umpire && (
                  <div className="pt-2 border-t border-outline-variant flex justify-end">
                    <button
                      type="button"
                      onClick={() => appointUmpire(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1.5 cursor-pointer py-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">person_remove</span>
                      {t("match.unassignUmpire")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
        title={t("match.deleteMatch")}
        message={t("match.deleteMatchConfirm")}
        confirmText={t("match.deleteMatch")}
        isDanger={true}
      />

      <StreamOverlayModal
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
        matchId={matchIdStr}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        isAlreadyPro={subscriptionTier === "pro"}
        source="stream_overlay"
      />
    </div>
  );
}
