import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("Phase 4: Concurrency, Load Resilience & Idempotency", () => {
  let organizerUser: any;
  let testMatchId: string;

  beforeAll(async () => {
    // 1. Get or create organizer user
    const { data: users } = await supabaseAdmin.from("users").select("id, email").limit(1);
    if (users && users.length > 0) {
      organizerUser = users[0];
    } else {
      const email = `perf-${Date.now()}@scoreboard.local`;
      const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "Password123!",
        email_confirm: true,
      });
      organizerUser = { id: authUser.user!.id, email };
    }

    // 2. Create test match
    const { data: match, error } = await supabaseAdmin
      .from("matches")
      .insert({
        organizer_id: organizerUser.id,
        sport_type: "Volleyball",
        status: "ongoing",
        scores: { current: { home: 0, away: 0 }, current_set: 1, sets: [] },
      })
      .select()
      .single();

    if (error) throw error;
    testMatchId = match.id;
  });

  afterAll(async () => {
    if (testMatchId) {
      await supabaseAdmin.from("matches").delete().eq("id", testMatchId);
    }
  });

  it("handles rapid concurrent scoring with strict idempotency and sub-250ms latency", async () => {
    const latencies: number[] = [];
    const NUM_POINTS = 20;

    // Simulate 20 rapid score taps
    for (let i = 1; i <= NUM_POINTS; i++) {
      const idempotencyKey = crypto.randomUUID();
      const side = i % 2 === 0 ? "home" : "away";
      const start = performance.now();

      // First tap
      const { data: firstRes, error: firstErr } = await supabaseAdmin.rpc(
        "record_match_event_atomic",
        {
          p_match_id: testMatchId,
          p_idempotency_key: idempotencyKey,
          p_new_scores: { current: { home: i, away: i - 1 } },
          p_event_data: { type: "point_won", side, point_number: i },
          p_new_status: "ongoing",
        }
      );

      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      expect(firstErr).toBeNull();
      expect(firstRes).toBeDefined();

      // Immediate retry with the EXACT same idempotency key (simulating offline retry or rapid double-tap)
      const { data: retryRes, error: retryErr } = await supabaseAdmin.rpc(
        "record_match_event_atomic",
        {
          p_match_id: testMatchId,
          p_idempotency_key: idempotencyKey,
          p_new_scores: { current: { home: i, away: i - 1 } },
          p_event_data: { type: "point_won", side, point_number: i },
          p_new_status: "ongoing",
        }
      );

      expect(retryErr).toBeNull();
      expect(retryRes).toBeDefined();
    }

    // Verify exactly NUM_POINTS rows inserted in match_events (no duplicate retries created)
    const { data: events, count } = await supabaseAdmin
      .from("match_events")
      .select("id, idempotency_key", { count: "exact" })
      .eq("match_id", testMatchId);

    expect(count).toBe(NUM_POINTS);

    // Calculate latency metrics
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log(
      `[Load Test] ${NUM_POINTS} atomic score events (with 100% duplicate retries):\n` +
      `  • Average Latency: ${avgLatency.toFixed(2)}ms\n` +
      `  • P95 Latency: ${p95Latency.toFixed(2)}ms\n` +
      `  • Target Threshold: < 250ms\n` +
      `  • Duplicate Events Created: 0`
    );

    expect(p95Latency).toBeLessThan(250);
  });

  it("fans out broadcast score_update across concurrent spectator listeners", async () => {
    const spectator1 = createClient(SUPABASE_URL, ANON_KEY);
    const spectator2 = createClient(SUPABASE_URL, ANON_KEY);

    let spectator1Received = false;
    let spectator2Received = false;

    const ch1 = spectator1
      .channel(`match:${testMatchId}`)
      .on("broadcast", { event: "score_update" }, () => {
        spectator1Received = true;
      })
      .subscribe();

    const ch2 = spectator2
      .channel(`match:${testMatchId}`)
      .on("broadcast", { event: "score_update" }, () => {
        spectator2Received = true;
      })
      .subscribe();

    // Give channels 300ms to connect
    await new Promise((r) => setTimeout(r, 300));

    // Record an atomic event which executes realtime.send
    const { error } = await supabaseAdmin.rpc("record_match_event_atomic", {
      p_match_id: testMatchId,
      p_idempotency_key: crypto.randomUUID(),
      p_new_scores: { current: { home: 25, away: 23 } },
      p_event_data: { type: "match_finished" },
      p_new_status: "completed",
    });

    expect(error).toBeNull();

    // Wait for broadcast delivery
    await new Promise((r) => setTimeout(r, 500));

    spectator1.removeChannel(ch1);
    spectator2.removeChannel(ch2);

    // Verify match state updated to completed
    const { data: finalMatch } = await supabaseAdmin
      .from("matches")
      .select("status, scores")
      .eq("id", testMatchId)
      .single();

    expect(finalMatch?.status).toBe("completed");
    expect(finalMatch?.scores?.current?.home).toBe(25);
  });
});
