"use client";

import { Suspense, useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import MatchCard from "@/components/MatchCard";
import SportIcon from "@/components/SportIcon";
import SportFilterBar from "@/components/SportFilterBar";
import MatchListItem from "@/components/MatchListItem";
import DataTable from "@/components/DataTable";
import { getMatchColumns, getTournamentColumns } from "@/components/entityTableColumns";
import { FollowButton } from "@/components/FollowButton";
import Pagination from "@/components/Pagination";
import SelectField from "@/components/SelectField";
import MatchAtmosphereBackground from "@/components/match/MatchAtmosphereBackground";
import { useFollow } from "@/lib/hooks/useFollow";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import { validatePassword } from "@/lib/auth/passwordValidation";

const MATCHES_PER_PAGE = 12;
const TOURNAMENTS_PER_PAGE = 9;

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { user, supabase } = useAuth();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const followHook = useFollow();

  // Authentication Modal State
  const [authModal, setAuthModal] = useState<"login" | "signup" | "forgot" | null>(null);
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Content Data State
  const [matches, setMatches] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs & Views (Defaults: matches active, list view)
  const [activeTab, setActiveTab] = useState<"matches" | "tournaments" | "following">("matches");
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [followingFilter, setFollowingFilter] = useState<"all" | "matches" | "tournaments">("all");

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auth modal query sync
  const closeAuthModal = useCallback(() => {
    setAuthModal(null);
    setForgotEmailSent(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    router.replace(
      window.location.pathname + (params.toString() ? "?" + params.toString() : ""),
      { scroll: false }
    );
  }, [searchParams, router]);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login") setAuthModal("login");
    else if (auth === "signup") setAuthModal("signup");
    else if (auth === "forgot") setAuthModal("forgot");
    else setAuthModal(null);

    const tab = searchParams.get("tab");
    if (tab === "matches" || tab === "tournaments" || tab === "following") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load matches and tournaments
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [matchesRes, tournamentsRes] = await Promise.all([
        supabase
          .from("matches")
          .select("*, tournaments(name), organizer:users!organizer_id(username)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("tournaments")
          .select("*, organizer:users!organizer_id(username)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (matchesRes.data) setMatches(matchesRes.data);
      if (tournamentsRes.data) setTournaments(tournamentsRes.data);
    } catch (err) {
      console.error("Error fetching home data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Tab Switch
  const handleTabChange = (tab: "matches" | "tournaments" | "following") => {
    setActiveTab(tab);
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(
      window.location.pathname + (params.toString() ? "?" + params.toString() : ""),
      { scroll: false }
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSportFilter("all");
    setStatusFilter("all");
    setDateSort("desc");
    setCurrentPage(1);
  };

  // Auth form submissions
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (authModal === "forgot") {
        if (!email.trim()) {
          toast.error(t("auth.fillAllFields"));
          setIsSubmitting(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) {
          toast.error(error.message);
          setIsSubmitting(false);
          return;
        }

        setForgotEmailSent(true);
        toast.success(t("auth.resetEmailSentMessage"));
        setIsSubmitting(false);
        return;
      } else if (authModal === "signup") {
        if (!username.trim()) {
          toast.error(t("auth.usernameRequired"));
          setIsSubmitting(false);
          return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
          toast.error(t("auth.passwordRequirements"));
          setIsSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          toast.error(t("auth.passwordsDoNotMatch"));
          setIsSubmitting(false);
          return;
        }

        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .ilike("username", username.trim())
          .maybeSingle();

        if (existingUser) {
          toast.error(t("auth.usernameTaken"));
          setIsSubmitting(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: username.trim(),
            },
          },
        });

        if (error) {
          toast.error(error.message);
          setIsSubmitting(false);
          return;
        }

        if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
          toast.error(t("auth.userAlreadyRegistered"));
          setIsSubmitting(false);
          return;
        }

        toast.success(t("auth.accountCreatedToast"));
        closeAuthModal();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast.error(error.message);
          setIsSubmitting(false);
          return;
        }

        toast.success(t("auth.welcomeBackToast"));
        closeAuthModal();

        const next = searchParams.get("next");
        if (next) {
          try {
            const parsed = new URL(next, window.location.origin);
            if (
              parsed.origin === window.location.origin &&
              parsed.pathname.startsWith("/") &&
              !next.startsWith("/\\") &&
              !next.startsWith("\\")
            ) {
              router.push(parsed.pathname + parsed.search + parsed.hash);
            }
          } catch {
            // Malformed URL, skip redirect
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Search Matches
  const filteredMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return matches
      .filter((m) => {
        // Sport filter
        if (sportFilter !== "all") {
          if (sportFilter === "Beach Volleyball") {
            if (m.sport_type !== "Beach Volleyball" && m.sport_type !== "beach_volleyball") {
              return false;
            }
          } else if (m.sport_type !== sportFilter) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== "all") {
          if (statusFilter === "scheduled") {
            if (m.status !== "scheduled" && m.status !== "pending") return false;
          } else if (m.status !== statusFilter) {
            return false;
          }
        }

        // Text search (participants, tournament, court, sport, organizer)
        if (query) {
          const userQuery = query.startsWith("@") ? query.slice(1) : query;
          const p1 = (m.participants?.[0]?.name || "").toLowerCase();
          const p2 = (m.participants?.[1]?.name || "").toLowerCase();
          const tName = (m.tournaments?.name || "").toLowerCase();
          const court = (m.court || "").toLowerCase();
          const sport = (m.sport_type || "").toLowerCase();
          const organizer = (m.organizer?.username || "").toLowerCase();
          if (
            !p1.includes(query) &&
            !p2.includes(query) &&
            !tName.includes(query) &&
            !court.includes(query) &&
            !sport.includes(query) &&
            !(userQuery && organizer.includes(userQuery))
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_at || a.created_at).getTime();
        const dateB = new Date(b.scheduled_at || b.created_at).getTime();
        return dateSort === "desc" ? dateB - dateA : dateA - dateB;
      });
  }, [matches, sportFilter, statusFilter, searchQuery, dateSort]);

  // Filter & Search Tournaments
  const filteredTournaments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tournaments
      .filter((t) => {
        // Sport filter
        if (sportFilter !== "all") {
          if (sportFilter === "Beach Volleyball") {
            if (t.sport_type !== "Beach Volleyball" && t.sport_type !== "beach_volleyball") {
              return false;
            }
          } else if (t.sport_type !== sportFilter) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== "all") {
          if (statusFilter === "scheduled") {
            if (t.status !== "scheduled" && t.status !== "pending") return false;
          } else if (t.status !== statusFilter) {
            return false;
          }
        }

        // Text search (name, sport, organizer)
        if (query) {
          const userQuery = query.startsWith("@") ? query.slice(1) : query;
          const name = (t.name || "").toLowerCase();
          const sport = (t.sport_type || "").toLowerCase();
          const organizer = (t.organizer?.username || "").toLowerCase();
          if (
            !name.includes(query) &&
            !sport.includes(query) &&
            !(userQuery && organizer.includes(userQuery))
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.start_date || a.created_at).getTime();
        const dateB = new Date(b.start_date || b.created_at).getTime();
        return dateSort === "desc" ? dateB - dateA : dateA - dateB;
      });
  }, [tournaments, sportFilter, statusFilter, searchQuery, dateSort]);

  // Followed Items
  const followedMatches = useMemo(() => {
    return filteredMatches.filter((m) => followHook.followedMatchIds.has(m.id));
  }, [filteredMatches, followHook.followedMatchIds]);

  const followedTournaments = useMemo(() => {
    return filteredTournaments.filter((t) => followHook.followedTournamentIds.has(t.id));
  }, [filteredTournaments, followHook.followedTournamentIds]);

  // Matching Organizers for Search Popover
  const matchingOrganizers = useMemo(() => {
    const raw = searchQuery.trim().toLowerCase();
    const q = raw.startsWith("@") ? raw.slice(1) : raw;
    if (q.length < 2) return [];

    const byUsername = new Map<
      string,
      { username: string; matches: number; tournaments: number }
    >();

    for (const m of matches) {
      const uname = m.organizer?.username;
      if (!uname || !uname.toLowerCase().includes(q)) continue;
      const entry = byUsername.get(uname) || { username: uname, matches: 0, tournaments: 0 };
      entry.matches += 1;
      byUsername.set(uname, entry);
    }

    for (const tourn of tournaments) {
      const uname = tourn.organizer?.username;
      if (!uname || !uname.toLowerCase().includes(q)) continue;
      const entry = byUsername.get(uname) || { username: uname, matches: 0, tournaments: 0 };
      entry.tournaments += 1;
      byUsername.set(uname, entry);
    }

    return Array.from(byUsername.values()).slice(0, 3);
  }, [matches, tournaments, searchQuery]);

  const matchingQuickTournaments = useMemo(() => {
    if (activeTab === "tournaments") return [];
    const q = searchQuery.trim().toLowerCase();
    const userQ = q.startsWith("@") ? q.slice(1) : q;
    if (userQ.length < 2) return [];

    return tournaments
      .filter((tItem) => {
        const name = (tItem.name || "").toLowerCase();
        const sport = (tItem.sport_type || "").toLowerCase();
        const org = (tItem.organizer?.username || "").toLowerCase();
        return name.includes(q) || sport.includes(q) || (userQ && org.includes(userQ));
      })
      .slice(0, 3);
  }, [activeTab, tournaments, searchQuery]);

  const matchingQuickMatches = useMemo(() => {
    if (activeTab === "matches") return [];
    const q = searchQuery.trim().toLowerCase();
    const userQ = q.startsWith("@") ? q.slice(1) : q;
    if (userQ.length < 2) return [];

    return matches
      .filter((m) => {
        const p1 = (m.participants?.[0]?.name || "").toLowerCase();
        const p2 = (m.participants?.[1]?.name || "").toLowerCase();
        const tName = (m.tournaments?.name || "").toLowerCase();
        const sport = (m.sport_type || "").toLowerCase();
        const org = (m.organizer?.username || "").toLowerCase();
        return (
          p1.includes(q) ||
          p2.includes(q) ||
          tName.includes(q) ||
          sport.includes(q) ||
          (userQ && org.includes(userQ))
        );
      })
      .slice(0, 3);
  }, [activeTab, matches, searchQuery]);

  const hasQuickJumpResults =
    matchingOrganizers.length > 0 ||
    matchingQuickTournaments.length > 0 ||
    matchingQuickMatches.length > 0;

  // Pagination Calculations
  const isMatchesTab = activeTab === "matches";
  const isTournamentsTab = activeTab === "tournaments";
  const isFollowingTab = activeTab === "following";

  const totalMatchesCount = matches.length;
  const totalTournamentsCount = tournaments.length;
  const totalFollowedCount =
    followHook.followedMatchIds.size + followHook.followedTournamentIds.size;

  const currentItemsTotal = isMatchesTab
    ? filteredMatches.length
    : isTournamentsTab
    ? filteredTournaments.length
    : followingFilter === "matches"
    ? followedMatches.length
    : followingFilter === "tournaments"
    ? followedTournaments.length
    : followedMatches.length + followedTournaments.length;

  const itemsPerPage = isTournamentsTab ? TOURNAMENTS_PER_PAGE : MATCHES_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(currentItemsTotal / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  // Sync counts to TopNavBar
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("scoreboard:counts", {
        detail: {
          matches: totalMatchesCount,
          tournaments: totalTournamentsCount,
          following: totalFollowedCount,
        },
      })
    );
  }, [totalMatchesCount, totalTournamentsCount, totalFollowedCount]);

  const paginatedMatches = useMemo(() => {
    const start = (safePage - 1) * MATCHES_PER_PAGE;
    return filteredMatches.slice(start, start + MATCHES_PER_PAGE);
  }, [filteredMatches, safePage]);

  const paginatedTournaments = useMemo(() => {
    const start = (safePage - 1) * TOURNAMENTS_PER_PAGE;
    return filteredTournaments.slice(start, start + TOURNAMENTS_PER_PAGE);
  }, [filteredTournaments, safePage]);

  return (
    <div className="relative min-h-screen bg-transparent text-on-surface">
      {/* ATMOSPHERE BACKGROUND */}
      <MatchAtmosphereBackground
        sportType={sportFilter !== "all" ? sportFilter : "random"}
        mode="spectator"
      />

      <div className="relative z-10 w-full py-4 sm:py-6 px-3 sm:px-8 max-w-7xl mx-auto">
        {/* Horizontal Sport Filter Bar (mirrors scoreboard-mobile) */}
        <div className="mb-3 sm:mb-4">
          <SportFilterBar
            selectedSport={sportFilter}
            onSelectSport={(sport) => {
              setSportFilter(sport);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Precision Controls Toolbar */}
        <div className="relative z-20 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8 bg-surface-container/70 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-outline-variant shadow-sm">
          {/* Top (mobile) / Left (desktop): Following Filter + Search */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 shrink-0">
            {/* Favorites/Following Type Segmented Control */}
            {activeTab === "following" && user && (followedMatches.length > 0 || followedTournaments.length > 0) && (
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-container-high border border-outline-variant">
                <button
                  type="button"
                  onClick={() => setFollowingFilter("all")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    followingFilter === "all"
                      ? "bg-surface-container text-text-primary shadow-sm border border-outline-variant"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {t("home.allFollowed")} ({followedMatches.length + followedTournaments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFollowingFilter("matches")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    followingFilter === "matches"
                      ? "bg-surface-container text-text-primary shadow-sm border border-outline-variant"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {t("home.matchesTab")} ({followedMatches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFollowingFilter("tournaments")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    followingFilter === "tournaments"
                      ? "bg-surface-container text-text-primary shadow-sm border border-outline-variant"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {t("home.tournamentsTab")} ({followedTournaments.length})
                </button>
              </div>
            )}

            {/* Search Box with Organizer quick-jump */}
            <div className="relative flex items-center w-full sm:w-64 md:w-72">
              <span className="material-symbols-outlined absolute left-3.5 text-[17px] text-text-muted pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder={
                  locale === "pt"
                    ? "Pesquisar jogos, torneios ou @utilizadores..."
                    : "Search matches, tournaments, or @users..."
                }
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-surface-container-lowest text-text-primary text-xs sm:text-[13px] font-medium pl-10 pr-10 py-2 rounded-lg border border-outline-variant outline-none focus:border-text-secondary transition-colors placeholder:text-text-muted"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  aria-label={t("common.clearFilters")}
                  className="absolute right-3.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center"
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    cancel
                  </span>
                </button>
              )}

              {searchFocused && hasQuickJumpResults && (
                <div className="absolute left-0 top-full mt-2 w-full sm:w-[340px] max-h-80 overflow-y-auto bg-surface-container-high border border-outline rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/10 z-40 py-1.5 divide-y divide-outline-variant">
                  {matchingOrganizers.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[11px] font-semibold text-text-secondary">
                        {locale === "pt" ? "Organizadores" : "Organizers"}
                      </div>
                      {matchingOrganizers.map((org) => (
                        <Link
                          key={org.username}
                          href={`/user/${encodeURIComponent(org.username)}`}
                          className="flex items-center justify-between gap-2.5 px-3 py-1.5 hover:bg-surface-container-high transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-surface-container-high border border-outline-variant flex items-center justify-center text-[10px] font-medium text-text-secondary shrink-0">
                              {org.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-text-primary truncate">
                                @{org.username}
                              </div>
                              <div className="text-[11px] text-text-muted truncate">
                                {org.matches} {t("home.matchesCount").toLowerCase()} • {org.tournaments}{" "}
                                {t("home.tournamentsCount").toLowerCase()}
                              </div>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-[15px] text-text-muted shrink-0">
                            arrow_forward
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {matchingQuickTournaments.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[11px] font-semibold text-text-secondary">
                        {t("home.tournamentsTab")}
                      </div>
                      {matchingQuickTournaments.map((tourn) => (
                        <Link
                          key={tourn.id}
                          href={`/tournament/${tourn.id}`}
                          className="flex items-center justify-between gap-2.5 px-3 py-1.5 hover:bg-surface-container-high transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
                              <SportIcon sport={tourn.sport_type} className="text-[13px] text-text-secondary" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-text-primary truncate">
                                {tourn.name}
                              </div>
                              <div className="text-[11px] text-text-muted truncate">
                                {getSportTranslation(tourn.sport_type, t)}
                                {tourn.organizer?.username ? ` • @${tourn.organizer.username}` : ""}
                              </div>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-[15px] text-text-muted shrink-0">
                            arrow_forward
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {matchingQuickMatches.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[11px] font-semibold text-text-secondary">
                        {t("home.matchesTab")}
                      </div>
                      {matchingQuickMatches.map((m) => {
                        const team0 = formatTeamOrPlayerName(m.participants?.[0]?.name) || "TBD";
                        const team1 = formatTeamOrPlayerName(m.participants?.[1]?.name) || "TBD";
                        return (
                          <Link
                            key={m.id}
                            href={`/match/${m.id}`}
                            className="flex items-center justify-between gap-2.5 px-3 py-1.5 hover:bg-surface-container-high transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
                                <SportIcon sport={m.sport_type} className="text-[13px] text-text-secondary" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-text-primary truncate">
                                  {team0} vs {team1}
                                </div>
                                <div className="text-[11px] text-text-muted truncate">
                                  {m.tournaments?.name || getSportTranslation(m.sport_type, t)}
                                  {m.organizer?.username ? ` • @${m.organizer.username}` : ""}
                                </div>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-[15px] text-text-muted shrink-0">
                              arrow_forward
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom (mobile) / Right (desktop): Dropdowns on left, Action + Toggle on right */}
          <div className="flex items-center justify-between sm:flex-1 gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {/* Divider */}
              <div className="hidden sm:block h-6 w-px bg-outline-variant/60 shrink-0" />

              {/* Status Filter */}
              <SelectField
                variant="inline"
                label={t("common.status")}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "all", label: t("status.all") },
                  { value: "ongoing", label: t("status.live") },
                  { value: "scheduled", label: t("status.scheduled") },
                  { value: "completed", label: t("status.completed") },
                ]}
              />

              {/* Divider */}
              <div className="hidden sm:block h-6 w-px bg-outline-variant/60 shrink-0" />

              {/* Date Sort */}
              <SelectField
                variant="inline"
                label={t("common.date")}
                value={dateSort}
                onChange={(val) => {
                  setDateSort(val as "desc" | "asc");
                  setCurrentPage(1);
                }}
                options={[
                  { value: "desc", label: t("common.recentFirst") },
                  { value: "asc", label: t("common.oldestFirst") },
                ]}
              />

              {/* Clear filters button */}
              {(sportFilter !== "all" || statusFilter !== "all" || searchQuery !== "" || dateSort !== "desc") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  title={t("common.clearFilters")}
                  className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                  <span className="hidden md:inline">{t("common.clearFilters")}</span>
                </button>
              )}
            </div>

            {/* Right: Actions & View Mode Toggle */}
            <div className="flex items-center gap-2 shrink-0">
            {activeTab === "matches" && (
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setAuthModal("login");
                  } else {
                    router.push("/my-matches?create=true");
                  }
                }}
                aria-label={t("common.newMatch")}
                title={t("common.newMatch")}
                className="h-8 w-8 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span className="hidden sm:inline">{t("common.newMatch")}</span>
              </button>
            )}

            {activeTab === "tournaments" && (
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setAuthModal("login");
                  } else {
                    router.push("/my-tournaments?create=true");
                  }
                }}
                aria-label={t("common.newTournament")}
                title={t("common.newTournament")}
                className="h-8 w-8 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span className="hidden sm:inline">{t("common.newTournament")}</span>
              </button>
            )}

            {/* View Mode Toggle: List on left, Grid on right */}
            <div className="flex items-center gap-0.5 bg-surface-container-high/50 p-1 rounded-xl border border-outline-variant shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title={t("common.viewList")}
                className={`p-1.5 rounded-lg transition-colors flex items-center cursor-pointer ${
                  viewMode === "list"
                    ? "bg-surface-container-highest text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                title={t("common.viewCards")}
                className={`p-1.5 rounded-lg transition-colors flex items-center cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-surface-container-highest text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
            </div>
          </div>
          </div>
        </div>

      {/* Loading Indicator */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-text-muted text-xs font-medium">
            {t("common.loading")}
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: MATCHES */}
          {activeTab === "matches" && (
            <div className="w-full">
              {filteredMatches.length === 0 ? (
                <div className="bg-surface-container rounded-xl p-12 text-center border border-outline-variant">
                  <span className="material-symbols-outlined text-3xl text-text-muted mb-2 block">
                    sports
                  </span>
                  <h3 className="font-sans font-medium text-sm text-text-primary mb-1">
                    {t("home.noMatchesFound")}
                  </h3>
                  <p className="text-text-muted text-xs mb-4">
                    {t("home.noMatchesFilterDesc")}
                  </p>
                  {(sportFilter !== "all" || statusFilter !== "all" || searchQuery !== "") && (
                    <button
                      onClick={clearFilters}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-medium text-primary transition-colors border border-outline-variant"
                    >
                      {t("common.clearFilters")}
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                /* Cards Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Mobile Compact Match List View */}
                  <div className="md:hidden space-y-2.5">
                    {paginatedMatches.map((m) => (
                      <MatchListItem key={m.id} match={m} />
                    ))}
                  </div>

                  {/* Desktop Data Table View */}
                  <DataTable
                    data={paginatedMatches}
                    columns={getMatchColumns(t)}
                    getRowKey={(m) => m.id}
                    onRowClick={(m) => router.push(`/match/${m.id}`)}
                  />
              </>
              )}
            </div>
          )}

          {/* TAB 2: TOURNAMENTS */}
          {activeTab === "tournaments" && (
            <div className="w-full">
              {filteredTournaments.length === 0 ? (
                <div className="bg-surface-container-low rounded-3xl p-12 text-center border border-white/5">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">
                    emoji_events
                  </span>
                  <h3 className="font-headline font-bold text-base text-on-surface mb-1">
                    {t("home.noTournamentsFound")}
                  </h3>
                  <p className="text-on-surface-variant/60 text-xs mb-4">
                    {t("home.noTournamentsFilterDesc")}
                  </p>
                  {(sportFilter !== "all" || statusFilter !== "all" || searchQuery !== "") && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-primary transition-all"
                    >
                      {t("common.clearFilters")}
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                /* Cards Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedTournaments.map((tItem) => (
                    <Link
                      key={tItem.id}
                      href={`/tournament/${tItem.id}`}
                      className="w-full group block h-full"
                    >
                      <div className="bg-surface-container rounded-xl p-4 border border-outline-variant hover:border-outline hover:bg-surface-container-high/40 transition-colors flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-outline-variant/60 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <SportIcon
                                sport={tItem.sport_type}
                                className="text-text-muted group-hover:text-text-primary text-[15px] shrink-0 transition-colors"
                              />
                              <span className="text-xs font-medium text-text-secondary truncate">
                                {getSportTranslation(tItem.sport_type, t)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {tItem.status === "ongoing" ? (
                                <span className="text-xs font-medium text-text-primary flex items-center gap-1.5 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  {t("status.live")}
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-text-muted shrink-0">
                                  {tItem.status === "completed"
                                    ? t("status.completed")
                                    : t("status.scheduled")}
                                </span>
                              )}
                              <FollowButton
                                entityId={tItem.id}
                                entityType="tournament"
                                variant="icon"
                                followHook={followHook}
                                className="text-text-muted hover:text-text-primary"
                              />
                            </div>
                          </div>

                          <h3 className="text-sm font-semibold text-text-primary mb-1.5 leading-snug">
                            {tItem.name}
                          </h3>

                          <p className="text-xs text-text-muted mb-4">
                            {tItem.settings?.stage_1?.type === "groups"
                              ? t("tournament.groupStage")
                              : tItem.settings?.stage_1?.type === "double_elimination"
                              ? t("tournament.doubleElimination")
                              : t("tournament.singleElimination")}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                          <span className="font-mono tabular-nums text-xs text-text-muted">
                            {tItem.start_date
                              ? new Date(tItem.start_date).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : t("home.tbdDate")}
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-text-muted group-hover:text-text-primary transition-colors">
                            arrow_forward
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <DataTable
                  data={paginatedTournaments}
                  columns={getTournamentColumns(t)}
                  getRowKey={(tItem) => tItem.id}
                  onRowClick={(tItem) => router.push(`/tournament/${tItem.id}`)}
                  hideOnMobile={false}
                />
              )}
            </div>
          )}

          {/* TAB 3: FOLLOWING / FAVORITOS */}
          {activeTab === "following" && (
            <div className="w-full">
              {!user ? (
                /* Unauthenticated Call to Action */
                <div className="bg-surface-container rounded-2xl p-8 text-center border border-outline-variant max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center mx-auto mb-4 text-text-muted">
                    <span className="material-symbols-outlined text-2xl">star</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1.5 text-text-primary">
                    {t("home.unauthTitle")}
                  </h3>
                  <p className="text-text-muted text-xs mb-5 leading-relaxed">
                    {t("home.unauthDesc")}
                  </p>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("auth", "login");
                      router.replace(window.location.pathname + "?" + params.toString());
                    }}
                    className="inline-flex items-center gap-1.5 bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">login</span>
                    {t("home.unauthSignIn")}
                  </button>
                </div>
              ) : followedMatches.length === 0 && followedTournaments.length === 0 ? (
                /* Empty Following State */
                <div className="bg-surface-container rounded-2xl p-8 text-center border border-outline-variant max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center mx-auto mb-4 text-text-muted">
                    <span className="material-symbols-outlined text-2xl">star_outline</span>
                  </div>
                  <h3 className="font-semibold text-base text-text-primary mb-1">
                    {t("home.emptyFollowingTitle")}
                  </h3>
                  <p className="text-text-muted text-xs max-w-sm mx-auto mb-5">
                    {t("home.emptyFollowingDesc")}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleTabChange("matches")}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-text-primary text-xs font-medium border border-outline-variant transition-colors cursor-pointer"
                    >
                      {t("home.exploreMatches")}
                    </button>
                    <button
                      onClick={() => handleTabChange("tournaments")}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-text-primary text-xs font-medium border border-outline-variant transition-colors cursor-pointer"
                    >
                      {t("home.exploreTournaments")}
                    </button>
                  </div>
                </div>
              ) : (
                /* Followed Items List */
                <div className="space-y-6">

                  {/* Followed Matches Section */}
                  {(followingFilter === "all" || followingFilter === "matches") && followedMatches.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                        <span className="material-symbols-outlined text-[16px] text-text-primary">star</span>
                        <span>{t("home.followedMatchesTitle")} ({followedMatches.length})</span>
                      </div>

                      {viewMode === "cards" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {followedMatches.map((m) => (
                            <MatchCard key={m.id} match={m} />
                          ))}
                        </div>
                      ) : (
                        <>
                          {/* Mobile List View */}
                          <div className="md:hidden divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container overflow-hidden">
                            {followedMatches.map((m) => (
                              <MatchListItem key={m.id} match={m} />
                            ))}
                          </div>

                          {/* Desktop Data Table View */}
                          <DataTable
                            data={followedMatches}
                            columns={getMatchColumns(t)}
                            getRowKey={(m) => m.id}
                            onRowClick={(m) => router.push(`/match/${m.id}`)}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Followed Tournaments Section */}
                  {(followingFilter === "all" || followingFilter === "tournaments") && followedTournaments.length > 0 && (
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                        <span className="material-symbols-outlined text-[16px] text-text-primary">emoji_events</span>
                        <span>{t("home.followedTournamentsTitle")} ({followedTournaments.length})</span>
                      </div>

                      {viewMode === "cards" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {followedTournaments.map((tItem) => (
                            <Link
                              key={tItem.id}
                              href={`/tournament/${tItem.id}`}
                              className="w-full group block h-full"
                            >
                              <div className="bg-surface-container rounded-xl p-4 border border-outline-variant hover:border-outline hover:bg-surface-container-high/40 transition-colors flex flex-col justify-between h-full">
                                <div>
                                  <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-outline-variant/60 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <SportIcon
                                        sport={tItem.sport_type}
                                        className="text-text-muted group-hover:text-text-primary text-[15px] shrink-0 transition-colors"
                                      />
                                      <span className="text-xs font-medium text-text-secondary truncate">
                                        {getSportTranslation(tItem.sport_type, t)}
                                      </span>
                                    </div>
                                    <FollowButton
                                      entityId={tItem.id}
                                      entityType="tournament"
                                      variant="icon"
                                      followHook={followHook}
                                      className="text-text-muted hover:text-text-primary"
                                    />
                                  </div>

                                  <h3 className="text-sm font-semibold text-text-primary mb-1.5 leading-snug">
                                    {tItem.name}
                                  </h3>

                                  <p className="text-xs text-text-muted mb-4">
                                    {tItem.settings?.stage_1?.type === "groups"
                                      ? t("tournament.groupStage")
                                      : t("tournament.singleElimination")}
                                  </p>
                                </div>

                                <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                                  <span className="font-mono tabular-nums text-xs text-text-muted">
                                    {tItem.start_date
                                      ? new Date(tItem.start_date).toLocaleDateString(undefined, {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        })
                                      : t("home.tbdDate")}
                                  </span>
                                  <span className="material-symbols-outlined text-[16px] text-text-muted group-hover:text-text-primary transition-colors">
                                    arrow_forward
                                  </span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        /* Desktop Data Table View for Tournaments */
                        <DataTable
                          data={followedTournaments}
                          columns={getTournamentColumns(t)}
                          getRowKey={(tItem) => tItem.id}
                          onRowClick={(tItem) => router.push(`/tournament/${tItem.id}`)}
                          hideOnMobile={false}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Authentication Modal (Preserved for full compatibility with tests & auth flow) */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 max-w-md w-full relative">
            <button
              onClick={closeAuthModal}
              aria-label="Close"
              className="absolute top-5 right-5 text-text-muted hover:text-text-primary transition-colors cursor-pointer p-1 rounded-lg hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>

            <div className="text-left mb-5 pr-8">
              <h2 className="font-sans text-lg font-semibold tracking-tight text-text-primary">
                {authModal === "signup"
                  ? t("auth.createAccount")
                  : authModal === "forgot"
                  ? t("auth.forgotPasswordTitle")
                  : t("auth.signInBtn")}
              </h2>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                {authModal === "signup"
                  ? t("auth.joinSubtitle")
                  : authModal === "forgot"
                  ? t("auth.forgotPasswordSubtitle")
                  : t("auth.manageSubtitle")}
              </p>
            </div>

            {forgotEmailSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-2xl">mark_email_read</span>
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-1">
                  {t("auth.resetEmailSentTitle")}
                </h3>
                <p className="text-xs text-text-muted mb-5 leading-relaxed">
                  {t("auth.resetEmailSentMessage")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModal("login");
                    setForgotEmailSent(false);
                  }}
                  className="w-full bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  {t("auth.backToSignIn")}
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authModal === "signup" && (
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        {t("auth.username")}
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t("auth.usernamePlaceholder")}
                        className="w-full bg-surface-container-high text-text-primary px-3.5 py-2.5 rounded-lg border border-outline-variant outline-none focus:border-outline-focus transition-colors text-xs font-medium placeholder:text-text-muted/50"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      {t("auth.email")}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      required
                      className="w-full bg-surface-container-high text-text-primary px-3.5 py-2.5 rounded-lg border border-outline-variant outline-none focus:border-outline-focus transition-colors text-xs font-medium placeholder:text-text-muted/50"
                    />
                  </div>

                  {authModal !== "forgot" && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-text-secondary">
                          {t("auth.password")}
                        </label>
                        {authModal === "login" && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuthModal("forgot");
                              setForgotEmailSent(false);
                            }}
                            className="text-xs text-text-muted hover:text-text-primary hover:underline underline-offset-2 cursor-pointer font-medium transition-colors"
                          >
                            {t("auth.forgotPassword")}
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("auth.passwordPlaceholder")}
                        required
                        className="w-full bg-surface-container-high text-text-primary px-3.5 py-2.5 rounded-lg border border-outline-variant outline-none focus:border-outline-focus transition-colors text-xs font-medium placeholder:text-text-muted/50"
                      />
                      {authModal === "signup" && (
                        <p className="text-[11px] text-text-muted mt-1.5 leading-snug">
                          {t("auth.passwordRequirements")}
                        </p>
                      )}
                    </div>
                  )}

                  {authModal === "signup" && (
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        {t("auth.confirmPassword")}
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t("auth.confirmPasswordPlaceholder")}
                        className="w-full bg-surface-container-high text-text-primary px-3.5 py-2.5 rounded-lg border border-outline-variant outline-none focus:border-outline-focus transition-colors text-xs font-medium placeholder:text-text-muted/50"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer mt-2"
                  >
                    {isSubmitting
                      ? t("auth.processing")
                      : authModal === "signup"
                      ? t("auth.signUpBtn")
                      : authModal === "forgot"
                      ? t("auth.sendResetLink")
                      : t("auth.signInBtn")}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-outline-variant/60 text-center">
                  {authModal === "forgot" ? (
                    <button
                      type="button"
                      onClick={() => setAuthModal("login")}
                      className="text-xs text-text-primary font-medium hover:underline underline-offset-2 cursor-pointer"
                    >
                      {t("auth.backToSignIn")}
                    </button>
                  ) : authModal === "signup" ? (
                    <p className="text-xs text-text-muted">
                      {t("auth.alreadyHaveAccount")}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthModal("login");
                          const params = new URLSearchParams(searchParams.toString());
                          params.set("auth", "login");
                          router.replace(window.location.pathname + "?" + params.toString());
                        }}
                        className="text-text-primary font-medium hover:underline underline-offset-2 cursor-pointer"
                      >
                        {t("auth.signInBtn")}
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted">
                      {t("auth.dontHaveAccount")}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthModal("signup");
                          const params = new URLSearchParams(searchParams.toString());
                          params.set("auth", "signup");
                          router.replace(window.location.pathname + "?" + params.toString());
                        }}
                        className="text-text-primary font-medium hover:underline underline-offset-2 cursor-pointer"
                      >
                        {t("auth.signUpBtn")}
                      </button>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
