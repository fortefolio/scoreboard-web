"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // --- AUTH MODAL STATE ---
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  // --- DASHBOARD VIEW STATE ---
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("Tennis");
  const [isGenerating, setIsGenerating] = useState(false);
  const [stage1Type, setStage1Type] = useState<'bracket' | 'groups' | 'double_elimination'>('bracket');
  const [maxTeams, setMaxTeams] = useState<number | "">("");

  useEffect(() => {
    setIsMounted(true);
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) fetchTournaments(session.user.id);
      setLoading(false);
    };

    checkUser();

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
    if (error) {
      toast.error(error.message);
    } else {
      setAuthModal(null);
    }
  };

  const handleCreate = async () => {
    const defaultSettings: any = {};
    if (newSport === 'Tennis' || newSport === 'Volleyball') {
      defaultSettings.max_sets = parseInt((document.getElementById('max_sets') as HTMLInputElement)?.value || "3");
    }
    if (newSport === 'Volleyball') {
      defaultSettings.points_per_set = parseInt((document.getElementById('points_per_set') as HTMLInputElement)?.value || "25");
    }
    if (newSport === 'Football') {
      defaultSettings.duration = parseInt((document.getElementById('duration') as HTMLInputElement)?.value || "90");
      defaultSettings.format = (document.getElementById('period_format') as HTMLSelectElement)?.value;
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
      settings: settings
    });

    if (!error) {
      toast.success("Tournament created successfully!");
      setShowModal(false);
      fetchTournaments(user.id);
    } else {
      toast.error(`Error creating tournament: ${error.message}`);
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
          teams: [
            "Alpha", "Beta", "Gamma", "Delta", "Epsilon", 
            "Zeta", "Eta", "Theta", "Iota", "Kappa", 
            "Lambda", "Mu", "Nu", "Xi", "Omicron"
          ],
          settings: tournament.settings
        }
      });
      if (error) throw error;
      toast.success("Bracket generated successfully!");
      fetchTournaments(user.id);
    } catch (err: any) {
      toast.error(`Error generating bracket: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 transition-all duration-300 ease-out">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto font-headline tracking-tight">
          <div className="text-2xl font-black text-indigo-500 italic tracking-tighter">Score:Board</div>
          <div className="hidden md:flex gap-8 items-center">
            <Link className="text-slate-400 hover:text-indigo-300 transition-colors transition-all duration-300 ease-out active:scale-95" href="/#hero">Hero</Link>
            <Link className="text-slate-400 hover:text-indigo-300 transition-colors transition-all duration-300 ease-out active:scale-95" href="/#feed">Feed</Link>
            <Link className="text-slate-400 hover:text-indigo-300 transition-colors transition-all duration-300 ease-out active:scale-95" href="/#features">Features</Link>
            <Link className="text-slate-400 hover:text-indigo-300 transition-colors transition-all duration-300 ease-out active:scale-95" href="/#leaderboard">Leaderboard</Link>
          </div>
          <div className="flex gap-4 items-center">
            {user ? (
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="text-slate-400 hover:text-red-400 transition-colors font-semibold px-4 py-2"
              >
                Sign Out
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setAuthModal("login")}
                  className="text-slate-400 hover:text-indigo-300 transition-colors font-semibold px-4 py-2"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setAuthModal("signup")}
                  className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-500/10 hover:text-indigo-300 transition-all duration-300 ease-out active:scale-95 shadow-lg shadow-indigo-500/20"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero / Dashboard Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-40 overflow-hidden" id="hero">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-container/10 rounded-full blur-[120px]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-8 relative z-10">
          {user ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h1 className="font-headline text-5xl md:text-6xl font-extrabold tracking-tighter leading-none mb-4">
                    My <span className="text-primary">Tournaments</span>
                  </h1>
                  <p className="text-on-surface-variant text-xl max-w-xl">Manage your active events and create new competitions.</p>
                </div>
                <button 
                  onClick={() => setShowModal(true)}
                  className="bg-primary-container text-on-primary-container px-8 py-4 rounded-xl font-bold text-lg hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">add</span>
                  New Tournament
                </button>
              </div>

              {loading ? (
                <div className="py-20 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-on-surface-variant font-label">Loading your events...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {tournaments.map((t) => (
                    <div key={t.id} className="bg-surface-container p-8 rounded-[2rem] border border-outline-variant/10 hover:border-primary/40 transition-all duration-500 group shadow-xl">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-secondary font-label text-xs uppercase tracking-widest mb-1">{t.sport_type}</p>
                          <h3 className="text-2xl font-bold group-hover:text-primary transition-colors">{t.name}</h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                          t.status === 'scheduled' ? 'bg-indigo-500/10 text-indigo-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      
                      <div className="mt-12 flex items-center justify-between">
                        <Link href={`/tournament/${t.id}`} className="w-full">
                          <button className="w-full bg-primary-container text-on-primary-container py-3 rounded-xl font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                            <span className="material-symbols-outlined">visibility</span>
                            View Dashboard
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  
                  {tournaments.length === 0 && (
                    <div 
                      onClick={() => setShowModal(true)}
                      className="border-2 border-dashed border-outline-variant/20 rounded-[2rem] p-8 flex flex-col items-center justify-center text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all bg-surface-container-low/30 cursor-pointer h-full min-h-[280px]"
                    >
                      <span className="material-symbols-outlined text-4xl mb-4">add_circle</span>
                      <p className="font-bold">No tournaments found</p>
                      <p className="text-sm">Click to create your first event</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter leading-none mb-6">
                  Don't just play.<br/>
                  <span className="text-primary">Be heard.</span>
                </h1>
                <p className="text-on-surface-variant text-xl md:text-2xl max-w-xl mb-10 leading-relaxed">
                  The first tournament platform where every point is a post. Live brackets, real-time trash talk, and community-driven sports management.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setAuthModal("signup")}
                    className="bg-primary-container text-on-primary-container px-8 py-4 rounded-xl font-bold text-lg hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                  >
                    Create Your Tournament
                  </button>
                  <Link href="#feed">
                    <button className="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface px-8 py-4 rounded-xl font-bold text-lg hover:bg-surface-bright transition-all active:scale-95">
                      Watch Live Feeds
                    </button>
                  </Link>
                </div>
              </div>
              <div className="relative">
                <div className="bg-surface-container rounded-3xl p-4 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50"></div>
                  <img 
                    className="rounded-2xl w-full h-[500px] object-cover grayscale hover:grayscale-0 transition-all duration-700" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCitfyKzFo7Ue6_usDjvJs8i3m0ise5dJyzM93IoypTdrs60ggNLa3N6mov53KIsALUFUpZM1lqBjkfj488PqJpg1Z4o4EVOPylLGluhv3BBTrW0mrEFOURda1MEnpF21FNnSX3eXJJzhOtNf0I7rwS1v8Xcoi5hqDpAvU48artJvzFW9sK990GJXyI5fX2dGSvHfLeYf28o4EIT89u2Rg2y2qBu0n8Egt2iMz-k01ZrpCou7cN6rxd2EFqG7slNn6ykgbGF5aAIVaa"
                    alt="Hero sport"
                  />
                  {/* Floating Hero Stat */}
                  <div className="absolute bottom-8 -left-8 bg-surface-container-highest/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-outline-variant/20 max-w-[240px]">
                    <div className="font-label text-4xl text-primary font-bold mb-1">128:127</div>
                    <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Live: Final Seconds</div>
                    <div className="mt-4 flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-surface"></div>
                      <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-surface"></div>
                      <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-surface flex items-center justify-center text-[10px]">+42</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Live Pulse Feed */}
      <section className="py-24 bg-surface-container-low relative" id="feed">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
            <div>
              <h2 className="font-headline text-4xl md:text-5xl font-bold tracking-tight mb-4">Live Pulse Feed</h2>
              <p className="text-on-surface-variant max-w-md">Real-time reactions from the arena floor to your screen.</p>
            </div>
            <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full border border-outline-variant/20">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="font-label text-sm uppercase tracking-widest">Live Now</span>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feed Card 1 */}
            <div className="bg-surface-container p-6 rounded-2xl shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-primary-container/10 border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold">A</div>
                <div>
                  <div className="font-bold text-sm">Team Alpha</div>
                  <div className="text-xs text-on-surface-variant">2 minutes ago</div>
                </div>
              </div>
              <p className="text-lg font-semibold mb-6">Team Alpha just pulled off a <span className="text-secondary">15-14 upset!</span> in the semi-finals!</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright transition-colors">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    <span className="font-label text-xs">1.2k</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright transition-colors text-tertiary">
                    <span className="material-symbols-outlined text-sm">local_fire_department</span>
                    <span className="font-label text-xs">84</span>
                  </button>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">share</span>
              </div>
            </div>
            {/* Feed Card 2 */}
            <div className="bg-primary-container p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <span className="material-symbols-outlined text-6xl">sports_score</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">M</div>
                  <div>
                    <div className="font-bold text-sm">Umpire Marco</div>
                    <div className="text-xs text-on-primary-container/80">Just now</div>
                  </div>
                </div>
                <p className="text-xl font-bold mb-6">Umpire Marco started a new game: Raptors vs. Titans</p>
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 px-4 py-1.5 rounded-full font-label text-xs uppercase tracking-widest">Pro League</div>
                  <div className="bg-white/20 px-4 py-1.5 rounded-full font-label text-xs uppercase tracking-widest">Court 4</div>
                </div>
              </div>
            </div>
            {/* Feed Card 3 */}
            <div className="bg-surface-container p-6 rounded-2xl shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-primary-container/10 border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
                </div>
                <div>
                  <div className="font-bold text-sm">Community Pulse</div>
                  <div className="text-xs text-on-surface-variant">15 minutes ago</div>
                </div>
              </div>
              <p className="text-lg font-semibold mb-6">30 people are cheering for the <span className="text-primary">Grand Final</span></p>
              <div className="flex -space-x-3 mb-6">
                <img className="w-10 h-10 rounded-full border-2 border-surface object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgqK-sf-OqLWNsHpz8rIH56TC_pSl0zl8AN9Uf1UtcjuJdB7UMFT0tp4oRDA57gaAbmz2_fp60YWUG93myvoY3fJ2AXKyntS41xWe_6PssdAPwfws5bhefe1TrT8wy24Wgp5UKD_p5hXPj3saGAW2rWb3dXOLsmIOltREipxSdrq4YNWgriCpAfIRGnKtVUxudgitiVwPdm34IxZXcv9AVYwJ7jhWa9-9J9oWX-Pcb_TcwzNfonkprwGUK09Ib4pDnJ7qf0zT_1NrK" alt="user1"/>
                <img className="w-10 h-10 rounded-full border-2 border-surface object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYNynW1YUCohGYcKMMMMt1OAGifbemx0G_5-0yJUvOPg_R0Jp-yN0gbvW0oH321SGuwLBdvgrPCfzZ_zbbwDKWTOimEyJp_B8TydUtfXftgSpJqEO_AWhRSGfub1GctgKtGIDTXZnr_f4IeSFSakmLMQjGTqeX9J9dHtBr1DmnmU4bcbQWwtVSXHT8QNZq6ed3xNhfFgoOJ16zlA0NIu9LexULFX6VSuSj7JZa89C81X7pVf0xbJHew-nDOxS6fwc92JYYc70J_Iz4" alt="user2"/>
                <img className="w-10 h-10 rounded-full border-2 border-surface object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdbFB3-QTkRNnc9SbXA94HEKJZfroWk9eKfX1Kao_SapViUAvWpVuwkdfzlp54vfoCJ-cn5OaaDopVWVDiHEwD9l0qmQxvmtFo5UIcjTt4zz_FGxUHTnJHx1M6l5qqj5MQhJHbj7_xuhF7rBJSwvMqjajAPC_U9EGNwA6kXtZa8o7cgvtog1qS4DifjaiudjxLfGHfR1KzVSYeMP9J8UXdXtgRaJFB5zDGDSjy4Ryz3m8VXDV2cbXXKjQd66_J-CV7k7628vwoH1uh" alt="user3"/>
                <div className="w-10 h-10 rounded-full bg-surface-container-highest border-2 border-surface flex items-center justify-center text-xs font-bold">+27</div>
              </div>
              <button className="w-full py-3 rounded-xl bg-surface-container-high hover:bg-surface-bright font-bold flex items-center justify-center gap-2 transition-all text-on-surface">
                <span className="material-symbols-outlined text-secondary">pan_tool</span>
                Join the Crowd
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Umpire-to-Crowd Connection */}
      <section className="py-24 overflow-hidden" id="features">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="bg-surface-container-low rounded-[40px] p-8 aspect-square relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/10 opacity-30 blur-3xl"></div>
                {/* Phone Mockup Frame */}
                <div className="w-64 h-[500px] bg-slate-900 rounded-[3rem] border-8 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                  <div className="h-6 w-32 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl"></div>
                  <div className="mt-12 p-4">
                    <div className="text-center mb-8">
                      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label">Official Scorer</div>
                      <div className="font-bold text-lg">Match Update</div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Warriors</span>
                          <span className="text-secondary font-bold">+2</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                          <div className="h-full bg-secondary w-3/4"></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="bg-primary-container/20 py-4 rounded-xl border border-primary/30 flex flex-col items-center">
                          <span className="material-symbols-outlined text-primary">add</span>
                          <span className="text-[10px] font-bold">SCORE</span>
                        </button>
                        <button className="bg-surface-container py-4 rounded-xl border border-outline-variant/20 flex flex-col items-center">
                          <span className="material-symbols-outlined text-on-surface">undo</span>
                          <span className="text-[10px] font-bold">UNDO</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto p-4 bg-primary-container text-center py-4 font-bold text-sm text-on-primary-container">
                    TRANSMITTING LIVE...
                  </div>
                </div>
                {/* Floating Signal Waves */}
                <div className="absolute top-1/4 -right-10 flex gap-2">
                  <span className="w-3 h-3 rounded-full bg-secondary animate-ping"></span>
                  <span className="w-3 h-3 rounded-full bg-secondary"></span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-primary font-bold tracking-widest uppercase text-sm mb-6">
                <span className="material-symbols-outlined text-lg">sensors</span>
                The Connection
              </div>
              <h2 className="font-headline text-5xl md:text-6xl font-extrabold tracking-tight mb-8 leading-tight">Umpire-to-Crowd Instant Sync</h2>
              <p className="text-on-surface-variant text-xl leading-relaxed mb-10">
                Zero-latency scoring. When the umpire taps the screen, the arena phone vibrates, the leaderboard flashes, and the community goes wild. No more waiting for "official results."
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="mt-1 w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[14px] text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">One-Tap Management</h4>
                    <p className="text-on-surface-variant">Simplified umpire tools that anyone can use.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1 w-6 h-6 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[14px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Live Notifications</h4>
                    <p className="text-on-surface-variant">Followers get pinged the moment the score changes.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Tournament Social Tiers */}
      <section className="py-24 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="font-headline text-4xl font-bold mb-4">Engage Your Community</h2>
            <p className="text-on-surface-variant">Define how your audience interacts with the tournament ecosystem.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Tier 1 */}
            <div className="group p-8 rounded-[2rem] bg-surface-container border border-outline-variant/10 hover:border-primary/40 transition-all duration-500">
              <span className="material-symbols-outlined text-4xl text-primary mb-6">person</span>
              <h3 className="text-2xl font-bold mb-4">Supporters</h3>
              <p className="text-on-surface-variant mb-8">Follow teams, receive goal alerts, and participate in global live chats.</p>
              <ul className="space-y-3 mb-10">
                <li className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                  Live Push Notifications
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                  Custom Cheer Emojis
                </li>
              </ul>
              <button 
                onClick={() => setAuthModal("signup")}
                className="w-full py-4 rounded-xl border border-outline-variant/30 font-bold group-hover:bg-primary-container group-hover:text-on-primary-container transition-all"
              >
                Join as Fan
              </button>
            </div>
            {/* Tier 2 */}
            <div className="group p-8 rounded-[2rem] bg-surface-container-high border-2 border-primary shadow-2xl shadow-primary/10 relative -translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">Most Popular</div>
              <span className="material-symbols-outlined text-4xl text-secondary mb-6">military_tech</span>
              <h3 className="text-2xl font-bold mb-4">Competitors</h3>
              <p className="text-on-surface-variant mb-8">Personal player profiles, career stats, and highlight reel generation.</p>
              <ul className="space-y-3 mb-10">
                <li className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                  ELO Ranking System
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                  Bracket History
                </li>
              </ul>
              <button 
                onClick={() => setAuthModal("signup")}
                className="w-full py-4 rounded-xl bg-primary-container text-on-primary-container font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
              >
                Register Team
              </button>
            </div>
            {/* Tier 3 */}
            <div className="group p-8 rounded-[2rem] bg-surface-container border border-outline-variant/10 hover:border-primary/40 transition-all duration-500">
              <span className="material-symbols-outlined text-4xl text-tertiary mb-6">verified</span>
              <h3 className="text-2xl font-bold mb-4">Organizers</h3>
              <p className="text-on-surface-variant mb-8">Full bracket control, sponsor placement, and revenue management tools.</p>
              <ul className="space-y-3 mb-10">
                <li className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                  Sponsor Dashboards
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                  Ticket Sales Engine
                </li>
              </ul>
              <button 
                onClick={() => setAuthModal("signup")}
                className="w-full py-4 rounded-xl border border-outline-variant/30 font-bold group-hover:bg-primary-container group-hover:text-on-primary-container transition-all"
              >
                Host Event
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Hall of Fame (Leaderboard) */}
      <section className="py-24 relative overflow-hidden" id="leaderboard">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-16">
            <h2 className="font-headline text-5xl font-bold tracking-tight mb-4">Hall of Fame</h2>
            <p className="text-on-surface-variant text-xl">The legends, the favorites, the most cheered.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Rankings Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-12 px-6 py-4 text-xs font-label uppercase tracking-widest text-on-surface-variant">
                <div className="col-span-1">Rank</div>
                <div className="col-span-5">Team / Player</div>
                <div className="col-span-2 text-center">Score</div>
                <div className="col-span-2 text-center">Wins</div>
                <div className="col-span-2 text-right">Support</div>
              </div>
              {/* Row 1 */}
              <div className="grid grid-cols-12 px-6 py-6 bg-surface-container-low rounded-2xl items-center hover:bg-surface-container transition-colors group">
                <div className="col-span-1 font-label text-2xl text-primary">01</div>
                <div className="col-span-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-bold border border-outline-variant/20">KV</div>
                  <div>
                    <div className="font-bold">Kinetic Vault</div>
                    <div className="text-xs text-on-surface-variant">Elite Division</div>
                  </div>
                </div>
                <div className="col-span-2 text-center font-label text-xl">2,450</div>
                <div className="col-span-2 text-center">
                  <span className="bg-secondary-container/20 text-secondary text-[10px] font-bold px-2 py-1 rounded-full">12-1</span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-1.5 text-secondary">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                  <span className="font-label">12.8k</span>
                </div>
              </div>
              {/* Row 2 */}
              <div className="grid grid-cols-12 px-6 py-6 bg-surface-container-low rounded-2xl items-center hover:bg-surface-container transition-colors">
                <div className="col-span-1 font-label text-2xl text-on-surface-variant">02</div>
                <div className="col-span-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-bold border border-outline-variant/20">RA</div>
                  <div>
                    <div className="font-bold">Rapid Apex</div>
                    <div className="text-xs text-on-surface-variant">Elite Division</div>
                  </div>
                </div>
                <div className="col-span-2 text-center font-label text-xl">2,210</div>
                <div className="col-span-2 text-center">
                  <span className="bg-secondary-container/20 text-secondary text-[10px] font-bold px-2 py-1 rounded-full">10-3</span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">favorite</span>
                  <span className="font-label">8.4k</span>
                </div>
              </div>
              {/* Row 3 */}
              <div className="grid grid-cols-12 px-6 py-6 bg-surface-container-low rounded-2xl items-center hover:bg-surface-container transition-colors">
                <div className="col-span-1 font-label text-2xl text-on-surface-variant">03</div>
                <div className="col-span-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-bold border border-outline-variant/20">NS</div>
                  <div>
                    <div className="font-bold">Neon Strike</div>
                    <div className="text-xs text-on-surface-variant">Pro League</div>
                  </div>
                </div>
                <div className="col-span-2 text-center font-label text-xl">1,980</div>
                <div className="col-span-2 text-center">
                  <span className="bg-secondary-container/20 text-secondary text-[10px] font-bold px-2 py-1 rounded-full">9-4</span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">favorite</span>
                  <span className="font-label">6.2k</span>
                </div>
              </div>
            </div>
            {/* MVP Spotlight */}
            <div className="relative">
              <div className="bg-gradient-to-br from-primary-container to-indigo-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden h-full flex flex-col justify-end min-h-[500px]">
                <div className="absolute top-0 left-0 w-full h-full">
                  <img 
                    className="w-full h-full object-cover opacity-60 mix-blend-overlay" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4ach31Vh3V3av4Cv0DItF2xi06D-drp-xbGvqc1vK7OPuByOkqwZ-ywNbeopUX5pF5LVC5PDUja9IVNadYXo2uoMJE09p2w52kVU6qjqTqMRe5Mthusn2hicd71XYNz2dWJ76_4JsJgKOQWLEZ_wO1VbMpyKCrKyGUiJ-8-N0nPDZbDubLmHJiz-hMrtlfLP-KF71F91PnAHOMsQ_fMtrHDK99zxP_wfS9jrNclbaIyxZiDKNLaenS55MKPSA7ZrJZue8s2KR2Exl" 
                    alt="MVP spotlight"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                <div className="relative z-10">
                  <div className="inline-block bg-tertiary text-on-tertiary font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest mb-4">Week MVP</div>
                  <div className="font-label text-7xl font-bold text-white/10 absolute -top-12 -left-4 select-none">#07</div>
                  <h3 className="text-4xl font-headline font-black text-white mb-2">Marcus "Volt" Chen</h3>
                  <p className="text-indigo-200 text-lg mb-6">Leading the league with 42 highlight-reel scores this season.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <div className="text-xs uppercase font-label text-indigo-200">Win Rate</div>
                      <div className="text-2xl font-bold font-label">92%</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <div className="text-xs uppercase font-label text-indigo-200">Likes</div>
                      <div className="text-2xl font-bold font-label">4.1k</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/20 bg-slate-950">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full font-inter text-sm antialiased max-w-7xl mx-auto">
          <div className="mb-6 md:mb-0">
            <div className="text-lg font-bold text-slate-200 mb-2">Score:Board</div>
            <div className="text-slate-500">© 2024 Score:Board Kinetic Vault. All Rights Reserved.</div>
          </div>
          <div className="flex gap-8 items-center">
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors opacity-80 hover:opacity-100" href="#">Privacy Policy</Link>
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors opacity-80 hover:opacity-100" href="#">Terms of Service</Link>
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors opacity-80 hover:opacity-100" href="#">API Docs</Link>
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors opacity-80 hover:opacity-100" href="#">Contact Support</Link>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL */}
      {authModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-hidden">
          <div className="absolute inset-0 z-0 bg-gradient-radial from-surface-container-low via-surface to-surface opacity-80 pointer-events-none"></div>
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary-container blur-[150px] opacity-10 pointer-events-none"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary-container blur-[150px] opacity-10 pointer-events-none"></div>
          
          <main className="w-full max-w-[480px] p-6 relative z-10 flex flex-col gap-8 animate-in zoom-in-95 duration-300">
            <header className="text-center space-y-4">
              <h1 className="font-headline text-5xl font-black tracking-tighter text-on-surface">Score:Board</h1>
              <p className="font-body text-on-surface-variant text-lg">
                {authModal === 'login' ? 'Welcome Athlete or Organizer' : 'Create your organizer account'}
              </p>
            </header>

            <section className="glass-panel rounded-xl p-8 shadow-[0_0_40px_rgba(79,70,229,0.06)] flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <button className="flex items-center justify-center gap-3 w-full h-12 rounded-xl bg-surface-container-highest hover:bg-surface-variant transition-colors text-on-surface font-body font-semibold">
                  <span className="material-symbols-outlined text-xl">account_circle</span>
                  Continue with Google
                </button>
                <button className="flex items-center justify-center gap-3 w-full h-12 rounded-xl bg-surface-container-highest hover:bg-surface-variant transition-colors text-on-surface font-body font-semibold">
                  <span className="material-symbols-outlined text-xl">forum</span>
                  Continue with Discord
                </button>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-outline-variant opacity-20 flex-1"></div>
                <span className="font-label text-sm text-outline uppercase tracking-widest">Or</span>
                <div className="h-px bg-outline-variant opacity-20 flex-1"></div>
              </div>

              <form className="flex flex-col gap-5">
                <label className="flex flex-col gap-2">
                  <span className="font-body text-sm font-medium text-on-surface-variant">Email</span>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">mail</span>
                    <input 
                      className="w-full h-14 bg-surface-container-lowest text-on-surface font-body rounded-lg pl-12 pr-4 border-none focus:ring-1 focus:ring-primary-container focus:outline-none placeholder:text-outline transition-shadow" 
                      placeholder="Enter your email" 
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="font-body text-sm font-medium text-on-surface-variant">Password</span>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                    <input 
                      className="w-full h-14 bg-surface-container-lowest text-on-surface font-body rounded-lg pl-12 pr-4 border-none focus:ring-1 focus:ring-primary-container focus:outline-none placeholder:text-outline transition-shadow" 
                      placeholder="Enter your password" 
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </label>

                {authModal === 'login' && (
                  <div className="flex items-center justify-between pt-1 pb-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input className="form-checkbox rounded bg-surface-container-lowest border-none text-primary-container focus:ring-0 focus:ring-offset-0 w-5 h-5 transition-colors" type="checkbox" />
                      <span className="font-body text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">Remember me</span>
                    </label>
                    <button type="button" className="font-body text-sm text-primary hover:text-primary-fixed transition-colors">Forgot password?</button>
                  </div>
                )}

                <button 
                  onClick={() => handleAuth(authModal)}
                  className="w-full h-14 rounded-xl bg-primary-container/80 hover:bg-primary-container backdrop-blur-md text-on-primary-container font-headline font-bold text-lg tracking-wide transition-all shadow-[0_0_15px_rgba(195,192,255,0.1)] hover:shadow-[0_0_20px_rgba(195,192,255,0.2)]" 
                  type="button"
                >
                  {authModal === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
                
                <button 
                  onClick={() => setAuthModal(null)}
                  className="w-full py-2 text-on-surface-variant font-medium hover:text-on-surface transition-colors"
                  type="button"
                >
                  Cancel
                </button>
              </form>

              <p className="text-center font-body text-sm text-on-surface-variant mt-2">
                {authModal === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                <button 
                  onClick={() => setAuthModal(authModal === 'login' ? 'signup' : 'login')}
                  className="text-primary hover:text-primary-fixed font-semibold transition-colors"
                >
                  {authModal === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </section>
            
            <footer className="text-center font-label text-xs text-outline opacity-60">
              Secure Gateway • v2.4.1
            </footer>
          </main>
        </div>
      )}

      {/* CREATE TOURNAMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-surface-container-high rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <h2 className="text-3xl font-headline font-black mb-8">New Tournament</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Tournament Name</label>
                <input 
                  className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface outline-none focus:border-primary transition-colors" 
                  placeholder="e.g. Summer Open 2026"
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Sport Type</label>
                  <select 
                    className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface outline-none focus:border-primary transition-colors appearance-none"
                    value={newSport}
                    onChange={e => setNewSport(e.target.value)}
                  >
                    <option value="Tennis">Tennis</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Football">Football</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Tournament Format</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setStage1Type('bracket')}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-bold transition-all ${stage1Type === 'bracket' ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}
                    >
                      BRACKET
                    </button>
                    <button 
                      onClick={() => setStage1Type('groups')}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-bold transition-all ${stage1Type === 'groups' ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}
                    >
                      GROUPS
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant/10">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Max teams</label>
                <input 
                  type="number" 
                  value={maxTeams} 
                  onChange={(e) => setMaxTeams(e.target.value === "" ? "" : parseInt(e.target.value))}
                  placeholder="e.g. 16"
                  className="w-full bg-transparent text-2xl font-black text-on-surface outline-none"
                />
              </div>

              {/* CONDITIONAL SETTINGS */}
              <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant/10 space-y-4">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Match Rules</p>
                
                {(newSport === 'Tennis' || newSport === 'Volleyball') && (
                  <div>
                    <label className="text-xs text-on-surface-variant">Max Sets</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-surface-container-high rounded-lg border border-outline-variant/20 mt-1" 
                      defaultValue={3} 
                      id="max_sets"
                    />
                  </div>
                )}

                {newSport === 'Volleyball' && (
                  <div>
                    <label className="text-xs text-on-surface-variant">Points per Set</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-surface-container-high rounded-lg border border-outline-variant/20 mt-1" 
                      defaultValue={25} 
                      id="points_per_set"
                    />
                  </div>
                )}

                {newSport === 'Football' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-on-surface-variant">Duration (mins)</label>
                      <input type="number" className="w-full p-3 bg-surface-container-high rounded-lg border border-outline-variant/20 mt-1" defaultValue={90} id="duration"/>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Format</label>
                      <select className="w-full p-3 bg-surface-container-high rounded-lg border border-outline-variant/20 mt-1" id="period_format">
                        <option value="halves">Halves</option>
                        <option value="single">Single Period</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-4 text-on-surface-variant font-bold hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreate} 
                  className="flex-1 bg-primary-container text-on-primary-container py-4 rounded-xl font-bold text-lg hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20"
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
