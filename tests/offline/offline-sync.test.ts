import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  enqueueOfflineEvent,
  getOfflineQueue,
  clearOfflineQueue,
  flushOfflineQueue,
} from "@/lib/offline/offlineQueue";
import { recordMatchEventAtomic } from "@/lib/scoring/atomicScoring";

describe("Web Offline Queue & Synchronization Engine", () => {
  beforeEach(() => {
    clearOfflineQueue();
    vi.clearAllMocks();
  });

  it("enqueues atomic events with idempotency keys when offline", () => {
    const event = enqueueOfflineEvent({
      matchId: "match-web-offline-1",
      idempotencyKey: "web-key-1",
      newScores: { current: { home: 1, away: 0 } },
      eventData: { type: "point_won", side: "home" },
    });

    expect(event.idempotencyKey).toBe("web-key-1");

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].matchId).toBe("match-web-offline-1");
    expect(queue[0].eventData.type).toBe("point_won");
  });

  it("automatically catches network failures in recordMatchEventAtomic and enqueues event", async () => {
    const mockFailingSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error("Failed to fetch")),
      from: vi.fn(),
    };

    const res = await recordMatchEventAtomic(mockFailingSupabase, {
      matchId: "match-web-offline-2",
      newScores: { current: { home: 10, away: 8 } },
      eventData: { type: "point_scored", points: 2, side: "home" },
    });

    expect(res.error).toBeNull();
    expect((res as any).queued).toBe(true);

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].matchId).toBe("match-web-offline-2");
    expect(queue[0].newScores.current.home).toBe(10);
  });

  it("flushes queued events to Supabase in FIFO order when connectivity is restored", async () => {
    enqueueOfflineEvent({
      matchId: "match-web-offline-3",
      idempotencyKey: "w-key-1",
      newScores: { current: { home: 1, away: 0 } },
      eventData: { type: "point_won", side: "home" },
    });
    enqueueOfflineEvent({
      matchId: "match-web-offline-3",
      idempotencyKey: "w-key-2",
      newScores: { current: { home: 2, away: 0 } },
      eventData: { type: "point_won", side: "home" },
    });

    expect(getOfflineQueue().length).toBe(2);

    const rpcCalls: any[] = [];
    const mockOnlineSupabase = {
      rpc: vi.fn().mockImplementation((name, args) => {
        rpcCalls.push({ name, args });
        return Promise.resolve({ data: { id: args.p_match_id }, error: null });
      }),
    };

    const { processed, remaining } = await flushOfflineQueue(mockOnlineSupabase);

    expect(processed).toBe(2);
    expect(remaining).toBe(0);
    expect(rpcCalls.length).toBe(2);

    expect(rpcCalls[0].args.p_idempotency_key).toBe("w-key-1");
    expect(rpcCalls[1].args.p_idempotency_key).toBe("w-key-2");
    expect(getOfflineQueue().length).toBe(0);
  });
});
