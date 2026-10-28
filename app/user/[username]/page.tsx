"use client";

import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import MatchCard from "@/components/MatchCard";
import SportIcon from "@/components/SportIcon";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";

const MATCHES_PER_PAGE = 12;
const TOURNAMENTS_PER_PAGE = 9;

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = use(params);
  const rawParam = decodeURIComponent(resolvedParams.username || "");
  const router = useRouter();
  const { supabase } = useAuth();

  const [targetUser, setTargetUser] = useState<any>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Tab & View Controls (Defaults: matches active, list view)
  const [activeTab, setActiveTab] = useState<"tournaments" | "matches">("matches");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");

  // Filter & Sort State
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    async function loadUserData() {
      if (!rawParam) return;
      setLoading(true);
      setNotFound(false);

      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawParam);
        let userQuery = supabase
          .from("users")
          .select("id, username, subscription_tier, created_at");

        if (isUuid) {
          userQuery = userQuery.or(`id.eq.${rawParam},username.ilike.${rawParam}`);
        } else {
          userQuery = userQuery.ilike("username", rawParam);
        }

        const { data: userData, error: userErr } = await userQuery.maybeSingle();

        if (userErr || !userData) {
          const { data: fallbackUsers } = await supabase
            .from("users")
            .select("id, username, subscription_tier, created_at")
            .ilike("username", `${rawParam}%`)
            .limit(1);

          if (fallbackUsers && fallbackUsers.length > 0) {
            await fetchContent(fallbackUsers[0]);
          } else {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        await fetchContent(userData);
      } catch (err) {
        console.error("Error loading user profile:", err);
        setNotFound(true);
        setLoading(false);
      }
    }

    async function fetchContent(u: any) {
      setTargetUser(u);

      // Tournaments
      const { data: tData } = await supabase
        .from("tournaments")
        .select("*")
        .eq("organizer_id", u.id)
        .order("created_at", { ascending: false });

      if (tData) setTournaments(tData);

      // Matches
      const { data: mData } = await supabase
        .from("matches")
        .select("*, tournaments(name)")
        .eq("organizer_id", u.id)
        .order("created_at", { ascending: false });

      if (mData) {
        setMatches(mData);
      }

      setLoading(false);
    }

    loadUserData();
  }, [rawParam, supabase]);

  // Reset page when tab changes
  const handleTabChange = (tab: "tournaments" | "matches") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSportFilter("all");
    setStatusFilter("all");
    setDateSort("desc");
    setCurrentPage(1);
  };

  // Filter & Sort Matches
  const filteredMatches = useMemo(() => {
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

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_at || a.created_at).getTime();
        const dateB = new Date(b.scheduled_at || b.created_at).getTime();
        return dateSort === "desc" ? dateB - dateA : dateA - dateB;
      });
  }, [matches, sportFilter, statusFilter, dateSort]);

  // Filter & Sort Tournaments
  const filteredTournaments = useMemo(() => {
    return tournaments
      .filter((t) => {
        if (sportFilter !== "all") {
          if (sportFilter === "Beach Volleyball") {
            if (t.sport_type !== "Beach Volleyball" && t.sport_type !== "beach_volleyball") {
              return false;
            }
          } else if (t.sport_type !== sportFilter) {
            return false;
          }
        }

        if (statusFilter !== "all") {
          if (statusFilter === "scheduled") {
            if (t.status !== "scheduled" && t.status !== "pending") return false;
          } else if (t.status !== statusFilter) {
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
  }, [tournaments, sportFilter, statusFilter, dateSort]);

  // Pagination Calculations
  const isMatchesTab = activeTab === "matches";
  const currentItemsTotal = isMatchesTab ? filteredMatches.length : filteredTournaments.length;
  const itemsPerPage = isMatchesTab ? MATCHES_PER_PAGE : TOURNAMENTS_PER_PAGE;
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

  const initials = useMemo(() => {
    const name = targetUser?.username || targetUser?.email || "?";
    return name.slice(0, 2).toUpperCase();
  }, [targetUser]);

  const displayName = targetUser?.username || (targetUser?.email ? targetUser.email.split("@")[0] : rawParam);

  return (
    <div className="min-h-screen bg-background text-on-surface py-8 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Top back navigation */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-xs font-label font-bold uppercase tracking-[0.2em] text-on-surface-variant/70 hover:text-primary transition-colors mb-8 group cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
          arrow_back
        </span>
        Voltar
      </button>

      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-on-surface-variant font-label uppercase tracking-widest text-xs">
            A carregar perfil de @{rawParam}...
          </p>
        </div>
      ) : notFound ? (
        <div className="bg-surface-container-low rounded-3xl p-12 text-center border border-white/5 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-on-surface-variant/60">
            <span className="material-symbols-outlined text-3xl">person_off</span>
          </div>
          <h2 className="font-headline font-black text-2xl mb-2 text-on-surface">
            Utilizador não encontrado
          </h2>
          <p className="text-on-surface-variant text-sm mb-6">
            Não foi possível encontrar nenhum utilizador correspondente a{" "}
            <span className="font-mono text-primary font-bold">@{rawParam}</span>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary-container text-on-primary-container px-6 py-3 rounded-full font-label text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all"
          >
            Ir para a Página Inicial
          </Link>
        </div>
      ) : (
        <>
          {/* User Profile Banner */}
          <div className="bg-surface-container-low rounded-[2.5rem] p-6 sm:p-10 border border-white/5 relative overflow-hidden mb-8 shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-3xl pointer-events-none rounded-full" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-surface-container-high border-2 border-primary/40 flex items-center justify-center shadow-xl shadow-primary/10 shrink-0">
                  <span className="font-headline font-black text-2xl sm:text-3xl text-on-surface">
                    {initials}
                  </span>
                </div>

                {/* Name & Badges */}
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="font-headline font-black text-2xl sm:text-4xl text-on-surface tracking-tight">
                      @{displayName}
                    </h1>
                    <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label text-[10px] font-black uppercase tracking-widest">
                      {targetUser.subscription_tier === "pro" ? "Pro Organizer" : "Organizador"}
                    </span>
                  </div>
                  {targetUser.created_at && (
                    <p className="text-on-surface-variant/60 font-label text-[11px] mt-1.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      Membro desde {new Date(targetUser.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>

              {/* Counters */}
              <div className="flex items-center gap-4 sm:gap-6 bg-surface-container/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5 shrink-0 self-start sm:self-auto">
                <div className="text-center">
                  <div className="font-mono text-2xl font-black text-secondary">
                    {tournaments.length}
                  </div>
                  <div className="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                    Torneios
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <div className="font-mono text-2xl font-black text-primary">
                    {matches.length}
                  </div>
                  <div className="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                    Jogos
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <button
              onClick={() => handleTabChange("matches")}
              className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
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
              className={`px-5 py-2.5 rounded-full font-label text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "tournaments"
                  ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
                  : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">emoji_events</span>
              Torneios ({tournaments.length})
            </button>
          </div>

          {/* Filter, Sort & View Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 bg-surface-container-low p-4 rounded-2xl border border-white/5 shadow-lg">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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

              {/* Clear filters button if active */}
              {(sportFilter !== "all" || statusFilter !== "all" || dateSort !== "desc") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[10px] font-label font-bold uppercase tracking-wider text-primary hover:underline cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* View Mode Toggle (List vs Cards) for Tournaments & Matches */}
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

          {/* TAB 1: Tournaments */}
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
                  {(sportFilter !== "all" || statusFilter !== "all") && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-primary transition-all"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                /* Tournaments Cards Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedTournaments.map((t) => (
                    <div
                      key={t.id}
                      className="bg-surface-container-low p-6 rounded-3xl border border-white/5 hover:border-primary/40 transition-all duration-300 group shadow-xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <SportIcon sport={t.sport_type} className="text-primary text-[16px]" />
                            <span className="text-secondary font-label text-[10px] font-black uppercase tracking-[0.2em]">
                              {t.sport_type}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              t.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : t.status === "ongoing"
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>

                        <h3 className="font-headline font-bold text-xl text-on-surface group-hover:text-primary transition-colors leading-tight mb-2">
                          {t.name}
                        </h3>

                        {t.start_date && (
                          <p className="text-on-surface-variant/60 font-label text-[10px] uppercase tracking-wider mb-4">
                            Início: {new Date(t.start_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5">
                        <Link
                          href={`/tournament/${t.id}`}
                          className="w-full inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container py-3 rounded-full font-label text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all shadow-md shadow-primary/20"
                        >
                          Ver Torneio
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Tournaments List Table View */
                <div className="bg-surface-container-low rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="border-b border-white/5 bg-surface-container/50 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                        <tr>
                          <th className="py-3.5 px-5">Torneio</th>
                          <th className="py-3.5 px-4">Desporto</th>
                          <th className="py-3.5 px-4">Formato</th>
                          <th className="py-3.5 px-4 text-center">Estado</th>
                          <th className="py-3.5 px-5 text-right">Data de Início</th>
                          <th className="py-3.5 px-5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm font-body">
                        {paginatedTournaments.map((t) => (
                          <tr
                            key={t.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* Torneio */}
                            <td className="py-4 px-5">
                              <div className="font-headline font-bold text-on-surface text-sm leading-snug group-hover:text-primary transition-colors">
                                {t.name}
                              </div>
                            </td>

                            {/* Desporto */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <SportIcon sport={t.sport_type} className="text-primary text-[18px] shrink-0" />
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
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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

          {/* TAB 2: Matches */}
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
                  {(sportFilter !== "all" || statusFilter !== "all") && (
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
                          const isTimedOrPointsSport = m.sport_type === "Football" || m.sport_type === "Basketball";
                          const setsWon0 = countSetsWon(rawSetData, 0);
                          const setsWon1 = countSetsWon(rawSetData, 1);
                          const mainScore0 = isTimedOrPointsSport ? (m.scores?.current?.home ?? 0) : setsWon0;
                          const mainScore1 = isTimedOrPointsSport ? (m.scores?.current?.away ?? 0) : setsWon1;

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
                                  <SportIcon sport={m.sport_type} className="text-primary text-[18px] shrink-0" />
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
                                        .filter((q: any) => (q.home ?? 0) > 0 || (q.away ?? 0) > 0)
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
                                  {m.status === "ongoing" && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                                  )}
                                  {m.status === "completed"
                                    ? "Final"
                                    : m.status === "ongoing"
                                    ? "Live"
                                    : "Agendado"}
                                </span>
                              </td>

                              {/* Date */}
                              <td className="py-4 px-5 text-right font-mono text-xs text-on-surface-variant/70">
                                {new Date(m.scheduled_at || m.created_at).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>

                              {/* Action */}
                              <td className="py-4 px-5 text-right">
                                <Link
                                  href={`/match/${m.id}`}
                                  title="Ver Jogo"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container/20 hover:bg-primary-container text-primary hover:text-on-primary-container transition-all cursor-pointer border border-primary/20"
                                >
                                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8 pt-6 border-t border-white/5">
              <p className="text-xs font-label text-on-surface-variant/60">
                A mostrar{" "}
                <span className="font-bold text-on-surface">
                  {(safePage - 1) * itemsPerPage + 1}
                </span>{" "}
                a{" "}
                <span className="font-bold text-on-surface">
                  {Math.min(safePage * itemsPerPage, currentItemsTotal)}
                </span>{" "}
                de <span className="font-bold text-on-surface">{currentItemsTotal}</span> {isMatchesTab ? "jogos" : "torneios"}
              </p>

              <div className="flex items-center gap-1 self-center sm:self-auto">
                {/* Previous Button */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  Anterior
                </button>

                {/* Page Number Buttons */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return p === 1 || p === totalPages || Math.abs(p - safePage) <= 1;
                  })
                  .map((p, pIdx, arr) => {
                    const prevP = arr[pIdx - 1];
                    const hasGap = prevP && p - prevP > 1;

                    return (
                      <div key={p} className="flex items-center">
                        {hasGap && <span className="px-1 text-on-surface-variant/40 text-xs">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            safePage === p
                              ? "bg-primary text-on-primary shadow-md shadow-primary/20 font-black"
                              : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                          }`}
                        >
                          {p}
                        </button>
                      </div>
                    );
                  })}

                {/* Next Button */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1"
                >
                  Seguinte
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
