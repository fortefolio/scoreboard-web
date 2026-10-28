"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type EntityType = "match" | "tournament" | "team" | "player" | "competition";

export function useFollow() {
  const { user, supabase: authSupabase } = useAuth();
  const supabase = authSupabase || getSupabaseBrowserClient();

  const [followedMatchIds, setFollowedMatchIds] = useState<Set<string>>(new Set());
  const [followedTournamentIds, setFollowedTournamentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Fetch initial follows
  const fetchFollows = useCallback(async () => {
    if (!user) {
      setFollowedMatchIds(new Set());
      setFollowedTournamentIds(new Set());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("follows")
        .select("entity_id, entity_type")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching follows:", error);
        return;
      }

      const matchIds = new Set<string>();
      const tournamentIds = new Set<string>();

      (data || []).forEach((item: { entity_id: string; entity_type: string }) => {
        if (item.entity_type === "match") {
          matchIds.add(item.entity_id);
        } else if (item.entity_type === "tournament" || item.entity_type === "competition") {
          tournamentIds.add(item.entity_id);
        }
      });

      setFollowedMatchIds(matchIds);
      setFollowedTournamentIds(tournamentIds);
    } catch (err) {
      console.error("Failed to load follows:", err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchFollows();
  }, [fetchFollows]);

  const isFollowing = useCallback(
    (entityId: string, entityType: "match" | "tournament"): boolean => {
      if (entityType === "match") {
        return followedMatchIds.has(entityId);
      }
      return followedTournamentIds.has(entityId);
    },
    [followedMatchIds, followedTournamentIds]
  );

  const toggleFollow = useCallback(
    async (entityId: string, entityType: "match" | "tournament"): Promise<boolean> => {
      if (!user) {
        // Not logged in
        return false;
      }

      const currentlyFollowing = isFollowing(entityId, entityType);
      const key = `${entityType}:${entityId}`;

      // Optimistic update
      setUpdatingIds((prev) => new Set(prev).add(key));

      if (entityType === "match") {
        setFollowedMatchIds((prev) => {
          const next = new Set(prev);
          if (currentlyFollowing) next.delete(entityId);
          else next.add(entityId);
          return next;
        });
      } else {
        setFollowedTournamentIds((prev) => {
          const next = new Set(prev);
          if (currentlyFollowing) next.delete(entityId);
          else next.add(entityId);
          return next;
        });
      }

      try {
        if (currentlyFollowing) {
          // Unfollow
          const { error } = await supabase
            .from("follows")
            .delete()
            .eq("user_id", user.id)
            .eq("entity_id", entityId)
            .eq("entity_type", entityType);

          if (error) throw error;
        } else {
          // Follow
          const { error } = await supabase.from("follows").insert({
            user_id: user.id,
            entity_id: entityId,
            entity_type: entityType,
          });

          if (error) throw error;
        }

        return !currentlyFollowing;
      } catch (err) {
        console.error(`Error toggling follow for ${entityType} ${entityId}:`, err);
        // Revert optimistic update on failure
        if (entityType === "match") {
          setFollowedMatchIds((prev) => {
            const next = new Set(prev);
            if (currentlyFollowing) next.add(entityId);
            else next.delete(entityId);
            return next;
          });
        } else {
          setFollowedTournamentIds((prev) => {
            const next = new Set(prev);
            if (currentlyFollowing) next.add(entityId);
            else next.delete(entityId);
            return next;
          });
        }
        return currentlyFollowing;
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [user, isFollowing, supabase]
  );

  return {
    isFollowing,
    toggleFollow,
    followedMatchIds,
    followedTournamentIds,
    loading,
    updatingIds,
    refreshFollows: fetchFollows,
  };
}
