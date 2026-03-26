"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { toast } from "sonner";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchNotifications(user.id);
      }
    };
    fetchUser();

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for new notifications
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
          toast.info(`New Notification: ${payload.new.title}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read_at).length);
    }
  };

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    }
  };

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
        <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-tighter"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-4 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors relative group ${!n.read_at ? 'bg-indigo-500/5' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm font-bold ${!n.read_at ? 'text-white' : 'text-slate-300'}`}>{n.title}</h4>
                    {!n.read_at && (
                      <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1"></div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">{n.body}</p>
                  
                  {n.data?.matchId && (
                    <Link 
                      href={`/match/${n.data.matchId}`}
                      onClick={() => {
                        markAsRead(n.id);
                        setIsOpen(false);
                      }}
                      className="mb-3 inline-flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <span className="material-symbols-outlined text-xs">sports_tennis</span>
                      Enter Match Center
                    </Link>
                  )}

                  <div className="flex justify-end items-center">
                    <span className="text-[9px] text-slate-600 font-bold uppercase">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-700 mb-2">notifications_off</span>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No notifications yet</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 bg-slate-900/80 text-center border-t border-slate-800">
               <Link 
                 href="/notifications" 
                 onClick={() => setIsOpen(false)}
                 className="text-[10px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-[0.2em] transition-colors"
               >
                 See all notifications
               </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
