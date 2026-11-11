"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import MatchCard from "@/components/MatchCard";
import MatchListItem from "@/components/MatchListItem";
import SportIcon from "@/components/SportIcon";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";

function MyMatchesContent() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const { t } = useTranslation();
  const [matches, setMatches] = useState<any[]>([]);
  const [userTournaments, setUserTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");

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
      <div className="min-h-screen bg-background text-on-background p-8 pt-24 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-text-muted">Initializing account...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-on-background p-4 sm:p-8 pt-20 sm:pt-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
            My Matches
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Matches assigned to you for scoring or participation.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Mode Toggle (Defaults to list) */}
          <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title={t("common.viewList")}
              className={`p-1.5 rounded-md transition-colors flex items-center cursor-pointer ${
                viewMode === "list"
                  ? "bg-surface-container-highest text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title={t("common.viewCards")}
              className={`p-1.5 rounded-md transition-colors flex items-center cursor-pointer ${
                viewMode === "cards"
                  ? "bg-surface-container-highest text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
          </div>

          <button 
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Match
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-text-muted text-xs">Loading matches...</p>
        </div>
      ) : matches.length === 0 ? (
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
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {matches.map((match) => (
            <div key={match.id} className="relative group/card flex justify-center">
              <MatchCard match={match} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Mobile List View */}
          <div className="md:hidden divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container overflow-hidden">
            {matches.map((match) => (
              <MatchListItem key={match.id} match={match} />
            ))}
          </div>

          {/* Desktop Data Table View */}
          <div className="hidden md:block w-full bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-outline-variant bg-surface-container-high/60 text-[11px] font-medium text-text-muted">
                  <tr>
                    <th className="py-3 px-6">{t("common.match")}</th>
                    <th className="py-3 px-4">{t("common.sport")}</th>
                    <th className="py-3 px-4">{t("common.tournament")}</th>
                    <th className="py-3 px-4 text-center">{t("common.status")}</th>
                    <th className="py-3 px-6 text-right font-mono">{t("common.score")}</th>
                    <th className="py-3 px-4 text-right">{t("common.date")}</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-sm font-sans">
                  {matches.map((m) => {
                    const rawSetData = extractSetsData(m.scores);
                    const isTimedOrPointsSport = m.sport_type === "Football" || m.sport_type === "Basketball";
                    const setsWon0 = countSetsWon(rawSetData, 0);
                    const setsWon1 = countSetsWon(rawSetData, 1);
                    const mainScore0 = m.sport_type === "Football"
                      ? (m.scores?.football?.goals?.[0] ?? m.scores?.goals?.[0] ?? m.scores?.current?.home ?? 0)
                      : m.sport_type === "Basketball"
                      ? (m.scores?.basketball?.total_points?.[0] ?? m.scores?.total_points?.[0] ?? m.scores?.current?.home ?? 0)
                      : setsWon0;
                    const mainScore1 = m.sport_type === "Football"
                      ? (m.scores?.football?.goals?.[1] ?? m.scores?.goals?.[1] ?? m.scores?.current?.away ?? 0)
                      : m.sport_type === "Basketball"
                      ? (m.scores?.basketball?.total_points?.[1] ?? m.scores?.total_points?.[1] ?? m.scores?.current?.away ?? 0)
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
                        onClick={() => router.push(`/match/${m.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/match/${m.id}`);
                          }
                        }}
                        className="hover:bg-surface-container-high/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-6">
                          <div className="font-medium text-sm text-text-primary group-hover:text-primary transition-colors flex items-center gap-2">
                            <span>{m.participants?.[0]?.name || "TBD"}</span>
                            <span className="text-text-muted text-xs font-normal">vs</span>
                            <span>{m.participants?.[1]?.name || "TBD"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <SportIcon sport={m.sport_type} className="text-text-muted text-[16px]" />
                            <span>{getSportTranslation(m.sport_type, t)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-text-muted">
                          {m.tournaments?.name || "-"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              m.status === "completed"
                                ? "bg-surface-container-high text-text-muted border-outline-variant"
                                : m.status === "ongoing"
                                ? "bg-surface-container-high text-success border-success/30"
                                : "bg-surface-container-high text-text-secondary border-outline-variant"
                            }`}
                          >
                            {m.status === "ongoing" && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                            <span>{getStatusTranslation(m.status)}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <div className="inline-flex flex-col items-end">
                            <span className="font-mono tabular-nums text-sm font-semibold text-text-primary">
                              {mainScore0} - {mainScore1}
                            </span>
                            {!isTimedOrPointsSport && setScores.length > 0 && (
                              <span className="font-mono tabular-nums text-[11px] text-text-muted">
                                ({setScores.map((s: any) => `${s.t1}-${s.t2}`).join(", ")})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs text-text-muted">
                          {m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "-"}
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
  );
}

export default function MyMatchesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-text-muted text-xs">Loading matches...</p>
      </div>
    }>
      <MyMatchesContent />
    </Suspense>
  );
}
