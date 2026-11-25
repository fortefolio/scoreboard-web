"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type EntityType = "match" | "tournament" | "team" | "player" | "competition";

const FOLLOWS_CHANGED_EVENT = "scoreboard:follows-changed";

interface FollowStoreState {
  userId: string | null;
  followedMatchIds: Set<string>;
  followedTournamentIds: Set<string>;
  loading: boolean;
  updatingIds: Set<string>;
}

let storeState: FollowStoreState = {
  userId: null,
  followedMatchIds: new Set(),
  followedTournamentIds: new Set(),
  loading: true,
  updatingIds: new Set(),
};

let inFlightFetch: { userId: string; promise: Promise<void> } | null = null;
const listeners = new Set<(state: FollowStoreState) => void>();

function setStoreState(updater: (prev: FollowStoreState) => FollowStoreState) {
  storeState = updater(storeState);
  listeners.forEach((listener) => listener(storeState));
}

function notifyFollowsChanged(detail: {
  entityId: string;
  entityType: "match" | "tournament";
  following: boolean;
}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FOLLOWS_CHANGED_EVENT, { detail }));
  }
}

async function fetchFollowsForUser(
  userId: string | null,
  supabase: SupabaseClient,
  force = false
): Promise<void> {
  if (!userId) {
    inFlightFetch = null;
    setStoreState((prev) => ({
      ...prev,
      userId: null,
      followedMatchIds: new Set(),
      followedTournamentIds: new Set(),
      loading: false,
    }));
    return;
  }

  if (!force && inFlightFetch && inFlightFetch.userId === userId) {
    return inFlightFetch.promise;
  }

  setStoreState((prev) => ({ ...prev, userId, loading: true }));

  let promise: Promise<void> | undefined;
  promise = (async () => {
    try {
      const { data, error } = await supabase
        .from("follows")
        .select("entity_id, entity_type")
        .eq("user_id", userId);

      if (error) {
        console.warn("Error fetching follows:", error?.message || error);
        setStoreState((prev) => ({ ...prev, loading: false }));
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

      setStoreState((prev) => ({
        ...prev,
        userId,
        followedMatchIds: matchIds,
        followedTournamentIds: tournamentIds,
        loading: false,
      }));
    } catch (err) {
      console.error("Failed to load follows:", err);
      setStoreState((prev) => ({ ...prev, loading: false }));
    } finally {
      if (inFlightFetch?.promise === promise) {
        inFlightFetch = null;
      }
    }
  })();

  inFlightFetch = { userId, promise };
  return promise;
}

export function useFollow() {
  const { user, supabase: authSupabase } = useAuth();
  const supabase = authSupabase || getSupabaseBrowserClient();
  const [state, setState] = useState<FollowStoreState>(storeState);

  useEffect(() => {
    listeners.add(setState);
    setState(storeState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (storeState.userId !== nextUserId) {
      fetchFollowsForUser(nextUserId, supabase);
    } else if (!nextUserId && storeState.loading) {
      fetchFollowsForUser(null, supabase);
    }
  }, [user?.id, supabase]);

  const refreshFollows = useCallback(async () => {
    await fetchFollowsForUser(user?.id ?? null, supabase, true);
  }, [user?.id, supabase]);

  const isFollowing = useCallback(
    (entityId: string, entityType: "match" | "tournament"): boolean => {
      if (entityType === "match") {
        return state.followedMatchIds.has(entityId);
      }
      return state.followedTournamentIds.has(entityId);
    },
    [state.followedMatchIds, state.followedTournamentIds]
  );

  const toggleFollow = useCallback(
    async (entityId: string, entityType: "match" | "tournament"): Promise<boolean> => {
      if (!user) {
        return false;
      }

      const currentlyFollowing = isFollowing(entityId, entityType);
      const key = `${entityType}:${entityId}`;

      const applyFollowState = (following: boolean) => {
        setStoreState((prev) => {
          if (entityType === "match") {
            const next = new Set(prev.followedMatchIds);
            if (following) next.add(entityId);
            else next.delete(entityId);
            return { ...prev, followedMatchIds: next };
          }
          const next = new Set(prev.followedTournamentIds);
          if (following) next.add(entityId);
          else next.delete(entityId);
          return { ...prev, followedTournamentIds: next };
        });
        notifyFollowsChanged({ entityId, entityType, following });
      };

      setStoreState((prev) => {
        const nextUpdating = new Set(prev.updatingIds);
        nextUpdating.add(key);
        return { ...prev, updatingIds: nextUpdating };
      });
      applyFollowState(!currentlyFollowing);

      try {
        if (currentlyFollowing) {
          const { error } = await supabase
            .from("follows")
            .delete()
            .eq("user_id", user.id)
            .eq("entity_id", entityId)
            .eq("entity_type", entityType);

          if (error) throw error;
        } else {
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
        applyFollowState(currentlyFollowing);
        return currentlyFollowing;
      } finally {
        setStoreState((prev) => {
          const nextUpdating = new Set(prev.updatingIds);
          nextUpdating.delete(key);
          return { ...prev, updatingIds: nextUpdating };
        });
      }
    },
    [user, isFollowing, supabase]
  );

  return {
    isFollowing,
    toggleFollow,
    followedMatchIds: state.followedMatchIds,
    followedTournamentIds: state.followedTournamentIds,
    loading: state.loading,
    updatingIds: state.updatingIds,
    refreshFollows,
  };
}
