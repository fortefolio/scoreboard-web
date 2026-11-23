"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { formatVersusTitle } from "@/lib/utils/formatName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { NotificationListSkeleton } from "@/components/Skeleton";

const getRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const {
    notifications,
    pendingInvitationMatchIds,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    handleInvitation,
  } = useNotifications();

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold mb-2 text-text-primary">
          Access Denied
        </h1>
        <p className="text-text-muted mb-6 text-xs max-w-sm">
          Please sign in to view your activity stream.
        </p>
        <Link
          href="/"
          className="bg-text-primary hover:bg-white text-surface-container-lowest px-5 py-2.5 rounded-lg font-medium text-xs transition-colors"
        >
          {t("common.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans p-4 sm:p-8 pt-20 sm:pt-24">
      <main className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-6 sm:mb-8 pb-4 border-b border-outline-variant">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              {t("notifications.title")}
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              {t("notifications.subtitle")}
            </p>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {notifications.some((n) => !n.read_at) && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="bg-surface-container-high hover:bg-surface-container-highest text-text-primary px-3.5 py-1.5 rounded-lg text-xs font-medium border border-outline-variant transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">done_all</span>
                  {t("notifications.markAllAsRead")}
                </button>
              )}
              <button
                type="button"
                onClick={deleteAllNotifications}
                className="bg-transparent hover:bg-error/10 text-text-muted hover:text-error px-3.5 py-1.5 rounded-lg text-xs font-medium border border-outline-variant transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                {t("notifications.clearAll")}
              </button>
            </div>
          )}
        </header>

        {/* Notifications List */}
        <div ref={menuContainerRef} className="space-y-2.5">
          {notifications.length > 0 ? (
            notifications.map((n) => {
              const data = n.data || {};
              const matchId = data.match_id || data.matchId;
              const type = data.type || "";
              const isInvitation =
                type.includes("umpire") &&
                (type.includes("invitation") || type.includes("assignment"));
              const matchDetails = data.match_details || {};
              const isMenuOpen = activeMenuId === n.id;
              const isUnread = !n.read_at;

              return (
                <div
                  key={n.id}
                  className={`relative bg-surface-container hover:bg-surface-container-high/60 border rounded-xl p-3.5 sm:p-4 transition-colors flex items-start gap-3 ${
                    isUnread
                      ? "border-outline-variant shadow-sm"
                      : "border-outline-variant/60 opacity-75 hover:opacity-100"
                  }`}
                >
                  {/* Left Icon Pill */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-outline-variant bg-surface-container-high text-text-muted">
                    <span className="material-symbols-outlined text-[18px]">
                      {isInvitation ? "sports" : "notifications"}
                    </span>
                  </div>

                  {/* Notification Content */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      if (matchId) {
                        if (isUnread) markAsRead(n.id);
                        router.push(`/match/${matchId}`);
                      }
                    }}
                  >
                    {/* Meta line */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container-high text-text-secondary border border-outline-variant">
                        {isInvitation
                          ? t("notifications.umpireInvitation")
                          : t("notifications.matchUpdate")}
                      </span>

                      <span className="text-[11px] text-text-muted font-mono">
                        {isInvitation && matchDetails.scheduled_at
                          ? new Date(matchDetails.scheduled_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : getRelativeTime(n.created_at)}
                      </span>

                      {matchDetails.tournament && (
                        <span className="text-[11px] text-text-muted truncate max-w-[160px]">
                          • {matchDetails.tournament}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className={`text-xs sm:text-sm font-semibold tracking-tight line-clamp-1 mb-0.5 ${
                        isUnread ? "text-text-primary" : "text-text-secondary"
                      }`}
                    >
                      {formatVersusTitle(isInvitation ? matchDetails.teams || n.title : n.title)}
                    </h3>

                    {/* Body snippet */}
                    <p className="text-text-muted text-xs leading-relaxed line-clamp-2">
                      {n.body}
                    </p>
                  </div>

                  {/* Right Side: Unread Dot + 3-Dot Action Menu Button */}
                  <div className="relative flex items-center gap-1.5 shrink-0 self-start">
                    {isInvitation && matchId && pendingInvitationMatchIds.has(matchId) ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInvitation(n.id, matchId, "accept");
                          }}
                          title={t("notifications.accept")}
                          aria-label={t("notifications.accept")}
                          className="w-7 h-7 rounded-md bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px] leading-none">check</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInvitation(n.id, matchId, "refuse");
                          }}
                          title={t("notifications.decline")}
                          aria-label={t("notifications.decline")}
                          className="w-7 h-7 rounded-md bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-muted hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px] leading-none">close</span>
                        </button>
                      </>
                    ) : isUnread ? (
                      <span className="w-2 h-2 rounded-full bg-text-primary/70 shrink-0" />
                    ) : null}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : n.id);
                      }}
                      className="w-7 h-7 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-container-highest flex items-center justify-center transition-colors cursor-pointer"
                      title="Actions"
                      aria-label="Actions"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>

                    {/* 3-Dot Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-8 z-40 w-44 bg-surface-container border border-outline-variant rounded-xl shadow-xl p-1 text-xs animate-in fade-in duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* View Match / Details */}
                        {matchId && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isUnread) markAsRead(n.id);
                              setActiveMenuId(null);
                              router.push(`/match/${matchId}`);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-high rounded-md transition-colors cursor-pointer text-left"
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {isInvitation ? "visibility" : "arrow_forward"}
                            </span>
                            {isInvitation ? t("notifications.details") : t("notifications.liveFeed")}
                          </button>
                        )}

                        {/* Mark As Read */}
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => {
                              markAsRead(n.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-high rounded-md transition-colors cursor-pointer text-left"
                          >
                            <span className="material-symbols-outlined text-[15px]">done</span>
                            {t("notifications.markAsRead")}
                          </button>
                        )}

                        {/* Delete Notification */}
                        <button
                          type="button"
                          onClick={() => {
                            deleteNotification(n.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 font-medium text-text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          {t("notifications.deleteNotif")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : !loading ? (
            <div className="bg-surface-container border border-dashed border-outline-variant rounded-xl p-12 sm:p-16 text-center">
              <span className="material-symbols-outlined text-3xl text-text-muted/40 mb-2 block">
                notifications_off
              </span>
              <h2 className="text-sm font-semibold text-text-primary mb-1">
                {t("notifications.quietTitle")}
              </h2>
              <p className="text-text-muted text-xs max-w-sm mx-auto">
                {t("notifications.quietDesc")}
              </p>
            </div>
          ) : (
            <NotificationListSkeleton />
          )}
        </div>
      </main>
    </div>
  );
}
