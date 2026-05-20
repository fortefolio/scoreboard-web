"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import GroupStandingsView from "@/components/GroupStandingsView";
import GroupMatchesView from "@/components/GroupMatchesView";
import TournamentBracket from "@/components/TournamentBracket";
import ConfirmationModal from "@/components/ConfirmationModal";
import NotificationBell from "@/components/NotificationBell";

const DEFAULT_TEAMS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", 
  "Zeta", "Eta", "Theta", "Iota", "Kappa", 
  "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi"
];

function TournamentContent() {
  const { id } = useParams();
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
  const [tVisibility, setTVisibility] = useState<'public' | 'private'>('public');
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
      const channel = supabase
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
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
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
      if (data.signup_form_config) setSignupFormConfig(data.signup_form_config);
      
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
      loadParticipants();
    }
    setLoading(false);
  };

  const loadParticipants = async () => {
    const { data: pData } = await supabase
      .from("tournament_participants")
      .select("id, name, contact_email, form_responses")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    
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
        signup_form_config: signupFormConfig,
      })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings, start_date: tStartDate, end_date: tEndDate, visibility: tVisibility, signup_form_config: signupFormConfig });
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
      await supabase.from("tournament_participants").delete().eq("tournament_id", tournamentId);
      const participantsToInsert = teamNames
        .filter(name => name.trim() !== "")
        .map(name => ({ tournament_id: tournamentId, name }));
      
      if (participantsToInsert.length > 0) {
        await supabase.from("tournament_participants").insert(participantsToInsert);
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
    <div className="min-h-screen bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">
      <main className="pt-12 pb-20 px-8 max-w-7xl mx-auto relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-container/10 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary-container/5 rounded-full blur-[120px] -z-10"></div>

        <header className="mb-16 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="text-secondary font-label text-xs uppercase tracking-[0.3em] mb-4">{tournament?.sport_type} Official Tournament</p>
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter leading-none mb-4">
            {tournament?.name || "Tournament"}
          </h1>
          <div className="flex items-center justify-center gap-3">
             <span className="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-wider border border-outline-variant/10">
                ID: {tournamentId.slice(0,8)}
             </span>
             <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                tournament?.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                tournament?.status === 'scheduled' ? 'bg-indigo-500/10 text-indigo-500' :
                'bg-emerald-500/10 text-emerald-500'
              }`}>
                {tournament?.status}
             </span>
          </div>
        </header>

        {/* Custom Tab Selector */}
        <div className="flex justify-center mb-12">
          <div className="bg-surface-container-low p-1.5 rounded-[1.5rem] border border-outline-variant/10 shadow-2xl flex gap-1">
            <button 
              onClick={() => handleTabChange('teams')}
              className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'teams' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'teams' ? "'FILL' 1" : "" }}>groups</span>
              Teams
            </button>
            {tournament?.settings?.stage_1?.type === 'groups' && tournament?.status !== 'pending' && (
              <>
                <button 
                  onClick={() => handleTabChange('standings')}
                  className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'standings' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'standings' ? "'FILL' 1" : "" }}>bar_chart</span>
                  Standings
                </button>
                <button 
                  onClick={() => handleTabChange('group_matches')}
                  className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'group_matches' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'group_matches' ? "'FILL' 1" : "" }}>sports_tennis</span>
                  Matches
                </button>
              </>
            )}
            {tournament?.status !== 'pending' && (
              <button 
                onClick={() => handleTabChange('bracket')}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'bracket' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'bracket' ? "'FILL' 1" : "" }}>account_tree</span>
                Bracket
              </button>
            )}
            <button 
              onClick={() => handleTabChange('settings')}
              className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'settings' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'settings' ? "'FILL' 1" : "" }}>settings</span>
              Settings
            </button>
          </div>
        </div>

        {/* View Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {activeTab === 'teams' ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-surface-container-low rounded-[3rem] p-10 border border-outline-variant/10 shadow-3xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50"></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h2 className="text-3xl font-headline font-black tracking-tight mb-2">Tournament Roster</h2>
                      <p className="text-on-surface-variant text-sm">Manage participating teams and players ({teamNames.length} / {maxTeams}).</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={copySignupLink}
                        className="bg-surface-container-high text-on-surface px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-500/10 hover:text-indigo-400 transition-all border border-outline-variant/10 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">share</span>
                        Share Signup Link
                      </button>
                      <button 
                        onClick={addTeam}
                        disabled={teamNames.length >= maxTeams}
                        className="bg-surface-container-high text-on-surface px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-surface-bright transition-all border border-outline-variant/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        {teamNames.length >= maxTeams ? 'Limit Reached' : 'Add Team'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {participants.map((p, idx) => (
                      <div key={p.id} className="relative group flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary opacity-30 group-focus-within:opacity-100 transition-opacity">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="w-full pl-12 pr-4 py-4 bg-surface-container rounded-xl border border-outline-variant/10 text-on-surface font-bold">
                            {p.name}
                            <span className="ml-3 text-[10px] opacity-40 font-normal">{p.contact_email}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedParticipant(p)}
                          className="w-12 h-12 rounded-xl bg-surface-container-high text-on-surface-variant hover:text-primary transition-all flex items-center justify-center border border-outline-variant/10"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                      </div>
                    ))}
                    {/* Fallback for empty slots if pending */}
                    {tournament.status === 'pending' && Array.from({ length: Math.max(0, teamNames.length - participants.length) }).map((_, idx) => (
                       <div key={`empty-${idx}`} className="relative group flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary opacity-30 group-focus-within:opacity-100 transition-opacity">
                            {String(participants.length + idx + 1).padStart(2, '0')}
                          </span>
                          <input 
                            className="w-full pl-12 pr-4 py-4 bg-surface-container rounded-xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            placeholder={`Assign Team ${participants.length + idx + 1}`}
                            value={teamNames[participants.length + idx] || ""}
                            onChange={(e) => handleTeamNameChange(participants.length + idx, e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={() => removeTeam(participants.length + idx)}
                          className="w-12 h-12 rounded-xl bg-surface-container-high text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center border border-outline-variant/10"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'standings' && tournament?.settings?.stage_1?.type === 'groups' ? (
            <div className="bg-surface-container-low/50 rounded-[3rem] p-12 border border-outline-variant/10 shadow-3xl">
               <GroupStandingsView tournamentId={tournamentId} />
            </div>
          ) : activeTab === 'group_matches' && tournament?.settings?.stage_1?.type === 'groups' ? (
            <div className="bg-surface-container-low/50 rounded-[3rem] p-12 border border-outline-variant/10 shadow-3xl">
               <GroupMatchesView tournamentId={tournamentId} tournament={tournament} onSaveOverride={saveOverride} onSaveScheduledDate={saveRoundDate} />
            </div>
          ) : activeTab === 'bracket' ? (
            <TournamentBracket tournamentId={tournamentId} tournamentFromParent={tournament} onSaveOverrideFromParent={saveOverride} onSaveScheduledDate={saveRoundDate} />
          ) : (
            <div className="w-full mx-auto">
              <div className="bg-surface-container-low rounded-[3rem] p-12 border border-outline-variant/10 shadow-3xl">
                <h2 className="text-3xl font-headline font-black tracking-tight mb-8">Tournament Settings</h2>
                <div className="space-y-8">
                  <div className="p-8 rounded-[2rem] bg-surface-container border border-outline-variant/10">
                    <h3 className="text-xl font-bold text-on-surface mb-6">General Configuration</h3>
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block mb-2">Tournament Start Date</label>
                          <input 
                            type="date"
                            className="w-full px-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant/10 font-bold outline-none focus:border-primary transition-all"
                            value={tStartDate}
                            onChange={(e) => setTStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block mb-2">Tournament End Date</label>
                          <input 
                            type="date"
                            className="w-full px-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant/10 font-bold outline-none focus:border-primary transition-all"
                            value={tEndDate}
                            onChange={(e) => setTEndDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block mb-2">Number of Available Courts</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="number"
                            min="1"
                            className="flex-1 px-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant/10 font-bold outline-none focus:border-primary transition-all"
                            value={courts}
                            onChange={(e) => setCourts(parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block mb-2">Maximum Number of Teams</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="number"
                            min="1"
                            className="flex-1 px-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant/10 font-bold outline-none focus:border-primary transition-all"
                            value={maxTeams}
                            onChange={(e) => setMaxTeams(parseInt(e.target.value) || 1)}
                          />
                          <button 
                            onClick={saveGeneralSettings}
                            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-full font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-xl shadow-primary-container/20"
                          >
                            Save Settings
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-10 rounded-[2.5rem] bg-surface-container-low border-none shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-primary-container/5 via-transparent to-transparent pointer-events-none"></div>
                    
                    <div className="relative z-10">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                        <div>
                          <h2 className="text-4xl font-headline font-black tracking-tight text-on-surface mb-2">Signup Form Builder</h2>
                          <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
                            Design the ultimate registration experience for your next tournament. Add fields, toggle requirements, and configure options.
                          </p>
                        </div>
                        <button 
                          onClick={addSignupField}
                          className="bg-surface-container-highest hover:bg-surface-container-high text-on-surface px-6 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-2 shadow-lg shadow-black/20 group active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm group-hover:rotate-90 transition-transform duration-300">add</span>
                          Add Field
                        </button>
                      </div>

                      <div className="space-y-6">
                        {signupFormConfig.map((field) => (
                          <div key={field.id} className="p-8 bg-surface-container rounded-[2rem] shadow-xl animate-in slide-in-from-bottom-4 duration-500 group/field">
                            <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                  field.type === 'text' ? 'bg-indigo-500/20 text-indigo-400' :
                                  field.type === 'number' ? 'bg-emerald-500/20 text-emerald-400' :
                                  field.type === 'select' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-purple-500/20 text-purple-400'
                                }`}>
                                  <span className="material-symbols-outlined">
                                    {field.type === 'text' ? 'text_fields' :
                                     field.type === 'number' ? '123' :
                                     field.type === 'select' ? 'list' :
                                     'check_box'}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="font-bold text-on-surface text-lg leading-none mb-1">{field.label || "Untitled Field"}</h4>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-40">
                                    {field.type === 'text' ? 'Text Input Field' :
                                     field.type === 'number' ? 'Numeric Input Field' :
                                     field.type === 'select' ? 'Dropdown Select Field' :
                                     'Checkbox / Toggle Field'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Required</span>
                                  <button 
                                    onClick={() => updateSignupField(field.id, { required: !field.required })}
                                    className={`w-12 h-6 rounded-full transition-all relative ${field.required ? 'bg-primary-container' : 'bg-surface-container-highest'}`}
                                  >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${field.required ? 'left-7' : 'left-1'}`}></div>
                                  </button>
                                </div>
                                <button 
                                  onClick={() => removeSignupField(field.id)}
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
                                >
                                  <span className="material-symbols-outlined text-xl">delete</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
                              <div className="lg:col-span-6">
                                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3 block">Field Label</label>
                                <input 
                                  className="w-full px-5 py-4 bg-surface-container-low rounded-xl text-on-surface font-bold outline-none focus:ring-1 focus:ring-primary-container transition-all border border-outline-variant/10"
                                  placeholder="e.g. Team Name"
                                  value={field.label}
                                  onChange={(e) => updateSignupField(field.id, { label: e.target.value })}
                                />
                              </div>

                              {field.type === 'text' && (
                                <div className="lg:col-span-6">
                                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3 block">Placeholder Text</label>
                                  <input 
                                    className="w-full px-5 py-4 bg-surface-container-low rounded-xl text-on-surface font-bold outline-none focus:ring-1 focus:ring-primary-container transition-all border border-outline-variant/10"
                                    placeholder="Enter your team name..."
                                    value={field.placeholder || ""}
                                    onChange={(e) => updateSignupField(field.id, { placeholder: e.target.value })}
                                  />
                                </div>
                              )}

                              {field.type === 'number' && (
                                <>
                                  <div className="lg:col-span-3">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3 block">Min</label>
                                    <input 
                                      type="number"
                                      className="w-full px-5 py-4 bg-surface-container-low rounded-xl text-on-surface font-bold outline-none focus:ring-1 focus:ring-primary-container transition-all border border-outline-variant/10"
                                      value={field.min || ""}
                                      onChange={(e) => updateSignupField(field.id, { min: parseInt(e.target.value) || null })}
                                    />
                                  </div>
                                  <div className="lg:col-span-3">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3 block">Max</label>
                                    <input 
                                      type="number"
                                      className="w-full px-5 py-4 bg-surface-container-low rounded-xl text-on-surface font-bold outline-none focus:ring-1 focus:ring-primary-container transition-all border border-outline-variant/10"
                                      value={field.max || ""}
                                      onChange={(e) => updateSignupField(field.id, { max: parseInt(e.target.value) || null })}
                                    />
                                  </div>
                                </>
                              )}

                              {field.type === 'checkbox' && (
                                <div className="lg:col-span-6">
                                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3 block">Description / Subtext</label>
                                  <textarea 
                                    className="w-full px-5 py-4 bg-surface-container-low rounded-xl text-on-surface font-bold outline-none focus:ring-1 focus:ring-primary-container transition-all border border-outline-variant/10 min-h-[100px] resize-none"
                                    placeholder="Check this box if your team will be attending..."
                                    value={field.description || ""}
                                    onChange={(e) => updateSignupField(field.id, { description: e.target.value })}
                                  />
                                </div>
                              )}

                              {field.type === 'select' && (
                                <div className="lg:col-span-12">
                                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3 block">Options</label>
                                  <div className="flex flex-wrap gap-3 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                    {(field.options || []).map((opt: string, optIdx: number) => (
                                      <div key={optIdx} className="bg-surface-container-highest px-4 py-2 rounded-full flex items-center gap-3 border border-outline-variant/20 shadow-lg group/opt">
                                        <input 
                                          className="bg-transparent text-sm font-bold text-on-surface outline-none min-w-[80px]"
                                          value={opt}
                                          onChange={(e) => updateOptionInField(field.id, optIdx, e.target.value)}
                                        />
                                        <button 
                                          onClick={() => removeOptionFromField(field.id, optIdx)}
                                          className="text-on-surface-variant hover:text-error transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                      </div>
                                    ))}
                                    <button 
                                      onClick={() => addOptionToField(field.id)}
                                      className="flex items-center gap-2 px-4 py-2 text-primary-container font-black uppercase tracking-widest text-[10px] hover:text-primary transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-sm">add_circle</span>
                                      Add Option
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {signupFormConfig.length === 0 && (
                          <div className="py-20 text-center bg-surface-container-low rounded-[2rem] border border-dashed border-outline-variant/20 group/empty">
                            <div className="w-20 h-20 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-6 group-hover/empty:scale-110 transition-transform duration-700">
                               <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-20">dynamic_form</span>
                            </div>
                            <p className="text-on-surface-variant text-sm font-bold opacity-40 uppercase tracking-widest">No custom fields defined</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-12 p-10 bg-surface-container rounded-[2rem] border border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                           <h3 className="text-2xl font-headline font-black text-on-surface mb-1">Configuration Complete?</h3>
                           <p className="text-on-surface-variant text-sm">Save your changes to update the live registration portal.</p>
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                           <button 
                             onClick={() => setIsPreviewModalOpen(true)}
                             className="flex-1 md:flex-none px-8 py-4 bg-transparent border border-outline-variant/30 rounded-xl text-on-surface font-black uppercase tracking-widest text-xs hover:bg-surface-bright transition-all"
                           >
                             Preview Form
                           </button>
                           <button 
                             onClick={saveGeneralSettings}
                             className="flex-1 md:flex-none bg-primary-container text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 active:scale-95"
                           >
                             Save Form Config
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {tournament?.status === 'pending' && (
                    <div className="p-8 rounded-[2rem] bg-primary-container/10 border border-primary-container/20">
                      <h3 className="text-xl font-bold text-primary mb-2">Tournament Generation</h3>
                      <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
                        Ready to start? Generating the bracket will finalize the current roster and create all initial matches.
                      </p>
                      <button 
                        onClick={handleGenerateBracket}
                        disabled={isGenerating}
                        className="w-full bg-primary-container text-on-primary-container py-4 rounded-full font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        {isGenerating ? "Generating..." : "Generate Tournament Bracket"}
                      </button>
                    </div>
                  )}

                  <div className="p-8 rounded-[2rem] bg-error-container/10 border border-error-container/20">
                    <h3 className="text-xl font-bold text-error mb-2">Danger Zone</h3>
                    <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
                      Deleting a tournament is a permanent action. All matches, team rosters, and historical scores will be erased from the Kinetic Vault scoring engine.
                    </p>
                    <button 
                      onClick={() => setIsDeleteModalOpen(true)}
                      disabled={isDeleting}
                      className="w-full bg-error-container text-on-error-container py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-error/10 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
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

      {/* FORM PREVIEW MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-300">
          <div className="absolute inset-0 z-0 bg-gradient-radial from-primary-container/10 via-transparent to-transparent pointer-events-none"></div>
          
          <div className="w-full max-w-lg bg-surface-container rounded-[3rem] shadow-4xl border border-outline-variant/10 relative z-10 overflow-hidden flex flex-col max-h-[80vh]">
            <header className="px-10 pt-10 pb-6 flex justify-between items-center bg-surface-container-high border-b border-outline-variant/5">
              <div>
                <h3 className="text-2xl font-headline font-black text-on-surface leading-none mb-2 italic">LIVE FORM PREVIEW</h3>
                <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest opacity-40">This is how participants will see your registration</p>
              </div>
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface hover:bg-error/10 hover:text-error transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
              {/* Core Fields (Static) */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Team or Player Name <span className="text-primary">*</span></label>
                  <div className="w-full px-6 py-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-on-surface font-bold text-lg opacity-60">
                    Kinetic Vault Elite
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Contact Email <span className="text-primary">*</span></label>
                  <div className="w-full px-6 py-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-on-surface font-bold text-lg opacity-60">
                    manager@team.com
                  </div>
                </div>
              </div>

              {/* Dynamic Fields */}
              <div className="pt-8 border-t border-outline-variant/5 space-y-6">
                {signupFormConfig.map((field) => (
                  <div key={field.id}>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">
                      {field.label || "Untitled Field"} {field.required && <span className="text-primary">*</span>}
                    </label>
                    
                    {field.type === 'select' ? (
                      <div className="w-full px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold flex justify-between items-center opacity-80">
                        <span>Select an option</span>
                        <span className="material-symbols-outlined">expand_more</span>
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center gap-3 px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10 opacity-80">
                        <div className="w-6 h-6 rounded bg-surface-container-highest border border-outline-variant/20"></div>
                        <span className="text-on-surface-variant text-sm font-medium">I agree to {field.label || "this condition"}</span>
                      </div>
                    ) : (
                      <div className="w-full px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface-variant/40 font-bold italic opacity-80">
                        {field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                      </div>
                    )}
                    {field.description && (
                       <p className="mt-3 text-on-surface-variant text-[11px] leading-relaxed opacity-60 px-2">{field.description}</p>
                    )}
                  </div>
                ))}

                {signupFormConfig.length === 0 && (
                  <p className="text-center text-on-surface-variant text-xs italic py-10 opacity-40">No custom fields added yet.</p>
                )}
              </div>
            </div>

            <footer className="p-10 bg-surface-container-high border-t border-outline-variant/5">
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-full bg-primary-container text-white py-5 rounded-full font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 active:scale-95"
              >
                Back to Editor
              </button>
            </footer>
          </div>
        </div>
      )}

      <footer className="mt-auto py-12 border-t border-outline-variant/10 text-center opacity-50">
        <p className="font-label text-[10px] uppercase tracking-[0.5em] text-on-surface-variant">Kinetic Vault Scoring Engine • v2.4.1</p>
      </footer>
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
