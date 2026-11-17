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

  // Hide on overlay and scoreboard pages
  if (pathname?.includes("/overlay") || pathname?.includes("/scoreboard")) {
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
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0b0d14]/95 backdrop-blur-md border-t border-outline-variant px-2 py-1 safe-area-bottom"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Matches Tab */}
        <Link
          href="/?tab=matches"
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors ${
            isMatchesActive
              ? "text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">sports_tennis</span>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">
            {t("nav.matches")}
          </span>
          {isMatchesActive && (
            <span className="w-1 h-1 rounded-full bg-text-primary mt-0.5" />
          )}
        </Link>

        {/* Tournaments Tab */}
        <Link
          href="/?tab=tournaments"
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors ${
            isTournamentsActive
              ? "text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">emoji_events</span>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">
            {t("nav.tournaments")}
          </span>
          {isTournamentsActive && (
            <span className="w-1 h-1 rounded-full bg-text-primary mt-0.5" />
          )}
        </Link>

        {/* Following Tab */}
        <Link
          href="/?tab=following"
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors ${
            isFollowingActive
              ? "text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">star</span>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">
            {t("nav.following")}
          </span>
          {isFollowingActive && (
            <span className="w-1 h-1 rounded-full bg-text-primary mt-0.5" />
          )}
        </Link>

        {/* Alerts / Notifications Tab */}
        <Link
          href={user ? "/notifications" : "/?auth=login"}
          scroll={false}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors relative ${
            isNotificationsActive
              ? "text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {user && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] bg-error text-white text-[9px] font-semibold flex items-center justify-center rounded-full px-0.5 border border-[#0b0d14]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">
            {t("nav.notifications")}
          </span>
          {isNotificationsActive && (
            <span className="w-1 h-1 rounded-full bg-text-primary mt-0.5" />
          )}
        </Link>
      </div>
    </nav>
  );
}
