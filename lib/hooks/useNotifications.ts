"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

function notifySync(detail: { type: string; id?: string }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("scoreboard:notifications-changed", { detail }));
  }
}

export function useNotifications() {
  const { user, supabase } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read_at).length);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (user) fetchNotifications(user.id);
    else setLoading(false);
  }, [user, fetchNotifications]);

  // Synchronize across multiple hook instances on the page (e.g. NotificationBell and NotificationsPage)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.type === "CLEAR_ALL") {
        setNotifications([]);
        setUnreadCount(0);
      } else if (detail.type === "MARK_ALL_READ") {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        );
        setUnreadCount(0);
      } else if (detail.type === "DELETE_ONE" && detail.id) {
        setNotifications((prev) => {
          const deleted = prev.find((n) => n.id === detail.id);
          if (deleted && !deleted.read_at) {
            setUnreadCount((c) => Math.max(0, c - 1));
          }
          return prev.filter((n) => n.id !== detail.id);
        });
      } else if (detail.type === "MARK_READ" && detail.id) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === detail.id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } else if (detail.type === "REFRESH" && user) {
        fetchNotifications(user.id);
      }
    };

    window.addEventListener("scoreboard:notifications-changed", handleSync);
    return () => {
      window.removeEventListener("scoreboard:notifications-changed", handleSync);
    };
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    // Use a unique channel name per hook instance to avoid conflicts
    const channelId = `user-notifications-${user.id}-${Math.random().toString(36).substring(2, 9)}`;
    let channel: any = null;

    try {
      channel = supabase
        .channel(channelId)
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setNotifications(prev => [payload.new, ...prev.slice(0, 19)]);
              setUnreadCount(prev => prev + 1);
              toast.info(`New Notification: ${payload.new.title}`);
            } else if (payload.eventType === 'UPDATE') {
              setNotifications(prev => 
                prev.map(n => n.id === payload.new.id ? payload.new : n)
              );
              setUnreadCount(prev => {
                if (payload.old.read_at === null && payload.new.read_at !== null) {
                  return Math.max(0, prev - 1);
                }
                if (payload.old.read_at !== null && payload.new.read_at === null) {
                  return prev + 1;
                }
                return prev;
              });
            } else if (payload.eventType === 'DELETE') {
              setNotifications(prev => {
                const deleted = prev.find(n => n.id === payload.old.id);
                if (deleted && !deleted.read_at) {
                  setUnreadCount(c => Math.max(0, c - 1));
                }
                return prev.filter(n => n.id !== payload.old.id);
              });
            }
          }
        );

      channel.subscribe((status: string, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.warn('[useNotifications] Realtime channel error (falling back to polling):', err || status);
        }
      });
    } catch (err) {
      console.warn('[useNotifications] Realtime subscription unavailable (insecure context or unsupported):', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // Swallow cleanup errors
        }
      }
    };
  }, [user, supabase]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount(c => Math.max(0, c - 1));
    notifySync({ type: "MARK_READ", id: notificationId });

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to update notification");
      notifySync({ type: "REFRESH" });
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    notifySync({ type: "MARK_ALL_READ" });

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      toast.error("Failed to update notifications");
      notifySync({ type: "REFRESH" });
    }
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    const prevNotifications = [...notifications];
    const deleted = prevNotifications.find(n => n.id === id);
    const prevUnread = unreadCount;

    setNotifications(prev => prev.filter(n => n.id !== id));
    if (deleted && !deleted.read_at) {
      setUnreadCount(c => Math.max(0, c - 1));
    }
    notifySync({ type: "DELETE_ONE", id });

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
      setNotifications(prevNotifications);
      setUnreadCount(prevUnread);
      notifySync({ type: "REFRESH" });
    } else {
      toast.success("Notification removed");
    }
  };

  const deleteAllNotifications = async () => {
    if (!user || notifications.length === 0) return;
    const prevNotifications = [...notifications];
    const prevUnread = unreadCount;

    setNotifications([]);
    setUnreadCount(0);
    notifySync({ type: "CLEAR_ALL" });

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error clearing notifications:", error);
      toast.error("Failed to clear notifications");
      setNotifications(prevNotifications);
      setUnreadCount(prevUnread);
      notifySync({ type: "REFRESH" });
    } else {
      toast.success("All notifications cleared");
    }
  };

  const handleInvitation = async (notificationId: string, matchId: string, action: 'accept' | 'refuse') => {
    if (!user) return;
    
    const rpcName = action === 'accept' ? 'accept_umpire_invitation' : 'refuse_umpire_invitation';
    const { error } = await supabase.rpc(rpcName, {
      p_match_id: matchId,
      p_notification_id: notificationId
    });

    if (!error) {
      toast.success(action === 'accept' ? "Invitation accepted!" : "Invitation declined");
      // The Realtime listener will handle state update for setNotifications and unreadCount
    } else {
      console.error(`Error ${action}ing invitation:`, error);
      toast.error(`Failed to ${action} invitation`);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    handleInvitation,
  };
}
