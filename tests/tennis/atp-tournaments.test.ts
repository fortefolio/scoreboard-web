import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateTennisScore,
  createInitialTennisScores,
  generatePointSequenceForMatch,
  playMCPGameString,
  type SetScoreSpec,
  type TennisRules,
  type TennisScoresState,
} from "@/lib/scoring/tennis-engine";
import { calculateStandings } from "@/lib/standings/groups";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Helper: Simulates a full tennis match using `calculateTennisScore` from a list of SetScoreSpecs
 */
function simulateMatchInMemory(
  sets: SetScoreSpec[],
  rules: TennisRules = {},
  initialServer: 0 | 1 = 0
): TennisScoresState {
  const points = generatePointSequenceForMatch(sets);
  let state = createInitialTennisScores(initialServer);
  for (const winnerIdx of points) {
    state = calculateTennisScore(state, winnerIdx, rules);
  }
  return state;
}

describe("Tennis Game & Point Mechanics (JeffSackmann/tennis_MatchChartingProject)", () => {
  it("tracks standard service hold (0 -> 15 -> 30 -> 40 -> Game), server_side, and change_ends", () => {
    let state = createInitialTennisScores(0);
    expect(state.serving_index).toBe(0);
    expect(state.tennis.server_side).toBe("deuce");

    // 15-0 (1 point played -> ad court)
    state = calculateTennisScore(state, 0);
    expect(state.tennis.points).toEqual([1, 0]);
    expect(state.tennis.server_side).toBe("ad");
    expect(state.tennis.change_ends).toBe(false);

    // 30-0 (2 points played -> deuce court)
    state = calculateTennisScore(state, 0);
    expect(state.tennis.points).toEqual([2, 0]);
    expect(state.tennis.server_side).toBe("deuce");

    // 40-0 (3 points played -> ad court)
    state = calculateTennisScore(state, 0);
    expect(state.tennis.points).toEqual([3, 0]);
    expect(state.tennis.server_side).toBe("ad");

    // Game won -> 1-0 in games, server switches to player 1, change_ends = true (after Game 1)
    state = calculateTennisScore(state, 0);
    expect(state.tennis.points).toEqual([0, 0]);
    expect(state.tennis.games).toEqual([1, 0]);
    expect(state.serving_index).toBe(1);
    expect(state.tennis.change_ends).toBe(true);
  });

  it("replays the 2023 Wimbledon Final Set 3 Game 5 marathon (13 deuces / 32 points, Alcaraz breaks Djokovic)", () => {
    // Source: JeffSackmann/tennis_MatchChartingProject (20230716-M-Wimbledon-F-Carlos_Alcaraz-Novak_Djokovic)
    // Djokovic (index 1) serving at 1-3 in Set 3.
    // Reaches 40-40 (Deuce #1), then goes through 12 more deuces (alternating AD-40 / 40-AD) before Alcaraz (returner) converts break point #7!
    let state = createInitialTennisScores(1); // Djokovic serving

    // Reach first Deuce (3-3 / 40-40): S, R, S, R, S, R
    state = playMCPGameString(state, "SRSRSR");
    expect(state.tennis.points).toEqual([3, 3]);

    // 12 more Deuces (6 Djokovic game points saved + 6 Alcaraz break points saved)
    for (let d = 0; d < 6; d++) {
      // Djokovic Advantage -> Deuce
      state = playMCPGameString(state, "SR");
      expect(state.tennis.points).toEqual([3, 3]);
      // Alcaraz Advantage -> Deuce
      state = playMCPGameString(state, "RS");
      expect(state.tennis.points).toEqual([3, 3]);
    }

    // Break point #7: Alcaraz wins 2 consecutive return points ("RR") to win the 32-point game!
    state = playMCPGameString(state, "R");
    expect(state.tennis.points).toEqual([4, 3]); // AD Alcaraz
    state = playMCPGameString(state, "R");
    expect(state.tennis.games).toEqual([1, 0]);
    expect(state.tennis.points).toEqual([0, 0]);
    expect(state.serving_index).toBe(0); // Alcaraz serves next game
  });

  it("supports No-Ad sudden-death scoring at 40-40 (deciding point wins game immediately)", () => {
    const rules: TennisRules = { no_ad: true };
    let state = createInitialTennisScores(0);

    // Reach 40-40 (3-3)
    state = playMCPGameString(state, "SRSRSR", rules);
    expect(state.tennis.points).toEqual([3, 3]);

    // Deciding point won by returner (player 1) immediately wins the game
    state = calculateTennisScore(state, 1, rules);
    expect(state.tennis.games).toEqual([0, 1]);
    expect(state.tennis.points).toEqual([0, 0]);
  });

  it("handles 2023 Wimbledon Final Set 2 Tiebreak (Alcaraz d. Djokovic 7-6(6) / 8-6) with 1-2-2-2 serve rotation and next-set server rule", () => {
    // Player 0 (Alcaraz) serves Game 1 of Set 2.
    let state = createInitialTennisScores(0);

    // Play 12 games to reach 6-6. Because 12 games were played, Player 0 (Alcaraz) is due to serve first in the tiebreak.
    for (let g = 0; g < 6; g++) {
      state = playMCPGameString(state, "SSSS"); // Server holds
      state = playMCPGameString(state, "SSSS"); // Server holds
    }
    expect(state.tennis.games).toEqual([6, 6]);
    expect(state.tennis.is_tiebreak).toBe(true);
    expect(state.serving_index).toBe(0);
    expect(state.tennis.tiebreak_initial_server).toBe(0);

    // Point 1 of tiebreak: served by Player 0. After 1 point, serve rotates to Player 1!
    state = calculateTennisScore(state, 1); // 0-1
    expect(state.serving_index).toBe(1);

    // Points 2 & 3 of tiebreak: served by Player 1.
    state = calculateTennisScore(state, 1); // 0-2 (still Player 1 serving point 3)
    expect(state.serving_index).toBe(1);
    state = calculateTennisScore(state, 1); // 0-3 (after 3 total points, serve rotates back to Player 0!)
    expect(state.serving_index).toBe(0);

    // Play to 3-3 (6 total points -> change_ends must be true!)
    state = calculateTennisScore(state, 0); // 1-3 (4 pts)
    state = calculateTennisScore(state, 0); // 2-3 (5 pts -> rotates to Player 1)
    expect(state.serving_index).toBe(1);
    state = calculateTennisScore(state, 0); // 3-3 (6 pts -> change of ends!)
    expect(state.tennis.change_ends).toBe(true);

    // Reach 6-6 in the tiebreak (12 total points -> second change of ends!)
    // From 3-3: P0(4-3), P1(4-4), P0(5-4), P1(5-5), P1(5-6 set point Djokovic!), P0(6-6 saved!)
    state = calculateTennisScore(state, 0); // 4-3
    state = calculateTennisScore(state, 1); // 4-4
    state = calculateTennisScore(state, 0); // 5-4
    state = calculateTennisScore(state, 1); // 5-5
    state = calculateTennisScore(state, 1); // 5-6 (Set point Djokovic)
    state = calculateTennisScore(state, 0); // 6-6 (Alcaraz saves set point! 12 pts played -> change_ends)
    expect(state.tennis.points).toEqual([6, 6]);
    expect(state.tennis.change_ends).toBe(true);
    expect(state.tennis.is_tiebreak).toBe(true);

    // Alcaraz wins next 2 points (7-6, 8-6) to take Set 2!
    state = calculateTennisScore(state, 0); // 7-6
    expect(state.tennis.is_tiebreak).toBe(true); // Must win by 2!
    state = calculateTennisScore(state, 0); // 8-6 -> Set won!

    expect(state.tennis.sets).toHaveLength(1);
    expect(state.tennis.sets[0]).toMatchObject({
      home: 7,
      away: 6,
      tiebreak: { home: 8, away: 6 },
    });
    // Official Tennis Rule: Since Player 0 served the first point of the tiebreak, Player 1 MUST serve Game 1 of the next set!
    expect(state.serving_index).toBe(1);
  });

  it("ensures next-set server is 1 - tiebreak_initial_server even when tiebreak ends on an ODD number of points (e.g. 7-4 = 11 pts)", () => {
    // Player 0 starts the set and therefore starts the 6-6 tiebreak.
    const state = simulateMatchInMemory(
      [{ home: 7, away: 6, tbLoserPoints: 4 }],
      { max_sets: 3 },
      0
    );
    expect(state.tennis.sets[0]).toMatchObject({
      home: 7,
      away: 6,
      tiebreak: { home: 7, away: 4 },
    });
    // Total tiebreak points = 11 (odd). Player 0 served point 1 of the tiebreak, so Player 1 MUST serve Game 1 of Set 2!
    expect(state.serving_index).toBe(1);
  });

  it("supports Advantage Sets (set_type = 'advantage', e.g., 10-8 in games without tiebreak at 6-6)", () => {
    const rules: TennisRules = { max_sets: 3, set_type: "advantage" };
    const state = simulateMatchInMemory([{ home: 10, away: 8 }], rules, 0);

    expect(state.tennis.sets).toHaveLength(1);
    expect(state.tennis.sets[0]).toMatchObject({ home: 10, away: 8 });
    expect(state.tennis.sets[0].tiebreak).toBeUndefined();
  });

  it("supports Grand Slam 10-Point Final-Set Super Tiebreak at 6-6 (final_set_tiebreak_points = 10)", () => {
    const rules: TennisRules = {
      max_sets: 5,
      set_type: "tiebreak",
      final_set_tiebreak_points: 10,
    };
    const state = simulateMatchInMemory(
      [
        { home: 6, away: 4 },
        { home: 4, away: 6 },
        { home: 6, away: 3 },
        { home: 3, away: 6 },
        { home: 7, away: 6, tbLoserPoints: 8, tbTargetPoints: 10 }, // 10-8 in 5th set tiebreak
      ],
      rules,
      0
    );

    expect(state.match_won).toBe(true);
    expect(state.final_sets).toEqual([3, 2]);
    expect(state.tennis.sets[4]).toMatchObject({
      home: 7,
      away: 6,
      tiebreak: { home: 10, away: 8 },
    });
  });

  it("supports Deciding-Set 10-Point Match Tiebreak (match_tiebreak = true, e.g., Laver Cup / ATP Doubles)", () => {
    const rules: TennisRules = {
      max_sets: 3,
      match_tiebreak: true,
    };
    const state = simulateMatchInMemory(
      [
        { home: 6, away: 4 },
        { home: 4, away: 6 },
        { home: 10, away: 8, isMatchTiebreak: true },
      ],
      rules,
      0
    );

    expect(state.match_won).toBe(true);
    expect(state.final_sets).toEqual([2, 1]);
    expect(state.tennis.sets[2]).toMatchObject({
      home: 1,
      away: 0,
      tiebreak: { home: 10, away: 8 },
    });
  });
});

describe("ATP Tournament Suite — Creation, Bracket Progression & Match Mechanics (Kadantte/tennis_atp & MCP)", () => {
  let supabaseAdmin: SupabaseClient;
  let organizerId: string;
  const createdTournamentIds: string[] = [];

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Create a dedicated Pro-tier organizer for the ATP tournament test suite
    const email = `atp-suite-${Date.now()}@scoreboard.test`;
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "AtpSuitePassword!23",
      email_confirm: true,
      user_metadata: { display_name: `atp_org_${Date.now()}` },
    });
    if (authErr || !authData.user) {
      throw new Error(`Failed to create test organizer: ${authErr?.message}`);
    }
    organizerId = authData.user.id;

    // Upgrade organizer to 'pro' tier as required by tournaments INSERT RLS
    const { error: proErr } = await supabaseAdmin
      .from("users")
      .update({ subscription_tier: "pro" })
      .eq("id", organizerId);
    if (proErr) throw new Error(`Failed to upgrade test organizer to pro: ${proErr.message}`);
  });

  afterAll(async () => {
    if (process.env.KEEP_TEST_DATA === "true" || process.env.KEEP_TEST_DATA === "1") {
      // Find the latest real user account so the tournaments appear in /my-tournaments and /my-matches
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
        `\n[KEEP_TEST_DATA] Preserved ${createdTournamentIds.length} tournaments (assigned to ${realUsers?.[0]?.email || organizerId}):`
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
   * Plays a match in PostgreSQL by verifying the TypeScript engine point-by-point AND executing
   * the PostgreSQL `calculate_tennis_score` + `update_match_score` trigger on the final point!
   */
  async function playMatchInDatabase(
    matchId: string,
    sets: SetScoreSpec[],
    rules: TennisRules
  ): Promise<TennisScoresState> {
    const pointSequence = generatePointSequenceForMatch(sets);
    let state = createInitialTennisScores(0);

    // Simulate all points up to the penultimate point, then let the PostgreSQL trigger
    // process the match point on `public.match_events` so the DB computes the final state,
    // marks the match 'completed', and triggers `public.advance_tournament_match`!
    for (let i = 0; i < pointSequence.length - 1; i++) {
      state = calculateTennisScore(state, pointSequence[i], rules);
    }

    const lastWinnerIdx = pointSequence[pointSequence.length - 1];
    const expectedFinal = calculateTennisScore(state, lastWinnerIdx, rules);

    // Seed the penultimate score state into `public.matches` and set status = 'ongoing'
    const { error: prepErr } = await supabaseAdmin
      .from("matches")
      .update({ status: "ongoing", scores: state })
      .eq("id", matchId);
    if (prepErr) throw new Error(`Failed to prepare match ${matchId}: ${prepErr.message}`);

    // Insert the match-winning point into `public.match_events` to fire `on_match_event_created` -> `update_match_score()`
    const { error: evErr } = await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: {
        type: "point_won",
        side: lastWinnerIdx === 0 ? "home" : "away",
      },
    });
    if (evErr) throw new Error(`Failed to insert winning match_event for ${matchId}: ${evErr.message}`);

    // Fetch updated match from PostgreSQL and verify DB trigger output matches our engine
    const { data: updatedMatch, error: fetchErr } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();
    if (fetchErr || !updatedMatch) {
      throw new Error(`Failed to fetch completed match ${matchId}: ${fetchErr?.message}`);
    }

    expect(updatedMatch.status).toBe("completed");
    expect(updatedMatch.scores.match_won).toBe(true);
    expect(updatedMatch.scores.final_sets).toEqual(expectedFinal.final_sets);
    expect(updatedMatch.scores.tennis.sets).toEqual(expectedFinal.tennis.sets);

    return updatedMatch.scores as TennisScoresState;
  }

  /**
   * Creates a Single-Elimination bracket in `public.matches` matching `generate-tournament-bracket`
   */
  async function createSingleEliminationBracket(
    tournamentId: string,
    sportType: string,
    seededParticipants: { id: string; name: string }[]
  ) {
    const teamCount = seededParticipants.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)));
    const roundsCount = Math.log2(bracketSize);
    const matchesToCreate: any[] = [];

    // Round 1: pair seededTeams[i] vs seededTeams[bracketSize - 1 - i]
    for (let i = 0; i < bracketSize / 2; i++) {
      matchesToCreate.push({
        tournament_id: tournamentId,
        organizer_id: organizerId,
        sport_type: sportType,
        round_number: 1,
        match_order: i + 1,
        participants: [seededParticipants[i], seededParticipants[bracketSize - 1 - i]],
        status: "scheduled",
        bracket_type: "main",
      });
    }

    // Subsequent rounds
    let currentRoundSize = bracketSize / 4;
    for (let r = 2; r <= roundsCount; r++) {
      for (let m = 1; m <= currentRoundSize; m++) {
        matchesToCreate.push({
          tournament_id: tournamentId,
          organizer_id: organizerId,
          sport_type: sportType,
          round_number: r,
          match_order: m,
          participants: [],
          status: "scheduled",
          bracket_type: "main",
        });
      }
      currentRoundSize /= 2;
    }

    const { data, error } = await supabaseAdmin
      .from("matches")
      .insert(matchesToCreate)
      .select()
      .order("round_number", { ascending: true })
      .order("match_order", { ascending: true });
    if (error) throw new Error(`Failed to create bracket matches: ${error.message}`);

    await supabaseAdmin
      .from("tournaments")
      .update({ status: "ongoing" })
      .eq("id", tournamentId);

    return data!;
  }

  it("Tournament 1: 2023 Wimbledon Men's Singles (Grand Slam — Best of 5 Sets, QF -> SF -> Final)", async () => {
    const rules: TennisRules = {
      max_sets: 5,
      set_type: "tiebreak",
      final_set_tiebreak_points: 10,
    };

    // 1. Create Tournament
    const { data: tournament, error: tErr } = await supabaseAdmin
      .from("tournaments")
      .insert({
        name: "2023 Wimbledon Championships — Men's Singles",
        sport_type: "Tennis",
        organizer_id: organizerId,
        status: "pending",
        visibility: "public",
        settings: {
          max_teams: 8,
          number_of_courts: 2,
          default: rules,
          stage_1: { type: "bracket" },
        },
      })
      .select()
      .single();
    expect(tErr).toBeNull();
    createdTournamentIds.push(tournament!.id);

    // 2. Register the 8 Quarterfinalists (ordered so seed[i] vs seed[7-i] produces the exact 2023 Wimbledon QFs):
    // Match 1 (i=0): Carlos Alcaraz vs Holger Rune
    // Match 2 (i=1): Daniil Medvedev vs Christopher Eubanks
    // Match 3 (i=2): Jannik Sinner vs Roman Safiullin
    // Match 4 (i=3): Novak Djokovic vs Andrey Rublev
    const rosterNames = [
      "Carlos Alcaraz",      // 0 (plays 7: Holger Rune)
      "Daniil Medvedev",     // 1 (plays 6: Christopher Eubanks)
      "Jannik Sinner",       // 2 (plays 5: Roman Safiullin)
      "Novak Djokovic",      // 3 (plays 4: Andrey Rublev)
      "Andrey Rublev",       // 4
      "Roman Safiullin",     // 5
      "Christopher Eubanks", // 6
      "Holger Rune",         // 7
    ];

    const { data: participants, error: pErr } = await supabaseAdmin
      .from("tournament_participants")
      .insert(
        rosterNames.map((name, idx) => ({
          tournament_id: tournament!.id,
          name,
          contact_email: `player${idx + 1}@atptour.test`,
          seed: idx + 1,
        }))
      )
      .select();
    expect(pErr).toBeNull();
    expect(participants).toHaveLength(8);

    // 3. Generate the 8-player Single Elimination Bracket (4 QFs, 2 SFs, 1 Final = 7 matches)
    const matches = await createSingleEliminationBracket(tournament!.id, "Tennis", participants!);
    expect(matches).toHaveLength(7);

    const qfMatches = matches.filter((m) => m.round_number === 1);
    expect(qfMatches).toHaveLength(4);

    // --- QUARTERFINALS ---
    // QF1: Carlos Alcaraz d. Holger Rune 7-6(3), 6-4, 6-4
    await playMatchInDatabase(
      qfMatches[0].id,
      [
        { home: 7, away: 6, tbLoserPoints: 3 },
        { home: 6, away: 4 },
        { home: 6, away: 4 },
      ],
      rules
    );

    // QF2: Daniil Medvedev d. Christopher Eubanks 6-4, 1-6, 4-6, 7-6(4), 6-1 (5-set thriller!)
    await playMatchInDatabase(
      qfMatches[1].id,
      [
        { home: 6, away: 4 },
        { home: 1, away: 6 },
        { home: 4, away: 6 },
        { home: 7, away: 6, tbLoserPoints: 4 },
        { home: 6, away: 1 },
      ],
      rules
    );

    // QF3: Jannik Sinner d. Roman Safiullin 6-4, 3-6, 6-2, 6-2
    await playMatchInDatabase(
      qfMatches[2].id,
      [
        { home: 6, away: 4 },
        { home: 3, away: 6 },
        { home: 6, away: 2 },
        { home: 6, away: 2 },
      ],
      rules
    );

    // QF4: Novak Djokovic d. Andrey Rublev 4-6, 6-1, 6-4, 6-3
    await playMatchInDatabase(
      qfMatches[3].id,
      [
        { home: 4, away: 6 },
        { home: 6, away: 1 },
        { home: 6, away: 4 },
        { home: 6, away: 3 },
      ],
      rules
    );

    // Verify automatic bracket advancement into Semifinals (Round 2)
    const { data: sfMatches } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament!.id)
      .eq("round_number", 2)
      .order("match_order", { ascending: true });

    expect(sfMatches).toHaveLength(2);
    expect(sfMatches![0].participants.map((p: any) => p.name)).toEqual([
      "Carlos Alcaraz",
      "Daniil Medvedev",
    ]);
    expect(sfMatches![1].participants.map((p: any) => p.name)).toEqual([
      "Jannik Sinner",
      "Novak Djokovic",
    ]);

    // --- SEMIFINALS ---
    // SF1: Carlos Alcaraz d. Daniil Medvedev 6-3, 6-3, 6-3
    await playMatchInDatabase(
      sfMatches![0].id,
      [
        { home: 6, away: 3 },
        { home: 6, away: 3 },
        { home: 6, away: 3 },
      ],
      rules
    );

    // SF2: Novak Djokovic (away, index 1) d. Jannik Sinner (home, index 0) 6-3, 6-4, 7-6(4)
    await playMatchInDatabase(
      sfMatches![1].id,
      [
        { home: 3, away: 6 },
        { home: 4, away: 6 },
        { home: 6, away: 7, tbLoserPoints: 4 },
      ],
      rules
    );

    // Verify automatic bracket advancement into the Championship Final (Round 3)
    const { data: finalMatch } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament!.id)
      .eq("round_number", 3)
      .single();

    expect(finalMatch.participants.map((p: any) => p.name)).toEqual([
      "Carlos Alcaraz",
      "Novak Djokovic",
    ]);

    // --- CHAMPIONSHIP FINAL ---
    // 2023 Wimbledon Final: Carlos Alcaraz d. Novak Djokovic 1-6, 7-6(6), 6-1, 3-6, 6-4
    const finalScores = await playMatchInDatabase(
      finalMatch.id,
      [
        { home: 1, away: 6 },
        { home: 7, away: 6, tbLoserPoints: 6 },
        { home: 6, away: 1 },
        { home: 3, away: 6 },
        { home: 6, away: 4 },
      ],
      rules
    );

    expect(finalScores.final_sets).toEqual([3, 2]);
    expect(countSetsWon(extractSetsData(finalScores), 0)).toBe(3);
    expect(countSetsWon(extractSetsData(finalScores), 1)).toBe(2);
    expect(finalScores.tennis.sets[1].tiebreak).toEqual({ home: 8, away: 6 });

    // Verify Tournament status automatically transitioned to 'completed'
    const { data: completedTournament } = await supabaseAdmin
      .from("tournaments")
      .select("status")
      .eq("id", tournament!.id)
      .single();
    expect(completedTournament!.status).toBe("completed");
  });

  it("Tournament 2: 2023 Cincinnati Masters — Western & Southern Open (ATP Masters 1000 — Best of 3 Sets)", async () => {
    const rules: TennisRules = { max_sets: 3, set_type: "tiebreak" };

    const { data: tournament, error: tErr } = await supabaseAdmin
      .from("tournaments")
      .insert({
        name: "2023 Western & Southern Open — Cincinnati Masters",
        sport_type: "Tennis",
        organizer_id: organizerId,
        status: "pending",
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
    createdTournamentIds.push(tournament!.id);

    // 8 Quarterfinalists:
    // QF1: Carlos Alcaraz vs Max Purcell
    // QF2: Hubert Hurkacz vs Alexei Popyrin
    // QF3: Alexander Zverev vs Adrian Mannarino
    // QF4: Novak Djokovic vs Taylor Fritz
    const rosterNames = [
      "Carlos Alcaraz",
      "Hubert Hurkacz",
      "Alexander Zverev",
      "Novak Djokovic",
      "Taylor Fritz",
      "Adrian Mannarino",
      "Alexei Popyrin",
      "Max Purcell",
    ];

    const { data: participants } = await supabaseAdmin
      .from("tournament_participants")
      .insert(
        rosterNames.map((name, idx) => ({
          tournament_id: tournament!.id,
          name,
          contact_email: `cincy${idx + 1}@atptour.test`,
          seed: idx + 1,
        }))
      )
      .select();

    const matches = await createSingleEliminationBracket(tournament!.id, "Tennis", participants!);
    const qfMatches = matches.filter((m) => m.round_number === 1);

    // QF1: Alcaraz d. Purcell 4-6, 6-3, 6-4
    await playMatchInDatabase(
      qfMatches[0].id,
      [
        { home: 4, away: 6 },
        { home: 6, away: 3 },
        { home: 6, away: 4 },
      ],
      rules
    );

    // QF2: Hurkacz d. Popyrin 6-1, 7-6(8) (extended tiebreak 10-8!)
    const qf2Scores = await playMatchInDatabase(
      qfMatches[1].id,
      [
        { home: 6, away: 1 },
        { home: 7, away: 6, tbLoserPoints: 8 },
      ],
      rules
    );
    expect(qf2Scores.tennis.sets[1].tiebreak).toEqual({ home: 10, away: 8 });

    // QF3: Zverev d. Mannarino 6-2, 6-3
    await playMatchInDatabase(
      qfMatches[2].id,
      [
        { home: 6, away: 2 },
        { home: 6, away: 3 },
      ],
      rules
    );

    // QF4: Djokovic d. Fritz 6-0, 6-4
    await playMatchInDatabase(
      qfMatches[3].id,
      [
        { home: 6, away: 0 },
        { home: 6, away: 4 },
      ],
      rules
    );

    // Semifinals
    const { data: sfMatches } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament!.id)
      .eq("round_number", 2)
      .order("match_order", { ascending: true });

    // SF1: Alcaraz d. Hurkacz 2-6, 7-6(4), 6-3
    await playMatchInDatabase(
      sfMatches![0].id,
      [
        { home: 2, away: 6 },
        { home: 7, away: 6, tbLoserPoints: 4 },
        { home: 6, away: 3 },
      ],
      rules
    );

    // SF2: Djokovic (away) d. Zverev (home) 7-6(5), 7-5
    await playMatchInDatabase(
      sfMatches![1].id,
      [
        { home: 6, away: 7, tbLoserPoints: 5 },
        { home: 5, away: 7 },
      ],
      rules
    );

    // Final: Novak Djokovic (away) d. Carlos Alcaraz (home) 5-7, 7-6(7), 7-6(4)
    const { data: finalMatch } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament!.id)
      .eq("round_number", 3)
      .single();

    expect(finalMatch.participants.map((p: any) => p.name)).toEqual([
      "Carlos Alcaraz",
      "Novak Djokovic",
    ]);

    const finalScores = await playMatchInDatabase(
      finalMatch.id,
      [
        { home: 7, away: 5 },
        { home: 6, away: 7, tbLoserPoints: 7 }, // 9-7 tiebreak saving championship point
        { home: 6, away: 7, tbLoserPoints: 4 }, // 7-4 deciding tiebreak
      ],
      rules
    );

    expect(finalScores.final_sets).toEqual([1, 2]);
    expect(finalScores.tennis.sets[1].tiebreak).toEqual({ home: 7, away: 9 });
    expect(finalScores.tennis.sets[2].tiebreak).toEqual({ home: 4, away: 7 });

    const { data: completedTournament } = await supabaseAdmin
      .from("tournaments")
      .select("status")
      .eq("id", tournament!.id)
      .single();
    expect(completedTournament!.status).toBe("completed");
  });

  it("Tournament 3: 2023 Nitto ATP Finals Turin (Group Stage Round-Robin + Knockout Semifinals & Final)", async () => {
    const rules: TennisRules = { max_sets: 3, set_type: "tiebreak" };

    // 1. Create Group-Stage Tournament
    const { data: tournament, error: tErr } = await supabaseAdmin
      .from("tournaments")
      .insert({
        name: "2023 Nitto ATP Finals — Turin",
        sport_type: "Tennis",
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
    createdTournamentIds.push(tournament!.id);

    // Group A (Green Group): Jannik Sinner, Novak Djokovic, Holger Rune, Stefanos Tsitsipas
    const groupA = [
      { name: "Jannik Sinner" },
      { name: "Novak Djokovic" },
      { name: "Holger Rune" },
      { name: "Stefanos Tsitsipas" },
    ];

    // Group B (Red Group): Daniil Medvedev, Carlos Alcaraz, Alexander Zverev, Andrey Rublev
    const groupB = [
      { name: "Carlos Alcaraz" },
      { name: "Daniil Medvedev" },
      { name: "Alexander Zverev" },
      { name: "Andrey Rublev" },
    ];

    // Create the 6 Group A matches + 6 Group B matches
    const groupMatchSpecs: {
      group_label: string;
      p1: { name: string };
      p2: { name: string };
      sets: SetScoreSpec[];
    }[] = [
      // Group A (Green Group) — Sinner 3-0, Djokovic 2-1, Rune 1-2, Tsitsipas 0-3
      {
        group_label: "A",
        p1: groupA[0], // Sinner
        p2: groupA[3], // Tsitsipas
        sets: [{ home: 6, away: 4 }, { home: 6, away: 4 }],
      },
      {
        group_label: "A",
        p1: groupA[1], // Djokovic
        p2: groupA[2], // Rune
        sets: [
          { home: 7, away: 6, tbLoserPoints: 4 },
          { home: 6, away: 7, tbLoserPoints: 1 },
          { home: 6, away: 3 },
        ],
      },
      {
        group_label: "A",
        p1: groupA[0], // Sinner
        p2: groupA[1], // Djokovic
        sets: [
          { home: 7, away: 5 },
          { home: 6, away: 7, tbLoserPoints: 5 },
          { home: 7, away: 6, tbLoserPoints: 2 },
        ],
      },
      {
        group_label: "A",
        p1: groupA[2], // Rune
        p2: groupA[3], // Tsitsipas
        sets: [{ home: 6, away: 4 }, { home: 6, away: 4 }],
      },
      {
        group_label: "A",
        p1: groupA[1], // Djokovic
        p2: groupA[3], // Tsitsipas/Hurkacz
        sets: [
          { home: 7, away: 6, tbLoserPoints: 1 },
          { home: 4, away: 6 },
          { home: 6, away: 1 },
        ],
      },
      {
        group_label: "A",
        p1: groupA[0], // Sinner
        p2: groupA[2], // Rune
        sets: [
          { home: 6, away: 2 },
          { home: 5, away: 7 },
          { home: 6, away: 4 },
        ],
      },

      // Group B (Red Group) — Alcaraz, Medvedev, Zverev, Rublev
      {
        group_label: "B",
        p1: groupB[2], // Zverev
        p2: groupB[0], // Alcaraz
        sets: [
          { home: 6, away: 7, tbLoserPoints: 3 },
          { home: 6, away: 3 },
          { home: 6, away: 4 },
        ],
      },
      {
        group_label: "B",
        p1: groupB[1], // Medvedev
        p2: groupB[3], // Rublev
        sets: [{ home: 6, away: 4 }, { home: 6, away: 2 }],
      },
      {
        group_label: "B",
        p1: groupB[0], // Alcaraz
        p2: groupB[3], // Rublev
        sets: [{ home: 7, away: 5 }, { home: 6, away: 2 }],
      },
      {
        group_label: "B",
        p1: groupB[1], // Medvedev
        p2: groupB[2], // Zverev
        sets: [
          { home: 7, away: 6, tbLoserPoints: 7 },
          { home: 6, away: 4 },
        ],
      },
      {
        group_label: "B",
        p1: groupB[0], // Alcaraz
        p2: groupB[1], // Medvedev
        sets: [{ home: 6, away: 4 }, { home: 6, away: 4 }],
      },
      {
        group_label: "B",
        p1: groupB[2], // Zverev
        p2: groupB[3], // Rublev
        sets: [{ home: 6, away: 4 }, { home: 6, away: 4 }],
      },
    ];

    for (const spec of groupMatchSpecs) {
      const { data: createdMatch, error: mErr } = await supabaseAdmin
        .from("matches")
        .insert({
          tournament_id: tournament!.id,
          organizer_id: organizerId,
          sport_type: "Tennis",
          group_label: spec.group_label,
          round_number: 1,
          participants: [spec.p1, spec.p2],
          status: "scheduled",
          bracket_type: "main",
        })
        .select()
        .single();
      expect(mErr).toBeNull();

      await playMatchInDatabase(createdMatch!.id, spec.sets, rules);
    }

    // 2. Verify PostgreSQL `public.group_standings` view AND client `calculateStandings()`
    const { data: dbStandings, error: stErr } = await supabaseAdmin
      .from("group_standings")
      .select("*")
      .eq("tournament_id", tournament!.id);
    expect(stErr).toBeNull();
    expect(dbStandings).toHaveLength(8);

    const groupAStandings = dbStandings!
      .filter((s) => s.group_label === "A")
      .sort((a, b) => b.wins - a.wins || b.total_sets_won - b.total_sets_lost - (a.total_sets_won - a.total_sets_lost));

    expect(groupAStandings[0].team_name).toBe("Jannik Sinner");
    expect(Number(groupAStandings[0].wins)).toBe(3);
    expect(groupAStandings[1].team_name).toBe("Novak Djokovic");
    expect(Number(groupAStandings[1].wins)).toBe(2);

    const groupBStandings = dbStandings!
      .filter((s) => s.group_label === "B")
      .sort((a, b) => b.wins - a.wins || (b.total_sets_won - b.total_sets_lost) - (a.total_sets_won - a.total_sets_lost));

    // In Group B: Alcaraz (5-2 sets, +3), Medvedev (4-2 sets, +2), Zverev (4-3 sets, +1), Rublev (0-6 sets)
    expect(groupBStandings[0].team_name).toBe("Carlos Alcaraz");
    expect(groupBStandings[1].team_name).toBe("Daniil Medvedev");
    expect(groupBStandings[3].team_name).toBe("Andrey Rublev");
    expect(Number(groupBStandings[3].wins)).toBe(0);

    // Also verify client-side `calculateStandings()` against the completed group matches
    const { data: allGroupMatches } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament!.id)
      .not("group_label", "is", null);
    const clientStandings = calculateStandings(allGroupMatches!);
    const clientSinner = clientStandings.find((s) => s.team_name === "Jannik Sinner")!;
    expect(clientSinner.wins).toBe(3);
    expect(clientSinner.total_sets_won).toBe(6);
    expect(clientSinner.total_sets_lost).toBe(2);

    // 3. Create & Play Knockout Stage (Semifinals -> Final)
    // SF1: Jannik Sinner (1A) vs Daniil Medvedev (2B) -> Sinner d. Medvedev 6-3, 6-7(4), 6-1
    // SF2: Carlos Alcaraz (1B) vs Novak Djokovic (2A) -> Djokovic d. Alcaraz 6-3, 6-2
    const { data: koMatches } = await supabaseAdmin
      .from("matches")
      .insert([
        {
          tournament_id: tournament!.id,
          organizer_id: organizerId,
          sport_type: "Tennis",
          round_number: 1,
          match_order: 1,
          participants: [{ name: "Jannik Sinner" }, { name: "Daniil Medvedev" }],
          status: "scheduled",
          bracket_type: "main",
        },
        {
          tournament_id: tournament!.id,
          organizer_id: organizerId,
          sport_type: "Tennis",
          round_number: 1,
          match_order: 2,
          participants: [{ name: "Carlos Alcaraz" }, { name: "Novak Djokovic" }],
          status: "scheduled",
          bracket_type: "main",
        },
        {
          tournament_id: tournament!.id,
          organizer_id: organizerId,
          sport_type: "Tennis",
          round_number: 2,
          match_order: 1,
          participants: [],
          status: "scheduled",
          bracket_type: "main",
        },
      ])
      .select()
      .order("round_number", { ascending: true })
      .order("match_order", { ascending: true });

    // Play SF1: Sinner d. Medvedev 6-3, 6-7(4), 6-1
    await playMatchInDatabase(
      koMatches![0].id,
      [
        { home: 6, away: 3 },
        { home: 6, away: 7, tbLoserPoints: 4 },
        { home: 6, away: 1 },
      ],
      rules
    );

    // Play SF2: Djokovic (away) d. Alcaraz (home) 6-3, 6-2
    await playMatchInDatabase(
      koMatches![1].id,
      [
        { home: 3, away: 6 },
        { home: 2, away: 6 },
      ],
      rules
    );

    // Verify Final has Sinner vs Djokovic
    const { data: turinFinal } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", koMatches![2].id)
      .single();

    expect(turinFinal.participants.map((p: any) => p.name)).toEqual([
      "Jannik Sinner",
      "Novak Djokovic",
    ]);

    // Play Final: Novak Djokovic (away) d. Jannik Sinner (home) 6-3, 6-3
    const turinFinalScores = await playMatchInDatabase(
      turinFinal.id,
      [
        { home: 3, away: 6 },
        { home: 3, away: 6 },
      ],
      rules
    );
    expect(turinFinalScores.final_sets).toEqual([0, 2]);

    const { data: completedTurin } = await supabaseAdmin
      .from("tournaments")
      .select("status")
      .eq("id", tournament!.id)
      .single();
    expect(completedTurin!.status).toBe("completed");
  });
});
