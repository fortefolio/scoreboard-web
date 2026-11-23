import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotifications } from "./useNotifications";

let realtimeCallback: ((payload: any) => void) | null = null;
const mockNotifications = [
  {
    id: "n1",
    user_id: "user-1",
    title: "Goal for AAC!",
    body: "AAC 1 - 0 AAV",
    data: { match_id: "m1", type: "score_update" },
    read_at: null,
    created_at: "2026-11-23T15:00:00Z",
  },
];

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "notifications") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
            })),
          })),
        })),
      };
    }
    return {
      select: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
  }),
  channel: vi.fn(() => ({
    on: vi.fn((_event: string, _filter: any, cb: (payload: any) => void) => {
      realtimeCallback = cb;
      return {
        subscribe: vi.fn(() => ({})),
      };
    }),
    subscribe: vi.fn(() => ({})),
  })),
  removeChannel: vi.fn(),
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    supabase: mockSupabase,
  }),
}));

describe("useNotifications realtime unreadCount", () => {
  beforeEach(() => {
    realtimeCallback = null;
    vi.clearAllMocks();
  });

  it("recomputes unreadCount on UPDATE even when payload.old lacks read_at (REPLICA IDENTITY DEFAULT)", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    // Simulate in-place score update where payload.old only has { id }
    act(() => {
      realtimeCallback?.({
        eventType: "UPDATE",
        old: { id: "n1" },
        new: {
          ...mockNotifications[0],
          body: "AAC 2 - 1 AAV",
          read_at: null,
        },
      });
    });

    // Must stay 1 (never increment 1 -> 2)
    expect(result.current.unreadCount).toBe(1);

    // Simulate marking as read
    act(() => {
      realtimeCallback?.({
        eventType: "UPDATE",
        old: { id: "n1" },
        new: {
          ...mockNotifications[0],
          read_at: "2026-11-23T15:05:00Z",
        },
      });
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it("recomputes unreadCount on DELETE", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    act(() => {
      realtimeCallback?.({
        eventType: "DELETE",
        old: { id: "n1" },
      });
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications).toHaveLength(0);
  });
});
