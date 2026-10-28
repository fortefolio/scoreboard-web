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
import { FollowButton } from "@/components/FollowButton";
import { useFollow } from "@/lib/hooks/useFollow";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const followHook = useFollow();

  // Authentication Modal State
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);
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
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auth modal query sync
  const closeAuthModal = useCallback(() => {
    setAuthModal(null);
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
    else setAuthModal(null);
  }, [searchParams]);

  // Load matches and tournaments
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [matchesRes, tournamentsRes] = await Promise.all([
        supabase
          .from("matches")
          .select("*, tournaments(name)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("tournaments")
          .select("*")
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
      if (authModal === "signup") {
        if (!username.trim()) {
          toast.error("Username is required");
          setIsSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setIsSubmitting(false);
          return;
        }

        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .ilike("username", username.trim())
          .maybeSingle();

        if (existingUser) {
          toast.error("Username already taken. Please choose another one.");
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
          toast.error("An account with this email already exists.");
          setIsSubmitting(false);
          return;
        }

        toast.success("Account created successfully!");
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

        toast.success("Welcome back!");
        closeAuthModal();

        const next = searchParams.get("next");
        if (next && next.startsWith("/") && !next.startsWith("//")) {
          router.push(next);
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

        // Text search (participants, tournament, court)
        if (query) {
          const p1 = (m.participants?.[0]?.name || "").toLowerCase();
          const p2 = (m.participants?.[1]?.name || "").toLowerCase();
          const tName = (m.tournaments?.name || "").toLowerCase();
          const court = (m.court || "").toLowerCase();
          const sport = (m.sport_type || "").toLowerCase();
          if (
            !p1.includes(query) &&
            !p2.includes(query) &&
            !tName.includes(query) &&
            !court.includes(query) &&
            !sport.includes(query)
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

        // Text search
        if (query) {
          const name = (t.name || "").toLowerCase();
          const sport = (t.sport_type || "").toLowerCase();
          if (!name.includes(query) && !sport.includes(query)) {
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

  const paginatedMatches = useMemo(() => {
    const start = (safePage - 1) * MATCHES_PER_PAGE;
    return filteredMatches.slice(start, start + MATCHES_PER_PAGE);
  }, [filteredMatches, safePage]);

  const paginatedTournaments = useMemo(() => {
    const start = (safePage - 1) * TOURNAMENTS_PER_PAGE;
    return filteredTournaments.slice(start, start + TOURNAMENTS_PER_PAGE);
  }, [filteredTournaments, safePage]);

  return (
    <div className="min-h-screen bg-background text-on-surface py-8 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="bg-surface-container-low rounded-[2.5rem] p-6 sm:p-10 border border-white/5 relative overflow-hidden mb-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/10 blur-3xl pointer-events-none rounded-full" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-[10px] font-black uppercase tracking-widest mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Kinetic Vault & Live Scoreboard
            </div>
            <h1 className="font-headline font-black text-3xl sm:text-5xl text-on-surface tracking-tight mb-2">
              Resultados e Torneios
            </h1>
            <p className="text-on-surface-variant text-sm max-w-xl">
              Acompanha resultados em tempo real, segue os teus jogos e torneios favoritos e recebe notificações instantâneas com cada ponto.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-surface-container/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5 shrink-0 self-start md:self-auto">
            <div className="text-center">
              <div className="font-mono text-2xl font-black text-primary">
                {totalMatchesCount}
              </div>
              <div className="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                Jogos
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="font-mono text-2xl font-black text-secondary">
                {totalTournamentsCount}
              </div>
              <div className="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                Torneios
              </div>
            </div>
            {user && (
              <>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <div className="font-mono text-2xl font-black text-amber-400">
                    {totalFollowedCount}
                  </div>
                  <div className="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                    Favoritos
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Consistent with Profile Page + Favoritos Tab) */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4 overflow-x-auto">
        <button
          onClick={() => handleTabChange("matches")}
          className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "matches"
              ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
              : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">sports</span>
          Jogos ({matches.length})
        </button>

        <button
          onClick={() => handleTabChange("tournaments")}
          className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "tournaments"
              ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
              : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">emoji_events</span>
          Torneios ({tournaments.length})
        </button>

        <button
          onClick={() => handleTabChange("following")}
          className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "following"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10"
              : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <span
            className="material-symbols-outlined text-[16px] text-amber-400"
            style={{ fontVariationSettings: activeTab === "following" ? "'FILL' 1" : undefined }}
          >
            star
          </span>
          Favoritos / A Seguir {user ? `(${totalFollowedCount})` : ""}
        </button>
      </div>

      {/* Filter, Search & View Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 bg-surface-container-low p-4 rounded-2xl border border-white/5 shadow-lg">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/50">
              search
            </span>
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-surface-container text-on-surface text-xs font-bold pl-9 pr-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
            />
          </div>

          {/* Sport Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant/60">
              Desporto:
            </span>
            <select
              value={sportFilter}
              onChange={(e) => {
                setSportFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-surface-container text-on-surface text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Todos os Desportos</option>
              <option value="Basketball">Basquetebol</option>
              <option value="Volleyball">Voleibol</option>
              <option value="Beach Volleyball">Voleibol de Praia</option>
              <option value="Football">Futebol</option>
              <option value="Tennis">Ténis</option>
              <option value="Padel">Padel</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant/60">
              Estado:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-surface-container text-on-surface text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Todos os Estados</option>
              <option value="scheduled">Não decorreu (Agendado)</option>
              <option value="ongoing">A decorrer (Ao Vivo)</option>
              <option value="completed">Terminado (Final)</option>
            </select>
          </div>

          {/* Date Sort */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant/60">
              Data:
            </span>
            <select
              value={dateSort}
              onChange={(e) => {
                setDateSort(e.target.value as "desc" | "asc");
                setCurrentPage(1);
              }}
              className="bg-surface-container text-on-surface text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="desc">Mais recentes primeiro</option>
              <option value="asc">Mais antigos primeiro</option>
            </select>
          </div>

          {/* Clear filters button */}
          {(sportFilter !== "all" || statusFilter !== "all" || searchQuery !== "" || dateSort !== "desc") && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[10px] font-label font-bold uppercase tracking-wider text-primary hover:underline cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* View Mode Toggle: List on Left, Grid on Right */}
        <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl border border-white/10 self-start lg:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            title="Ver em Lista"
            className={`p-1.5 rounded-lg transition-all flex items-center cursor-pointer ${
              viewMode === "list"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">view_list</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            title="Ver em Cartões"
            className={`p-1.5 rounded-lg transition-all flex items-center cursor-pointer ${
              viewMode === "cards"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-on-surface-variant font-label uppercase tracking-widest text-xs">
            A carregar eventos...
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: MATCHES */}
          {activeTab === "matches" && (
            <div>
              {filteredMatches.length === 0 ? (
                <div className="bg-surface-container-low rounded-3xl p-12 text-center border border-white/5">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">
                    sports
                  </span>
                  <h3 className="font-headline font-bold text-base text-on-surface mb-1">
                    Nenhum jogo encontrado
                  </h3>
                  <p className="text-on-surface-variant/60 text-xs mb-4">
                    Não existem jogos correspondentes aos filtros selecionados.
                  </p>
                  {(sportFilter !== "all" || statusFilter !== "all" || searchQuery !== "") && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-primary transition-all"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                /* Cards Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {paginatedMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              ) : (
                /* List / Table View */
                <div className="bg-surface-container-low rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="border-b border-white/5 bg-surface-container/50 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                        <tr>
                          <th className="py-3.5 px-4 w-12 text-center">Seguir</th>
                          <th className="py-3.5 px-5">Equipas / Jogadores</th>
                          <th className="py-3.5 px-5">Evento</th>
                          <th className="py-3.5 px-4">Desporto</th>
                          <th className="py-3.5 px-4 text-center">Resultado</th>
                          <th className="py-3.5 px-4 text-center">Estado</th>
                          <th className="py-3.5 px-5 text-right">Data</th>
                          <th className="py-3.5 px-5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm font-body">
                        {paginatedMatches.map((m) => {
                          const rawSetData = extractSetsData(m.scores);
                          const isTimedOrPointsSport =
                            m.sport_type === "Football" || m.sport_type === "Basketball";
                          const setsWon0 = countSetsWon(rawSetData, 0);
                          const setsWon1 = countSetsWon(rawSetData, 1);
                          const mainScore0 = isTimedOrPointsSport
                            ? m.scores?.current?.home ?? 0
                            : setsWon0;
                          const mainScore1 = isTimedOrPointsSport
                            ? m.scores?.current?.away ?? 0
                            : setsWon1;

                          const setScores = Array.isArray(rawSetData)
                            ? rawSetData.map((s: any) => ({
                                t1: s.team1 ?? s.home ?? 0,
                                t2: s.team2 ?? s.away ?? 0,
                              }))
                            : [];

                          return (
                            <tr
                              key={m.id}
                              className="hover:bg-white/[0.02] transition-colors group"
                            >
                              {/* Follow Toggle */}
                              <td className="py-4 px-4 text-center">
                                <FollowButton
                                  entityId={m.id}
                                  entityType="match"
                                  variant="icon"
                                  followHook={followHook}
                                />
                              </td>

                              {/* Equipas / Jogadores */}
                              <td className="py-4 px-5">
                                <div className="space-y-1">
                                  <div className="font-bold text-xs text-on-surface flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                                    {formatTeamOrPlayerName(m.participants?.[0]?.name) || "TBD"}
                                  </div>
                                  <div className="font-bold text-xs text-on-surface flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-secondary/40 shrink-0" />
                                    {formatTeamOrPlayerName(m.participants?.[1]?.name) || "TBD"}
                                  </div>
                                </div>
                              </td>

                              {/* Evento */}
                              <td className="py-4 px-5">
                                <div className="font-headline font-bold text-on-surface text-xs leading-snug">
                                  {m.tournaments?.name || "Jogo Isolado"}
                                </div>
                                {m.court && (
                                  <div className="text-[10px] text-on-surface-variant/60 font-label mt-0.5">
                                    {m.court}
                                  </div>
                                )}
                              </td>

                              {/* Desporto */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  <SportIcon
                                    sport={m.sport_type}
                                    className="text-primary text-[18px] shrink-0"
                                  />
                                  <span className="text-xs font-label font-bold uppercase tracking-wider text-on-surface-variant">
                                    {m.sport_type}
                                  </span>
                                </div>
                              </td>

                              {/* Score & Sets */}
                              <td className="py-4 px-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-mono text-base font-black text-secondary tracking-tight">
                                    {mainScore0} - {mainScore1}
                                  </span>
                                  {!isTimedOrPointsSport && setScores.length > 0 && (
                                    <span className="font-mono text-[10px] text-on-surface-variant/60 tracking-tighter">
                                      ({setScores.map((s: any) => `${s.t1}-${s.t2}`).join(", ")})
                                    </span>
                                  )}
                                  {m.sport_type === "Basketball" && m.scores?.basketball?.quarters && (
                                    <span className="font-mono text-[10px] text-on-surface-variant/60 tracking-tighter">
                                      ({m.scores.basketball.quarters
                                        .filter(
                                          (q: any) =>
                                            (q.home ?? 0) > 0 || (q.away ?? 0) > 0
                                        )
                                        .map((q: any) => `${q.home}-${q.away}`)
                                        .join(", ")})
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-4 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    m.status === "completed"
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : m.status === "ongoing"
                                      ? "bg-primary/10 text-primary border border-primary/20 animate-pulse"
                                      : "bg-white/5 text-on-surface-variant/70 border border-white/10"
                                  }`}
                                >
                                  {m.status === "completed"
                                    ? "Concluído"
                                    : m.status === "ongoing"
                                    ? "Ao Vivo"
                                    : "Agendado"}
                                </span>
                              </td>

                              {/* Data */}
                              <td className="py-4 px-5 text-right font-mono text-xs text-on-surface-variant/70">
                                {m.scheduled_at
                                  ? new Date(m.scheduled_at).toLocaleDateString(undefined, {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : m.created_at
                                  ? new Date(m.created_at).toLocaleDateString(undefined, {
                                      day: "numeric",
                                      month: "short",
                                    })
                                  : "-"}
                              </td>

                              {/* Ação */}
                              <td className="py-4 px-5 text-right">
                                <Link
                                  href={`/match/${m.id}`}
                                  title="Ver Jogo"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container/20 hover:bg-primary-container text-primary hover:text-on-primary-container transition-all cursor-pointer border border-primary/20"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    arrow_forward
                                  </span>
                                </Link>
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
          )}

          {/* TAB 2: TOURNAMENTS */}
          {activeTab === "tournaments" && (
            <div>
              {filteredTournaments.length === 0 ? (
                <div className="bg-surface-container-low rounded-3xl p-12 text-center border border-white/5">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">
                    emoji_events
                  </span>
                  <h3 className="font-headline font-bold text-base text-on-surface mb-1">
                    Nenhum torneio encontrado
                  </h3>
                  <p className="text-on-surface-variant/60 text-xs mb-4">
                    Não existem torneios correspondentes aos filtros selecionados.
                  </p>
                  {(sportFilter !== "all" || statusFilter !== "all" || searchQuery !== "") && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-primary transition-all"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                /* Cards Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedTournaments.map((t) => (
                    <div
                      key={t.id}
                      className="bg-surface-container-low rounded-3xl p-6 border border-white/5 hover:border-primary/20 transition-all flex flex-col justify-between group shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div className="flex items-center gap-2">
                            <SportIcon
                              sport={t.sport_type}
                              className="text-primary text-[20px]"
                            />
                            <span className="text-[10px] font-label font-black uppercase tracking-wider text-on-surface-variant">
                              {t.sport_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                t.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : t.status === "ongoing"
                                  ? "bg-primary/10 text-primary border border-primary/20 animate-pulse"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {t.status === "completed"
                                ? "Concluído"
                                : t.status === "ongoing"
                                ? "Em Curso"
                                : "Agendado"}
                            </span>
                            <FollowButton
                              entityId={t.id}
                              entityType="tournament"
                              variant="icon"
                              followHook={followHook}
                            />
                          </div>
                        </div>

                        <h3 className="font-headline font-black text-lg text-on-surface mb-2 group-hover:text-primary transition-colors">
                          {t.name}
                        </h3>

                        <p className="text-xs text-on-surface-variant/70 font-label uppercase tracking-wider mb-4">
                          {t.settings?.stage_1?.type === "groups"
                            ? "Fase de Grupos"
                            : t.settings?.stage_1?.type === "double_elimination"
                            ? "Dupla Eliminatória"
                            : "Eliminatória"}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <span className="font-mono text-xs text-on-surface-variant/60">
                          {t.start_date
                            ? new Date(t.start_date).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "Data a definir"}
                        </span>
                        <Link
                          href={`/tournament/${t.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform"
                        >
                          Ver Torneio
                          <span className="material-symbols-outlined text-[16px]">
                            arrow_forward
                          </span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List / Table View */
                <div className="bg-surface-container-low rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="border-b border-white/5 bg-surface-container/50 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                        <tr>
                          <th className="py-3.5 px-4 w-12 text-center">Seguir</th>
                          <th className="py-3.5 px-5">Torneio</th>
                          <th className="py-3.5 px-4">Desporto</th>
                          <th className="py-3.5 px-4">Formato</th>
                          <th className="py-3.5 px-4 text-center">Estado</th>
                          <th className="py-3.5 px-5 text-right">Data</th>
                          <th className="py-3.5 px-5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm font-body">
                        {paginatedTournaments.map((t) => (
                          <tr
                            key={t.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* Follow Toggle */}
                            <td className="py-4 px-4 text-center">
                              <FollowButton
                                entityId={t.id}
                                entityType="tournament"
                                variant="icon"
                                followHook={followHook}
                              />
                            </td>

                            {/* Torneio */}
                            <td className="py-4 px-5">
                              <div className="font-headline font-bold text-sm text-on-surface">
                                {t.name}
                              </div>
                            </td>

                            {/* Desporto */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <SportIcon
                                  sport={t.sport_type}
                                  className="text-primary text-[18px] shrink-0"
                                />
                                <span className="text-xs font-label font-bold uppercase tracking-wider text-on-surface-variant">
                                  {t.sport_type}
                                </span>
                              </div>
                            </td>

                            {/* Formato */}
                            <td className="py-4 px-4 font-label text-xs uppercase tracking-wider text-on-surface-variant/80">
                              {t.settings?.stage_1?.type === "groups"
                                ? "Fase de Grupos"
                                : t.settings?.stage_1?.type === "double_elimination"
                                ? "Dupla Eliminatória"
                                : "Eliminatória"}
                            </td>

                            {/* Estado */}
                            <td className="py-4 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  t.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : t.status === "ongoing"
                                    ? "bg-primary/10 text-primary border border-primary/20 animate-pulse"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}
                              >
                                {t.status === "completed"
                                  ? "Concluído"
                                  : t.status === "ongoing"
                                  ? "Em Curso"
                                  : "Agendado"}
                              </span>
                            </td>

                            {/* Data */}
                            <td className="py-4 px-5 text-right font-mono text-xs text-on-surface-variant/70">
                              {t.start_date
                                ? new Date(t.start_date).toLocaleDateString(undefined, {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "-"}
                            </td>

                            {/* Ação */}
                            <td className="py-4 px-5 text-right">
                              <Link
                                href={`/tournament/${t.id}`}
                                title="Ver Torneio"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container/20 hover:bg-primary-container text-primary hover:text-on-primary-container transition-all cursor-pointer border border-primary/20"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  arrow_forward
                                </span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FOLLOWING / FAVORITOS */}
          {activeTab === "following" && (
            <div>
              {!user ? (
                /* Unauthenticated Call to Action */
                <div className="bg-surface-container-low rounded-3xl p-12 text-center border border-white/5 max-w-xl mx-auto shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
                    <span className="material-symbols-outlined text-3xl">star</span>
                  </div>
                  <h3 className="font-headline font-black text-2xl mb-2 text-on-surface">
                    Acompanha os teus favoritos
                  </h3>
                  <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                    Inicia sessão para marcares jogos e torneios como favoritos. Vais receber notificações automáticas em tempo real para cada evolução de resultado.
                  </p>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("auth", "login");
                      router.replace(window.location.pathname + "?" + params.toString());
                    }}
                    className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    Iniciar Sessão
                  </button>
                </div>
              ) : followedMatches.length === 0 && followedTournaments.length === 0 ? (
                /* Empty Following State */
                <div className="bg-surface-container-low rounded-3xl p-12 text-center border border-white/5">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-amber-400/60">
                    <span className="material-symbols-outlined text-3xl">star_outline</span>
                  </div>
                  <h3 className="font-headline font-bold text-lg text-on-surface mb-2">
                    Ainda não estás a seguir nenhum evento
                  </h3>
                  <p className="text-on-surface-variant/70 text-xs max-w-md mx-auto mb-6">
                    Explora as abas <strong className="text-on-surface">Jogos</strong> ou <strong className="text-on-surface">Torneios</strong> e clica no ícone da estrela para começares a seguir os teus favoritos e receberes notificações agregadas de cada pontuação.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => handleTabChange("matches")}
                      className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary-container font-label text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer"
                    >
                      Explorar Jogos
                    </button>
                    <button
                      onClick={() => handleTabChange("tournaments")}
                      className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border border-white/10"
                    >
                      Explorar Torneios
                    </button>
                  </div>
                </div>
              ) : (
                /* Followed Items List */
                <div className="space-y-6">
                  {/* Sub-filter chips */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFollowingFilter("all")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        followingFilter === "all"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface border border-transparent"
                      }`}
                    >
                      Todos ({followedMatches.length + followedTournaments.length})
                    </button>
                    <button
                      onClick={() => setFollowingFilter("matches")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        followingFilter === "matches"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface border border-transparent"
                      }`}
                    >
                      Jogos ({followedMatches.length})
                    </button>
                    <button
                      onClick={() => setFollowingFilter("tournaments")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        followingFilter === "tournaments"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface border border-transparent"
                      }`}
                    >
                      Torneios ({followedTournaments.length})
                    </button>
                  </div>

                  {/* Followed Matches Section */}
                  {(followingFilter === "all" || followingFilter === "matches") && followedMatches.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 font-label text-xs font-black uppercase tracking-wider text-amber-400">
                        <span className="material-symbols-outlined text-[16px]">sports</span>
                        Jogos a Seguir ({followedMatches.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {followedMatches.map((m) => (
                          <MatchCard key={m.id} match={m} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Followed Tournaments Section */}
                  {(followingFilter === "all" || followingFilter === "tournaments") && followedTournaments.length > 0 && (
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center gap-2 font-label text-xs font-black uppercase tracking-wider text-amber-400">
                        <span className="material-symbols-outlined text-[16px]">emoji_events</span>
                        Torneios a Seguir ({followedTournaments.length})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {followedTournaments.map((t) => (
                          <div
                            key={t.id}
                            className="bg-surface-container-low rounded-3xl p-6 border border-white/5 hover:border-amber-500/30 transition-all flex flex-col justify-between group shadow-lg"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-4">
                                <div className="flex items-center gap-2">
                                  <SportIcon
                                    sport={t.sport_type}
                                    className="text-primary text-[20px]"
                                  />
                                  <span className="text-[10px] font-label font-black uppercase tracking-wider text-on-surface-variant">
                                    {t.sport_type}
                                  </span>
                                </div>
                                <FollowButton
                                  entityId={t.id}
                                  entityType="tournament"
                                  variant="icon"
                                  followHook={followHook}
                                />
                              </div>

                              <h3 className="font-headline font-black text-lg text-on-surface mb-2 group-hover:text-primary transition-colors">
                                {t.name}
                              </h3>

                              <p className="text-xs text-on-surface-variant/70 font-label uppercase tracking-wider mb-4">
                                {t.settings?.stage_1?.type === "groups"
                                  ? "Fase de Grupos"
                                  : "Eliminatória"}
                              </p>
                            </div>

                            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                              <span className="font-mono text-xs text-on-surface-variant/60">
                                {t.start_date
                                  ? new Date(t.start_date).toLocaleDateString(undefined, {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "Data a definir"}
                              </span>
                              <Link
                                href={`/tournament/${t.id}`}
                                className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform"
                              >
                                Ver Torneio
                                <span className="material-symbols-outlined text-[16px]">
                                  arrow_forward
                                </span>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
              <span className="text-xs font-label text-on-surface-variant/60 font-bold uppercase tracking-wider">
                Página {safePage} de {totalPages}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-on-surface transition-all cursor-pointer border border-white/5"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-on-surface transition-all cursor-pointer border border-white/5"
                >
                  Seguinte
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Authentication Modal (Preserved for full compatibility with tests & auth flow) */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 max-w-md w-full relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={closeAuthModal}
              className="absolute top-6 right-6 text-on-surface-variant/50 hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="text-center mb-8">
              <h2 className="font-headline text-3xl font-black uppercase tracking-tight text-on-surface">
                {authModal === "signup" ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant/60 mt-1">
                {authModal === "signup"
                  ? "Join Kinetic Vault ScoreBoard"
                  : "Sign in to manage your events"}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authModal === "signup" && (
                <div>
                  <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-2xl border border-outline-variant/10 outline-none focus:border-primary transition-colors text-sm font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-2xl border border-outline-variant/10 outline-none focus:border-primary transition-colors text-sm font-medium"
                />
              </div>

              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-2xl border border-outline-variant/10 outline-none focus:border-primary transition-colors text-sm font-medium"
                />
              </div>

              {authModal === "signup" && (
                <div>
                  <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-2xl border border-outline-variant/10 outline-none focus:border-primary transition-colors text-sm font-medium"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-on-primary py-3.5 rounded-2xl font-label text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-primary/20 mt-2"
              >
                {isSubmitting
                  ? "Processing..."
                  : authModal === "signup"
                  ? "Sign Up"
                  : "Sign In"}
              </button>
            </form>

            <div className="mt-6 text-center">
              {authModal === "signup" ? (
                <p className="text-xs text-on-surface-variant">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModal("login");
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("auth", "login");
                      router.replace(window.location.pathname + "?" + params.toString());
                    }}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-xs text-on-surface-variant">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModal("signup");
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("auth", "signup");
                      router.replace(window.location.pathname + "?" + params.toString());
                    }}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Sign up
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
