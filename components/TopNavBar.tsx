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
    const query = searchParams?.toString();
    const fullPath = query ? `${pathname}?${query}` : pathname || "/";
    try {
      const curr = sessionStorage.getItem("sb:currPath");
      if (curr && curr.split("?")[0] !== pathname) {
        sessionStorage.setItem("sb:prevPath", curr);
      }
      sessionStorage.setItem("sb:currPath", fullPath);
    } catch {
      // ignore storage errors
    }
  }, [pathname, searchParams]);

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
    <nav className="fixed top-0 w-full z-50 bg-[#0b0d14]/90 backdrop-blur-md border-b border-outline-variant">
      <div className="flex justify-between items-center px-4 sm:px-8 py-3 max-w-7xl mx-auto font-sans tracking-tight">
        <Link href="/" className="text-2xl sm:text-3xl font-digital text-text-primary tracking-tighter shrink-0">
          SCORE:BOARD
        </Link>

        {/* Navigation Links (Desktop only, hidden on mobile in favor of bottom tab bar) */}
        <div className="hidden md:flex gap-6 items-center">
          {hasMounted && (
            <>
              <Link
                href="/?tab=matches"
                scroll={false}
                className={`text-sm font-medium transition-colors ${
                  isMatchesActive
                    ? "text-text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t("home.matchesTab")}
              </Link>

              <Link
                href="/?tab=tournaments"
                scroll={false}
                className={`text-sm font-medium transition-colors ${
                  isTournamentsActive
                    ? "text-text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t("home.tournamentsTab")}
              </Link>

              <Link
                href="/?tab=following"
                scroll={false}
                className={`text-sm font-medium transition-colors ${
                  isFollowingActive
                    ? "text-text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t("home.followingTab")}
              </Link>
            </>
          )}
        </div>

        <div className="flex gap-2 sm:gap-4 items-center shrink-0">
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
                className="flex items-center gap-1.5 group focus:outline-none cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-text-secondary font-medium group-hover:border-outline transition-colors overflow-hidden text-xs">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.email?.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="material-symbols-outlined text-text-muted group-hover:text-text-primary transition-colors text-lg">
                  {isMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-surface-container border border-outline-variant rounded-xl shadow-xl z-[110] overflow-hidden">
                  <div className="p-3 border-b border-outline-variant bg-surface-container-high/40">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-text-muted">{t("nav.signedInAs")}</p>
                      {subscriptionTier === "pro" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-container-highest text-text-primary border border-outline">
                          PRO
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-container-highest text-text-muted border border-outline-variant">
                          FREE
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-text-primary truncate">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/settings'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">settings</span>
                      {t("nav.settings")}
                    </button>
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/my-matches'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer mt-0.5"
                    >
                      <span className="material-symbols-outlined text-base">sports_tennis</span>
                      {t("nav.myMatches")}
                    </button>
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/my-tournaments'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer mt-0.5"
                    >
                      <span className="material-symbols-outlined text-base">emoji_events</span>
                      {t("nav.myTournaments")}
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer mt-0.5"
                    >
                      <span className="material-symbols-outlined text-base">logout</span>
                      {t("nav.signOut")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2 sm:gap-3 items-center">
               <Link
                 href="/?auth=login"
                 className="text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg font-medium text-xs transition-colors"
               >
                 {t("nav.signIn")}
               </Link>
               <Link
                 href="/?auth=signup"
                 className="hidden sm:inline-flex bg-text-primary hover:bg-white text-surface-container-lowest px-3.5 py-1.5 rounded-lg font-medium text-xs transition-colors shadow-sm"
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
