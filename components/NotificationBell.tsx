"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { formatVersusTitle } from "@/lib/utils/formatName";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const getRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes} mins`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function NotificationBell() {
  const { user, supabase } = useAuth();
  const { t } = useTranslation();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    deleteNotification,
    handleInvitation
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-text-primary transition-colors focus:outline-none cursor-pointer"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error text-white text-[10px] font-semibold flex items-center justify-center rounded-full border border-background">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[360px] bg-surface-container border border-outline-variant rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in duration-200">
          <div className="p-4 px-5 flex justify-between items-center border-b border-outline-variant bg-surface-container-high/40">
            <h3 className="text-sm font-semibold text-text-primary">{t("notifications.title")}</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                {t("notifications.markAllAsRead")}
              </button>
            )}
          </div>

          <div className="max-h-[460px] overflow-y-auto p-3 space-y-2.5">
            {notifications.length > 0 ? (
              notifications.map((n) => {
                const data = n.data || {};
                const matchId = data.match_id || data.matchId;
                const type = data.type || '';
                const isInvitation = type.includes('umpire') && (type.includes('invitation') || type.includes('assignment'));
                const matchDetails = data.match_details || {};
                const isUnread = !n.read_at;
                
                return (
                  <div 
                    key={n.id} 
                    className={`p-3.5 rounded-xl border transition-colors ${
                      isUnread 
                        ? 'border-outline-variant bg-surface-container-high' 
                        : 'border-outline-variant/60 bg-surface-container-high/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* Top Row: Badge & Action Icons */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-1.5">
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />}
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container text-text-secondary border border-outline-variant">
                          {isInvitation ? t("notifications.umpireInvitation") : t("notifications.matchUpdate")}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {isInvitation && isUnread && (
                          <>
                            <button 
                              onClick={() => handleInvitation(n.id, matchId, 'accept')}
                              title={t("notifications.accept")}
                              className="w-6 h-6 rounded-md bg-success/10 text-success flex items-center justify-center transition-colors hover:bg-success hover:text-white border border-success/20 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px]">check</span>
                            </button>
                            <button 
                              onClick={() => handleInvitation(n.id, matchId, 'refuse')}
                              title={t("notifications.decline")}
                              className="w-6 h-6 rounded-md bg-error/10 text-error flex items-center justify-center transition-colors hover:bg-error hover:text-white border border-error/20 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px]">close</span>
                            </button>
                          </>
                        )}
                        {!isInvitation && isUnread && (
                          <button 
                            onClick={() => markAsRead(n.id)}
                            className="w-6 h-6 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-container-highest flex items-center justify-center transition-colors cursor-pointer"
                            title={t("notifications.markAsRead")}
                          >
                            <span className="material-symbols-outlined text-[13px]">done</span>
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="w-6 h-6 rounded-md text-text-muted hover:text-error hover:bg-error/10 flex items-center justify-center transition-colors cursor-pointer"
                          title={t("notifications.deleteNotif")}
                          aria-label={t("notifications.deleteNotif")}
                        >
                          <span className="material-symbols-outlined text-[13px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Content */}
                    <h4 className="text-xs font-semibold text-text-primary leading-tight mb-2">
                      {formatVersusTitle(isInvitation ? (matchDetails.teams || n.title) : n.title)}
                    </h4>

                    {/* Bottom Row: Info & CTA */}
                    <div className="flex justify-between items-center pt-1 border-t border-outline-variant/50">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                        <span className="material-symbols-outlined text-[13px]">{isInvitation ? 'calendar_today' : 'schedule'}</span>
                        <span>
                          {isInvitation 
                            ? (matchDetails.scheduled_at 
                                ? new Date(matchDetails.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                : new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              )
                            : getRelativeTime(n.created_at)
                          }
                        </span>
                      </div>
                      
                      {matchId && (
                        <Link 
                          href={`/match/${matchId}`}
                          onClick={() => {
                            if (!n.read_at) markAsRead(n.id);
                            setIsOpen(false);
                          }}
                          className="text-[11px] font-medium text-text-primary hover:text-white transition-colors bg-surface-container px-2.5 py-1 rounded-md border border-outline-variant"
                        >
                          {isInvitation ? t("notifications.details") : t("notifications.liveFeed")}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-3xl text-text-muted/40 mb-2 block">notifications_off</span>
                <p className="text-xs text-text-muted">{t("notifications.quietDesc")}</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 bg-surface-container-high/30 border-t border-outline-variant text-center">
               <Link 
                 href="/notifications" 
                 onClick={() => setIsOpen(false)}
                 className="text-xs text-text-secondary hover:text-text-primary font-medium transition-colors"
               >
                 View all notifications
               </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
