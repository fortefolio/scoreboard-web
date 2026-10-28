import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateTennisScore,
  createInitialTennisScores,
  type TennisRules,
} from "@/lib/scoring/tennis-engine";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Premier Padel Official Match Data & Golden Point Test Suite
 * Based on Premier Padel Madrid P1 / Qatar Major (Coello / Tapia vs Galán / Chingotto)
 * Reference: ferranfg/padelapi & Joao-M-Silva/padel_analytics dataset
 */
describe("Premier Padel Game Mechanics & Ponto de Ouro (Golden Point)", () => {
  let supabaseAdmin: SupabaseClient;
  let matchId: string;
  let organizerId: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Obtain or create an organizer user
    const { data: users } = await supabaseAdmin.from("users").select("id").limit(1);
    if (users && users.length > 0) {
      organizerId = users[0].id;
    } else {
      const email = `padel-test-${Date.now()}@scoreboard.test`;
      const { data: authData } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "PadelPassword!23",
        email_confirm: true,
      });
      organizerId = authData.user!.id;
    }

    // Create Premier Padel Final match
    // Arturo Coello / Agustín Tapia (#1) vs Alejandro Galán / Federico Chingotto (#2)
    const { data: createdMatch, error: mErr } = await supabaseAdmin
      .from("matches")
      .insert({
        organizer_id: organizerId,
        sport_type: "Padel",
        court: "WiZink Center — Pista Central (Madrid)",
        scheduled_at: "2026-10-27T19:00:00Z",
        status: "scheduled",
        participants: [
          { name: "Arturo Coello / Agustín Tapia" },
          { name: "Alejandro Galán / Federico Chingotto" },
        ],
        settings: {
          max_sets: 3,
          points_per_set: 6,
          set_type: "tiebreak",
          match_format: "best_of_3",
          no_ad: true, // Ponto de Ouro (Golden Point) standard in Premier Padel / WPT
        },
        scores: {
          current: { home: 0, away: 0 },
          tennis: {
            points: [0, 0],
            games: [0, 0],
            sets: [],
            current_set: 1,
            is_tiebreak: false,
          },
        },
      })
      .select()
      .single();

    if (mErr) throw new Error(`Falha ao criar jogo de padel: ${mErr.message}`);
    matchId = createdMatch.id;
  });

  afterAll(async () => {
    if (matchId) {
      await supabaseAdmin.from("matches").delete().eq("id", matchId);
    }
  });

  it("inicia a partida de Padel com start_scoreboard e muda status para ongoing", async () => {
    const { error: startErr } = await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "start_scoreboard" },
    });
    expect(startErr).toBeNull();

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("status, sport_type, scores")
      .eq("id", matchId)
      .single();

    expect(match?.status).toBe("ongoing");
    expect(match?.sport_type).toBe("Padel");
    expect(match?.scores?.tennis?.games).toEqual([0, 0]);
    expect(match?.scores?.tennis?.points).toEqual([0, 0]);
  });

  it("executa a regra do Ponto de Ouro (Golden Point / No-Ad) a 40-40 sem vantagens", async () => {
    // Game 1: Coello/Tapia a servir
    // 15-0 (Home)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "home" },
    });
    // 15-15 (Away)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "away" },
    });
    // 30-15 (Home)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "home" },
    });
    // 30-30 (Away)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "away" },
    });
    // 40-30 (Home)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "home" },
    });
    // 40-40 (Away) -> Ponto de Ouro / Golden Point alcançado!
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "away" },
    });

    let { data: match } = await supabaseAdmin
      .from("matches")
      .select("scores")
      .eq("id", matchId)
      .single();

    // Em 40-40, points são [3, 3]
    expect(match?.scores?.tennis?.points).toEqual([3, 3]);
    expect(match?.scores?.tennis?.games).toEqual([0, 0]);

    // Ponto Decisivo (Ponto de Ouro):
    // No Padel moderno, não há Vantagem (AD). Quem ganha o ponto ganha logo o jogo!
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "home" },
    });

    ({ data: match } = await supabaseAdmin
      .from("matches")
      .select("scores")
      .eq("id", matchId)
      .single());

    // O jogo tem de ter terminado imediatamente para Home: games = [1, 0], points = [0, 0]
    expect(match?.scores?.tennis?.games).toEqual([1, 0]);
    expect(match?.scores?.tennis?.points).toEqual([0, 0]);
  });

  it("completa o 1.º Set (6-4) a favor de Coello / Tapia e avança para o 2.º Set", async () => {
    // Já está 1-0 para Home.
    // Vamos simular a sequência real do Premier Padel Madrid:
    // Game 2 (Away segura serviço): 1-1
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "away" },
      });
    }
    // Game 3 (Home segura serviço): 2-1
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home" },
      });
    }
    // Game 4 (Away segura serviço): 2-2
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "away" },
      });
    }
    // Game 5 (Home segura serviço): 3-2
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home" },
      });
    }
    // Game 6 (Away segura serviço): 3-3
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "away" },
      });
    }
    // Game 7 (Home segura serviço): 4-3
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home" },
      });
    }
    // Game 8 (Away segura serviço): 4-4
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "away" },
      });
    }
    // Game 9 (Home segura serviço): 5-4
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home" },
      });
    }
    // Game 10 (Home quebra o serviço de Galán/Chingotto): 6-4 -> Fim do 1.º Set!
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home" },
      });
    }

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("scores, status")
      .eq("id", matchId)
      .single();

    // O 1.º set deve estar guardado como 6-4
    expect(match?.scores?.tennis?.sets).toHaveLength(1);
    expect(match?.scores?.tennis?.sets[0]?.home).toBe(6);
    expect(match?.scores?.tennis?.sets[0]?.away).toBe(4);
    // Novo set começa em 0-0
    expect(match?.scores?.tennis?.current_set).toBe(2);
    expect(match?.scores?.tennis?.games).toEqual([0, 0]);
    expect(match?.status).toBe("ongoing");
  });

  it("leva o 2.º Set a Tie-break (6-6), finaliza 7-6 e completa o jogo com vitória de Coello / Tapia", async () => {
    // Simular 12 jogos alternados para chegar a 6-6 no 2.º set
    for (let g = 0; g < 6; g++) {
      // Home ganha um jogo
      for (let p = 0; p < 4; p++) {
        await supabaseAdmin.from("match_events").insert({
          match_id: matchId,
          event_data: { type: "point_scored", side: "home" },
        });
      }
      // Away ganha um jogo
      for (let p = 0; p < 4; p++) {
        await supabaseAdmin.from("match_events").insert({
          match_id: matchId,
          event_data: { type: "point_scored", side: "away" },
        });
      }
    }

    let { data: match } = await supabaseAdmin
      .from("matches")
      .select("scores")
      .eq("id", matchId)
      .single();

    expect(match?.scores?.tennis?.games).toEqual([6, 6]);
    expect(match?.scores?.tennis?.is_tiebreak).toBe(true);

    // Jogar o tiebreak: Coello/Tapia ganham 7-4
    // 4 pontos para Away
    for (let p = 0; p < 4; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "away" },
      });
    }
    // 7 pontos para Home
    for (let p = 0; p < 7; p++) {
      await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home" },
      });
    }

    ({ data: match } = await supabaseAdmin
      .from("matches")
      .select("scores, status")
      .eq("id", matchId)
      .single());

    // Jogo deve terminar com vitória de Coello / Tapia (2-0 em sets: 6-4, 7-6)
    expect(match?.status).toBe("completed");
    expect(match?.scores?.match_won).toBe(true);
    expect(match?.scores?.tennis?.sets).toHaveLength(2);
    expect(match?.scores?.tennis?.sets[1]?.home).toBe(7);
    expect(match?.scores?.tennis?.sets[1]?.away).toBe(6);
    expect(match?.scores?.tennis?.sets[1]?.tiebreak).toEqual({ home: 7, away: 4 });
  });

  it("verifica suporte a vantagens tradicionais quando no_ad: false é configurado explicitamente", () => {
    const rulesWithAd: TennisRules = {
      no_ad: false,
      max_sets: 3,
      points_per_set: 6,
    };

    let state = createInitialTennisScores(0);
    // Levar a 40-40 (3 pontos cada)
    for (let i = 0; i < 3; i++) {
      state = calculateTennisScore(state, 0, rulesWithAd);
      state = calculateTennisScore(state, 1, rulesWithAd);
    }
    expect(state.tennis.points).toEqual([3, 3]);

    // Ponto para Home -> Vantagem Home (4, 3)
    state = calculateTennisScore(state, 0, rulesWithAd);
    expect(state.tennis.points).toEqual([4, 3]);
    expect(state.tennis.games).toEqual([0, 0]);

    // Ponto para Away -> Volta a 40-40 (3, 3)
    state = calculateTennisScore(state, 1, rulesWithAd);
    expect(state.tennis.points).toEqual([3, 3]);
    expect(state.tennis.games).toEqual([0, 0]);

    // Dois pontos seguidos de Home -> Ganha o jogo
    state = calculateTennisScore(state, 0, rulesWithAd);
    state = calculateTennisScore(state, 0, rulesWithAd);
    expect(state.tennis.games).toEqual([1, 0]);
  });
});
