import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

describe("Follow System & Aggregated Notifications E2E", () => {
  let supabaseAdmin: SupabaseClient;
  let followerUser: any;
  let organizerUser: any;
  let testTournamentId: string;
  let testMatchId: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Create a follower user
    const followerEmail = `follower-${Date.now()}@scoreboard.test`;
    const { data: fData, error: fErr } = await supabaseAdmin.auth.admin.createUser({
      email: followerEmail,
      password: "FollowerPassword!123",
      email_confirm: true,
      user_metadata: { display_name: `follower_${Date.now()}` },
    });
    if (fErr || !fData.user) {
      throw new Error(`Failed to create follower: ${fErr?.message}`);
    }
    followerUser = fData.user;

    // 2. Create organizer user (Pro tier)
    const orgEmail = `organizer-${Date.now()}@scoreboard.test`;
    const { data: oData, error: oErr } = await supabaseAdmin.auth.admin.createUser({
      email: orgEmail,
      password: "OrgPassword!123",
      email_confirm: true,
      user_metadata: { display_name: `org_${Date.now()}` },
    });
    if (oErr || !oData.user) {
      throw new Error(`Failed to create organizer: ${oErr?.message}`);
    }
    organizerUser = oData.user;

    await supabaseAdmin
      .from("users")
      .update({ subscription_tier: "pro" })
      .eq("id", organizerUser.id);

    // 3. Create a test tournament
    const { data: tData, error: tErr } = await supabaseAdmin
      .from("tournaments")
      .insert({
        organizer_id: organizerUser.id,
        name: `Tournament Follow Test ${Date.now()}`,
        sport_type: "Tennis",
        status: "ongoing",
      })
      .select()
      .single();

    if (tErr || !tData) {
      throw new Error(`Failed to create tournament: ${tErr?.message}`);
    }
    testTournamentId = tData.id;

    // 4. Create a test match belonging to this tournament
    const { data: mData, error: mErr } = await supabaseAdmin
      .from("matches")
      .insert({
        organizer_id: organizerUser.id,
        tournament_id: testTournamentId,
        sport_type: "Tennis",
        status: "scheduled",
        participants: [{ name: "Player Alpha" }, { name: "Player Beta" }],
        scores: { sets: [{ home: 0, away: 0 }] },
      })
      .select()
      .single();

    if (mErr || !mData) {
      throw new Error(`Failed to create match: ${mErr?.message}`);
    }
    testMatchId = mData.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testMatchId) {
      await supabaseAdmin.from("matches").delete().eq("id", testMatchId);
    }
    if (testTournamentId) {
      await supabaseAdmin.from("tournaments").delete().eq("id", testTournamentId);
    }
    if (followerUser?.id) {
      await supabaseAdmin.auth.admin.deleteUser(followerUser.id);
    }
    if (organizerUser?.id) {
      await supabaseAdmin.auth.admin.deleteUser(organizerUser.id);
    }
  });

  it("aggregates multiple match score updates into a single notification for match followers", async () => {
    // Step 1: Follower follows the specific match
    const { error: followErr } = await supabaseAdmin.from("follows").insert({
      user_id: followerUser.id,
      entity_id: testMatchId,
      entity_type: "match",
    });
    expect(followErr).toBeNull();

    // Step 2: First score update (Set 1: 1-0)
    const { error: scoreErr1 } = await supabaseAdmin
      .from("matches")
      .update({
        status: "ongoing",
        scores: { sets: [{ home: 1, away: 0 }] },
      })
      .eq("id", testMatchId);
    expect(scoreErr1).toBeNull();

    // Verify 1 notification exists
    const { data: notifs1, error: nErr1 } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", followerUser.id)
      .eq("data->>match_id", testMatchId);

    expect(nErr1).toBeNull();
    expect(notifs1).toHaveLength(1);
    expect(notifs1![0].title).toBe("Player Alpha vs Player Beta");
    expect(notifs1![0].body).toContain("1-0");
    const firstNotifId = notifs1![0].id;

    // Simulate follower marking this notification as read
    await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", firstNotifId);

    // Step 3: Second score update (Set 1: 2-0)
    const { error: scoreErr2 } = await supabaseAdmin
      .from("matches")
      .update({
        scores: { sets: [{ home: 2, away: 0 }] },
      })
      .eq("id", testMatchId);
    expect(scoreErr2).toBeNull();

    // Step 4: Third score update (Set 1: 2-1)
    const { error: scoreErr3 } = await supabaseAdmin
      .from("matches")
      .update({
        scores: { sets: [{ home: 2, away: 1 }] },
      })
      .eq("id", testMatchId);
    expect(scoreErr3).toBeNull();

    // VERIFICATION OF AGGREGATION RULE:
    // Still EXACTLY 1 notification for this match, updated in-place with latest score!
    const { data: notifsFinal, error: nErrFinal } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", followerUser.id)
      .eq("data->>match_id", testMatchId);

    expect(nErrFinal).toBeNull();
    expect(notifsFinal).toHaveLength(1);
    expect(notifsFinal![0].id).toBe(firstNotifId);
    expect(notifsFinal![0].body).toContain("2-1");
    // read_at must be reset to null so the user is alerted to the new update!
    expect(notifsFinal![0].read_at).toBeNull();
  });

  it("notifies tournament followers for any match in the tournament with aggregation per match", async () => {
    // Cleanup previous match follow and notifications
    await supabaseAdmin.from("follows").delete().eq("user_id", followerUser.id);
    await supabaseAdmin.from("notifications").delete().eq("user_id", followerUser.id);

    // Follower follows the entire TOURNAMENT
    const { error: followTErr } = await supabaseAdmin.from("follows").insert({
      user_id: followerUser.id,
      entity_id: testTournamentId,
      entity_type: "tournament",
    });
    expect(followTErr).toBeNull();

    // Create a 2nd match in this tournament
    const { data: match2, error: m2Err } = await supabaseAdmin
      .from("matches")
      .insert({
        organizer_id: organizerUser.id,
        tournament_id: testTournamentId,
        sport_type: "Tennis",
        status: "scheduled",
        participants: [{ name: "Player Gamma" }, { name: "Player Delta" }],
        scores: { sets: [{ home: 0, away: 0 }] },
      })
      .select()
      .single();
    expect(m2Err).toBeNull();

    try {
      // Score update on match 1
      await supabaseAdmin
        .from("matches")
        .update({
          status: "ongoing",
          scores: { sets: [{ home: 3, away: 1 }] },
        })
        .eq("id", testMatchId);

      // Score update on match 2
      await supabaseAdmin
        .from("matches")
        .update({
          status: "ongoing",
          scores: { sets: [{ home: 4, away: 4 }] },
        })
        .eq("id", match2.id);

      // Verify the tournament follower received 1 notification for match 1 and 1 notification for match 2
      const { data: allNotifs } = await supabaseAdmin
        .from("notifications")
        .select("*")
        .eq("user_id", followerUser.id)
        .order("created_at", { ascending: false });

      expect(allNotifs).toHaveLength(2);

      const notifMatch1 = allNotifs?.find((n) => n.data?.match_id === testMatchId);
      const notifMatch2 = allNotifs?.find((n) => n.data?.match_id === match2.id);

      expect(notifMatch1).toBeDefined();
      expect(notifMatch1?.body).toContain("3-1");

      expect(notifMatch2).toBeDefined();
      expect(notifMatch2?.body).toContain("4-4");

      // Multiple updates on match 2 are aggregated into match 2's notification
      await supabaseAdmin
        .from("matches")
        .update({
          scores: { sets: [{ home: 6, away: 4 }] },
          status: "completed",
        })
        .eq("id", match2.id);

      const { data: updatedNotifs } = await supabaseAdmin
        .from("notifications")
        .select("*")
        .eq("user_id", followerUser.id);

      // Still exactly 2 notifications total (1 per match!)
      expect(updatedNotifs).toHaveLength(2);
      const updatedMatch2Notif = updatedNotifs?.find((n) => n.data?.match_id === match2.id);
      expect(updatedMatch2Notif?.body).toContain("6-4");
      expect(updatedMatch2Notif?.data?.type).toBe("match_completed");
    } finally {
      await supabaseAdmin.from("matches").delete().eq("id", match2.id);
    }
  });

  it("stops sending notifications when user unfollows", async () => {
    // Unfollow tournament
    await supabaseAdmin
      .from("follows")
      .delete()
      .eq("user_id", followerUser.id)
      .eq("entity_id", testTournamentId);

    // Delete existing notifications
    await supabaseAdmin.from("notifications").delete().eq("user_id", followerUser.id);

    // Score update on match 1
    await supabaseAdmin
      .from("matches")
      .update({
        scores: { sets: [{ home: 6, away: 1 }] },
        status: "completed",
      })
      .eq("id", testMatchId);

    // Verify NO notifications received
    const { data: emptyNotifs } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", followerUser.id);

    expect(emptyNotifs).toHaveLength(0);
  });
});
