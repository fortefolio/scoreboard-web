"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
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
                
                const dateText = isInvitation 
                  ? (matchDetails.scheduled_at 
                      ? new Date(matchDetails.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                      : new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    )
                  : getRelativeTime(n.created_at);

                return (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      if (isUnread) markAsRead(n.id);
                      if (matchId) {
                        router.push(`/match/${matchId}`);
                        setIsOpen(false);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (isUnread) markAsRead(n.id);
                        if (matchId) {
                          router.push(`/match/${matchId}`);
                          setIsOpen(false);
                        }
                      }
                    }}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer group ${
                      isUnread 
                        ? 'border-outline-variant bg-surface-container-high hover:bg-surface-container-highest' 
                        : 'border-outline-variant/60 bg-surface-container-high/40 opacity-70 hover:opacity-100 hover:bg-surface-container-high'
                    }`}
                  >
                    {/* Top Row: Type Icon + Date/Time on left, Actions or Unread Dot on right */}
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                        <span className="material-symbols-outlined text-[15px] text-text-secondary leading-none">
                          {isInvitation ? "sports" : "notifications"}
                        </span>
                        <span>{dateText}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {isInvitation && isUnread ? (
                          <>
                            <button 
                              onClick={() => handleInvitation(n.id, matchId, 'accept')}
                              title={t("notifications.accept")}
                              aria-label={t("notifications.accept")}
                              className="w-6 h-6 rounded-md bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px] leading-none">check</span>
                            </button>
                            <button 
                              onClick={() => handleInvitation(n.id, matchId, 'refuse')}
                              title={t("notifications.decline")}
                              aria-label={t("notifications.decline")}
                              className="w-6 h-6 rounded-md bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-muted hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px] leading-none">close</span>
                            </button>
                          </>
                        ) : isUnread ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-text-primary/70 shrink-0" />
                        ) : null}
                      </div>
                    </div>

                    {/* Notification Title */}
                    <h4 className={`text-xs font-semibold leading-snug line-clamp-2 ${isUnread ? "text-text-primary group-hover:text-primary transition-colors" : "text-text-secondary"}`}>
                      {formatVersusTitle(isInvitation ? (matchDetails.teams || n.title) : n.title)}
                    </h4>
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
