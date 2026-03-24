"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // --- LOGGED IN DASHBOARD VIEW STATE ---
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("Tennis");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Check active sessions and sets the user
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) fetchTournaments(session.user.id);
      setLoading(false);
    };

    checkUser();

    // Listen for auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTournaments(session.user.id);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchTournaments = async (userId: string) => {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("organizer_id", userId);
    if (data) setTournaments(data);
  };

  const handleAuth = async (type: "login" | "signup") => {
    const { error } = type === "login" 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
  };

  const handleCreate = async () => {
    // Extract values from the inputs based on the sport
    const settings: any = {};
    
    if (newSport === 'Tennis' || newSport === 'Volleyball') {
      settings.max_sets = (document.getElementById('max_sets') as HTMLInputElement)?.value;
    }
    if (newSport === 'Volleyball') {
      settings.points_per_set = (document.getElementById('points_per_set') as HTMLInputElement)?.value;
    }
    if (newSport === 'Football') {
      settings.duration = (document.getElementById('duration') as HTMLInputElement)?.value;
      settings.format = (document.getElementById('period_format') as HTMLSelectElement)?.value;
    }

    const { error } = await supabase.from("tournaments").insert({
      name: newName,
      sport_type: newSport,
      organizer_id: user.id,
      status: "pending",
      settings: settings // This saves the JSON object to Postgres
    });

    if (!error) {
      setShowModal(false);
      fetchTournaments(user.id);
    }
  };

  const handleGenerateBracket = async (tournament: any) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tournament-bracket", {
        body: {
          tournament_id: tournament.id,
          organizer_id: user.id,
          sport_type: tournament.sport_type,
          teams: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]
        }
      });

      if (error) throw error;
      
      alert("Bracket generated successfully!");
      fetchTournaments(user.id); // Refresh list
    } catch (err: any) {
      alert(`Error generating bracket: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // HYDRATION FIX: Return an empty shell on server and first client pass
  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {loading ? (
        <div className="flex justify-center items-center h-screen">
          <p className="text-gray-900 font-medium">Loading...</p>
        </div>
      ) : !user ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-4">
            <h1 className="text-2xl font-bold text-center text-gray-900">Organizer Login</h1>
            <input 
              className="w-full p-2 border rounded text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" 
              type="email" 
              placeholder="Email" 
              onChange={e => setEmail(e.target.value)} 
            />
            <input 
              className="w-full p-2 border rounded text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" 
              type="password" 
              placeholder="Password" 
              onChange={e => setPassword(e.target.value)} 
            />
            <div className="flex gap-2">
              <button onClick={() => handleAuth("login")} className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 transition-colors">Sign In</button>
              <button onClick={() => handleAuth("signup")} className="w-full border py-2 rounded text-gray-900 font-bold hover:bg-gray-50 transition-colors">Sign Up</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">My Tournaments</h1>
              <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-500 hover:text-red-500">Sign Out</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tournaments.map((t) => (
                <div key={t.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800">{t.name}</h3>
                  <p className="text-gray-400 uppercase text-xs font-semibold mt-1">{t.sport_type}</p>
                  <div className="mt-6 flex justify-between items-center">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded capitalize">{t.status}</span>
                    {t.status === "pending" ? (
                      <button 
                        onClick={() => handleGenerateBracket(t)}
                        disabled={isGenerating}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isGenerating ? "Processing..." : "⚡ Generate Bracket"}
                      </button>
                    ) : t.status === "scheduled" ? (
                      <Link href={`/tournament/${t.id}`}>
                        <button className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
                          View Live Bracket
                        </button>
                      </Link>
                    ) : (                      <button className="text-indigo-600 text-sm font-semibold hover:underline">Manage →</button>
                    )}
                  </div>
                </div>
              ))}

              {/* CREATE BUTTON */}
              <button 
                onClick={() => setShowModal(true)}
                className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-500 hover:text-indigo-500 transition-all bg-white/50"
              >
                <span className="text-4xl mb-2">+</span>
                <span className="font-medium">Create New Tournament</span>
              </button>
            </div>
          </div>

          {/* SIMPLE MODAL */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                <h2 className="text-2xl font-bold mb-6">New Tournament</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Name</label>
                    <input 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" 
                      placeholder="e.g. Summer Open 2026"
                      onChange={e => setNewName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sport Type</label>
                    <select 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newSport}
                      onChange={e => setNewSport(e.target.value)}
                    >
                      <option value="Tennis">Tennis</option>
                      <option value="Volleyball">Volleyball</option>
                      <option value="Football">Football</option>
                    </select>
                  </div>

                  {/* CONDITIONAL SETTINGS BASED ON SPORT */}
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Match Rules</p>
                    
                    {(newSport === 'Tennis' || newSport === 'Volleyball') && (
                      <div>
                        <label className="text-xs text-gray-500">Max Sets</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border rounded text-sm" 
                          defaultValue={3} 
                          id="max_sets"
                        />
                      </div>
                    )}

                    {newSport === 'Volleyball' && (
                      <div>
                        <label className="text-xs text-gray-500">Points per Set</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border rounded text-sm" 
                          defaultValue={25} 
                          id="points_per_set"
                        />
                      </div>
                    )}

                    {newSport === 'Football' && (
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Duration (mins)</label>
                          <input type="number" className="w-full p-2 border rounded text-sm" defaultValue={90} id="duration"/>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Format</label>
                          <select className="w-full p-2 border rounded text-sm" id="period_format">
                            <option value="halves">Halves</option>
                            <option value="single">Single Period</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 mt-8">
                    <button onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500 font-medium">Cancel</button>
                    <button onClick={handleCreate} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Create</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
