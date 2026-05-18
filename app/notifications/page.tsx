"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";

export default function NotificationsPage() {
  const { user, supabase } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) setNotifications(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (user) fetchNotifications(user.id);
    else setLoading(false);
  }, [user, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      );
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
      toast.success("All notifications marked as read");
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Notification deleted");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-black mb-4">Access Denied</h1>
      <p className="text-on-surface-variant mb-8">Please sign in to view your notifications.</p>
      <Link href="/" className="bg-primary-container text-on-primary-container px-8 py-3 rounded-xl font-bold">Return Home</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-background font-body">
      <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between items-center px-8 py-4 max-w-5xl mx-auto">
          <Link href="/" className="text-2xl font-digital text-indigo-500 tracking-tighter">SCORE:BOARD</Link>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Link href="/" className="text-slate-400 hover:text-white font-bold text-sm">Dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-3xl mx-auto">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-2">Notifications</h1>
            <p className="text-on-surface-variant font-label text-xs uppercase tracking-widest">Your Kinetic Vault activity stream</p>
          </div>
          {notifications.some(n => !n.read_at) && (
            <button 
              onClick={markAllAsRead}
              className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 transition-all"
            >
              Mark All as Read
            </button>
          )}
        </header>

        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={`bg-surface-container-low border border-outline-variant/10 rounded-[2rem] p-8 transition-all relative overflow-hidden group ${!n.read_at ? 'ring-1 ring-indigo-500/30' : 'opacity-80'}`}
              >
                {!n.read_at && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className={`text-xl font-black mb-1 ${!n.read_at ? 'text-white' : 'text-slate-400'}`}>
                      {n.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!n.read_at && (
                      <button 
                        onClick={() => markAsRead(n.id)}
                        className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-full transition-colors"
                        title="Mark as read"
                      >
                        <span className="material-symbols-outlined text-xl">done</span>
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(n.id)}
                      className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>

                <p className="text-on-surface-variant leading-relaxed mb-8">
                  {n.body}
                </p>

                {n.data?.matchId && (
                  <Link 
                    href={`/match/${n.data.matchId}`}
                    onClick={() => markAsRead(n.id)}
                    className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                  >
                    <span className="material-symbols-outlined text-sm">sports_tennis</span>
                    Go to Match Center
                  </Link>
                )}
              </div>
            ))
          ) : (
            <div className="bg-surface-container-low border border-dashed border-outline-variant/20 rounded-[3rem] p-20 text-center">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-slate-700">notifications_off</span>
              </div>
              <h2 className="text-xl font-bold text-slate-500 uppercase tracking-widest">Quiet in the vault</h2>
              <p className="text-slate-600 text-sm mt-2">No new notifications at this time.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
