"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface LiveMatchScoreState {
  scores: Record<string, any> | null;
  status: string | null;
  lastEvent: Record<string, any> | null;
  connected: boolean;
}

/**
 * Enterprise Realtime Spectator Hook.
 *
 * Subscribes to Postgres in-database Realtime Broadcast (`realtime.send`) on channel `match:${matchId}`.
 * - Sub-100ms latency fan-out directly from the atomic scoring RPC.
 * - Zero WAL decoding bottleneck on the database.
 * - Zero HTTP refetches when points are scored.
 * - Seamless fallback to `postgres_changes` if broadcast drops.
 */
export function useLiveMatchScore(
  matchId: string,
  initialScores?: Record<string, any> | null,
  initialStatus?: string | null
) {
  const [scores, setScores] = useState<Record<string, any> | null>(initialScores || null);
  const [status, setStatus] = useState<string | null>(initialStatus || null);
  const [lastEvent, setLastEvent] = useState<Record<string, any> | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  // Keep references to prevent unnecessary channel re-subscriptions
  const matchIdRef = useRef(matchId);
  matchIdRef.current = matchId;

  // Sync initial state if provided
  useEffect(() => {
    if (initialScores) setScores(initialScores);
    if (initialStatus) setStatus(initialStatus);
  }, [initialScores, initialStatus]);

  const handleBroadcastPayload = useCallback((payload: any) => {
    if (!payload || payload.match_id !== matchIdRef.current) return;

    if (payload.scores && typeof payload.scores === "object") {
      setScores(payload.scores);
    }
    if (payload.status) {
      setStatus(payload.status);
    }
    if (payload.event_data) {
      setLastEvent(payload.event_data);
    }
  }, []);

  useEffect(() => {
    if (!matchId) return;

    const supabase = getSupabaseBrowserClient();
    const channelTopic = `match:${matchId}`;

    let channel: any = null;
    try {
      channel = supabase
        .channel(channelTopic)
        // 1. Primary: High-throughput in-database broadcast from record_match_event_atomic
        .on("broadcast", { event: "score_update" }, (res: any) => {
          handleBroadcastPayload(res?.payload);
        })
        .on("broadcast", { event: "SCORE_UPDATED" }, (res: any) => {
          handleBroadcastPayload(res?.payload);
        })
        // 2. Fallback: Standard Postgres CDC changes
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "matches",
            filter: `id=eq.${matchId}`,
          },
          (payload: any) => {
            if (payload.new) {
              if (payload.new.scores) setScores(payload.new.scores);
              if (payload.new.status) setStatus(payload.new.status);
            }
          }
        );

      channel.subscribe((statusStr: string) => {
        setConnected(statusStr === "SUBSCRIBED");
      });
    } catch (err) {
      console.warn('[useLiveMatchScore] Realtime unavailable:', err);
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [matchId, handleBroadcastPayload]);

  return {
    scores,
    status,
    lastEvent,
    connected,
  };
}
