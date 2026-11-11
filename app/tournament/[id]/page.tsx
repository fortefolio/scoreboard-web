"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import GroupStandingsView from "@/components/GroupStandingsView";
import GroupMatchesView from "@/components/GroupMatchesView";
import TournamentBracket from "@/components/TournamentBracket";
import ConfirmationModal from "@/components/ConfirmationModal";
import NotificationBell from "@/components/NotificationBell";
import { FollowButton } from "@/components/FollowButton";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

const DEFAULT_TEAMS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", 
  "Zeta", "Eta", "Theta", "Iota", "Kappa", 
  "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi"
];

function TournamentContent() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'standings' | 'group_matches' | 'bracket' | 'teams' | 'settings'>('teams');
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAMS);
  const [courts, setCourts] = useState<number>(1);
  const [maxTeams, setMaxTeams] = useState<number>(16);
  const [tStartDate, setTStartDate] = useState("");
  const [tEndDate, setTEndDate] = useState("");
  const [tVisibility, setTVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [signupFormConfig, setSignupFormConfig] = useState<any[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const tournamentId = Array.isArray(id) ? id[0] : id;

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/tournament/${tournamentId}?${params.toString()}`, { scroll: false });
  };

  // Sync activeTab with URL search params
  useEffect(() => {
    const tab = searchParams.get('tab') as any;
    if (tab && ['standings', 'group_matches', 'bracket', 'teams', 'settings'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (tournamentId) {
      loadTournament();

      // Real-time listener for signups
      let channel: any = null;
      try {
        channel = supabase
          .channel(`tournament-participants-${tournamentId}`)
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'tournament_participants',
              filter: `tournament_id=eq.${tournamentId}`
            }, 
            () => {
              loadParticipants();
            }
          );

        channel.subscribe();
      } catch (err) {
        console.warn('[TournamentPage] Realtime unavailable:', err);
      }

      return () => {
        if (channel) {
          try { supabase.removeChannel(channel); } catch {}
        }
      };
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();
    
    if (data) {
      setTournament(data);
      if (data.settings?.number_of_courts) {
        setCourts(data.settings.number_of_courts);
      }
      if (data.settings?.max_teams) {
        setMaxTeams(data.settings.max_teams);
      }
      if (data.start_date) setTStartDate(new Date(data.start_date).toISOString().split('T')[0]);
      if (data.end_date) setTEndDate(new Date(data.end_date).toISOString().split('T')[0]);
      if (data.visibility) setTVisibility(data.visibility);
      if (data.signup_schema) setSignupFormConfig(data.signup_schema);
      
      // Only set default tab if no tab is present in URL
      if (!searchParams.get('tab')) {
        if (data.status !== 'pending') {
          if (data.settings?.stage_1?.type === 'bracket' || data.settings?.stage_1?.type === 'double_elimination') {
            handleTabChange('bracket');
          } else {
            handleTabChange('standings');
          }
        }
      }
      loadParticipants(data.organizer_id);
    }
    setLoading(false);
  };

  const loadParticipants = async (organizerId?: string) => {
    const targetOrganizerId = organizerId ?? tournament?.organizer_id;
    let pData: any[] | null = null;

    if (user && targetOrganizerId && user.id === targetOrganizerId) {
      const { data: adminData, error: rpcError } = await supabase.rpc(
        "get_tournament_participants_admin",
        { p_tournament_id: tournamentId }
      );
      if (!rpcError && adminData) {
        pData = adminData;
      }
    }

    if (!pData) {
      const { data: publicData } = await supabase
        .from("tournament_participants")
        .select("id, name, seed, created_at")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true });
      pData = publicData;
    }

    if (pData) {
      setParticipants(pData);
      setTeamNames(pData.map((p: { name: string }) => p.name));
    }
  };

  const copySignupLink = () => {
    const url = `${window.location.origin}/tournament/${tournamentId}/signup`;
    navigator.clipboard.writeText(url);
    toast.success("Signup link copied to clipboard!");
  };

  const saveOverride = async (roundNum: number, sets: number, points: number, cap: number | null) => {
    if (!tournament) return;
    const newSettings = {
      ...tournament.settings,
      overrides: {
        ...(tournament.settings?.overrides || {}),
        [roundNum]: { max_sets: sets, points_per_set: points, point_cap: cap }
      }
    };

    const { error } = await supabase
      .from('tournaments')
      .update({ settings: newSettings })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings });
      toast.success(`Rules updated for Round ${roundNum}`);
    } else {
      toast.error(`Error updating rules: ${error.message}`);
    }
  };

  const saveGeneralSettings = async () => {
    if (!tournament) return;
    const newSettings = {
      ...tournament.settings,
      number_of_courts: courts,
      max_teams: maxTeams
    };

    const { error } = await supabase
      .from('tournaments')
      .update({ 
        settings: newSettings,
        start_date: tStartDate || null,
        end_date: tEndDate || null,
        visibility: tVisibility,
        signup_schema: signupFormConfig,
      })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings, start_date: tStartDate, end_date: tEndDate, visibility: tVisibility, signup_schema: signupFormConfig });
      toast.success("Tournament settings updated.");
    } else {
      toast.error(`Error updating settings: ${error.message}`);
    }
  };

  const saveRoundDate = async (key: string, date: string) => {
    if (!tournament) return;
    const newSettings = {
      ...tournament.settings,
      round_dates: {
        ...(tournament.settings?.round_dates || {}),
        [key]: date,
      },
    };

    const { error } = await supabase
      .from('tournaments')
      .update({ settings: newSettings })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings });
      toast.success(`Date updated for ${key}`);
    } else {
      toast.error(`Error updating round date: ${error.message}`);
    }
  };

  const handleDeleteTournament = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;

      toast.success("Tournament deleted successfully.");
      router.push("/");
    } catch (err: any) {
      toast.error(`Error deleting tournament: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTeamNameChange = (index: number, value: string) => {
    const newNames = [...teamNames];
    newNames[index] = value;
    setTeamNames(newNames);
  };

  const addTeam = () => {
    setTeamNames([...teamNames, `Team ${teamNames.length + 1}`]);
  };

  const removeTeam = (index: number) => {
    const newNames = teamNames.filter((_, i) => i !== index);
    setTeamNames(newNames);
  };

  const addSignupField = () => {
    const newField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      min: null,
      max: null,
      description: "",
      options: []
    };
    setSignupFormConfig([...signupFormConfig, newField]);
  };

  const updateSignupField = (id: string, updates: any) => {
    setSignupFormConfig(signupFormConfig.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeSignupField = (id: string) => {
    setSignupFormConfig(signupFormConfig.filter(f => f.id !== id));
  };

  const addOptionToField = (fieldId: string) => {
    setSignupFormConfig(signupFormConfig.map(f => {
      if (f.id === fieldId) {
        return { ...f, options: [...(f.options || []), ""] };
      }
      return f;
    }));
  };

  const updateOptionInField = (fieldId: string, optionIdx: number, value: string) => {
    setSignupFormConfig(signupFormConfig.map(f => {
      if (f.id === fieldId) {
        const newOptions = [...(f.options || [])];
        newOptions[optionIdx] = value;
        return { ...f, options: newOptions };
      }
      return f;
    }));
  };

  const removeOptionFromField = (fieldId: string, optionIdx: number) => {
    setSignupFormConfig(signupFormConfig.map(f => {
      if (f.id === fieldId) {
        const newOptions = (f.options || []).filter((_: any, i: number) => i !== optionIdx);
        return { ...f, options: newOptions };
      }
      return f;
    }));
  };

  const handleGenerateBracket = async () => {
    if (!tournament) return;
    setIsGenerating(true);
    try {
      // Only insert newly added manual teams; preserve existing registered participants and their PII/form responses
      const manualNewNames = teamNames
        .slice(participants.length)
        .map(name => name.trim())
        .filter(name => name !== "");

      if (manualNewNames.length > 0) {
        const participantsToInsert = manualNewNames.map(name => ({
          tournament_id: tournamentId,
          name
        }));
        const { error: insertError } = await supabase
          .from("tournament_participants")
          .insert(participantsToInsert);
        if (insertError) throw insertError;
      }

      const { error } = await supabase.functions.invoke("generate-tournament-bracket", {
        body: {
          tournament_id: tournament.id,
          organizer_id: tournament.organizer_id,
          sport_type: tournament.sport_type,
          teams: teamNames.filter(name => name.trim() !== ""),
          settings: tournament.settings
        }
      });
      if (error) throw error;
      
      toast.success("Bracket generated successfully!");
      await loadTournament();
    } catch (err: any) {
      toast.error(`Error generating bracket: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!tournamentId) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-on-surface-variant font-label tracking-widest uppercase text-xs">Loading Tournament Details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary selection:text-white">
      <main className="pt-8 pb-20 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto relative">
        <header className="mb-8 text-center animate-in fade-in duration-300">
          <p className="text-text-muted font-medium text-xs uppercase tracking-wider mb-2">
            {getSportTranslation(tournament?.sport_type, t)} {t("tournament.officialTournament")}
          </p>
          <h1 className="font-sans text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-text-primary leading-tight mb-3">
            {tournament?.name || "Tournament"}
          </h1>
          <div className="flex items-center justify-center gap-2.5">
             <span className="px-2.5 py-0.5 bg-surface-container rounded-md text-[11px] font-mono font-medium text-text-secondary border border-outline-variant">
                {t("tournament.idBadge")}: {tournamentId.slice(0,8)}
             </span>
             <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-outline-variant ${
                tournament?.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                tournament?.status === 'scheduled' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {tournament?.status}
             </span>
             <FollowButton entityId={tournamentId} entityType="tournament" variant="icon" className="w-7 h-7" />
          </div>
        </header>

        {/* Precision Telemetry Segmented Tab Bar */}
        <div className="flex justify-center mb-8 overflow-x-auto no-scrollbar max-w-full pb-2">
          <div className="bg-surface-container-low p-1 rounded-xl border border-outline-variant flex gap-1 shrink-0">
            <button 
              onClick={() => handleTabChange('teams')}
              className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'teams'
                  ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">groups</span>
              {t("tournament.teamsTab")}
            </button>
            {tournament?.settings?.stage_1?.type === 'groups' && tournament?.status !== 'pending' && (
              <>
                <button 
                  onClick={() => handleTabChange('standings')}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'standings'
                      ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">bar_chart</span>
                  {t("tournament.standingsTab")}
                </button>
                <button 
                  onClick={() => handleTabChange('group_matches')}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'group_matches'
                      ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">sports_tennis</span>
                  {t("tournament.matchesTab")}
                </button>
              </>
            )}
            {tournament?.status !== 'pending' && (
              <button 
                onClick={() => handleTabChange('bracket')}
                className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'bracket'
                    ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">account_tree</span>
                Bracket
              </button>
            )}
            <button 
              onClick={() => handleTabChange('settings')}
              className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">settings</span>
              {t("tournament.settingsTab")}
            </button>
          </div>
        </div>

        {/* View Content */}
        <div className="animate-in fade-in duration-300">
          {activeTab === 'teams' ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant relative">
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 pb-5 border-b border-outline-variant">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-1">Tournament Roster</h2>
                      <p className="text-text-muted text-xs sm:text-sm">Manage participating teams and players ({teamNames.length} / {maxTeams}).</p>
                    </div>
                    <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                      <button 
                        onClick={copySignupLink}
                        className="flex-1 sm:flex-initial justify-center bg-surface-container-high text-text-primary hover:bg-surface-container-highest px-4 py-2 rounded-lg font-medium text-xs transition-colors border border-outline-variant flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px] leading-none text-text-muted">share</span>
                        Share Signup Link
                      </button>
                      <button 
                        onClick={addTeam}
                        disabled={teamNames.length >= maxTeams}
                        className="flex-1 sm:flex-initial justify-center bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] leading-none">add</span>
                        {teamNames.length >= maxTeams ? 'Limit Reached' : 'Add Team'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {participants.map((p, idx) => (
                      <div key={p.id} className="relative group flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-text-muted">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="w-full pl-11 pr-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant text-text-primary font-medium text-sm flex items-center justify-between">
                            <span className="truncate">{p.name}</span>
                            <span className="ml-2 text-xs text-text-muted font-normal truncate max-w-[140px]">{p.contact_email}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedParticipant(p)}
                          className="w-10 h-10 rounded-xl bg-surface-container-high text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors flex items-center justify-center border border-outline-variant shrink-0"
                          title="View Participant Details"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">visibility</span>
                        </button>
                      </div>
                    ))}
                    {/* Fallback for empty slots if pending */}
                    {tournament.status === 'pending' && Array.from({ length: Math.max(0, teamNames.length - participants.length) }).map((_, idx) => (
                       <div key={`empty-${idx}`} className="relative group flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-text-muted">
                            {String(participants.length + idx + 1).padStart(2, '0')}
                          </span>
                          <input 
                            className="w-full pl-11 pr-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
                            placeholder={`Assign Team ${participants.length + idx + 1}`}
                            value={teamNames[participants.length + idx] || ""}
                            onChange={(e) => handleTeamNameChange(participants.length + idx, e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={() => removeTeam(participants.length + idx)}
                          className="w-10 h-10 rounded-xl bg-surface-container-high text-text-muted hover:text-error hover:bg-error/10 transition-colors flex items-center justify-center border border-outline-variant shrink-0"
                          title="Remove Team"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'standings' && tournament?.settings?.stage_1?.type === 'groups' ? (
            <div className="max-w-6xl mx-auto">
               <GroupStandingsView tournamentId={tournamentId} />
            </div>
          ) : activeTab === 'group_matches' && tournament?.settings?.stage_1?.type === 'groups' ? (
            <div className="max-w-6xl mx-auto">
               <GroupMatchesView tournamentId={tournamentId} tournament={tournament} onSaveOverride={saveOverride} onSaveScheduledDate={saveRoundDate} />
            </div>
          ) : activeTab === 'bracket' ? (
            <TournamentBracket tournamentId={tournamentId} tournamentFromParent={tournament} onSaveOverrideFromParent={saveOverride} onSaveScheduledDate={saveRoundDate} />
          ) : (
            <div className="w-full max-w-4xl mx-auto space-y-6">
              <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-6">Tournament Settings</h2>
                <div className="space-y-6">
                  <div className="p-5 sm:p-6 rounded-xl bg-surface-container-low border border-outline-variant">
                    <h3 className="text-sm font-semibold text-text-primary mb-5">General Configuration</h3>
                    <div className="space-y-5">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-text-secondary block mb-1.5">Tournament Start Date</label>
                          <input 
                            type="date"
                            className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-primary transition-colors"
                            value={tStartDate}
                            onChange={(e) => setTStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-secondary block mb-1.5">Tournament End Date</label>
                          <input 
                            type="date"
                            className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-primary transition-colors"
                            value={tEndDate}
                            onChange={(e) => setTEndDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-secondary block mb-1.5">Number of Available Courts</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="number"
                            min="1"
                            className="flex-1 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-primary transition-colors"
                            value={courts}
                            onChange={(e) => setCourts(parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-secondary block mb-1.5">Tournament Visibility</label>
                        <div className="flex bg-surface-container-high p-1 rounded-lg border border-outline-variant gap-1">
                          {(['public', 'unlisted', 'private'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setTVisibility(mode)}
                              className={`flex-1 py-2 rounded-md text-xs font-medium uppercase tracking-wider transition-colors ${
                                tVisibility === mode
                                  ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                                  : 'text-text-muted hover:text-text-primary'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-text-muted">
                          {tVisibility === 'public'
                            ? 'Visible to everyone on the landing page'
                            : tVisibility === 'unlisted'
                            ? 'Hidden from landing page; accessible via direct link'
                            : 'Only visible to you (organizer)'}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-secondary block mb-1.5">Maximum Number of Teams</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            min="1"
                            className="flex-1 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-primary transition-colors"
                            value={maxTeams}
                            onChange={(e) => setMaxTeams(parseInt(e.target.value) || 1)}
                          />
                          <button 
                            onClick={saveGeneralSettings}
                            className="bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2.5 rounded-lg font-medium text-xs transition-colors shrink-0 cursor-pointer"
                          >
                            Save Settings
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 rounded-xl bg-surface-container-low border border-outline-variant relative">
                    <div>
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-outline-variant">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-1">Signup Form Builder</h2>
                          <p className="text-text-muted text-xs sm:text-sm max-w-xl leading-relaxed">
                            Configure registration fields, required responses, and options for participants.
                          </p>
                        </div>
                        <button 
                          onClick={addSignupField}
                          className="bg-surface-container-high hover:bg-surface-container-highest text-text-primary px-3.5 py-2 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 border border-outline-variant active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[16px] leading-none text-text-muted">add</span>
                          Add Field
                        </button>
                      </div>

                      <div className="space-y-4">
                        {signupFormConfig.map((field) => (
                          <div key={field.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant group/field">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-text-muted border border-outline-variant">
                                  <span className="material-symbols-outlined text-sm">
                                    {field.type === 'text' ? 'text_fields' :
                                     field.type === 'number' ? '123' :
                                     field.type === 'select' ? 'list' :
                                     'check_box'}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="font-medium text-text-primary text-sm leading-none mb-1">{field.label || "Untitled Field"}</h4>
                                  <span className="text-[11px] text-text-muted">
                                    {field.type === 'text' ? 'Text Input Field' :
                                     field.type === 'number' ? 'Numeric Input Field' :
                                     field.type === 'select' ? 'Dropdown Select Field' :
                                     'Checkbox / Toggle Field'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-text-muted">Required</span>
                                  <button 
                                    type="button"
                                    onClick={() => updateSignupField(field.id, { required: !field.required })}
                                    className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${field.required ? 'bg-text-primary' : 'bg-surface-container-highest border border-outline-variant'}`}
                                  >
                                    <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${field.required ? 'left-4 bg-surface-container-lowest' : 'left-0.5 bg-text-muted'}`}></div>
                                  </button>
                                </div>
                                <button 
                                  onClick={() => removeSignupField(field.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                                  title="Remove Field"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                              <div className="lg:col-span-4">
                                <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Field Label</label>
                                <input 
                                  className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-primary transition-colors border border-outline-variant"
                                  placeholder="e.g. T-Shirt Size"
                                  value={field.label}
                                  onChange={(e) => updateSignupField(field.id, { label: e.target.value })}
                                />
                              </div>

                              <div className="lg:col-span-2">
                                <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Field Type</label>
                                <select
                                  className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-primary transition-colors border border-outline-variant"
                                  value={field.type}
                                  onChange={(e) => updateSignupField(field.id, { type: e.target.value })}
                                >
                                  <option value="text">Text</option>
                                  <option value="number">Number</option>
                                  <option value="select">Select</option>
                                  <option value="checkbox">Checkbox</option>
                                </select>
                              </div>

                              {field.type === 'text' && (
                                <div className="lg:col-span-6">
                                  <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Placeholder Text</label>
                                  <input 
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-primary transition-colors border border-outline-variant"
                                    placeholder="Enter placeholder..."
                                    value={field.placeholder || ""}
                                    onChange={(e) => updateSignupField(field.id, { placeholder: e.target.value })}
                                  />
                                </div>
                              )}

                              {field.type === 'number' && (
                                <>
                                  <div className="lg:col-span-3">
                                    <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Min</label>
                                    <input 
                                      type="number"
                                      className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-primary transition-colors border border-outline-variant"
                                      value={field.min || ""}
                                      onChange={(e) => updateSignupField(field.id, { min: parseInt(e.target.value) || null })}
                                    />
                                  </div>
                                  <div className="lg:col-span-3">
                                    <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Max</label>
                                    <input 
                                      type="number"
                                      className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-primary transition-colors border border-outline-variant"
                                      value={field.max || ""}
                                      onChange={(e) => updateSignupField(field.id, { max: parseInt(e.target.value) || null })}
                                    />
                                  </div>
                                </>
                              )}

                              {field.type === 'checkbox' && (
                                <div className="lg:col-span-6">
                                  <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Description / Subtext</label>
                                  <textarea 
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-primary transition-colors border border-outline-variant min-h-[64px] resize-none"
                                    placeholder="Check this box if your team will be attending..."
                                    value={field.description || ""}
                                    onChange={(e) => updateSignupField(field.id, { description: e.target.value })}
                                  />
                                </div>
                              )}

                              {field.type === 'select' && (
                                <div className="lg:col-span-12">
                                  <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Options</label>
                                  <div className="flex flex-wrap gap-2 p-3 bg-surface-container-high rounded-lg border border-outline-variant">
                                    {(field.options || []).map((opt: string, optIdx: number) => (
                                      <div key={optIdx} className="bg-surface-container px-3 py-1.5 rounded-md flex items-center gap-2 border border-outline-variant text-xs">
                                        <input 
                                          className="bg-transparent text-xs font-medium text-text-primary outline-none min-w-[70px]"
                                          value={opt}
                                          onChange={(e) => updateOptionInField(field.id, optIdx, e.target.value)}
                                        />
                                        <button 
                                          onClick={() => removeOptionFromField(field.id, optIdx)}
                                          className="text-text-muted hover:text-error transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-sm leading-none">close</span>
                                        </button>
                                      </div>
                                    ))}
                                    <button 
                                      onClick={() => addOptionToField(field.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-primary text-xs font-medium hover:underline transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-sm leading-none">add_circle</span>
                                      Add Option
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {signupFormConfig.length === 0 && (
                          <div className="py-12 text-center bg-surface-container rounded-xl border border-dashed border-outline-variant group/empty">
                            <span className="material-symbols-outlined text-3xl text-text-muted/40 mb-2 block">dynamic_form</span>
                            <p className="text-text-muted text-xs font-medium">No custom fields defined</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-8 pt-5 border-t border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                           <h3 className="text-sm font-semibold text-text-primary">Configuration Complete?</h3>
                           <p className="text-text-muted text-xs">Save your changes to update the live registration portal.</p>
                        </div>
                        <div className="flex items-center gap-2.5 w-full sm:w-auto">
                           <button 
                             onClick={() => setIsPreviewModalOpen(true)}
                             className="flex-1 sm:flex-none px-4 py-2 bg-transparent border border-outline-variant rounded-lg text-text-primary font-medium text-xs hover:bg-surface-container-high transition-colors cursor-pointer"
                           >
                             Preview Form
                           </button>
                           <button 
                             onClick={saveGeneralSettings}
                             className="flex-1 sm:flex-none bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2 rounded-lg font-medium text-xs transition-colors cursor-pointer"
                           >
                             Save Form Config
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {tournament?.status === 'pending' && (
                    <div className="p-5 sm:p-6 rounded-xl bg-surface-container-low border border-outline-variant">
                      <h3 className="text-sm font-semibold text-text-primary mb-1">Tournament Generation</h3>
                      <p className="text-text-muted text-xs mb-4 leading-relaxed">
                        Ready to start? Generating the bracket will finalize the current roster and create all initial matches.
                      </p>
                      <button 
                        onClick={handleGenerateBracket}
                        disabled={isGenerating}
                        className="w-full bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 px-4 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm leading-none">bolt</span>
                        {isGenerating ? "Generating..." : "Generate Tournament Bracket"}
                      </button>
                    </div>
                  )}

                  <div className="p-5 sm:p-6 rounded-xl bg-error/5 border border-error/20">
                    <h3 className="text-sm font-semibold text-error mb-1">Danger Zone</h3>
                    <p className="text-text-muted text-xs mb-4 leading-relaxed">
                      Deleting a tournament is a permanent action. All matches, team rosters, and historical scores will be erased permanently.
                    </p>
                    <button 
                      onClick={() => setIsDeleteModalOpen(true)}
                      disabled={isDeleting}
                      className="w-full bg-error hover:bg-error/90 text-white py-2.5 px-4 rounded-lg font-medium text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">delete_forever</span>
                      {isDeleting ? "Deleting..." : "Permanently Delete Tournament"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteTournament}
        title="Delete Tournament?"
        message="Are you sure you want to delete this tournament? This will permanently remove all matches, participants, and scoring data. This action cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Delete Permanently"}
        isDanger={true}
      />

      {/* PARTICIPANT DETAILS MODAL */}
      {selectedParticipant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl shadow-2xl border border-outline-variant relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-6 py-4 flex justify-between items-center bg-surface-container-high border-b border-outline-variant">
              <div>
                <h3 className="text-base font-semibold text-text-primary leading-tight">{selectedParticipant.name}</h3>
                <p className="text-text-muted text-xs mt-0.5">{selectedParticipant.contact_email || "No contact email visible"}</p>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </header>
            <div className="p-6 overflow-y-auto space-y-3">
              {signupFormConfig.length > 0 ? (
                signupFormConfig.map((field: any) => (
                  <div key={field.id} className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant">
                    <p className="text-[11px] font-medium text-text-muted mb-0.5">{field.label || field.id}</p>
                    <p className="font-medium text-text-primary text-xs">
                      {String(selectedParticipant.form_responses?.[field.id] ?? "—")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-text-muted text-xs italic text-center py-6">No custom signup fields configured for this tournament.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FORM PREVIEW MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl shadow-2xl border border-outline-variant relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-6 py-4 flex justify-between items-center bg-surface-container-high border-b border-outline-variant">
              <div>
                <h3 className="text-base font-semibold text-text-primary leading-tight">Live Form Preview</h3>
                <p className="text-text-muted text-xs mt-0.5">This is how participants will see your registration form</p>
              </div>
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Core Fields (Static) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1.5">Team or Player Name <span className="text-primary">*</span></label>
                  <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs opacity-70">
                    Lisbon Masters
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1.5">Contact Email <span className="text-primary">*</span></label>
                  <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs opacity-70">
                    manager@team.com
                  </div>
                </div>
              </div>

              {/* Dynamic Fields */}
              <div className="pt-4 border-t border-outline-variant space-y-4">
                {signupFormConfig.map((field) => (
                  <div key={field.id}>
                    <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                      {field.label || "Untitled Field"} {field.required && <span className="text-primary">*</span>}
                    </label>
                    
                    {field.type === 'select' ? (
                      <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-muted font-medium text-xs flex justify-between items-center">
                        <span>Select an option</span>
                        <span className="material-symbols-outlined text-sm leading-none">expand_more</span>
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant">
                        <div className="w-4 h-4 rounded bg-surface-container border border-outline-variant"></div>
                        <span className="text-text-secondary text-xs font-medium">I agree to {field.label || "this condition"}</span>
                      </div>
                    ) : (
                      <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-muted font-medium text-xs">
                        {field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                      </div>
                    )}
                    {field.description && (
                       <p className="mt-1 text-text-muted text-[11px] leading-relaxed">{field.description}</p>
                    )}
                  </div>
                ))}

                {signupFormConfig.length === 0 && (
                  <p className="text-center text-text-muted text-xs italic py-6">No custom fields added yet.</p>
                )}
              </div>
            </div>

            <footer className="p-4 bg-surface-container-high border-t border-outline-variant">
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-full bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 rounded-lg font-medium text-xs transition-colors cursor-pointer"
              >
                Back to Editor
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TournamentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-on-surface-variant font-label tracking-widest uppercase text-xs">Loading Tournament Details...</p>
      </div>
    }>
      <TournamentContent />
    </Suspense>
  );
}
