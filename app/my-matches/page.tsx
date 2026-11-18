"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import MatchCard from "@/components/MatchCard";
import MatchListItem from "@/components/MatchListItem";
import GroupedMatchList from "@/components/GroupedMatchList";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import { getMatchColumns } from "@/components/entityTableColumns";
import { MyWorkspaceTabs } from "@/components/MyWorkspaceTabs";
import { WorkspaceControlsBar, filterAndSortMatches } from "@/components/WorkspaceControlsBar";
import SportIcon from "@/components/SportIcon";
import ConfirmationModal from "@/components/ConfirmationModal";
import MatchAtmosphereBackground from "@/components/match/MatchAtmosphereBackground";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";

function MyMatchesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, supabase } = useAuth();
  const { t } = useTranslation();
  const [matches, setMatches] = useState<any[]>([]);
  const [userTournaments, setUserTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredMatches = useMemo(
    () =>
      filterAndSortMatches(matches, {
        sportFilter,
        statusFilter,
        searchQuery,
        dateSort,
      }),
    [matches, sportFilter, statusFilter, searchQuery, dateSort]
  );

  const MATCHES_PER_PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / MATCHES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMatches = useMemo(() => {
    const start = (safePage - 1) * MATCHES_PER_PAGE;
    return filteredMatches.slice(start, start + MATCHES_PER_PAGE);
  }, [filteredMatches, safePage]);

  const clearFilters = () => {
    setSearchQuery("");
    setSportFilter("all");
    setStatusFilter("all");
    setDateSort("desc");
    setCurrentPage(1);
  };

  const [showModal, setShowModal] = useState(false);
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [sportType, setSportType] = useState("Tennis");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchToDelete, setMatchToDelete] = useState<any | null>(null);

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
      .eq("organizer_id", userId)
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
    if (searchParams.get("create") === "true") {
      setShowModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    let channel: any = null;
    try {
      channel = supabase
        .channel(`my-matches-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches' },
          () => { fetchMyMatches(user.id); }
        );

      channel.subscribe((status: string, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.warn('[MyMatches] Realtime error:', err || status);
        }
      });
    } catch (err) {
      console.warn('[MyMatches] Realtime unavailable:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user, supabase, fetchMyMatches]);

  const handleCreateMatch = async () => {
    if (!user) {
      toast.error("You must be logged in to create a match");
      return;
    }
    if (!team1.trim() || !team2.trim()) {
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
        participants: [{ name: team1.trim() }, { name: team2.trim() }],
        tournament_id: selectedTournamentId || null,
        status: "scheduled",
        scheduled_at: finalDate,
      }).select();

      if (!error) {
        toast.success("Match created successfully!");
        setShowModal(false);
        setTeam1("");
        setTeam2("");
        setMatchDate("");
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

  const getStatusTranslation = (status: string) => {
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

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-background text-on-background p-8 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-text-muted">Initializing account...</p>
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
        <MyWorkspaceTabs active="matches" />

        <WorkspaceControlsBar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search matches or tournaments..."
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
            label: t("common.newMatch"),
            onClick: () => setShowModal(true),
          }}
        />

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-text-muted text-xs">Loading matches...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="border border-dashed border-outline-variant rounded-2xl p-16 flex flex-col items-center justify-center text-center bg-surface-container">
          <span className="material-symbols-outlined text-4xl mb-3 text-text-muted opacity-40">sports_tennis</span>
          <p className="font-semibold text-sm text-text-primary mb-1">No matches found</p>
          <p className="text-xs text-text-muted mb-4 max-w-sm">You haven't created or been assigned to any matches yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-text-primary text-xs font-medium border border-outline-variant transition-colors cursor-pointer"
          >
            Create Match
          </button>
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedMatches.map((match) => (
                <div key={match.id} className="relative group/card flex justify-center">
                  <MatchCard match={match} />
                </div>
              ))}
            </div>
          ) : (
            <GroupedMatchList
              matches={paginatedMatches}
              showOrganizer={false}
              extraColumns={[
                {
                  key: "action",
                  header: t("common.action"),
                  align: "center",
                  headerClassName: "w-24",
                  cellClassName: "w-24",
                  stopRowClick: true,
                  render: (m) => (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => router.push(`/match/${m.id}/scoreboard`)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors cursor-pointer"
                        title="Score Match"
                      >
                        <span className="material-symbols-outlined text-[16px]">scoreboard</span>
                      </button>
                      <button
                        onClick={() => setMatchToDelete(m)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                        title="Delete Match"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ),
                },
              ]}
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

      {/* CREATE MATCH MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 max-w-lg w-full border border-outline-variant shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary">New Match</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Team 1</label>
                  <input 
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors" 
                    placeholder="Team Alpha"
                    value={team1}
                    onChange={e => setTeam1(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Team 2</label>
                  <input 
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors" 
                    placeholder="Team Beta"
                    value={team2}
                    onChange={e => setTeam2(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Sport Type</label>
                  <select 
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={sportType}
                    onChange={e => setSportType(e.target.value)}
                  >
                    <option value="Tennis">Tennis</option>
                    <option value="Padel">Padel</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Beach Volleyball">Beach Volleyball</option>
                    <option value="Football">Football</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Tournament (Optional)</label>
                  <select 
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
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
                <label className="block text-xs font-medium text-text-muted mb-1.5">Match Date</label>
                <input 
                  type="datetime-local"
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                  value={matchDate}
                  onChange={e => setMatchDate(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-outline-variant">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 rounded-lg text-text-muted hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleCreateMatch} 
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-surface-container-lowest border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Create Match"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!matchToDelete}
        onClose={() => setMatchToDelete(null)}
        onConfirm={async () => {
          if (!matchToDelete) return;
          const { error } = await supabase.from("matches").delete().eq("id", matchToDelete.id);
          if (error) {
            toast.error("Failed to delete match: " + error.message);
          } else {
            toast.success("Match deleted successfully!");
            setMatches((prev) => prev.filter((m) => m.id !== matchToDelete.id));
          }
          setMatchToDelete(null);
        }}
        title="Delete Match"
        message="Are you sure you want to permanently delete this match? All recorded events and scores will be removed."
        confirmText="Delete Match"
        isDanger={true}
      />
      </div>
    </div>
  );
}

export default function MyMatchesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-text-muted text-xs">Loading matches...</p>
      </div>
    }>
      <MyMatchesContent />
    </Suspense>
  );
}
