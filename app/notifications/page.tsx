"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { formatVersusTitle } from "@/lib/utils/formatName";
import { useTranslation } from "@/lib/i18n/LanguageContext";

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
        <h1 className="text-2xl sm:text-3xl font-black mb-3 uppercase italic tracking-tighter">
          Access Denied
        </h1>
        <p className="text-on-surface-variant mb-6 uppercase text-xs font-bold tracking-widest opacity-60">
          Please sign in to view your activity stream.
        </p>
        <Link
          href="/"
          className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all"
        >
          {t("common.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body">
      <main className="w-full pt-6 sm:pt-10 pb-24 px-4 sm:px-6 max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-6 sm:mb-8 pb-4 border-b border-white/5">
          <div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter italic uppercase">
              {t("notifications.title")}
            </h1>
            <p className="text-on-surface-variant font-label text-[10px] sm:text-xs uppercase tracking-[0.25em] opacity-60">
              {t("notifications.subtitle")}
            </p>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {notifications.some((n) => !n.read_at) && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="bg-primary/10 hover:bg-primary text-primary hover:text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-primary/20 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">done_all</span>
                  {t("notifications.markAllAsRead")}
                </button>
              )}
              <button
                type="button"
                onClick={deleteAllNotifications}
                className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-rose-500/20 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
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
                  className={`relative bg-[#151b2d]/60 hover:bg-[#151b2d]/90 border border-white/5 rounded-2xl p-3 sm:p-4 transition-all duration-200 flex items-start gap-3 shadow-sm ${
                    isUnread
                      ? "ring-1 ring-primary/40 bg-[#151b2d]/95"
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {/* Left Icon Pill */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isInvitation
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-surface-container-high/60 border-white/5 text-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
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
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                          isInvitation
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
                            : "bg-white/5 text-slate-400 border-white/10"
                        }`}
                      >
                        {isInvitation
                          ? t("notifications.umpireInvitation")
                          : t("notifications.matchUpdate")}
                      </span>

                      <span className="text-[10px] text-on-surface-variant/60 font-mono tracking-tight">
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
                        <span className="text-[10px] text-primary/80 font-mono truncate max-w-[160px]">
                          • {matchDetails.tournament}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className={`text-xs sm:text-sm font-bold tracking-tight line-clamp-1 mb-0.5 ${
                        isUnread ? "text-white font-black" : "text-slate-300"
                      }`}
                    >
                      {formatVersusTitle(isInvitation ? matchDetails.teams || n.title : n.title)}
                    </h3>

                    {/* Body snippet */}
                    <p className="text-on-surface-variant/70 text-[11px] sm:text-xs leading-relaxed line-clamp-2">
                      {n.body}
                    </p>
                  </div>

                  {/* Right Side: Unread Dot + 3-Dot Action Menu Button */}
                  <div className="relative flex items-center gap-1.5 shrink-0 self-start">
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : n.id);
                      }}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                      title="Actions"
                      aria-label="Actions"
                    >
                      <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>

                    {/* 3-Dot Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-9 z-40 w-48 bg-[#0c1324] border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Invitation Accept */}
                        {isInvitation && !n.read_at && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                handleInvitation(n.id, matchId, "accept");
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer text-left"
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                              {t("notifications.accept")}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleInvitation(n.id, matchId, "refuse");
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer text-left"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                              {t("notifications.decline")}
                            </button>
                            <div className="h-px bg-white/5 my-1" />
                          </>
                        )}

                        {/* View Match / Details */}
                        {matchId && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isUnread) markAsRead(n.id);
                              setActiveMenuId(null);
                              router.push(`/match/${matchId}`);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <span className="material-symbols-outlined text-[16px]">
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
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <span className="material-symbols-outlined text-[16px]">done</span>
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
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          {t("notifications.deleteNotif")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : !loading ? (
            <div className="bg-surface-container-low border border-dashed border-outline-variant/20 rounded-3xl p-12 sm:p-16 text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-slate-600">
                  notifications_off
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-400 uppercase tracking-widest">
                {t("notifications.quietTitle")}
              </h2>
              <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                {t("notifications.quietDesc")}
              </p>
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                {t("notifications.syncing")}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
