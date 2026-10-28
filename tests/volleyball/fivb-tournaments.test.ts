import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateVolleyballScore,
  createInitialVolleyballScores,
  generateRallySequenceForMatch,
  playDataVolleyRallyString,
  type VolleyballRules,
  type VolleyballScoresState,
  type VolleyballSetScoreSpec,
} from "@/lib/scoring/volleyball-engine";
import { calculateStandings } from "@/lib/standings/groups";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function simulateVolleyballMatchInMemory(
  sets: VolleyballSetScoreSpec[],
  rules: VolleyballRules = {},
  initialServer: 0 | 1 = 0
): VolleyballScoresState {
  const rallies = generateRallySequenceForMatch(sets, rules);
  let state = createInitialVolleyballScores(initialServer);
  for (const side of rallies) {
    state = calculateVolleyballScore(state, side, rules);
  }
  return state;
}

describe("Volleyball & Beach Volleyball Engine Mechanics (BigTimeStats/beach-volleyball & OpenVolley/datavolley)", () => {
  it("tracks Rally Point System: Break Points (server holds serve) vs Side-outs (receiver wins rally and takes serve)", () => {
    const rules: VolleyballRules = { sport_type: "Beach Volleyball", max_sets: 3, points_per_set: 21 };
    let state = createInitialVolleyballScores(0); // Team 0 serving

    // Rally 1: Team 0 (server) scores -> Break Point! Score 1-0, Team 0 keeps serve
    state = calculateVolleyballScore(state, "home", rules);
    expect(state.current).toEqual({ home: 1, away: 0 });
    expect(state.serving_index).toBe(0);
    expect(state.volleyball.last_rally_sideout).toBe(false);
    expect(state.volleyball.current_set_rallies[0]).toMatchObject({
      rally_number: 1,
      server: 0,
      winner: 0,
      is_sideout: false,
      is_break_point: true,
      score_after: { home: 1, away: 0 },
    });

    // Rally 2: Team 1 (receiver) scores -> Side-out! Score 1-1, serve rotates to Team 1
    state = calculateVolleyballScore(state, "away", rules);
    expect(state.current).toEqual({ home: 1, away: 1 });
    expect(state.serving_index).toBe(1);
    expect(state.volleyball.last_rally_sideout).toBe(true);
    expect(state.volleyball.current_set_rallies[1]).toMatchObject({
      rally_number: 2,
      server: 0,
      winner: 1,
      is_sideout: true,
      is_break_point: false,
      score_after: { home: 1, away: 1 },
    });

    // Rally 3: Team 1 (now serving) scores -> Break Point! Score 1-2, Team 1 keeps serve
    state = calculateVolleyballScore(state, "away", rules);
    expect(state.current).toEqual({ home: 1, away: 2 });
    expect(state.serving_index).toBe(1);
    expect(state.volleyball.last_rally_sideout).toBe(false);
  });

  it("enforces FIVB Beach Volleyball court switches (every 7 pts in Sets 1-2, every 5 pts in Set 3) and Technical Timeout at 21 total points", () => {
    const rules: VolleyballRules = {
      sport_type: "Beach Volleyball",
      max_sets: 3,
      points_per_set: 21,
      deciding_set_points: 15,
    };
    let state = createInitialVolleyballScores(0);

    // Play 6 rallies (4-2): total = 6 -> no court switch yet
    state = playDataVolleyRallyString(state, "SSSRRS", rules);
    expect(state.current.home + state.current.away).toBe(6);
    expect(state.volleyball.change_ends).toBe(false);

    // 7th rally (total = 7): FIVB Beach Volleyball court switch!
    state = calculateVolleyballScore(state, "home", rules);
    expect(state.current.home + state.current.away).toBe(7);
    expect(state.volleyball.change_ends).toBe(true);

    // Play up to 20 total points (11-9)
    while (state.current.home + state.current.away < 20) {
      const nextSide = state.current.home <= state.current.away ? "home" : "away";
      state = calculateVolleyballScore(state, nextSide, rules);
    }
    expect(state.current.home + state.current.away).toBe(20);
    expect(state.volleyball.technical_timeout).toBe(false);

    // 21st point in a regular Beach Volleyball set (e.g. 11-10): triggers Technical Timeout AND 3rd court switch (21 % 7 === 0)!
    state = calculateVolleyballScore(state, "home", rules);
    expect(state.current.home + state.current.away).toBe(21);
    expect(state.volleyball.technical_timeout).toBe(true);
    expect(state.volleyball.change_ends).toBe(true);
  });

  it("enforces FIVB Beach Volleyball deciding 3rd set court switch every 5 points and no technical timeout at 21", () => {
    const rules: VolleyballRules = {
      sport_type: "Beach Volleyball",
      max_sets: 3,
      points_per_set: 21,
      deciding_set_points: 15,
    };

    // Simulate Set 1 (21-18) and Set 2 (19-21) to enter deciding Set 3
    let state = simulateVolleyballMatchInMemory(
      [
        { home: 21, away: 18 },
        { home: 19, away: 21 },
      ],
      rules,
      0
    );
    expect(state.sets).toHaveLength(2);
    expect(state.volleyball.is_deciding_set).toBe(true);

    // Play 4 points in Set 3 (2-2) -> no switch
    state = calculateVolleyballScore(state, "home", rules);
    state = calculateVolleyballScore(state, "away", rules);
    state = calculateVolleyballScore(state, "home", rules);
    state = calculateVolleyballScore(state, "away", rules);
    expect(state.volleyball.change_ends).toBe(false);

    // 5th point in Set 3 (3-2, total = 5) -> switch ends!
    state = calculateVolleyballScore(state, "home", rules);
    expect(state.current).toEqual({ home: 3, away: 2 });
    expect(state.volleyball.change_ends).toBe(true);
  });

  it("enforces FIVB Indoor Volleyball Best-of-5 (25/25/25/25/15) with deciding 5th-set court switch when leading team first reaches 8 points", () => {
    const rules: VolleyballRules = {
      sport_type: "Volleyball",
      max_sets: 5,
      points_per_set: 25,
      deciding_set_points: 15,
    };

    // Simulate first 4 sets split 2-2: 25-22, 23-25, 28-26 (extended deuce), 21-25
    let state = simulateVolleyballMatchInMemory(
      [
        { home: 25, away: 22 },
        { home: 23, away: 25 },
        { home: 28, away: 26 },
        { home: 21, away: 25 },
      ],
      rules,
      0
    );
    expect(state.sets).toHaveLength(4);
    expect(state.final_sets).toEqual([2, 2]);
    expect(state.volleyball.is_deciding_set).toBe(true);

    // Play Set 5 to 7-6
    for (let i = 0; i < 6; i++) {
      state = calculateVolleyballScore(state, "home", rules);
      state = calculateVolleyballScore(state, "away", rules);
    }
    state = calculateVolleyballScore(state, "home", rules); // 7-6
    expect(state.current).toEqual({ home: 7, away: 6 });
    expect(state.volleyball.change_ends).toBe(false);

    // Home reaches 8 points first (8-6) -> Court Switch!
    state = calculateVolleyballScore(state, "home", rules);
    expect(state.current).toEqual({ home: 8, away: 6 });
    expect(state.volleyball.change_ends).toBe(true);

    // Away later reaches 8 points (8-7, 8-8) -> must NOT trigger a second court switch!
    state = calculateVolleyballScore(state, "away", rules); // 8-7
    expect(state.volleyball.change_ends).toBe(false);
    state = calculateVolleyballScore(state, "away", rules); // 8-8
    expect(state.volleyball.change_ends).toBe(false);
  });

  it("supports Hard Point Cap (point_cap = 25 in a 21-point set ends at 25-24 without win-by-2)", () => {
    const rules: VolleyballRules = {
      sport_type: "Beach Volleyball",
      max_sets: 3,
      points_per_set: 21,
      point_cap: 25,
    };
    let state = createInitialVolleyballScores(0);

    // Reach 24-24 (deuce past 21, still playing because cap is 25)
    for (let i = 0; i < 24; i++) {
      state = calculateVolleyballScore(state, "home", rules);
      state = calculateVolleyballScore(state, "away", rules);
    }
    expect(state.sets).toHaveLength(0);
    expect(state.current).toEqual({ home: 24, away: 24 });

    // Next point reaches hard cap 25 -> Set won 25-24 immediately!
    state = calculateVolleyballScore(state, "home", rules);
    expect(state.sets).toHaveLength(1);
    expect(state.sets[0]).toMatchObject({ home: 25, away: 24 });
  });
});

describe("FIVB Beach Volleyball & Indoor Volleyball Tournament Suite — Supabase E2E", () => {
  let supabaseAdmin: SupabaseClient;
  let organizerId: string;
  const createdTournamentIds: string[] = [];

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `fivb-suite-${Date.now()}@scoreboard.test`;
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "FivbSuitePassword!23",
      email_confirm: true,
      user_metadata: { display_name: `fivb_org_${Date.now()}` },
    });
    if (authErr || !authData.user) {
      throw new Error(`Failed to create test organizer: ${authErr?.message}`);
    }
    organizerId = authData.user.id;

    const { error: proErr } = await supabaseAdmin
      .from("users")
      .update({ subscription_tier: "pro" })
      .eq("id", organizerId);
    if (proErr) throw new Error(`Failed to upgrade test organizer to pro: ${proErr.message}`);
  });

  afterAll(async () => {
    if (process.env.KEEP_TEST_DATA === "true" || process.env.KEEP_TEST_DATA === "1") {
      const targetEmail = process.env.TEST_USER_EMAIL;
      let query = supabaseAdmin
        .from("users")
        .select("id, email")
        .not("email", "like", "%@scoreboard.test")
        .order("created_at", { ascending: false })
        .limit(1);
      if (targetEmail) {
        query = supabaseAdmin.from("users").select("id, email").eq("email", targetEmail).limit(1);
      }
      const { data: realUsers } = await query;
      const targetOwnerId = realUsers?.[0]?.id;

      if (createdTournamentIds.length > 0) {
        await supabaseAdmin
          .from("tournaments")
          .update({
            status: "ongoing",
            ...(targetOwnerId ? { organizer_id: targetOwnerId } : {}),
          })
          .in("id", createdTournamentIds);

        if (targetOwnerId) {
          await supabaseAdmin
            .from("matches")
            .update({ organizer_id: targetOwnerId })
            .in("tournament_id", createdTournamentIds);
        }
      }

      if (organizerId && targetOwnerId && organizerId !== targetOwnerId) {
        await supabaseAdmin.auth.admin.deleteUser(organizerId);
      }

      console.log(
        `\n[KEEP_TEST_DATA] Preserved ${createdTournamentIds.length} FIVB Volleyball/Beach Volleyball tournaments (assigned to ${realUsers?.[0]?.email || organizerId}):`
      );
      for (const id of createdTournamentIds) {
        console.log(`  -> http://localhost:3000/tournament/${id}`);
      }
      return;
    }

    if (createdTournamentIds.length > 0) {
      await supabaseAdmin.from("tournaments").delete().in("id", createdTournamentIds);
    }
    if (organizerId) {
      await supabaseAdmin.auth.admin.deleteUser(organizerId);
    }
  });

  /**
   * Helper: Plays a full Volleyball / Beach Volleyball match through PostgreSQL `match_events`
   * point-by-point so the DB trigger `public.update_match_score` computes every rally, set,
   * and bracket advancement.
   */
  async function playVolleyballMatchViaDatabaseEvents(
    matchId: string,
    sets: VolleyballSetScoreSpec[],
    rules: VolleyballRules,
    initialServer: 0 | 1 = 0
  ) {
    // 1. Start the scoreboard and set initial server
    const { error: startErr } = await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "start_scoreboard", initial_server_index: initialServer },
    });
    expect(startErr).toBeNull();

    // 2. Generate rally sequence and insert each point event sequentially
    const rallies = generateRallySequenceForMatch(sets, rules);
    for (const side of rallies) {
      const { error: ptErr } = await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_won", side },
      });
      if (ptErr) throw new Error(`Failed to record rally on match ${matchId}: ${ptErr.message}`);
    }

    // 3. Fetch final match row
    const { data: updatedMatch, error: fetchErr } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();
    expect(fetchErr).toBeNull();
    return updatedMatch;
  }

  it(
    "simulates Paris 2024 / FIVB Beach Pro Tour Men's Finals (Beach Volleyball, Best of 3 sets — 21/21/15, Single Elimination)",
    async () => {
      const rules: VolleyballRules = {
        sport_type: "Beach Volleyball",
        max_sets: 3,
        points_per_set: 21,
        deciding_set_points: 15,
      };

      // 1. Create Tournament
      const { data: tournament, error: tErr } = await supabaseAdmin
        .from("tournaments")
        .insert({
          name: "Paris 2024 Olympic Beach Volleyball — Men's Knockout",
          sport_type: "Beach Volleyball",
          organizer_id: organizerId,
          status: "ongoing",
          visibility: "public",
          settings: {
            max_teams: 8,
            default: rules,
            stage_1: { type: "bracket" },
          },
        })
        .select()
        .single();
      expect(tErr).toBeNull();
      createdTournamentIds.push(tournament.id);

      // 2. Register 8 Olympic Men's Beach Volleyball Pairs (BigTimeStats/beach-volleyball)
      const pairs = [
        "Åhman / Hellvig (SWE)",
        "Evandro / Arthur (BRA)",
        "Cherif / Ahmed (QAT)",
        "Partain / Benesh (USA)",
        "Ehlers / Wickler (GER)",
        "Boermans / de Groot (NED)",
        "Mol / Sørum (NOR)",
        "Herrera / Gavira (ESP)",
      ];

      const { data: participants, error: pErr } = await supabaseAdmin
        .from("tournament_participants")
        .insert(pairs.map((name) => ({ tournament_id: tournament.id, name })))
        .select();
      expect(pErr).toBeNull();
      expect(participants).toHaveLength(8);

      const pByName = Object.fromEntries(participants!.map((p) => [p.name, p]));

      // 3. Seed Single Elimination Bracket (QF: 4 matches, SF: 2 matches, Final: 1 match)
      const bracketRows = [
        // Round 1 — Quarterfinals
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 1,
          match_order: 1,
          bracket_type: "main",
          court: "Eiffel Tower Stadium — Center Court",
          status: "scheduled",
          participants: [
            { id: pByName["Åhman / Hellvig (SWE)"].id, name: "Åhman / Hellvig (SWE)" },
            { id: pByName["Evandro / Arthur (BRA)"].id, name: "Evandro / Arthur (BRA)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 1,
          match_order: 2,
          bracket_type: "main",
          court: "Eiffel Tower Stadium — Center Court",
          status: "scheduled",
          participants: [
            { id: pByName["Cherif / Ahmed (QAT)"].id, name: "Cherif / Ahmed (QAT)" },
            { id: pByName["Partain / Benesh (USA)"].id, name: "Partain / Benesh (USA)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 1,
          match_order: 3,
          bracket_type: "main",
          court: "Eiffel Tower Stadium — Center Court",
          status: "scheduled",
          participants: [
            { id: pByName["Ehlers / Wickler (GER)"].id, name: "Ehlers / Wickler (GER)" },
            { id: pByName["Boermans / de Groot (NED)"].id, name: "Boermans / de Groot (NED)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 1,
          match_order: 4,
          bracket_type: "main",
          court: "Eiffel Tower Stadium — Center Court",
          status: "scheduled",
          participants: [
            { id: pByName["Mol / Sørum (NOR)"].id, name: "Mol / Sørum (NOR)" },
            { id: pByName["Herrera / Gavira (ESP)"].id, name: "Herrera / Gavira (ESP)" },
          ],
        },
        // Round 2 — Semifinals
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 2,
          match_order: 1,
          bracket_type: "main",
          court: "Eiffel Tower Stadium — Center Court",
          status: "scheduled",
          participants: [],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 2,
          match_order: 2,
          bracket_type: "main",
          court: "Eiffel Tower Stadium — Center Court",
          status: "scheduled",
          participants: [],
        },
        // Round 3 — Gold Medal Final
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 3,
          match_order: 1,
          bracket_type: "main",
          court: "Eiffel Tower Stadium — Center Court",
          status: "scheduled",
          participants: [],
        },
      ];

      const { data: seededMatches, error: mErr } = await supabaseAdmin
        .from("matches")
        .insert(bracketRows)
        .select()
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });
      expect(mErr).toBeNull();
      expect(seededMatches).toHaveLength(7);

      // 4. Play Quarterfinals (Real Paris 2024 Quarterfinal scores!)
      // QF1: Åhman / Hellvig (SWE) d. Evandro / Arthur (BRA) 21-17, 21-16
      const qf1 = await playVolleyballMatchViaDatabaseEvents(
        seededMatches![0].id,
        [
          { home: 21, away: 17 },
          { home: 21, away: 16 },
        ],
        rules
      );
      expect(qf1.status).toBe("completed");
      expect(qf1.scores.final_sets).toEqual([2, 0]);
      expect(qf1.scores.sets[0].rallies_history).toHaveLength(38);

      // QF2: Cherif / Ahmed (QAT) d. Partain / Benesh (USA) 21-14, 21-16
      const qf2 = await playVolleyballMatchViaDatabaseEvents(
        seededMatches![1].id,
        [
          { home: 21, away: 14 },
          { home: 21, away: 16 },
        ],
        rules
      );
      expect(qf2.status).toBe("completed");
      expect(qf2.scores.final_sets).toEqual([2, 0]);

      // QF3: Ehlers / Wickler (GER) d. Boermans / de Groot (NED) 22-20, 21-15 (extended deuce Set 1!)
      const qf3 = await playVolleyballMatchViaDatabaseEvents(
        seededMatches![2].id,
        [
          { home: 22, away: 20 },
          { home: 21, away: 15 },
        ],
        rules
      );
      expect(qf3.status).toBe("completed");
      expect(qf3.scores.sets[0]).toMatchObject({ home: 22, away: 20 });

      // QF4: Mol / Sørum (NOR) d. Herrera / Gavira (ESP) 21-16, 21-17
      const qf4 = await playVolleyballMatchViaDatabaseEvents(
        seededMatches![3].id,
        [
          { home: 21, away: 16 },
          { home: 21, away: 17 },
        ],
        rules
      );
      expect(qf4.status).toBe("completed");

      // 5. Verify Semifinalists were automatically advanced by `advance_tournament_match`
      const { data: sfMatches } = await supabaseAdmin
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .eq("round_number", 2)
        .order("match_order", { ascending: true });

      expect(sfMatches![0].participants[0].name).toBe("Åhman / Hellvig (SWE)");
      expect(sfMatches![0].participants[1].name).toBe("Cherif / Ahmed (QAT)");
      expect(sfMatches![1].participants[0].name).toBe("Ehlers / Wickler (GER)");
      expect(sfMatches![1].participants[1].name).toBe("Mol / Sørum (NOR)");

      // 6. Play Semifinals
      // SF1: Åhman / Hellvig (SWE) d. Cherif / Ahmed (QAT) 21-13, 21-17
      await playVolleyballMatchViaDatabaseEvents(
        sfMatches![0].id,
        [
          { home: 21, away: 13 },
          { home: 21, away: 17 },
        ],
        rules
      );

      // SF2: Ehlers / Wickler (GER) d. Mol / Sørum (NOR) 21-13, 17-21, 15-13 (3-set thriller!)
      const sf2 = await playVolleyballMatchViaDatabaseEvents(
        sfMatches![1].id,
        [
          { home: 21, away: 13 },
          { home: 17, away: 21 },
          { home: 15, away: 13 },
        ],
        rules
      );
      expect(sf2.scores.final_sets).toEqual([2, 1]);
      expect(sf2.scores.sets[2]).toMatchObject({ home: 15, away: 13 });

      // 7. Play Gold Medal Final: Åhman / Hellvig (SWE) d. Ehlers / Wickler (GER) 21-10, 21-13
      const { data: finalMatchBefore } = await supabaseAdmin
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .eq("round_number", 3)
        .single();
      expect(finalMatchBefore.participants[0].name).toBe("Åhman / Hellvig (SWE)");
      expect(finalMatchBefore.participants[1].name).toBe("Ehlers / Wickler (GER)");

      const finalMatch = await playVolleyballMatchViaDatabaseEvents(
        finalMatchBefore.id,
        [
          { home: 21, away: 10 },
          { home: 21, away: 13 },
        ],
        rules
      );
      expect(finalMatch.status).toBe("completed");
      expect(finalMatch.scores.final_sets).toEqual([2, 0]);
    },
    60000
  );

  it(
    "simulates FIVB Volleyball Nations League (VNL) Finals (Indoor Volleyball, Best of 5 sets — 25/25/25/25/15)",
    async () => {
      const rules: VolleyballRules = {
        sport_type: "Volleyball",
        max_sets: 5,
        points_per_set: 25,
        deciding_set_points: 15,
      };

      const { data: tournament, error: tErr } = await supabaseAdmin
        .from("tournaments")
        .insert({
          name: "FIVB Volleyball Nations League (VNL) Finals",
          sport_type: "Volleyball",
          organizer_id: organizerId,
          status: "ongoing",
          visibility: "public",
          settings: {
            max_teams: 8,
            default: rules,
            stage_1: { type: "bracket" },
          },
        })
        .select()
        .single();
      expect(tErr).toBeNull();
      createdTournamentIds.push(tournament.id);

      const teams = [
        "Poland (POL)",
        "Brazil (BRA)",
        "Japan (JPN)",
        "Slovenia (SLO)",
        "USA (USA)",
        "France (FRA)",
        "Italy (ITA)",
        "Argentina (ARG)",
      ];

      const { data: participants } = await supabaseAdmin
        .from("tournament_participants")
        .insert(teams.map((name) => ({ tournament_id: tournament.id, name })))
        .select();
      const pByName = Object.fromEntries(participants!.map((p) => [p.name, p]));

      const bracketRows = [
        // Quarterfinals
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Volleyball",
          round_number: 1,
          match_order: 1,
          bracket_type: "main",
          court: "Ergo Arena — Gdańsk",
          status: "scheduled",
          participants: [
            { id: pByName["Poland (POL)"].id, name: "Poland (POL)" },
            { id: pByName["Brazil (BRA)"].id, name: "Brazil (BRA)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Volleyball",
          round_number: 1,
          match_order: 2,
          bracket_type: "main",
          court: "Ergo Arena — Gdańsk",
          status: "scheduled",
          participants: [
            { id: pByName["Japan (JPN)"].id, name: "Japan (JPN)" },
            { id: pByName["Slovenia (SLO)"].id, name: "Slovenia (SLO)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Volleyball",
          round_number: 1,
          match_order: 3,
          bracket_type: "main",
          court: "Ergo Arena — Gdańsk",
          status: "scheduled",
          participants: [
            { id: pByName["USA (USA)"].id, name: "USA (USA)" },
            { id: pByName["France (FRA)"].id, name: "France (FRA)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Volleyball",
          round_number: 1,
          match_order: 4,
          bracket_type: "main",
          court: "Ergo Arena — Gdańsk",
          status: "scheduled",
          participants: [
            { id: pByName["Italy (ITA)"].id, name: "Italy (ITA)" },
            { id: pByName["Argentina (ARG)"].id, name: "Argentina (ARG)" },
          ],
        },
        // Semifinals
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Volleyball",
          round_number: 2,
          match_order: 1,
          bracket_type: "main",
          court: "Ergo Arena — Gdańsk",
          status: "scheduled",
          participants: [],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Volleyball",
          round_number: 2,
          match_order: 2,
          bracket_type: "main",
          court: "Ergo Arena — Gdańsk",
          status: "scheduled",
          participants: [],
        },
        // Final
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Volleyball",
          round_number: 3,
          match_order: 1,
          bracket_type: "main",
          court: "Ergo Arena — Gdańsk",
          status: "scheduled",
          participants: [],
        },
      ];

      const { data: seededMatches, error: mErr } = await supabaseAdmin
        .from("matches")
        .insert(bracketRows)
        .select()
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });
      expect(mErr).toBeNull();

      // QF1: Poland d. Brazil 3-0 (26-24, 25-21, 25-20)
      const qf1 = await playVolleyballMatchViaDatabaseEvents(
        seededMatches![0].id,
        [
          { home: 26, away: 24 },
          { home: 25, away: 21 },
          { home: 25, away: 20 },
        ],
        rules
      );
      expect(qf1.scores.final_sets).toEqual([3, 0]);

      // QF2: Japan d. Slovenia 3-0 (26-24, 25-18, 25-22)
      await playVolleyballMatchViaDatabaseEvents(
        seededMatches![1].id,
        [
          { home: 26, away: 24 },
          { home: 25, away: 18 },
          { home: 25, away: 22 },
        ],
        rules
      );

      // QF3: USA d. France 3-2 (25-21, 25-18, 17-25, 24-26, 15-9) — 5-Set Thriller!
      const qf3 = await playVolleyballMatchViaDatabaseEvents(
        seededMatches![2].id,
        [
          { home: 25, away: 21 },
          { home: 25, away: 18 },
          { home: 17, away: 25 },
          { home: 24, away: 26 },
          { home: 15, away: 9 },
        ],
        rules
      );
      expect(qf3.scores.final_sets).toEqual([3, 2]);
      expect(qf3.scores.sets[4]).toMatchObject({ home: 15, away: 9 });

      // QF4: Italy d. Argentina 3-0 (25-17, 25-13, 25-14)
      await playVolleyballMatchViaDatabaseEvents(
        seededMatches![3].id,
        [
          { home: 25, away: 17 },
          { home: 25, away: 13 },
          { home: 25, away: 14 },
        ],
        rules
      );

      // Semifinals
      const { data: sfMatches } = await supabaseAdmin
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .eq("round_number", 2)
        .order("match_order", { ascending: true });

      // SF1: Poland d. Japan 3-1 (19-25, 28-26, 25-17, 25-21)
      await playVolleyballMatchViaDatabaseEvents(
        sfMatches![0].id,
        [
          { home: 19, away: 25 },
          { home: 28, away: 26 },
          { home: 25, away: 17 },
          { home: 25, away: 21 },
        ],
        rules
      );

      // SF2: USA d. Italy 3-0 (25-19, 25-18, 25-19)
      await playVolleyballMatchViaDatabaseEvents(
        sfMatches![1].id,
        [
          { home: 25, away: 19 },
          { home: 25, away: 18 },
          { home: 25, away: 19 },
        ],
        rules
      );

      // Final: Poland d. USA 3-1 (25-23, 24-26, 25-18, 25-18)
      const { data: finalMatchBefore } = await supabaseAdmin
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .eq("round_number", 3)
        .single();
      expect(finalMatchBefore.participants[0].name).toBe("Poland (POL)");
      expect(finalMatchBefore.participants[1].name).toBe("USA (USA)");

      const finalMatch = await playVolleyballMatchViaDatabaseEvents(
        finalMatchBefore.id,
        [
          { home: 25, away: 23 },
          { home: 24, away: 26 },
          { home: 25, away: 18 },
          { home: 25, away: 18 },
        ],
        rules
      );
      expect(finalMatch.status).toBe("completed");
      expect(finalMatch.scores.final_sets).toEqual([3, 1]);
    },
    90000
  );

  it(
    "simulates FIVB Beach Volleyball World Championships Women's Finals (Groups + Knockout, Pool Standings & Tiebreakers)",
    async () => {
      const rules: VolleyballRules = {
        sport_type: "Beach Volleyball",
        max_sets: 3,
        points_per_set: 21,
        deciding_set_points: 15,
      };

      const { data: tournament, error: tErr } = await supabaseAdmin
        .from("tournaments")
        .insert({
          name: "FIVB Beach Volleyball World Championships — Women's Finals",
          sport_type: "Beach Volleyball",
          organizer_id: organizerId,
          status: "ongoing",
          visibility: "public",
          settings: {
            max_teams: 8,
            default: rules,
            stage_1: {
              type: "groups",
              advance_per_group: 2,
              advance_best_thirds: 0,
            },
          },
        })
        .select()
        .single();
      expect(tErr).toBeNull();
      createdTournamentIds.push(tournament.id);

      const poolAPairs = [
        "Ana Patrícia / Duda (BRA)",
        "Melissa / Brandie (CAN)",
        "Stam / Schoon (NED)",
        "Müller / Tillmann (GER)",
      ];
      const poolBPairs = [
        "Hughes / Cheng (USA)",
        "Nuss / Kloth (USA)",
        "Clancy / Mariafe (AUS)",
        "Hüberli / Brunner (SUI)",
      ];

      const { data: participants } = await supabaseAdmin
        .from("tournament_participants")
        .insert(
          [...poolAPairs, ...poolBPairs].map((name) => ({
            tournament_id: tournament.id,
            name,
          }))
        )
        .select();
      const pByName = Object.fromEntries(participants!.map((p) => [p.name, p]));

      // Create Pool A (6 matches) + Pool B (6 matches) + Knockout SF (2 matches) + Final (1 match)
      const poolAMatchSpecs = [
        {
          home: "Ana Patrícia / Duda (BRA)",
          away: "Melissa / Brandie (CAN)",
          sets: [
            { home: 21, away: 16 },
            { home: 21, away: 19 },
          ],
        },
        {
          home: "Stam / Schoon (NED)",
          away: "Müller / Tillmann (GER)",
          sets: [
            { home: 21, away: 18 },
            { home: 18, away: 21 },
            { home: 15, away: 12 },
          ],
        },
        {
          home: "Ana Patrícia / Duda (BRA)",
          away: "Stam / Schoon (NED)",
          sets: [
            { home: 21, away: 17 },
            { home: 21, away: 15 },
          ],
        },
        {
          home: "Melissa / Brandie (CAN)",
          away: "Müller / Tillmann (GER)",
          sets: [
            { home: 21, away: 18 },
            { home: 21, away: 17 },
          ],
        },
        {
          home: "Ana Patrícia / Duda (BRA)",
          away: "Müller / Tillmann (GER)",
          sets: [
            { home: 21, away: 14 },
            { home: 21, away: 16 },
          ],
        },
        {
          home: "Melissa / Brandie (CAN)",
          away: "Stam / Schoon (NED)",
          sets: [
            { home: 21, away: 19 },
            { home: 21, away: 18 },
          ],
        },
      ];

      const poolBMatchSpecs = [
        {
          home: "Hughes / Cheng (USA)",
          away: "Nuss / Kloth (USA)",
          sets: [
            { home: 21, away: 19 },
            { home: 17, away: 21 },
            { home: 15, away: 13 },
          ],
        },
        {
          home: "Clancy / Mariafe (AUS)",
          away: "Hüberli / Brunner (SUI)",
          sets: [
            { home: 21, away: 18 },
            { home: 21, away: 19 },
          ],
        },
        {
          home: "Hughes / Cheng (USA)",
          away: "Clancy / Mariafe (AUS)",
          sets: [
            { home: 21, away: 16 },
            { home: 21, away: 18 },
          ],
        },
        {
          home: "Nuss / Kloth (USA)",
          away: "Hüberli / Brunner (SUI)",
          sets: [
            { home: 21, away: 17 },
            { home: 21, away: 15 },
          ],
        },
        {
          home: "Hughes / Cheng (USA)",
          away: "Hüberli / Brunner (SUI)",
          sets: [
            { home: 21, away: 18 },
            { home: 21, away: 14 },
          ],
        },
        {
          home: "Nuss / Kloth (USA)",
          away: "Clancy / Mariafe (AUS)",
          sets: [
            { home: 21, away: 17 },
            { home: 21, away: 19 },
          ],
        },
      ];

      const groupRows = [
        ...poolAMatchSpecs.map((m, idx) => ({
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          group_label: "Pool A",
          round_number: Math.floor(idx / 2) + 1,
          match_order: idx + 1,
          court: "Tlaxcala Bullring — Center Court",
          status: "scheduled",
          participants: [
            { id: pByName[m.home].id, name: m.home },
            { id: pByName[m.away].id, name: m.away },
          ],
        })),
        ...poolBMatchSpecs.map((m, idx) => ({
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          group_label: "Pool B",
          round_number: Math.floor(idx / 2) + 1,
          match_order: idx + 1,
          court: "Tlaxcala Bullring — Court 2",
          status: "scheduled",
          participants: [
            { id: pByName[m.home].id, name: m.home },
            { id: pByName[m.away].id, name: m.away },
          ],
        })),
      ];

      const { data: insertedGroupMatches, error: gmErr } = await supabaseAdmin
        .from("matches")
        .insert(groupRows)
        .select()
        .order("group_label", { ascending: true })
        .order("match_order", { ascending: true });
      expect(gmErr).toBeNull();

      const allPoolSpecs = [...poolAMatchSpecs, ...poolBMatchSpecs];
      for (let i = 0; i < allPoolSpecs.length; i++) {
        await playVolleyballMatchViaDatabaseEvents(
          insertedGroupMatches![i].id,
          allPoolSpecs[i].sets,
          rules
        );
      }

      // Verify `group_standings` SQL view matches TypeScript `calculateStandings`
      const { data: dbStandings, error: stErr } = await supabaseAdmin
        .from("group_standings")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("wins", { ascending: false });
      expect(stErr).toBeNull();
      expect(dbStandings).toHaveLength(8);

      const poolAStandings = dbStandings!.filter((s) => s.group_label === "Pool A");
      const poolBStandings = dbStandings!.filter((s) => s.group_label === "Pool B");

      expect(poolAStandings[0].team_name).toBe("Ana Patrícia / Duda (BRA)");
      expect(Number(poolAStandings[0].wins)).toBe(3);
      expect(poolAStandings[1].team_name).toBe("Melissa / Brandie (CAN)");
      expect(Number(poolAStandings[1].wins)).toBe(2);

      expect(poolBStandings[0].team_name).toBe("Hughes / Cheng (USA)");
      expect(Number(poolBStandings[0].wins)).toBe(3);
      expect(poolBStandings[1].team_name).toBe("Nuss / Kloth (USA)");
      expect(Number(poolBStandings[1].wins)).toBe(2);

      const { data: completedPoolMatches } = await supabaseAdmin
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .not("group_label", "is", null);

      const tsStandings = calculateStandings(completedPoolMatches as any);
      const anaPatricia = tsStandings.find((s) => s.team_name === "Ana Patrícia / Duda (BRA)")!;
      expect(anaPatricia.wins).toBe(3);
      expect(anaPatricia.total_sets_won).toBe(6);

      const hughes = tsStandings.find((s) => s.team_name === "Hughes / Cheng (USA)")!;
      expect(hughes.wins).toBe(3);
      expect(hughes.total_sets_won).toBe(6);

      // Seed Knockout Stage (Semifinals + Final) from Pool Winners & Runners-Up
      const knockoutRows = [
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 1,
          match_order: 1,
          bracket_type: "main",
          court: "Tlaxcala Bullring — Center Court",
          status: "scheduled",
          participants: [
            { id: pByName["Ana Patrícia / Duda (BRA)"].id, name: "Ana Patrícia / Duda (BRA)" },
            { id: pByName["Nuss / Kloth (USA)"].id, name: "Nuss / Kloth (USA)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 1,
          match_order: 2,
          bracket_type: "main",
          court: "Tlaxcala Bullring — Center Court",
          status: "scheduled",
          participants: [
            { id: pByName["Hughes / Cheng (USA)"].id, name: "Hughes / Cheng (USA)" },
            { id: pByName["Melissa / Brandie (CAN)"].id, name: "Melissa / Brandie (CAN)" },
          ],
        },
        {
          tournament_id: tournament.id,
          organizer_id: organizerId,
          sport_type: "Beach Volleyball",
          round_number: 2,
          match_order: 1,
          bracket_type: "main",
          court: "Tlaxcala Bullring — Center Court",
          status: "scheduled",
          participants: [],
        },
      ];

      const { data: koMatches, error: koErr } = await supabaseAdmin
        .from("matches")
        .insert(knockoutRows)
        .select()
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });
      expect(koErr).toBeNull();

      // SF1: Ana Patrícia / Duda (BRA) d. Nuss / Kloth (USA) 21-17, 21-14
      await playVolleyballMatchViaDatabaseEvents(
        koMatches![0].id,
        [
          { home: 21, away: 17 },
          { home: 21, away: 14 },
        ],
        rules
      );

      // SF2: Hughes / Cheng (USA) d. Melissa / Brandie (CAN) 18-21, 21-12, 15-13
      await playVolleyballMatchViaDatabaseEvents(
        koMatches![1].id,
        [
          { home: 18, away: 21 },
          { home: 21, away: 12 },
          { home: 15, away: 13 },
        ],
        rules
      );

      // Final: Hughes / Cheng (USA) d. Ana Patrícia / Duda (BRA) 21-16, 24-22
      const { data: finalBefore } = await supabaseAdmin
        .from("matches")
        .select("*")
        .eq("id", koMatches![2].id)
        .single();
      expect(finalBefore.participants[0].name).toBe("Ana Patrícia / Duda (BRA)");
      expect(finalBefore.participants[1].name).toBe("Hughes / Cheng (USA)");

      const finalAfter = await playVolleyballMatchViaDatabaseEvents(
        koMatches![2].id,
        [
          { home: 16, away: 21 },
          { home: 22, away: 24 },
        ],
        rules
      );
      expect(finalAfter.status).toBe("completed");
      expect(countSetsWon(extractSetsData(finalAfter.scores), 1)).toBe(2);
    },
    90000
  );
});
