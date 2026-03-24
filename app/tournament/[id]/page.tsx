"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import GroupStandingsView from "@/components/GroupStandingsView";
import TournamentBracket from "@/components/TournamentBracket";

const DEFAULT_TEAMS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", 
  "Zeta", "Eta", "Theta", "Iota", "Kappa", 
  "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi"
];

export default function TournamentPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'standings' | 'bracket' | 'teams' | 'settings'>('teams');
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAMS);

  const tournamentId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
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
      if (data.status !== 'pending') {
        if (data.settings?.stage_1?.type === 'bracket' || data.settings?.stage_1?.type === 'double_elimination') {
          setActiveTab('bracket');
        } else {
          setActiveTab('standings');
        }
      }
      const { data: pData } = await supabase
        .from("tournament_participants")
        .select("name")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true });
      
      if (pData && pData.length > 0) {
        setTeamNames(pData.map(p => p.name));
      }
    }
    setLoading(false);
  };

  const handleDeleteTournament = async () => {
    const confirmed = confirm("Are you sure you want to delete this tournament? This will permanently remove all matches, participants, and scoring data. This action cannot be undone.");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;

      alert("Tournament deleted successfully.");
      router.push("/");
    } catch (err: any) {
      alert(`Error deleting tournament: ${err.message}`);
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
      
      alert("Bracket generated successfully!");
      await loadTournament();
    } catch (err: any) {
      alert(`Error generating bracket: ${err.message}`);
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
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 transition-all duration-300 ease-out">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto font-headline tracking-tight">
          <Link href="/" className="text-2xl font-black text-indigo-500 italic tracking-tighter">Score:Board</Link>
          <div className="flex gap-4 items-center">
             <button onClick={() => router.push('/')} className="text-slate-400 hover:text-indigo-300 transition-colors font-semibold px-4 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Dashboard
             </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-8 max-w-7xl mx-auto relative">
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
              onClick={() => setActiveTab('teams')}
              className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'teams' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'teams' ? "'FILL' 1" : "" }}>groups</span>
              Teams
            </button>
            {tournament?.settings?.stage_1?.type === 'groups' && tournament?.status !== 'pending' && (
              <button 
                onClick={() => setActiveTab('standings')}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'standings' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'standings' ? "'FILL' 1" : "" }}>bar_chart</span>
                Standings
              </button>
            )}
            {tournament?.status !== 'pending' && (
              <button 
                onClick={() => setActiveTab('bracket')}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'bracket' ? 'bg-primary-container text-on-primary-container shadow-xl shadow-primary-container/20' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: activeTab === 'bracket' ? "'FILL' 1" : "" }}>account_tree</span>
                Bracket
              </button>
            )}
            <button 
              onClick={() => setActiveTab('settings')}
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
                      <p className="text-on-surface-variant text-sm">Manage participating teams and players.</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={addTeam}
                        className="bg-surface-container-high text-on-surface px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-surface-bright transition-all border border-outline-variant/10 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Team
                      </button>
                      {tournament?.status === 'pending' && (
                        <button 
                          onClick={handleGenerateBracket}
                          disabled={isGenerating}
                          className="bg-primary-container text-on-primary-container px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">bolt</span>
                          {isGenerating ? "Generating..." : "Generate Bracket"}
                        </button>
                      )}
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
          ) : activeTab === 'bracket' ? (
            <TournamentBracket tournamentId={tournamentId} />
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-surface-container-low rounded-[3rem] p-12 border border-outline-variant/10 shadow-3xl">
                <h2 className="text-3xl font-headline font-black tracking-tight mb-8">Tournament Settings</h2>
                <div className="space-y-8">
                  <div className="p-8 rounded-[2rem] bg-error-container/10 border border-error-container/20">
                    <h3 className="text-xl font-bold text-error mb-2">Danger Zone</h3>
                    <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
                      Deleting a tournament is a permanent action. All matches, team rosters, and historical scores will be erased from the Kinetic Vault scoring engine.
                    </p>
                    <button 
                      onClick={handleDeleteTournament}
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

      <footer className="mt-auto py-12 border-t border-outline-variant/10 text-center opacity-50">
        <p className="font-label text-[10px] uppercase tracking-[0.5em] text-on-surface-variant">Kinetic Vault Scoring Engine • v2.4.1</p>
      </footer>
    </div>
  );
}
