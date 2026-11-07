"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import NotificationBell from "./NotificationBell";
import LanguageSelector from "./LanguageSelector";

export default function TopNavBar() {
  const { user, supabase, signOut } = useAuth();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!user) {
      setSubscriptionTier("free");
      return;
    }
    let isMounted = true;
    const fetchTier = async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("subscription_tier")
          .eq("id", user.id)
          .maybeSingle();

        if (isMounted && data?.subscription_tier) {
          setSubscriptionTier(data.subscription_tier);
        }
      } catch {
        // ignore
      }
    };

    fetchTier();

    return () => {
      isMounted = false;
    };
  }, [user, supabase]);

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

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await signOut();
  };

  const isHome = pathname === "/";
  const activeTab = isHome ? (searchParams.get("tab") || "matches") : null;
  const isMatchesActive = activeTab === "matches";
  const isTournamentsActive = activeTab === "tournaments";
  const isFollowingActive = activeTab === "following";

  if (pathname?.includes("/overlay")) {
    return null;
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 transition-all duration-300 ease-out border-b border-white/5">
      <div className="flex justify-between items-center px-4 sm:px-8 py-3 sm:py-4 max-w-7xl mx-auto font-headline tracking-tight">
        <Link href="/" className="text-2xl sm:text-3xl md:text-4xl font-digital text-white tracking-tighter hover:scale-105 transition-transform shrink-0">
          SCORE:BOARD
        </Link>

        {/* Navigation Links (Desktop only, hidden on mobile in favor of bottom tab bar) */}
        <div className="hidden md:flex gap-8 items-center">
          {hasMounted && (
            <>
              <Link
                href="/?tab=matches"
                scroll={false}
                className={`transition-colors transition-all duration-300 ease-out active:scale-95 text-sm font-black uppercase tracking-widest ${
                  isMatchesActive
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t("home.matchesTab")}
              </Link>

              <Link
                href="/?tab=tournaments"
                scroll={false}
                className={`transition-colors transition-all duration-300 ease-out active:scale-95 text-sm font-black uppercase tracking-widest ${
                  isTournamentsActive
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t("home.tournamentsTab")}
              </Link>

              <Link
                href="/?tab=following"
                scroll={false}
                className={`transition-colors transition-all duration-300 ease-out active:scale-95 text-sm font-black uppercase tracking-widest ${
                  isFollowingActive
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t("home.followingTab")}
              </Link>
            </>
          )}
        </div>

        <div className="flex gap-2 sm:gap-4 md:gap-6 items-center shrink-0">
          {hasMounted && <LanguageSelector />}

          {/* Notification bell on desktop (on mobile, it lives on the bottom tab bar) */}
          {hasMounted && user && (
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          )}

          {hasMounted && user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="User menu"
                className="flex items-center gap-1.5 sm:gap-2 group focus:outline-none"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black group-hover:border-indigo-400/50 transition-all overflow-hidden text-xs sm:text-sm">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.email?.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors text-lg sm:text-2xl">
                  {isMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-3 w-52 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("nav.signedInAs")}</p>
                      {subscriptionTier === "pro" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          PRO
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                          FREE
                        </span>
                      )}
                    </div>
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
            <div className="flex gap-2 sm:gap-4 items-center">
               <Link
                 href="/?auth=login"
                 className="text-slate-400 hover:text-white px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all duration-300 ease-out active:scale-95 border border-white/5 sm:border-transparent"
               >
                 {t("nav.signIn")}
               </Link>
               <Link
                 href="/?auth=signup"
                 className="hidden sm:inline-flex bg-primary-container text-on-primary-container px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500/10 hover:text-indigo-300 transition-all duration-300 ease-out active:scale-95 shadow-lg shadow-indigo-500/20"
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
