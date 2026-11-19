"use client";

import { useEffect, useState, useMemo, use, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import MatchCard from "@/components/MatchCard";
import MatchListItem from "@/components/MatchListItem";
import GroupedMatchList from "@/components/GroupedMatchList";
import SportIcon from "@/components/SportIcon";
import Pagination from "@/components/Pagination";
import DataTable from "@/components/DataTable";
import SelectField from "@/components/SelectField";
import { SUPPORTED_SPORTS } from "@/lib/sports";
import { getMatchColumns, getTournamentColumns } from "@/components/entityTableColumns";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

const MATCHES_PER_PAGE = 12;
const TOURNAMENTS_PER_PAGE = 9;

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <UserProfileContent params={params} />
    </Suspense>
  );
}

function UserProfileContent({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = use(params);
  const rawParam = decodeURIComponent(resolvedParams.username || "");
  const router = useRouter();
  const { supabase } = useAuth();
  const { t, locale } = useTranslation();

  const [targetUser, setTargetUser] = useState<any>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Tab & View Controls (Defaults: matches active, list view)
  const [activeTab, setActiveTab] = useState<"tournaments" | "matches">("matches");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState<string>("");
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
    setSearchQuery("");
    setSportFilter("all");
    setStatusFilter("all");
    setDateSort("desc");
    setCurrentPage(1);
  };

  // Filter & Sort Matches
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

        // Search filter
        if (query) {
          const p1 = (m.participants?.[0]?.name || "").toLowerCase();
          const p2 = (m.participants?.[1]?.name || "").toLowerCase();
          const tName = (m.tournaments?.name || "").toLowerCase();
          const sport = (m.sport_type || "").toLowerCase();
          if (!p1.includes(query) && !p2.includes(query) && !tName.includes(query) && !sport.includes(query)) {
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

  // Filter & Sort Tournaments
  const filteredTournaments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tournaments
      .filter((tItem) => {
        if (sportFilter !== "all") {
          if (sportFilter === "Beach Volleyball") {
            if (tItem.sport_type !== "Beach Volleyball" && tItem.sport_type !== "beach_volleyball") {
              return false;
            }
          } else if (tItem.sport_type !== sportFilter) {
            return false;
          }
        }

        if (statusFilter !== "all") {
          if (statusFilter === "scheduled") {
            if (tItem.status !== "scheduled" && tItem.status !== "pending") return false;
          } else if (tItem.status !== statusFilter) {
            return false;
          }
        }

        if (query) {
          const name = (tItem.name || "").toLowerCase();
          const sport = (tItem.sport_type || "").toLowerCase();
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

  const displayName = targetUser?.username || (targetUser?.email ? targetUser.email.split("@")[0] : rawParam);

  return (
    <div className="w-full min-h-screen bg-background text-text-primary py-3 sm:py-6 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Top back navigation */}
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={locale === "pt" ? "Voltar" : "Back"}
        title={locale === "pt" ? "Voltar" : "Back"}
        className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant text-text-secondary hover:text-text-primary inline-flex items-center justify-center transition-colors mb-3 sm:mb-5 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
      </button>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-text-muted text-xs">
            {locale === "pt" ? `A carregar perfil de @${rawParam}...` : `Loading @${rawParam}...`}
          </p>
        </div>
      ) : notFound ? (
        <div className="bg-surface-container rounded-xl p-12 text-center border border-outline-variant max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center mx-auto mb-4 text-text-muted">
            <span className="material-symbols-outlined text-2xl">person_off</span>
          </div>
          <h2 className="font-semibold text-lg mb-1.5 text-text-primary">
            {locale === "pt" ? "Utilizador não encontrado" : "User not found"}
          </h2>
          <p className="text-text-muted text-xs mb-5">
            {locale === "pt" ? "Não foi possível encontrar nenhum utilizador para " : "Could not find a user matching "}
            <span className="font-mono text-text-primary font-medium">@{rawParam}</span>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            {locale === "pt" ? "Ir para a Página Inicial" : "Back to Home"}
          </Link>
        </div>
      ) : (
        <>
          {/* User Profile Card */}
          <div className="bg-surface-container rounded-2xl p-4 sm:p-5 border border-outline-variant shadow-sm mb-4 sm:mb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="h-7 px-2.5 rounded-md bg-surface-container-high border border-outline-variant text-text-primary inline-flex items-center gap-1.5 text-xs font-medium"
                  title={`@${displayName}`}
                >
                  <span className="material-symbols-outlined text-[13px] leading-none text-text-muted">person</span>
                  <span className="leading-none">@{displayName}</span>
                </div>
                <span className="h-7 px-2.5 rounded-md bg-surface-container-high border border-outline-variant text-text-secondary text-[11px] font-medium inline-flex items-center">
                  {targetUser.subscription_tier === "pro"
                    ? "Pro"
                    : locale === "pt"
                    ? "Organizador"
                    : "Organizer"}
                </span>
              </div>

              {targetUser.created_at && (
                <p className="text-text-muted text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  {locale === "pt" ? "Membro desde" : "Member since"}{" "}
                  {new Date(targetUser.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="inline-flex items-center gap-1 bg-surface-container-high/50 p-1 rounded-xl border border-outline-variant mb-3.5 sm:mb-4">
            <button
              type="button"
              onClick={() => handleTabChange("matches")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "matches"
                  ? "bg-surface-container-highest text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t("home.matchesTab")} ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("tournaments")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "tournaments"
                  ? "bg-surface-container-highest text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t("home.tournamentsTab")} ({tournaments.length})
            </button>
          </div>

          {/* Precision Controls Toolbar (Search, Filters, Sort & View Toggle) */}
          <div className="relative z-20 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mb-6 bg-surface-container/70 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-outline-variant shadow-sm">
            {/* Search Box */}
            <div className="relative flex items-center w-full sm:w-64 md:w-80 lg:w-96 shrink-0">
              <span className="material-symbols-outlined absolute left-3.5 text-[17px] text-text-muted pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder={
                  locale === "pt"
                    ? "Pesquisar jogos ou torneios..."
                    : "Search matches or tournaments..."
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-surface-container-lowest text-text-primary text-xs sm:text-[13px] font-medium pl-10 pr-10 py-2 rounded-lg border border-outline-variant outline-none focus:border-text-secondary transition-colors placeholder:text-text-muted"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
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
            </div>

            {/* Dropdowns on left, View Toggle on right */}
            <div className="flex items-center justify-between sm:flex-1 gap-3">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
                <div className="hidden sm:block h-6 w-px bg-outline-variant/60 shrink-0" />

                <SelectField
                  variant="inline"
                  label={t("common.sport")}
                  value={sportFilter}
                  onChange={(val) => {
                    setSportFilter(val);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: "all", label: t("sports.all") },
                    ...SUPPORTED_SPORTS.map((s) => ({
                      value: s.value,
                      label: t(`sports.${s.i18nKey}`),
                    })),
                  ]}
                />

                <div className="hidden sm:block h-6 w-px bg-outline-variant/60 shrink-0" />

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
                    { value: "scheduled", label: t("status.scheduled") },
                    { value: "ongoing", label: t("status.ongoing") },
                    { value: "completed", label: t("status.completed") },
                  ]}
                />

                <div className="hidden sm:block h-6 w-px bg-outline-variant/60 shrink-0" />

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

              {/* View Mode Toggle (List vs Cards) */}
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

          {/* TAB 1: Tournaments */}
          {activeTab === "tournaments" && (
            <div>
              {filteredTournaments.length === 0 ? (
                <div className="bg-surface-container rounded-xl p-12 text-center border border-dashed border-outline-variant">
                  <span className="material-symbols-outlined text-3xl text-text-muted opacity-50 mb-3">
                    emoji_events
                  </span>
                  <h3 className="font-semibold text-sm text-text-primary mb-1">
                    {locale === "pt" ? "Nenhum torneio encontrado" : "No tournaments found"}
                  </h3>
                  <p className="text-text-muted text-xs mb-4">
                    {locale === "pt"
                      ? "Não existem torneios correspondentes aos filtros selecionados."
                      : "No tournaments match the selected filters."}
                  </p>
                  {(sportFilter !== "all" || statusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-medium text-text-primary border border-outline-variant transition-colors cursor-pointer"
                    >
                      {t("common.clearFilters")}
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedTournaments.map((tourn) => (
                    <Link
                      key={tourn.id}
                      href={`/tournament/${tourn.id}`}
                      className="w-full group block h-full"
                    >
                      <div className="bg-surface-container rounded-xl p-4 border border-outline-variant hover:border-outline hover:bg-surface-container-high/40 transition-colors flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-outline-variant/60 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <SportIcon
                                sport={tourn.sport_type}
                                className="text-text-muted group-hover:text-text-primary text-[15px] shrink-0 transition-colors"
                              />
                              <span className="text-xs font-medium text-text-secondary truncate">
                                {getSportTranslation(tourn.sport_type, t)}
                              </span>
                            </div>
                            {tourn.status === "ongoing" ? (
                              <span className="text-xs font-medium text-text-primary flex items-center gap-1.5 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {t("status.live")}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-text-muted shrink-0">
                                {tourn.status === "completed"
                                  ? t("status.completed")
                                  : t("status.scheduled")}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-semibold text-text-primary mb-1.5 leading-snug">
                            {tourn.name}
                          </h3>

                          <p className="text-xs text-text-muted mb-4">
                            {tourn.settings?.stage_1?.type === "groups"
                              ? t("tournament.groupStage")
                              : tourn.settings?.stage_1?.type === "double_elimination"
                              ? t("tournament.doubleElimination")
                              : t("tournament.singleElimination")}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                          <span className="font-mono tabular-nums text-xs text-text-muted">
                            {tourn.start_date
                              ? new Date(tourn.start_date).toLocaleDateString(undefined, {
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
                  columns={getTournamentColumns(t, [], { showOrganizer: false })}
                  getRowKey={(tItem) => tItem.id}
                  onRowClick={(tItem) => router.push(`/tournament/${tItem.id}`)}
                  hideOnMobile={false}
                />
              )}
            </div>
          )}

          {/* TAB 2: Matches */}
          {activeTab === "matches" && (
            <div>
              {filteredMatches.length === 0 ? (
                <div className="bg-surface-container rounded-xl p-12 text-center border border-dashed border-outline-variant">
                  <span className="material-symbols-outlined text-3xl text-text-muted opacity-50 mb-3">
                    sports
                  </span>
                  <h3 className="font-semibold text-sm text-text-primary mb-1">
                    {locale === "pt" ? "Nenhum jogo encontrado" : "No matches found"}
                  </h3>
                  <p className="text-text-muted text-xs mb-4">
                    {locale === "pt"
                      ? "Não existem jogos correspondentes aos filtros selecionados."
                      : "No matches match the selected filters."}
                  </p>
                  {(sportFilter !== "all" || statusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-medium text-text-primary border border-outline-variant transition-colors cursor-pointer"
                    >
                      {t("common.clearFilters")}
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              ) : (
                <GroupedMatchList matches={paginatedMatches} showOrganizer={false} />
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
    </div>
  );
}
