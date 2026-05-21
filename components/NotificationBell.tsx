"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useNotifications } from "@/lib/hooks/useNotifications";

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
        className="relative p-2 text-slate-400 hover:text-indigo-400 transition-colors focus:outline-none"
      >
        <span className="material-symbols-outlined text-2xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-slate-950">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-[360px] bg-[#0c1324] border border-white/5 rounded-3xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-6 flex justify-between items-center bg-[#0c1324]/50 backdrop-blur-md">
            <h3 className="text-xl font-headline font-black text-white italic uppercase tracking-tight">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-[0.15em]"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[480px] overflow-y-auto px-4 pb-4 space-y-3">
            {notifications.length > 0 ? (
              notifications.map((n) => {
                const data = n.data || {};
                const matchId = data.match_id || data.matchId;
                const type = data.type || '';
                const isInvitation = type.includes('umpire') && (type.includes('invitation') || type.includes('assignment'));
                const matchDetails = data.match_details || {};
                
                return (
                  <div 
                    key={n.id} 
                    className={`p-4 rounded-2xl border border-white/5 bg-[#151b2d]/40 transition-all relative group ${!n.read_at ? 'ring-1 ring-primary/20 bg-[#151b2d]/80 shadow-lg shadow-primary/5' : 'opacity-60'}`}
                  >
                    {/* Top Row: Badge & Action Icons */}
                    <div className="flex justify-between items-center mb-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${isInvitation ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-slate-700/30 text-slate-400 border border-white/5'}`}>
                        {isInvitation ? 'Umpire Invitation' : 'Match Update'}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {isInvitation && !n.read_at && (
                          <>
                            <button 
                              onClick={() => handleInvitation(n.id, matchId, 'accept')}
                              title="Accept"
                              className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center transition-all hover:bg-emerald-500 hover:text-white border border-emerald-500/20"
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            </button>
                            <button 
                              onClick={() => handleInvitation(n.id, matchId, 'refuse')}
                              title="Decline"
                              className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center transition-all hover:bg-rose-500 hover:text-white border border-rose-500/20"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          </>
                        )}
                        {!isInvitation && !n.read_at && (
                          <button 
                            onClick={() => markAsRead(n.id)}
                            className="w-6 h-6 rounded-full bg-white/5 text-slate-500 flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">info</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Content */}
                    <h4 className="text-[15px] font-black text-white leading-tight mb-2 tracking-tight">
                      {isInvitation ? (matchDetails.teams || n.title) : n.title}
                    </h4>

                    {/* Bottom Row: Info & CTA */}
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                          <span className="material-symbols-outlined text-[12px]">{isInvitation ? 'calendar_today' : 'schedule'}</span>
                          {isInvitation 
                            ? (matchDetails.scheduled_at 
                                ? new Date(matchDetails.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                : new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              )
                            : getRelativeTime(n.created_at)
                          }
                        </div>
                      </div>
                      
                      {matchId && (
                        <Link 
                          href={`/match/${matchId}`}
                          onClick={() => {
                            if (!n.read_at) markAsRead(n.id);
                            setIsOpen(false);
                          }}
                          className="text-[9px] font-black uppercase tracking-[0.2em] text-primary hover:text-primary/80 transition-colors bg-primary/5 px-3 py-1 rounded-md border border-primary/10"
                        >
                          {isInvitation ? 'Details' : 'Live Feed'}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-5xl text-white/5 mb-3">notifications_off</span>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">No activity detected</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-6 bg-[#0c1324]/80 backdrop-blur-md border-t border-white/5 text-center">
               <Link 
                 href="/notifications" 
                 onClick={() => setIsOpen(false)}
                 className="text-[11px] text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] transition-colors"
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
