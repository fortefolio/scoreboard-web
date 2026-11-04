import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

describe.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)("Atomic & Idempotent Scoring RPC (record_match_event_atomic)", () => {
  let adminClient: SupabaseClient;
  let organizerClient: SupabaseClient;
  let unauthorizedClient: SupabaseClient;

  let organizerId: string;
  let unauthorizedUserId: string;
  let testMatchId: string;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create organizer user
    const organizerEmail = `organizer_${Date.now()}@scoreboard.local`;
    const password = "Password123!";
    const { data: orgUser } = await adminClient.auth.admin.createUser({
      email: organizerEmail,
      password,
      email_confirm: true,
      user_metadata: { username: `org_${Date.now()}` },
    });
    organizerId = orgUser.user!.id;

    organizerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await organizerClient.auth.signInWithPassword({ email: organizerEmail, password });

    // 2. Create unauthorized user
    const unauthEmail = `unauth_${Date.now()}@scoreboard.local`;
    const { data: unauthUser } = await adminClient.auth.admin.createUser({
      email: unauthEmail,
      password,
      email_confirm: true,
      user_metadata: { username: `unauth_${Date.now()}` },
    });
    unauthorizedUserId = unauthUser.user!.id;

    unauthorizedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await unauthorizedClient.auth.signInWithPassword({ email: unauthEmail, password });

    // 3. Create test match owned by organizer
    const { data: match, error: matchErr } = await adminClient
      .from("matches")
      .insert({
        sport_type: "Volleyball",
        organizer_id: organizerId,
        status: "ongoing",
        participants: [{ name: "Team Alpha" }, { name: "Team Beta" }],
        scores: { current: { home: 0, away: 0 } },
      })
      .select()
      .single();

    if (matchErr || !match) {
      throw new Error("Failed to create test match: " + matchErr?.message);
    }
    testMatchId = match.id;
  });

  afterAll(async () => {
    if (testMatchId) {
      await adminClient.from("match_events").delete().eq("match_id", testMatchId);
      await adminClient.from("matches").delete().eq("id", testMatchId);
    }
    if (organizerId) {
      await adminClient.auth.admin.deleteUser(organizerId);
    }
    if (unauthorizedUserId) {
      await adminClient.auth.admin.deleteUser(unauthorizedUserId);
    }
  });

  it("organizer records score and event atomically via RPC", async () => {
    const idempotencyKey = crypto.randomUUID();
    const newScores = { current: { home: 1, away: 0 }, volleyball: { current_points: [1, 0] } };
    const eventData = { type: "point_won", side: "home", score: "1-0" };

    const { data, error } = await organizerClient.rpc("record_match_event_atomic", {
      p_match_id: testMatchId,
      p_idempotency_key: idempotencyKey,
      p_new_scores: newScores,
      p_event_data: eventData,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.scores.current.home).toBe(1);

    // Verify row was inserted into match_events with idempotency_key
    const { data: events } = await adminClient
      .from("match_events")
      .select("*")
      .eq("idempotency_key", idempotencyKey);

    expect(events).toHaveLength(1);
    expect(events![0].event_data.side).toBe("home");
  });

  it("enforces idempotency: repeated calls with same key do not duplicate events", async () => {
    const idempotencyKey = crypto.randomUUID();
    const newScores = { current: { home: 2, away: 0 }, volleyball: { current_points: [2, 0] } };
    const eventData = { type: "point_won", side: "home", score: "2-0" };

    // First attempt
    const res1 = await organizerClient.rpc("record_match_event_atomic", {
      p_match_id: testMatchId,
      p_idempotency_key: idempotencyKey,
      p_new_scores: newScores,
      p_event_data: eventData,
    });
    expect(res1.error).toBeNull();

    // Simulated retry (e.g. 4G reconnection timeout re-transmission)
    const res2 = await organizerClient.rpc("record_match_event_atomic", {
      p_match_id: testMatchId,
      p_idempotency_key: idempotencyKey,
      p_new_scores: newScores,
      p_event_data: eventData,
    });
    expect(res2.error).toBeNull();

    // Verify exactly ONE event exists for this idempotency key
    const { data: events } = await adminClient
      .from("match_events")
      .select("*")
      .eq("idempotency_key", idempotencyKey);

    expect(events).toHaveLength(1);
  });

  it("blocks unauthorized users from scoring", async () => {
    const idempotencyKey = crypto.randomUUID();
    const newScores = { current: { home: 99, away: 99 } };
    const eventData = { type: "tampering" };

    const { data, error } = await unauthorizedClient.rpc("record_match_event_atomic", {
      p_match_id: testMatchId,
      p_idempotency_key: idempotencyKey,
      p_new_scores: newScores,
      p_event_data: eventData,
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain("Unauthorized to score this match");
  });
});
