import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe("Match Lifecycle RLS Enforcement", () => {
  let userClient: SupabaseClient;
  let adminClient: SupabaseClient;
  let testUserId: string;
  let createdMatchId: string;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testEmail = `rls_test_${Date.now()}@scoreboard.local`;
    const testPassword = "Password123!";

    // Create user via admin API
    const { data: createdUser, error: userError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { username: `rls_user_${Date.now()}` },
    });

    if (userError || !createdUser.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }

    testUserId = createdUser.user.id;

    // Create client as authenticated user (SUBJECT TO RLS)
    userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      throw new Error(`Failed to sign in test user: ${signInError.message}`);
    }
  });

  afterAll(async () => {
    if (createdMatchId) {
      await adminClient.from("matches").delete().eq("id", createdMatchId);
    }
    if (testUserId) {
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  it("organizer can create a tennis match under RLS", async () => {
    const { data, error } = await userClient
      .from("matches")
      .insert({
        sport_type: "Tennis",
        organizer_id: testUserId,
        status: "scheduled",
        participants: [{ name: "Player 1" }, { name: "Player 2" }],
        scores: { tennis: { sets: [], points: [0, 0], games: [0, 0] } },
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBeDefined();
    createdMatchId = data?.id;
  });

  it("organizer can start match ('status: ongoing') without infinite RLS recursion", async () => {
    expect(createdMatchId).toBeDefined();

    // This is the exact operation performed by "Start Scoreboard" in MatchDetailClient
    const { data, error } = await userClient
      .from("matches")
      .update({ status: "ongoing" })
      .eq("id", createdMatchId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("ongoing");
  });

  it("organizer cannot alter organizer_id to someone else via trigger protection", async () => {
    expect(createdMatchId).toBeDefined();
    const fakeNewOrganizer = "00000000-0000-0000-0000-000000000000";

    const { error } = await userClient
      .from("matches")
      .update({ organizer_id: fakeNewOrganizer })
      .eq("id", createdMatchId);

    // RLS or trigger must reject unauthorized change
    expect(error).not.toBeNull();
  });
});
