"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function BottomTabBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { unreadCount } = useNotifications();

  // Hide on overlay pages
  if (pathname?.includes("/overlay")) {
    return null;
  }

  const isHome = pathname === "/";
  const activeTab = isHome ? (searchParams.get("tab") || "matches") : null;
  const isMatchesActive = isHome && activeTab === "matches";
  const isTournamentsActive = isHome && activeTab === "tournaments";
  const isFollowingActive = isHome && activeTab === "following";
  const isNotificationsActive = pathname === "/notifications";

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0a0f1d]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 safe-area-bottom shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Matches Tab */}
        <Link
          href="/?tab=matches"
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            isMatchesActive
              ? "text-emerald-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">sports_tennis</span>
          <span className="text-[10px] font-bold tracking-tight mt-0.5">
            {t("home.matchesTab") || "Jogos"}
          </span>
          {isMatchesActive && (
            <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
          )}
        </Link>

        {/* Tournaments Tab */}
        <Link
          href="/?tab=tournaments"
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            isTournamentsActive
              ? "text-emerald-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">emoji_events</span>
          <span className="text-[10px] font-bold tracking-tight mt-0.5">
            {t("home.tournamentsTab") || "Torneios"}
          </span>
          {isTournamentsActive && (
            <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
          )}
        </Link>

        {/* Following Tab */}
        <Link
          href="/?tab=following"
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            isFollowingActive
              ? "text-emerald-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">star</span>
          <span className="text-[10px] font-bold tracking-tight mt-0.5">
            {t("home.followingTab") || "A Seguir"}
          </span>
          {isFollowingActive && (
            <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
          )}
        </Link>

        {/* Alerts / Notifications Tab */}
        <Link
          href={user ? "/notifications" : "/?auth=login"}
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative ${
            isNotificationsActive
              ? "text-emerald-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {user && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full px-0.5 border border-slate-950">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-tight mt-0.5">
            {t("nav.notifications") || "Alertas"}
          </span>
          {isNotificationsActive && (
            <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
          )}
        </Link>
      </div>
    </nav>
  );
}
