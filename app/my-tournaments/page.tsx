"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

export default function MyTournamentsPage() {
  const { user, supabase } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("Tennis");
  const [stage1Type, setStage1Type] = useState<'bracket' | 'groups' | 'double_elimination'>('bracket');
  const [maxTeams, setMaxTeams] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const fetchTournaments = useCallback(async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("organizer_id", userId)
      .order("created_at", { ascending: false });
    if (data) setTournaments(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTournaments(user.id);
  }, [user, fetchTournaments]);

  const handleCreate = async () => {
    if (!user) {
      toast.error("Authentication required. Please wait for the page to finish loading.");
      return;
    }
    if (!newName) {
      toast.error("Please enter a tournament name");
      return;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("Tournament Start Date cannot be after the End Date.");
      return;
    }

    const defaultSettings: any = {};
    if (newSport === 'Tennis' || newSport === 'Volleyball') {
      defaultSettings.max_sets = 3;
    }
    if (newSport === 'Volleyball') {
      defaultSettings.points_per_set = 25;
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

    const { error } = await supabase.from("tournaments").insert({
      name: newName,
      sport_type: newSport,
      organizer_id: user.id,
      status: "pending",
      settings: settings,
      start_date: startDate || null,
      end_date: endDate || null,
      visibility: visibility
    });

    if (!error) {
      toast.success("Tournament created successfully!");
      setShowModal(false);
      fetchTournaments(user.id);
    } else {
      toast.error(`Error creating tournament: ${error.message}`);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-background text-on-background p-8 pt-24 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-black uppercase tracking-widest text-xs opacity-60">Initializing your account...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-on-background p-8 pt-24 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter leading-none mb-4">
            My <span className="text-primary">Tournaments</span>
          </h1>
          <p className="text-on-surface-variant text-xl max-w-xl">Manage your active events and create new competitions.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary-container text-on-primary-container px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          New Tournament
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-on-surface-variant font-label uppercase tracking-widest text-[10px]">Loading your events...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tournaments.map((t) => (
            <div key={t.id} className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10 hover:border-primary/40 transition-all duration-500 group shadow-xl flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-secondary font-label text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t.sport_type}</p>
                    <h3 className="text-2xl font-black group-hover:text-primary transition-colors leading-tight">{t.name}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    t.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                    t.status === 'scheduled' ? 'bg-indigo-500/10 text-indigo-500' :
                    'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {t.status}
                  </span>
                </div>
              </div>
              
              <div className="mt-12">
                <Link href={`/tournament/${t.id}`} className="w-full">
                  <button className="w-full bg-primary-container text-on-primary-container py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    View Dashboard
                  </button>
                </Link>
              </div>
            </div>
          ))}
          
          {tournaments.length === 0 && (
            <div 
              onClick={() => setShowModal(true)}
              className="border-2 border-dashed border-outline-variant/20 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all bg-surface-container-low/30 cursor-pointer h-full min-h-[300px]"
            >
              <span className="material-symbols-outlined text-4xl mb-4">add_circle</span>
              <p className="font-black uppercase tracking-widest text-sm">No tournaments found</p>
              <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">Click to create your first event</p>
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container-high rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <h2 className="text-3xl font-headline font-black mb-8 italic tracking-tighter">NEW TOURNAMENT</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Tournament Name</label>
                <input 
                  className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors" 
                  placeholder="e.g. Summer Open 2026"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Sport Type</label>
                  <select 
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors appearance-none"
                    value={newSport}
                    onChange={e => setNewSport(e.target.value)}
                  >
                    <option value="Tennis">Tennis</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Football">Football</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Initial Format</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setStage1Type('bracket')}
                      className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${stage1Type === 'bracket' ? 'bg-primary-container text-on-primary-container border-primary shadow-lg shadow-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}
                    >
                      BRACKET
                    </button>
                    <button 
                      onClick={() => setStage1Type('groups')}
                      className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${stage1Type === 'groups' ? 'bg-primary-container text-on-primary-container border-primary shadow-lg shadow-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}
                    >
                      GROUPS
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant/10">
                <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-2">Max teams</label>
                <input 
                  type="number" 
                  value={maxTeams} 
                  onChange={(e) => setMaxTeams(e.target.value === "" ? "" : parseInt(e.target.value))}
                  placeholder="e.g. 16"
                  className="w-full bg-transparent text-3xl font-black text-on-surface outline-none italic tracking-tighter"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Start Date</label>
                  <input 
                    type="date"
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">End Date</label>
                  <input 
                    type="date"
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface font-bold outline-none focus:border-primary transition-colors"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3">Tournament Visibility</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setVisibility('public')}
                    className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${visibility === 'public' ? 'bg-primary-container text-on-primary-container border-primary shadow-lg shadow-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}
                  >
                    PUBLIC
                  </button>
                  <button 
                    onClick={() => setVisibility('private')}
                    className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${visibility === 'private' ? 'bg-primary-container text-on-primary-container border-primary shadow-lg shadow-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}
                  >
                    PRIVATE
                  </button>
                </div>
                <p className="mt-2 text-[9px] text-on-surface-variant opacity-60 uppercase font-bold tracking-tight">
                  {visibility === 'public' ? 'Visible to everyone on the landing page' : 'Only accessible via direct link'}
                </p>
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-4 text-on-surface-variant font-black uppercase tracking-widest text-xs hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreate} 
                  className="flex-1 bg-primary-container text-on-primary-container py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20"
                >
                  Create Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
