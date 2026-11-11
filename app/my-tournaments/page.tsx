"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import UpgradeModal from "@/components/subscription/UpgradeModal";
import SportIcon from "@/components/SportIcon";

export default function MyTournamentsPage() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const { t: tr } = useTranslation();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");

  const [showModal, setShowModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
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
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTournaments(user.id);
  }, [user, fetchTournaments]);

  const handleOpenCreate = () => {
    if (!user) {
      toast.error("Please log in to create an event.");
      return;
    }
    if (subscriptionTier !== "pro") {
      setShowUpgradeModal(true);
    } else {
      setShowModal(true);
    }
  };

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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-text-muted">Loading your events...</p>
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
            My Tournaments
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Manage your active events and create new competitions.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Mode Toggle (Defaults to list) */}
          <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title={tr("common.viewList")}
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
              title={tr("common.viewCards")}
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
            onClick={handleOpenCreate}
            className="px-3.5 py-2 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Tournament
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-text-muted text-xs">Loading tournaments...</p>
        </div>
      ) : tournaments.length === 0 ? (
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
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((t) => (
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
                      ? 'bg-surface-container-high text-success border-success/30'
                      : 'bg-surface-container-high text-text-secondary border-outline-variant'
                  }`}>
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
        <div className="w-full bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="border-b border-outline-variant bg-surface-container-high/60 text-[11px] font-medium text-text-muted">
                <tr>
                  <th className="py-3 px-6">{tr("common.event")}</th>
                  <th className="py-3 px-4">{tr("common.sport")}</th>
                  <th className="py-3 px-4">{tr("common.format")}</th>
                  <th className="py-3 px-4 text-center">{tr("common.status")}</th>
                  <th className="py-3 px-6 text-right">{tr("common.date")}</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm font-sans">
                {tournaments.map((tItem) => (
                  <tr
                    key={tItem.id}
                    onClick={() => router.push(`/tournament/${tItem.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/tournament/${tItem.id}`);
                      }
                    }}
                    className="hover:bg-surface-container-high/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-6">
                      <div className="font-medium text-sm text-text-primary group-hover:text-primary transition-colors">
                        {tItem.name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <SportIcon sport={tItem.sport_type} className="text-text-muted text-[16px]" />
                        <span>{getSportTranslation(tItem.sport_type, tr)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-muted">
                      {tItem.settings?.stage_1?.type === "groups"
                        ? tr("tournament.groupStage")
                        : tItem.settings?.stage_1?.type === "double_elimination"
                        ? tr("tournament.doubleElimination")
                        : tr("tournament.singleElimination")}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          tItem.status === "completed"
                            ? "bg-surface-container-high text-text-muted border-outline-variant"
                            : tItem.status === "ongoing"
                            ? "bg-surface-container-high text-success border-success/30"
                            : "bg-surface-container-high text-text-secondary border-outline-variant"
                        }`}
                      >
                        <span>{tItem.status === "completed" ? tr("status.completed") : tItem.status === "ongoing" ? tr("status.live") : tr("status.scheduled")}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs text-text-muted">
                      {tItem.start_date
                        ? new Date(tItem.start_date).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/tournament/${tItem.id}`}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-container-highest transition-colors inline-flex"
                        title="View Dashboard"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
              <h2 className="text-lg font-semibold text-text-primary">New Tournament</h2>
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
                <label className="block text-xs font-medium text-text-muted mb-1.5">Tournament Name</label>
                <input 
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors" 
                  placeholder="e.g. Summer Open 2026"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Sport Type</label>
                  <select 
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={newSport}
                    onChange={e => setNewSport(e.target.value)}
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
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Initial Format</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={stage1Type}
                    onChange={(e) => setStage1Type(e.target.value as any)}
                  >
                    <option value="bracket">Single Elimination (Bracket)</option>
                    <option value="double_elimination">Double Elimination</option>
                    <option value="groups">Groups + Playoffs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Max Teams</label>
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
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Start Date</label>
                  <input 
                    type="date"
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">End Date</label>
                  <input 
                    type="date"
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary text-xs outline-none focus:border-outline-focus transition-colors"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Tournament Visibility</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${visibility === 'public' ? 'bg-surface-container-high text-text-primary border-primary/50' : 'bg-surface-container text-text-muted border-outline-variant'}`}
                  >
                    Public
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVisibility('unlisted')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${visibility === 'unlisted' ? 'bg-surface-container-high text-text-primary border-primary/50' : 'bg-surface-container text-text-muted border-outline-variant'}`}
                  >
                    Unlisted
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${visibility === 'private' ? 'bg-surface-container-high text-text-primary border-primary/50' : 'bg-surface-container text-text-muted border-outline-variant'}`}
                  >
                    Private
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  {visibility === 'public'
                    ? 'Visible to everyone on the landing page'
                    : visibility === 'unlisted'
                    ? 'Hidden from landing page; accessible via direct link'
                    : 'Only visible to you (organizer)'}
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
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleCreate} 
                  className="px-4 py-2 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest text-xs font-medium transition-colors cursor-pointer shadow-sm"
                >
                  Create Tournament
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
