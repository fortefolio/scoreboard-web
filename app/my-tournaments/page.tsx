"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import SelectField from "@/components/SelectField";
import { TournamentListSkeleton } from "@/components/Skeleton";
import { SUPPORTED_SPORTS } from "@/lib/sports";
import UpgradeModal from "@/components/subscription/UpgradeModal";
import SportIcon from "@/components/SportIcon";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import { getTournamentColumns } from "@/components/entityTableColumns";
import { MyWorkspaceTabs } from "@/components/MyWorkspaceTabs";
import { WorkspaceControlsBar, filterAndSortTournaments } from "@/components/WorkspaceControlsBar";
import MatchAtmosphereBackground from "@/components/match/MatchAtmosphereBackground";

export default function MyTournamentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-20" />}>
      <MyTournamentsContent />
    </Suspense>
  );
}

function MyTournamentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, supabase } = useAuth();
  const { t: tr, locale } = useTranslation();
  const isPt = locale === "pt";
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredTournaments = useMemo(
    () =>
      filterAndSortTournaments(tournaments, {
        sportFilter,
        statusFilter,
        searchQuery,
        dateSort,
      }),
    [tournaments, sportFilter, statusFilter, searchQuery, dateSort]
  );

  const TOURNAMENTS_PER_PAGE = 9;
  const totalPages = Math.max(1, Math.ceil(filteredTournaments.length / TOURNAMENTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTournaments = useMemo(() => {
    const start = (safePage - 1) * TOURNAMENTS_PER_PAGE;
    return filteredTournaments.slice(start, start + TOURNAMENTS_PER_PAGE);
  }, [filteredTournaments, safePage]);

  const clearFilters = () => {
    setSearchQuery("");
    setSportFilter("all");
    setStatusFilter("all");
    setDateSort("desc");
    setCurrentPage(1);
  };

  const [showModal, setShowModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [tierLoaded, setTierLoaded] = useState(false);
  const hasHandledCreateParam = useRef(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("Tennis");
  const [stage1Type, setStage1Type] = useState<'bracket' | 'groups' | 'double_elimination'>('bracket');
  const [maxTeams, setMaxTeams] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');

  const resetForm = () => {
    setNewName("");
    setNewSport("Tennis");
    setStage1Type("bracket");
    setMaxTeams("");
    setStartDate("");
    setEndDate("");
    setVisibility("public");
  };

  const fetchTournaments = useCallback(async (userId: string) => {
    setLoading(true);
    const [tRes, uRes] = await Promise.all([
      supabase
        .from("tournaments")
        .select("*")
        .eq("organizer_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("subscription_tier")
        .eq("id", userId)
        .maybeSingle()
    ]);

    if (tRes.data) setTournaments(tRes.data);
    if (uRes.data?.subscription_tier) setSubscriptionTier(uRes.data.subscription_tier);
    setTierLoaded(true);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTournaments(user.id);
  }, [user, fetchTournaments]);

  const handleOpenCreate = useCallback(() => {
    if (!user) {
      toast.error("Please log in to create an event.");
      return;
    }
    if (subscriptionTier !== "pro") {
      setShowModal(false);
      setShowUpgradeModal(true);
    } else {
      setShowUpgradeModal(false);
      setShowModal(true);
    }
  }, [user, subscriptionTier]);

  useEffect(() => {
    if (searchParams.get("create") === "true" && user && tierLoaded && !hasHandledCreateParam.current) {
      hasHandledCreateParam.current = true;
      handleOpenCreate();
    }
  }, [searchParams, user, tierLoaded, handleOpenCreate]);

  const handleCreate = async () => {
    if (!user) {
      toast.error("Authentication required. Please wait for the page to finish loading.");
      return;
    }
    if (subscriptionTier !== "pro") {
      setShowModal(false);
      setShowUpgradeModal(true);
      return;
    }
    if (!newName.trim()) {
      toast.error("Please enter a tournament name");
      return;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("Tournament Start Date cannot be after the End Date.");
      return;
    }

    const defaultSettings: any = {};
    if (newSport === 'Tennis' || newSport === 'Volleyball' || newSport === 'Beach Volleyball' || newSport === 'Padel') {
      defaultSettings.max_sets = 3;
    }
    if (newSport === 'Padel') {
      defaultSettings.points_per_set = 6;
      defaultSettings.set_type = 'tiebreak';
      defaultSettings.no_ad = true;
    }
    if (newSport === 'Volleyball') {
      defaultSettings.points_per_set = 25;
      defaultSettings.deciding_set_points = 15;
    }
    if (newSport === 'Beach Volleyball') {
      defaultSettings.points_per_set = 21;
      defaultSettings.deciding_set_points = 15;
    }
    if (newSport === 'Football') {
      defaultSettings.duration = 90;
      defaultSettings.format = 'halves';
    }

    const settings = {
      max_teams: maxTeams || 16,
      default: defaultSettings,
      stage_1: {
        type: stage1Type,
        ...(stage1Type === 'groups' && { 
          advance_per_group: 2,
          advance_best_thirds: 0 
        })
      }
    };

    const { data, error } = await supabase.from("tournaments").insert({
      name: newName.trim(),
      sport_type: newSport,
      organizer_id: user.id,
      status: "pending",
      settings: settings,
      start_date: startDate || null,
      end_date: endDate || null,
      visibility: visibility
    }).select("id").single();

    if (!error && data?.id) {
      toast.success("Tournament created successfully!");
      resetForm();
      setShowModal(false);
      router.push(`/tournament/${data.id}`);
    } else {
      toast.error(`Error creating tournament: ${error?.message || "Unknown error"}`);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-background text-on-background p-8 pt-24 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-text-muted">Loading your events...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative min-h-screen bg-transparent text-on-background">
      {/* ATMOSPHERE BACKGROUND */}
      <MatchAtmosphereBackground
        sportType={sportFilter !== "all" ? sportFilter : "random"}
        mode="spectator"
      />

      <div className="relative z-10 px-4 py-3 sm:p-6 max-w-7xl mx-auto">
        <MyWorkspaceTabs active="tournaments" />

        <WorkspaceControlsBar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          searchPlaceholder={
            isPt ? "Pesquisar torneios..." : "Search tournaments..."
          }
          sportFilter={sportFilter}
          onSportChange={(val) => {
            setSportFilter(val);
            setCurrentPage(1);
          }}
          statusFilter={statusFilter}
          onStatusChange={(val) => {
            setStatusFilter(val);
            setCurrentPage(1);
          }}
          dateSort={dateSort}
          onDateSortChange={(val) => {
            setDateSort(val);
            setCurrentPage(1);
          }}
          onClearFilters={clearFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          newAction={{
            label: tr("common.newTournament"),
            onClick: handleOpenCreate,
          }}
        />

      {loading ? (
        <TournamentListSkeleton />
      ) : filteredTournaments.length === 0 ? (
        <div 
          onClick={handleOpenCreate}
          className="border border-dashed border-outline-variant rounded-2xl p-16 flex flex-col items-center justify-center text-center bg-surface-container hover:border-outline-focus transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-4xl mb-3 text-text-muted opacity-40">emoji_events</span>
          <p className="font-semibold text-sm text-text-primary mb-1">No tournaments found</p>
          <p className="text-xs text-text-muted mb-4 max-w-sm">Click here to create and manage your first competition.</p>
          <span className="px-3.5 py-1.5 rounded-lg bg-surface-container-high text-text-primary text-xs font-medium border border-outline-variant">
            Create Tournament
          </span>
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedTournaments.map((t) => (
                <div 
                  key={t.id} 
                  className="bg-surface-container p-6 rounded-xl border border-outline-variant hover:border-outline-focus transition-colors flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <SportIcon sport={t.sport_type} className="text-text-muted text-[16px]" />
                        <span className="text-xs font-medium text-text-muted">{getSportTranslation(t.sport_type, tr)}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        t.status === 'completed'
                          ? 'bg-surface-container-high text-text-muted border-outline-variant'
                          : t.status === 'ongoing'
                          ? 'bg-surface-container-high text-text-primary border-outline-variant inline-flex items-center gap-1.5'
                          : 'bg-surface-container-high text-text-secondary border-outline-variant'
                      }`}>
                        {t.status === 'ongoing' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                        {t.status === 'completed' ? tr("status.completed") : t.status === 'ongoing' ? tr("status.live") : tr("status.scheduled")}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors leading-snug mb-2">
                      {t.name}
                    </h3>

                    <p className="text-xs text-text-muted">
                      {t.settings?.stage_1?.type === "groups"
                        ? tr("tournament.groupStage")
                        : t.settings?.stage_1?.type === "double_elimination"
                        ? tr("tournament.doubleElimination")
                        : tr("tournament.singleElimination")} • {t.settings?.max_teams || 16} teams
                    </p>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-outline-variant flex items-center justify-between">
                    <span className="font-mono text-xs text-text-muted">
                      {t.start_date
                        ? new Date(t.start_date).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : tr("home.tbdDate")}
                    </span>
                    <Link 
                      href={`/tournament/${t.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View Dashboard
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop & Mobile Data Table */
            <DataTable
              data={paginatedTournaments}
              columns={getTournamentColumns(tr, [], { showOrganizer: false })}
              getRowKey={(tItem) => tItem.id}
              onRowClick={(tItem) => router.push(`/tournament/${tItem.id}`)}
              hideOnMobile={false}
            />
          )}

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}

      {/* UPGRADE / PAYWALL MODAL */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={() => {
          setSubscriptionTier("pro");
          setShowModal(true);
        }}
      />

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 max-w-lg w-full border border-outline-variant shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary">{tr("common.newTournament")}</h2>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowModal(false);
                }}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {isPt ? "Nome do Torneio" : "Tournament Name"}
                </label>
                <input 
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors" 
                  placeholder={isPt ? "ex: Open de Verão 2026" : "e.g. Summer Open 2026"}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    {isPt ? "Modalidade" : "Sport Type"}
                  </label>
                  <SelectField
                    value={newSport}
                    onChange={setNewSport}
                    options={SUPPORTED_SPORTS.map((s) => ({
                      value: s.value,
                      label: getSportTranslation(s.value, tr),
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    {isPt ? "Formato Inicial" : "Initial Format"}
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={stage1Type}
                    onChange={(e) => setStage1Type(e.target.value as any)}
                  >
                    <option value="bracket">{isPt ? "Eliminação Direta (Quadro)" : "Single Elimination (Bracket)"}</option>
                    <option value="double_elimination">{isPt ? "Dupla Eliminação" : "Double Elimination"}</option>
                    <option value="groups">{isPt ? "Grupos + Playoffs" : "Groups + Playoffs"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {isPt ? "Máximo de Equipas" : "Max Teams"}
                </label>
                <input 
                  type="number" 
                  value={maxTeams} 
                  onChange={(e) => setMaxTeams(e.target.value === "" ? "" : parseInt(e.target.value))}
                  placeholder="16"
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs font-mono tabular-nums outline-none focus:border-outline-focus transition-colors"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    {isPt ? "Data de Início" : "Start Date"}
                  </label>
                  <input 
                    type="date"
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    {isPt ? "Data de Fim" : "End Date"}
                  </label>
                  <input 
                    type="date"
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {isPt ? "Visibilidade do Torneio" : "Tournament Visibility"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "public", label: isPt ? "Público" : "Public" },
                      { value: "unlisted", label: isPt ? "Não Listado" : "Unlisted" },
                      { value: "private", label: isPt ? "Privado" : "Private" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVisibility(opt.value)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        visibility === opt.value
                          ? "bg-surface-container-high text-text-primary border-text-primary/40"
                          : "bg-surface-container text-text-muted border-outline-variant hover:text-text-secondary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  {visibility === 'public'
                    ? (isPt ? 'Visível para todos na página inicial' : 'Visible to everyone on the landing page')
                    : visibility === 'unlisted'
                    ? (isPt ? 'Oculto da página inicial; acessível via link direto' : 'Hidden from landing page; accessible via direct link')
                    : (isPt ? 'Visível apenas para si (organizador)' : 'Only visible to you (organizer)')}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-outline-variant">
                <button 
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowModal(false);
                  }} 
                  className="px-4 py-2 rounded-lg text-text-muted hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
                >
                  {tr("common.cancel")}
                </button>
                <button 
                  type="button"
                  onClick={handleCreate} 
                  className="px-4 py-2 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest text-xs font-medium transition-colors cursor-pointer shadow-sm"
                >
                  {isPt ? "Criar Torneio" : "Create Tournament"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
