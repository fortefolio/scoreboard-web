"use client";

import Link from "next/link";
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

export default function NotificationsPage() {
  const { user } = useAuth();
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    handleInvitation
  } = useNotifications();

  // Override handleInvitation for the page to use the hook's logic if needed,
  // but for now the page has its own invitation handler.
  // Actually, I should probably move handleInvitation to the hook as well.
  // Let's refactor the hook to include handleInvitation.
  
  if (!user) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-black mb-4 uppercase italic tracking-tighter">Access Denied</h1>
      <p className="text-on-surface-variant mb-8 uppercase text-xs font-bold tracking-widest opacity-60">Please sign in to view your activity stream.</p>
      <Link href="/" className="bg-primary text-on-primary px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all">Return Home</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-background font-body">
      <main className="pt-12 pb-20 px-6 max-w-7xl mx-auto">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-6xl font-black tracking-tighter mb-2 italic uppercase">Notifications</h1>
            <p className="text-on-surface-variant font-label text-xs uppercase tracking-[0.3em] opacity-60">Your Kinetic Vault activity stream</p>
          </div>
          {notifications.some(n => !n.read_at) && (
            <button 
              onClick={markAllAsRead}
              className="bg-primary/10 hover:bg-primary text-primary hover:text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20 transition-all shadow-lg shadow-primary/5"
            >
              Mark All as Read
            </button>
          )}
        </header>

        <div className="space-y-4">
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
                  className={`bg-[#151b2d]/40 border border-white/5 rounded-2xl p-5 transition-all relative overflow-hidden group ${!n.read_at ? 'ring-1 ring-primary/30 bg-[#151b2d]/80 shadow-2xl shadow-primary/5' : 'opacity-70'}`}
                >
                  {!n.read_at && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
                  )}
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isInvitation ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                        {isInvitation ? 'Umpire Invitation' : 'Match Update'}
                      </span>
                    </div>
                    <div className="flex gap-1.5">

                      {!n.read_at && (
                        <button 
                          onClick={() => markAsRead(n.id)}
                          className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full transition-all border border-white/5 hover:border-primary/20"
                          title="Mark as read"
                        >
                          <span className="material-symbols-outlined text-lg">done_all</span>
                        </button>
                      )}
                      <button 
                        onClick={() => deleteNotification(n.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all border border-white/5 hover:border-red-500/20 opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>

                  <h3 className={`text-lg font-black mb-1.5 tracking-tight uppercase italic ${!n.read_at ? 'text-white' : 'text-slate-400'}`}>
                    {isInvitation ? (matchDetails.teams || n.title) : n.title}
                  </h3>

                  <p className="text-on-surface-variant leading-relaxed mb-4 max-w-2xl text-xs">
                    {n.body}
                  </p>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        <span className="material-symbols-outlined text-[14px] text-primary/60">{isInvitation ? 'calendar_today' : 'schedule'}</span>
                        {isInvitation 
                          ? (matchDetails.scheduled_at 
                              ? new Date(matchDetails.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                              : new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            )
                          : getRelativeTime(n.created_at)
                        }
                      </div>
                      {matchDetails.tournament && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          <span className="material-symbols-outlined text-[14px] text-primary/60">emoji_events</span>
                          {matchDetails.tournament}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {isInvitation && !n.read_at && (
                        <>
                          <button 
                            onClick={() => handleInvitation(n.id, matchId, 'accept')}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/20"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                            Accept
                          </button>
                          <button 
                            onClick={() => handleInvitation(n.id, matchId, 'refuse')}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white/5 hover:bg-rose-500 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 border border-white/10 hover:border-rose-500/50"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                            Decline
                          </button>
                        </>
                      )}
                      
                      {matchId && (
                        <Link 
                          href={`/match/${matchId}`}
                          onClick={() => {
                            if (!n.read_at) markAsRead(n.id);
                          }}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-primary text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-primary/20"
                        >
                          {isInvitation ? 'Details' : 'Live Feed'}
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : !loading ? (
            <div className="bg-surface-container-low border border-dashed border-outline-variant/20 rounded-[3rem] p-20 text-center">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-slate-700">notifications_off</span>
              </div>
              <h2 className="text-xl font-bold text-slate-500 uppercase tracking-widest">Quiet in the vault</h2>
              <p className="text-slate-600 text-xs font-bold uppercase tracking-tighter mt-2">No activity detected at the moment.</p>
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Synchronizing Activity...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
