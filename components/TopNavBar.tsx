"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useFollow } from "@/lib/hooks/useFollow";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import NotificationBell from "./NotificationBell";
import LanguageSelector from "./LanguageSelector";

export default function TopNavBar() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [counts, setCounts] = useState<{ matches: number; tournaments: number; following?: number }>({
    matches: 0,
    tournaments: 0,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const followHook = useFollow();

  useEffect(() => {
    setHasMounted(true);
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchCounts = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const [mRes, tRes] = await Promise.all([
          supabase.from("matches").select("id", { count: "exact" }),
          supabase.from("tournaments").select("id", { count: "exact" }),
        ]);
        if (active) {
          setCounts((prev) => ({
            ...prev,
            matches: mRes.count ?? (Array.isArray(mRes.data) ? mRes.data.length : prev.matches),
            tournaments: tRes.count ?? (Array.isArray(tRes.data) ? tRes.data.length : prev.tournaments),
          }));
        }
      } catch (err) {
        console.error("Failed to load nav counts:", err);
      }
    };
    fetchCounts();

    const onCounts = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && active) {
        setCounts((prev) => ({
          matches: detail.matches ?? prev.matches,
          tournaments: detail.tournaments ?? prev.tournaments,
          following: detail.following ?? prev.following,
        }));
      }
    };
    window.addEventListener("scoreboard:counts", onCounts);

    return () => {
      active = false;
      window.removeEventListener("scoreboard:counts", onCounts);
    };
  }, []);

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await signOut();
  };

  const isHome = pathname === "/";
  const activeTab = isHome ? (searchParams.get("tab") || "matches") : null;
  const isMatchesActive = activeTab === "matches";
  const isTournamentsActive = activeTab === "tournaments";
  const isFollowingActive = activeTab === "following";

  const totalFollowedCount =
    counts.following ?? (followHook.followedMatchIds.size + followHook.followedTournamentIds.size);

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 transition-all duration-300 ease-out border-b border-white/5">
      <div className="flex justify-between items-center px-4 sm:px-8 py-3.5 max-w-7xl mx-auto font-headline tracking-tight gap-4">
        <Link href="/" className="text-3xl sm:text-4xl font-digital text-white tracking-tighter hover:scale-105 transition-transform shrink-0">
          SCORE:BOARD
        </Link>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
          {hasMounted && (
            <>
              <Link
                href="/?tab=matches"
                scroll={false}
                className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full font-label text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isMatchesActive
                    ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-white/5"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">sports</span>
                <span>
                  {t("home.matchesTab")} ({counts.matches})
                </span>
              </Link>

              <Link
                href="/?tab=tournaments"
                scroll={false}
                className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full font-label text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isTournamentsActive
                    ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/20"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-white/5"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">emoji_events</span>
                <span>
                  {t("home.tournamentsTab")} ({counts.tournaments})
                </span>
              </Link>

              <Link
                href="/?tab=following"
                scroll={false}
                className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full font-label text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isFollowingActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-white/5"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[16px] text-amber-400"
                  style={{ fontVariationSettings: isFollowingActive ? "'FILL' 1" : undefined }}
                >
                  star
                </span>
                <span>
                  {t("home.followingTab")} {user ? `(${totalFollowedCount})` : ""}
                </span>
              </Link>
            </>
          )}
        </div>

        <div className="flex gap-4 md:gap-6 items-center shrink-0">
          {hasMounted && <LanguageSelector />}

          {hasMounted && user && <NotificationBell />}

          {hasMounted && user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="User menu"
                className="flex items-center gap-2 group focus:outline-none"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black group-hover:border-indigo-400/50 transition-all overflow-hidden">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.email?.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">
                  {isMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{t("nav.signedInAs")}</p>
                    <p className="text-xs font-bold text-white truncate">{user.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/settings'); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">settings</span>
                      {t("nav.settings")}
                    </button>
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/my-matches'); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all mt-1"
                    >
                      <span className="material-symbols-outlined text-lg">sports_tennis</span>
                      {t("nav.myMatches")}
                    </button>
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/my-tournaments'); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all mt-1"
                    >
                      <span className="material-symbols-outlined text-lg">emoji_events</span>
                      {t("nav.myTournaments")}
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all mt-1"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
                      {t("nav.signOut")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-4 items-center">
               <Link
                 href="/?auth=login"
                 className="text-slate-400 hover:text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all duration-300 ease-out active:scale-95"
               >
                 {t("nav.signIn")}
               </Link>
               <Link
                 href="/?auth=signup"
                 className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500/10 hover:text-indigo-300 transition-all duration-300 ease-out active:scale-95 shadow-lg shadow-indigo-500/20"
               >
                 {t("nav.getStarted")}
               </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
