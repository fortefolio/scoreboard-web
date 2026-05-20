"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { countSetsWon } from "@/lib/scoring/sets";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { user, supabase } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [featuredTournaments, setFeaturedTournaments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  const closeAuthModal = useCallback(() => {
    setAuthModal(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('auth');
    router.replace(window.location.pathname + (params.toString() ? '?' + params.toString() : ''), { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    const auth = searchParams.get('auth');
    if (auth === 'login') setAuthModal('login');
    else if (auth === 'signup') setAuthModal('signup');
    else setAuthModal(null);
  }, [searchParams]);

  const fetchLiveMatches = useCallback(async () => {
    const { data } = await supabase
      .from("matches")
      .select("*, tournaments(name)")
      .eq("status", "ongoing")
      .limit(10);
    if (data) setLiveMatches(data);
  }, [supabase]);

  const fetchFeaturedTournaments = useCallback(async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .neq("status", "completed")
      .limit(10);
    if (data) setFeaturedTournaments(data);
  }, [supabase]);

  useEffect(() => {
    fetchLiveMatches();
    fetchFeaturedTournaments();

    const channel = supabase
      .channel('live-arena-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: 'status=eq.ongoing' },
        () => { fetchLiveMatches(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLiveMatches, fetchFeaturedTournaments]);

  const handleAuth = async (type: "login" | "signup") => {
    if (!type) return;
    setIsSubmitting(true);

    try {
      if (type === "signup") {
        if (!username.trim()) {
          toast.error("Username is required");
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setIsSubmitting(false);
          return;
        }

        try {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username.trim())
            .maybeSingle();

          if (existingUser) {
            toast.error("Username already taken. Please choose another one.");
            setIsSubmitting(false);
            return;
          }
        } catch {
          // Username check failed; proceed and let signup itself surface errors.
        }
      }

      const { error } = type === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: username.trim() } },
          });

      if (error) {
        toast.error(error.message);
        setIsSubmitting(false);
      } else {
        if (type === "signup") {
          toast.success("Signup successful! Please check your email if confirmation is required.");
        } else {
          toast.success("Welcome back!");
        }
        closeAuthModal();
        const next = searchParams.get('next');
        if (next) router.push(next);
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">
      
      {/* Logged-in Content */}
      {user && (
        <>
          {/* 1. Live Matches Carousel (Top) */}
          <section className="pt-8 pb-12 bg-surface-container-lowest overflow-hidden" id="matches">
            <div className="max-w-7xl mx-auto px-8 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-headline text-3xl font-black tracking-tight mb-2 italic text-white">LIVE ARENA</h2>
                  <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Real-time pulse from the vault</p>
                </div>
                <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-red-500 font-black text-[9px] uppercase tracking-widest">Live Updates</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-6 overflow-x-auto px-8 pb-8 no-scrollbar scroll-smooth">
              {liveMatches.length > 0 ? liveMatches.map((match) => (
                <Link key={match.id} href={`/match/${match.id}`} className="min-w-[340px] group">
                  <div className="bg-surface-container p-6 rounded-[2rem] border border-outline-variant/10 hover:border-primary/40 transition-all duration-500 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">{match.tournaments?.name}</span>
                    </div>
                    <div className="space-y-4 pt-4">
                      {[0, 1].map((i) => {
                        const side = i === 0 ? 'home' : 'away';
                        let livePoints: string | number = 0;
                        let games: number | null = null;
                        const sets = countSetsWon(match.scores?.sets, i as 0 | 1);

                        if (match.status === 'ongoing' && match.scores) {
                          if (match.sport_type === 'Tennis' && match.scores.tennis) {
                            const p = match.scores.tennis.points?.[i] ?? 0;
                            const opp = match.scores.tennis.points?.[i === 0 ? 1 : 0] ?? 0;
                            games = match.scores.tennis.games?.[i] ?? 0;
                            const TENNIS_POINTS = ["0", "15", "30", "40", "AD"];
                            if (p >= 3 && opp >= 3) {
                              livePoints = p > opp ? "AD" : (p === opp ? "40" : "40");
                            } else {
                              livePoints = TENNIS_POINTS[p] || "0";
                            }
                          } else {
                            livePoints = match.scores.current?.[side] ?? 0;
                          }
                        }
                        
                        return (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-2 truncate max-w-[160px]">
                              <span className="text-lg font-bold text-on-surface truncate">{match.participants?.[i]?.name || "TBD"}</span>
                              {match.status === 'ongoing' && match.scores?.serving_index === i && (
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Serving"></span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase text-on-surface-variant opacity-40 leading-none mb-1">Sets</span>
                                <span className="text-sm font-bold text-on-surface-variant">{sets}</span>
                              </div>
                              {games !== null && (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black uppercase text-indigo-400/60 leading-none mb-1">Games</span>
                                  <span className="text-sm font-bold text-indigo-400">{games}</span>
                                </div>
                              )}
                              {match.status === 'ongoing' && (
                                <div className="flex flex-col items-end min-w-[40px]">
                                  <span className="text-[10px] font-black uppercase text-primary/60 leading-none mb-1">Points</span>
                                  <span className="text-3xl font-digital text-primary">{livePoints}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 pt-6 border-t border-outline-variant/10 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Round {match.round_number}</span>
                      <div className="flex items-center gap-2 text-secondary">
                        <span className="material-symbols-outlined text-sm">sensors</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Live Syncing</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="w-full text-center py-10 opacity-30 font-black uppercase tracking-widest text-xs">No live matches at the moment</div>
              )}
            </div>
          </section>

          {/* 2. Featured Tournaments Carousel */}
          <section className="py-12 overflow-hidden border-b border-white/5" id="tournaments">
            <div className="max-w-7xl mx-auto px-8 mb-8">
              <div>
                <h2 className="font-headline text-3xl font-black tracking-tight mb-2 italic text-white">FEATURED EVENTS</h2>
                <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.3em] opacity-60">The biggest competitions in the ecosystem</p>
              </div>
            </div>
            
            <div className="flex gap-8 overflow-x-auto px-8 pb-8 no-scrollbar scroll-smooth">
              {featuredTournaments.length > 0 ? featuredTournaments.map((t) => (
                <Link key={t.id} href={`/tournament/${t.id}`} className="min-w-[400px] group">
                  <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10 group-hover:border-primary/40 transition-all duration-500 shadow-2xl relative overflow-hidden h-[240px] flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-widest">{t.sport_type}</span>
                        <span className="text-on-surface-variant text-[9px] font-black uppercase tracking-widest opacity-50">{t.status}</span>
                      </div>
                      <h3 className="text-2xl font-black text-on-surface group-hover:text-primary transition-colors line-clamp-2 uppercase tracking-tighter italic">{t.name}</h3>
                    </div>
                    <div className="flex items-center justify-between text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{t.settings?.max_teams || 16} Teams Max</span>
                      </div>
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="w-full text-center py-10 opacity-30 font-black uppercase tracking-widest text-xs italic">Synchronizing tournament data...</div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Guest-only Marketing Sections */}
      {!user && (
        <>
          {/* Hero Section */}
          <section className="relative py-24 md:py-32 overflow-hidden border-b border-white/5" id="hero">
            <div className="absolute inset-0 z-0">
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/20 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-container/10 rounded-full blur-[120px]"></div>
            </div>
            
            <div className="max-w-7xl mx-auto px-8 relative z-10">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h1 className="font-headline text-6xl md:text-8xl font-black tracking-tighter leading-none mb-6 italic text-white">
                    DON'T JUST FOLLOW.<br/>
                    <span className="text-primary">BE PART OF THE GAME.</span>
                  </h1>
                  <p className="text-on-surface-variant text-xl md:text-2xl max-w-xl mb-10 leading-relaxed font-medium">
                    The first tournament platform where every point is a post. Live brackets, real-time trash talk, and community-driven sports management.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setAuthModal("signup")}
                      className="bg-primary-container text-on-primary-container px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm hover:brightness-110 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                    >
                      Create Your Tournament
                    </button>
                    <button 
                      onClick={() => setAuthModal("login")}
                      className="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-surface-bright transition-all active:scale-95"
                    >
                      Watch Live Feeds
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="bg-surface-container rounded-[3rem] p-4 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50"></div>
                    <img 
                      className="rounded-[2.5rem] w-full h-[500px] object-cover grayscale hover:grayscale-0 transition-all duration-700" 
                      src="https://images.unsplash.com/photo-1541252260730-0412e8e2108e?q=80&w=2000&auto=format&fit=crop"
                      alt="Hero sport"
                    />
                  </div>
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
                    <div className="w-64 h-[500px] bg-slate-900 rounded-[3rem] border-8 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                      <div className="h-6 w-32 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl"></div>
                      <div className="mt-12 p-4">
                        <div className="text-center mb-8">
                          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label font-black">Official Scorer</div>
                          <div className="font-black text-xl italic tracking-tighter text-white">ARENA UPDATE</div>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/20">
                            <div className="flex justify-between text-[10px] font-black uppercase mb-2 tracking-widest">
                              <span>Warriors</span>
                              <span className="text-secondary">+2</span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                              <div className="h-full bg-secondary w-3/4"></div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-primary-container/20 p-4 rounded-xl border border-primary/30 flex flex-col items-center">
                              <span className="material-symbols-outlined text-primary">add</span>
                              <span className="text-[10px] font-black uppercase tracking-widest mt-1">SCORE</span>
                            </div>
                            <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/20 flex flex-col items-center">
                              <span className="material-symbols-outlined text-on-surface">undo</span>
                              <span className="text-[10px] font-black uppercase tracking-widest mt-1">UNDO</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-auto p-4 bg-primary-container text-center py-4 font-black tracking-[0.2em] text-[10px] text-on-primary-container">
                        TRANSMITTING LIVE...
                      </div>
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 text-primary font-black tracking-widest uppercase text-xs mb-6">
                    <span className="material-symbols-outlined text-lg">sensors</span>
                    THE CONNECTION
                  </div>
                  <h2 className="font-headline text-5xl md:text-6xl font-black tracking-tighter mb-8 leading-[0.9] italic uppercase text-white">Umpire-to-Crowd Instant Sync</h2>
                  <p className="text-on-surface-variant text-xl leading-relaxed mb-10 font-medium">
                    Zero-latency scoring. When the umpire taps the screen, the arena phone vibrates, the leaderboard flashes, and the community goes wild. No more waiting for "official results."
                  </p>
                  <ul className="space-y-8">
                    <li className="flex items-start gap-5">
                      <div className="mt-1 w-8 h-8 rounded-xl bg-secondary-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-lg text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      </div>
                      <div>
                        <h4 className="font-black text-lg uppercase tracking-tight italic text-white">One-Tap Management</h4>
                        <p className="text-on-surface-variant font-medium">Simplified umpire tools that anyone can use.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-5">
                      <div className="mt-1 w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-lg text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                      </div>
                      <div>
                        <h4 className="font-black text-lg uppercase tracking-tight italic text-white">Live Notifications</h4>
                        <p className="text-on-surface-variant font-medium">Followers get pinged the moment the score changes.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Tournament Social Tiers */}
          <section className="py-24 bg-surface-container-lowest border-y border-white/5">
            <div className="max-w-7xl mx-auto px-8">
              <div className="text-center max-w-2xl mx-auto mb-20">
                <h2 className="font-headline text-5xl font-black mb-4 italic tracking-tighter uppercase text-white">Community Ecosystem</h2>
                <p className="text-on-surface-variant font-medium">Define how your audience interacts with the tournament universe.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                {/* Tier 1 */}
                <div className="group p-10 rounded-[2.5rem] bg-surface-container border border-outline-variant/10 hover:border-primary/40 transition-all duration-500 shadow-xl">
                  <span className="material-symbols-outlined text-4xl text-primary mb-8">person</span>
                  <h3 className="text-2xl font-black mb-4 uppercase italic tracking-tighter text-white">Supporters</h3>
                  <p className="text-on-surface-variant mb-10 font-medium leading-relaxed">Follow teams, receive goal alerts, and participate in global live chats.</p>
                  <ul className="space-y-4 mb-12">
                    <li className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-on-surface">
                      <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                      Push Notifications
                    </li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-on-surface">
                      <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                      Cheer Emojis
                    </li>
                  </ul>
                  <button 
                    onClick={() => setAuthModal("signup")}
                    className="w-full py-4 rounded-xl border border-outline-variant/30 font-black uppercase tracking-widest text-[10px] group-hover:bg-primary-container group-hover:text-on-primary-container transition-all"
                  >
                    Join as Fan
                  </button>
                </div>
                {/* Tier 2 */}
                <div className="group p-10 rounded-[2.5rem] bg-surface-container-high border-2 border-primary shadow-2xl shadow-primary/10 relative -translate-y-4">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[9px] font-black uppercase tracking-[0.3em] px-5 py-1.5 rounded-full">Most Popular</div>
                  <span className="material-symbols-outlined text-4xl text-secondary mb-8">military_tech</span>
                  <h3 className="text-2xl font-black mb-4 uppercase italic tracking-tighter text-white">Competitors</h3>
                  <p className="text-on-surface-variant mb-10 font-medium leading-relaxed">Personal player profiles, career stats, and highlight reel generation.</p>
                  <ul className="space-y-4 mb-12">
                    <li className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-white">
                      <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                      ELO Ranking
                    </li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-white">
                      <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                      Bracket History
                    </li>
                  </ul>
                  <button 
                    onClick={() => setAuthModal("signup")}
                    className="w-full py-4 rounded-full bg-primary-container text-on-primary-container font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Register Team
                  </button>
                </div>
                {/* Tier 3 */}
                <div className="group p-10 rounded-[2.5rem] bg-surface-container border border-outline-variant/10 hover:border-primary/40 transition-all duration-500 shadow-xl">
                  <span className="material-symbols-outlined text-4xl text-tertiary mb-8">verified</span>
                  <h3 className="text-2xl font-black mb-4 uppercase italic tracking-tighter text-white">Organizers</h3>
                  <p className="text-on-surface-variant mb-10 font-medium leading-relaxed">Full bracket control, sponsor placement, and revenue management tools.</p>
                  <ul className="space-y-4 mb-12">
                    <li className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-on-surface">
                      <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                      Sponsor Panels
                    </li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-on-surface">
                      <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                      Ticket Sales
                    </li>
                  </ul>
                  <button 
                    onClick={() => setAuthModal("signup")}
                    className="w-full py-4 rounded-xl border border-outline-variant/30 font-black uppercase tracking-widest text-[10px] group-hover:bg-primary-container group-hover:text-on-primary-container transition-all"
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
              <div className="mb-20">
                <h2 className="font-headline text-5xl font-black tracking-tighter italic uppercase mb-4 text-white">Hall of Fame</h2>
                <p className="text-on-surface-variant text-xl font-medium">The legends, the favorites, the most cheered.</p>
              </div>
              <div className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-12 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant opacity-50">
                    <div className="col-span-1">Rank</div>
                    <div className="col-span-5">Team / Player</div>
                    <div className="col-span-2 text-center">Score</div>
                    <div className="col-span-2 text-center">Wins</div>
                    <div className="col-span-2 text-right">Support</div>
                  </div>
                  <div className="grid grid-cols-12 px-8 py-8 bg-surface-container-low rounded-3xl items-center hover:bg-surface-container transition-all duration-500 group border border-white/5 shadow-2xl">
                    <div className="col-span-1 font-label text-3xl font-black text-primary italic">01</div>
                    <div className="col-span-5 flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-lg border border-outline-variant/20 shadow-inner italic">KV</div>
                      <div>
                        <div className="font-black text-lg uppercase italic tracking-tight text-white">Kinetic Vault</div>
                        <div className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-50">Elite Division</div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center font-digital text-3xl text-white">2,450</div>
                    <div className="col-span-2 text-center">
                      <span className="bg-secondary-container/20 text-secondary text-[10px] font-black px-3 py-1 rounded-lg border border-secondary/20">12-1</span>
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-2 text-secondary">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                      <span className="font-label font-black text-base italic">12.8k</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 px-8 py-8 bg-surface-container-low/50 rounded-3xl items-center hover:bg-surface-container transition-all duration-500 border border-white/5 opacity-80 hover:opacity-100">
                    <div className="col-span-1 font-label text-3xl font-black text-on-surface-variant italic">02</div>
                    <div className="col-span-5 flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-lg border border-outline-variant/20 italic text-white">RA</div>
                      <div>
                        <div className="font-black text-lg uppercase italic tracking-tight text-white">Rapid Apex</div>
                        <div className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-50">Elite Division</div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center font-digital text-3xl text-slate-400">2,210</div>
                    <div className="col-span-2 text-center">
                      <span className="bg-secondary-container/10 text-slate-400 text-[10px] font-black px-3 py-1 rounded-lg border border-white/5">10-3</span>
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-2 text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">favorite</span>
                      <span className="font-label font-black text-base italic">8.4k</span>
                    </div>
                  </div>
                </div>
                <div className="relative h-full">
                  <div className="bg-gradient-to-br from-primary-container to-indigo-950 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden h-full flex flex-col justify-end min-h-[600px] border border-white/10">
                    <div className="absolute top-0 left-0 w-full h-full">
                      <img 
                        className="w-full h-full object-cover opacity-40 mix-blend-overlay grayscale" 
                        src="https://images.unsplash.com/photo-1541252260730-0412e8e2108e?q=80&w=2000&auto=format&fit=crop" 
                        alt="MVP spotlight"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                    <div className="relative z-10">
                      <div className="inline-block bg-secondary text-on-secondary font-black px-4 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] mb-6">Week MVP</div>
                      <div className="font-digital text-[12rem] font-black text-white/5 absolute -top-20 -left-10 select-none">#07</div>
                      <h3 className="text-5xl font-black text-white mb-4 uppercase italic tracking-tighter leading-none">Marcus "Volt" Chen</h3>
                      <p className="text-indigo-200 text-lg mb-10 font-medium italic">Leading the league with 42 highlight-reel scores this season.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10">
                          <div className="text-[10px] uppercase font-black tracking-widest text-indigo-200 opacity-60 mb-2">Win Rate</div>
                          <div className="text-3xl font-black font-digital italic text-white">92%</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10">
                          <div className="text-[10px] uppercase font-black tracking-widest text-indigo-200 opacity-60 mb-2">Likes</div>
                          <div className="text-3xl font-black font-digital italic text-white">4.1k</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer (Always visible) */}
      <footer className="w-full border-t border-white/5 bg-slate-950">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full font-inter text-sm antialiased max-w-7xl mx-auto">
          <div className="mb-6 md:mb-0">
            <div className="text-lg font-digital text-slate-200 mb-2">SCORE:BOARD</div>
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-40">© 2024 Kinetic Vault. All Rights Reserved.</div>
          </div>
          <div className="flex gap-8 items-center">
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors text-[10px] font-black uppercase tracking-widest" href="#">Privacy</Link>
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors text-[10px] font-black uppercase tracking-widest" href="#">Terms</Link>
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors text-[10px] font-black uppercase tracking-widest" href="#">Docs</Link>
            <Link className="text-slate-500 hover:text-indigo-400 transition-colors text-[10px] font-black uppercase tracking-widest" href="#">Support</Link>
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
              <h1 className="font-digital text-5xl tracking-tighter text-on-surface">SCORE:BOARD</h1>
              <p className="font-body text-on-surface-variant text-lg">
                {authModal === "login" ? "Welcome Athlete or Organizer" : "Create your organizer account"}
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
                {authModal === "signup" && (
                  <label className="flex flex-col gap-2">
                    <span className="font-body text-sm font-medium text-on-surface-variant">Username</span>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">person</span>
                      <input 
                        className="w-full h-14 bg-surface-container-lowest text-on-surface font-body rounded-lg pl-12 pr-4 border-none focus:ring-1 focus:ring-primary-container focus:outline-none placeholder:text-outline transition-shadow" 
                        placeholder="Choose a username" 
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                      />
                    </div>
                  </label>
                )}
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

                {authModal === "signup" && (
                  <label className="flex flex-col gap-2">
                    <span className="font-body text-sm font-medium text-on-surface-variant">Confirm Password</span>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                      <input 
                        className="w-full h-14 bg-surface-container-lowest text-on-surface font-body rounded-lg pl-12 pr-4 border-none focus:ring-1 focus:ring-primary-container focus:outline-none placeholder:text-outline transition-shadow" 
                        placeholder="Confirm your password" 
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </label>
                )}

                {authModal === "login" && (
                  <div className="flex items-center justify-between pt-1 pb-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input className="form-checkbox rounded bg-surface-container-lowest border-none text-primary-container focus:ring-0 focus:ring-offset-0 w-5 h-5 transition-colors" type="checkbox" />
                      <span className="font-body text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">Remember me</span>
                    </label>
                    <button type="button" className="font-body text-sm text-primary hover:text-primary-fixed transition-colors">Forgot password?</button>
                  </div>
                )}

                <button 
                  onClick={() => handleAuth(authModal as any)}
                  disabled={isSubmitting}
                  className="w-full h-14 rounded-full bg-primary-container/80 hover:bg-primary-container backdrop-blur-md text-on-primary-container font-headline font-bold text-lg tracking-wide transition-all shadow-[0_0_15px_rgba(195,192,255,0.1)] hover:shadow-[0_0_20px_rgba(195,192,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3" 
                  type="button"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    authModal === "login" ? "Sign In" : "Sign Up"
                  )}
                </button>

                <button 
                  onClick={closeAuthModal}
                  className="w-full py-2 text-on-surface-variant font-medium hover:text-on-surface transition-colors"
                  type="button"
                >
                  Cancel
                </button>
              </form>

              <p className="text-center font-body text-sm text-on-surface-variant mt-2">
                {authModal === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button 
                  onClick={() => setAuthModal(authModal === "login" ? "signup" : "login")}
                  className="text-primary hover:text-primary-fixed font-semibold transition-colors"
                >
                  {authModal === "login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </section>
            
            <footer className="text-center font-label text-xs text-outline opacity-60">
              Secure Gateway • v2.4.1
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}
