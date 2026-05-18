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
  const [participants, setParticipants] = useState<any[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAMS);
  const [courts, setCourts] = useState<number>(1);
  const [maxTeams, setMaxTeams] = useState<number>(16);
  const [tStartDate, setTStartDate] = useState("");
  const [tEndDate, setTEndDate] = useState("");

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
      .select("name, contact_email")
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
        end_date: tEndDate || null
      })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings, start_date: tStartDate, end_date: tEndDate });
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
              className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'teams' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'teams' ? "'FILL' 1" : "" }}>groups</span>
              Teams
            </button>
            {tournament?.settings?.stage_1?.type === 'groups' && tournament?.status !== 'pending' && (
              <>
                <button 
                  onClick={() => handleTabChange('standings')}
                  className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'standings' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'standings' ? "'FILL' 1" : "" }}>bar_chart</span>
                  Standings
                </button>
                <button 
                  onClick={() => handleTabChange('group_matches')}
                  className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'group_matches' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'group_matches' ? "'FILL' 1" : "" }}>sports_tennis</span>
                  Matches
                </button>
              </>
            )}
            {tournament?.status !== 'pending' && (
              <button 
                onClick={() => handleTabChange('bracket')}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'bracket' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'bracket' ? "'FILL' 1" : "" }}>account_tree</span>
                Bracket
              </button>
            )}
            <button 
              onClick={() => handleTabChange('settings')}
              className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'settings' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
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
                    {teamNames.map((name, idx) => (
                      <div key={idx} className="relative group flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary opacity-30 group-focus-within:opacity-100 transition-opacity">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <input 
                            className="w-full pl-12 pr-4 py-4 bg-surface-container rounded-xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            placeholder={`Team ${idx + 1}`}
                            value={name}
                            onChange={(e) => handleTeamNameChange(idx, e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={() => removeTeam(idx)}
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
            <div className="max-w-2xl mx-auto">
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
                            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-xl shadow-primary-container/20"
                          >
                            Save Settings
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
                        className="w-full bg-primary-container text-on-primary-container py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
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
