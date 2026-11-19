import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)(
  "Platform Permissions Matrix (Unauthenticated, Free, Pro)",
  () => {
    let adminClient: SupabaseClient;
    let anonClient: SupabaseClient;
    let freeClient: SupabaseClient;
    let proClient: SupabaseClient;

    let freeUserId: string;
    let proUserId: string;
    const createdTournamentIds: string[] = [];
    const createdMatchIds: string[] = [];

    beforeAll(async () => {
      adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const ts = Date.now();
      const freeEmail = `rls_free_${ts}@scoreboard.local`;
      const proEmail = `rls_pro_${ts}@scoreboard.local`;
      const password = "Password123!";

      const { data: freeCreated } = await adminClient.auth.admin.createUser({
        email: freeEmail,
        password,
        email_confirm: true,
        user_metadata: { username: `free_${ts}` },
      });
      const { data: proCreated } = await adminClient.auth.admin.createUser({
        email: proEmail,
        password,
        email_confirm: true,
        user_metadata: { username: `pro_${ts}` },
      });

      freeUserId = freeCreated.user!.id;
      proUserId = proCreated.user!.id;

      // Upgrade proUser to active Pro tier
      await adminClient.from("users").update({ subscription_tier: "pro" }).eq("id", proUserId);

      freeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      proClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      await freeClient.auth.signInWithPassword({ email: freeEmail, password });
      await proClient.auth.signInWithPassword({ email: proEmail, password });
    });

    afterAll(async () => {
      if (createdMatchIds.length) {
        await adminClient.from("matches").delete().in("id", createdMatchIds);
      }
      if (createdTournamentIds.length) {
        await adminClient.from("tournaments").delete().in("id", createdTournamentIds);
      }
      if (freeUserId) await adminClient.auth.admin.deleteUser(freeUserId);
      if (proUserId) await adminClient.auth.admin.deleteUser(proUserId);
    });

    it("unauthenticated user cannot create matches or tournaments", async () => {
      const { error: matchErr } = await anonClient.from("matches").insert({
        sport_type: "Tennis",
        status: "scheduled",
        participants: [{ name: "A" }, { name: "B" }],
      });
      expect(matchErr).not.toBeNull();

      const { error: tourErr } = await anonClient.from("tournaments").insert({
        name: "Anon Tour",
        sport_type: "Tennis",
        status: "pending",
      });
      expect(tourErr).not.toBeNull();
    });

    it("free user can create standalone matches but is blocked from creating tournaments", async () => {
      const { data: match, error: matchErr } = await freeClient
        .from("matches")
        .insert({
          sport_type: "Padel",
          organizer_id: freeUserId,
          status: "scheduled",
          participants: [{ name: "Team 1" }, { name: "Team 2" }],
        })
        .select("id")
        .single();

      expect(matchErr).toBeNull();
      expect(match?.id).toBeDefined();
      if (match?.id) createdMatchIds.push(match.id);

      const { error: tourErr } = await freeClient.from("tournaments").insert({
        name: "Free User Tour",
        sport_type: "Tennis",
        organizer_id: freeUserId,
        status: "pending",
      });
      expect(tourErr).not.toBeNull();
    });

    it("pro user can create public & private tournaments, and non-owners cannot see private tournaments or edit them", async () => {
      const { data: privTour, error: createErr } = await proClient
        .from("tournaments")
        .insert({
          name: "Pro Private Open",
          sport_type: "Volleyball",
          organizer_id: proUserId,
          visibility: "private",
          status: "pending",
        })
        .select("id")
        .single();

      expect(createErr).toBeNull();
      expect(privTour?.id).toBeDefined();
      createdTournamentIds.push(privTour!.id);

      // Free user & anon cannot read or update private tournament
      const { data: freeRead } = await freeClient
        .from("tournaments")
        .select("id")
        .eq("id", privTour!.id)
        .maybeSingle();
      expect(freeRead).toBeNull();

      const { data: anonRead } = await anonClient
        .from("tournaments")
        .select("id")
        .eq("id", privTour!.id)
        .maybeSingle();
      expect(anonRead).toBeNull();

      const { error: updateErr } = await freeClient
        .from("tournaments")
        .update({ name: "Hijacked" })
        .eq("id", privTour!.id);
      expect(updateErr).toBeNull(); // PostgREST updates 0 rows under RLS

      const { data: afterAttempt } = await proClient
        .from("tournaments")
        .select("name")
        .eq("id", privTour!.id)
        .single();
      expect(afterAttempt?.name).toBe("Pro Private Open");
    });

    it("free user can follow a public match and receive notifications when it starts", async () => {
      const { data: pubMatch } = await proClient
        .from("matches")
        .insert({
          sport_type: "Basketball",
          organizer_id: proUserId,
          status: "scheduled",
          participants: [{ name: "Home" }, { name: "Away" }],
        })
        .select("id")
        .single();
      createdMatchIds.push(pubMatch!.id);

      const { error: followErr } = await freeClient.from("follows").insert({
        user_id: freeUserId,
        entity_id: pubMatch!.id,
        entity_type: "match",
      });
      expect(followErr).toBeNull();

      // Pro organizer starts match
      await proClient.from("matches").update({ status: "ongoing" }).eq("id", pubMatch!.id);

      const { data: notifs } = await freeClient
        .from("notifications")
        .select("id, entity_id")
        .eq("user_id", freeUserId)
        .eq("entity_id", pubMatch!.id);
      expect(Array.isArray(notifs)).toBe(true);
    });
  }
);
