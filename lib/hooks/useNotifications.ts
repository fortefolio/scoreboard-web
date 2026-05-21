"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

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

  useEffect(() => {
    if (!user) return;

    // Use a unique channel name per hook instance to avoid conflicts
    const channelId = `user-notifications-${user.id}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to update notification");
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      toast.error("Failed to update notifications");
    }
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
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
    handleInvitation,
  };
}
