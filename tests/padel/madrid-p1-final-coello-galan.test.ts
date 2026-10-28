import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateTennisScore,
  createInitialTennisScores,
  generatePointSequenceForMatch,
  type SetScoreSpec,
  type TennisRules,
  type TennisScoresState,
} from "@/lib/scoring/tennis-engine";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Ficha Oficial Premier Padel — Comunidad de Madrid Premier Padel P1 2024
 * Final Masculina: Arturo Coello / Agustín Tapia vs Alejandro Galán / Federico Chingotto
 * WiZink Center, Madrid — 8 Setembro 2024
 *
 * Resultados Oficiais dos Sets:
 *  - Set 1: 6 - 4 (Coello / Tapia vencem com quebra decisiva no 10º jogo)
 *  - Set 2: 7 - 6 (Tie-break: 7 - 4 para Coello / Tapia)
 *
 * Total de Sets: 2 - 0 | Campeões: Arturo Coello & Agustín Tapia
 * Regras Oficiais: FIP / Premier Padel — "Ponto de Ouro" (Golden Point / No-Ad)
 * Dataset de Referência: ferranfg/padelapi & Joao-M-Silva/padel_analytics
 */
export const MADRID_P1_SPECS: SetScoreSpec[] = [
  { home: 6, away: 4 },
  { home: 7, away: 6, tiebreak: { home: 7, away: 4 } },
];

export const MADRID_P1_RULES: TennisRules = {
  max_sets: 3,
  set_type: "tiebreak",
  match_format: "best_of_3",
  no_ad: true, // Ponto de Ouro ativado por omissão no Padel
};

describe("Final Madrid Premier Padel P1 (Coello/Tapia vs Galán/Chingotto) — Mecânicas em Memória", () => {
  it("valida Set 1 Game 1: Ponto de Ouro decisivo a 40-40 (Golden Point sem vantagem)", () => {
    let state = createInitialTennisScores(0); // Coello / Tapia a servir (0)
    expect(state.serving_index).toBe(0);
    expect(state.tennis.games).toEqual([0, 0]);

    // Simular até 40-40 (3 pontos para cada dupla)
    for (let i = 0; i < 3; i++) {
      state = calculateTennisScore(state, 0, MADRID_P1_RULES); // Coello/Tapia
      state = calculateTennisScore(state, 1, MADRID_P1_RULES); // Galán/Chingotto
    }
    expect(state.tennis.points).toEqual([3, 3]);
    expect(state.tennis.games).toEqual([0, 0]);

    // Ponto de Ouro: Coello vence o ponto na rede -> Fecha de imediato o 1º jogo sem vantagem
    state = calculateTennisScore(state, 0, MADRID_P1_RULES);
    expect(state.tennis.points).toEqual([0, 0]);
    expect(state.tennis.games).toEqual([1, 0]);
    expect(state.serving_index).toBe(1); // Serviço roda para Galán/Chingotto
    expect(state.tennis.change_ends).toBe(true); // Troca de campo após o 1º jogo
  });

  it("valida Set 1 completo: progressão jogo a jogo até 6-4 a favor de Coello / Tapia", () => {
    let state = createInitialTennisScores(0);

    const points = generatePointSequenceForMatch([MADRID_P1_SPECS[0]], MADRID_P1_RULES);
    for (const winnerIdx of points) {
      state = calculateTennisScore(state, winnerIdx, MADRID_P1_RULES);
    }

    expect(state.tennis.sets).toHaveLength(1);
    expect(state.tennis.sets[0]).toMatchObject({ home: 6, away: 4 });
    expect(state.final_sets).toEqual([1, 0]); // 1 set ganho por Coello / Tapia
    expect(state.tennis.current_set).toBe(2);
    expect(state.tennis.games).toEqual([0, 0]);
    expect(state.current).toEqual({ home: 0, away: 0 }); // Início do 2.º set a 0-0 em jogos
    expect(state.match_won).toBe(false);
  });

  it("valida Set 2: equilíbrio 6-6, ativação do Tie-break e vitória final por 7-6 (7-4)", () => {
    let state = createInitialTennisScores(0);

    // Jogar ambos os sets da final
    const points = generatePointSequenceForMatch(MADRID_P1_SPECS, MADRID_P1_RULES);
    for (const winnerIdx of points) {
      state = calculateTennisScore(state, winnerIdx, MADRID_P1_RULES);
    }

    expect(state.tennis.sets).toHaveLength(2);
    expect(state.tennis.sets[0]).toMatchObject({ home: 6, away: 4 });
    expect(state.tennis.sets[1]).toMatchObject({
      home: 7,
      away: 6,
      tiebreak: { home: 7, away: 4 },
    });
    expect(state.final_sets).toEqual([2, 0]);
    expect(state.match_won).toBe(true);
  });

  it("conferência estatística oficial: total de jogos ganhos (13 vs 10) e sets (2 vs 0)", () => {
    const totalHomeGames = MADRID_P1_SPECS.reduce((sum, s) => sum + s.home, 0);
    const totalAwayGames = MADRID_P1_SPECS.reduce((sum, s) => sum + s.away, 0);

    expect(totalHomeGames).toBe(13);
    expect(totalAwayGames).toBe(10);
  });
});

describe("Final Madrid Premier Padel P1 — End-to-End no Supabase (Triggers & Tempo Real)", () => {
  let supabaseAdmin: SupabaseClient;
  let organizerId: string;
  let matchId: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const targetEmail = process.env.TEST_USER_EMAIL || "gjoforte@proton.me";
    const { data: realUser } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", targetEmail)
      .limit(1)
      .single();

    if (realUser) {
      organizerId = realUser.id;
    } else {
      const email = `padel-final-${Date.now()}@scoreboard.test`;
      const { data: authData } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "PadelPassword!23",
        email_confirm: true,
      });
      organizerId = authData.user!.id;
      await supabaseAdmin.from("users").update({ subscription_tier: "pro" }).eq("id", organizerId);
    }

    // Criar a final no Supabase
    const { data: createdMatch, error: mErr } = await supabaseAdmin
      .from("matches")
      .insert({
        organizer_id: organizerId,
        sport_type: "Padel",
        court: "WiZink Center — Pista Central (Madrid Premier Padel P1)",
        scheduled_at: "2024-09-08T16:00:00Z",
        status: "scheduled",
        participants: [
          { name: "Arturo Coello / Agustín Tapia" },
          { name: "Alejandro Galán / Federico Chingotto" },
        ],
        settings: MADRID_P1_RULES,
      })
      .select()
      .single();

    if (mErr) throw new Error(`Falha ao criar jogo de padel: ${mErr.message}`);
    matchId = createdMatch.id;
  });

  afterAll(async () => {
    if (process.env.KEEP_TEST_DATA === "true" || process.env.KEEP_TEST_DATA === "1") {
      console.log(`\n[KEEP_TEST_DATA] Jogo de Padel preservado na base de dados:`);
      console.log(`  -> http://localhost:3000/match/${matchId}`);
      return;
    }
    if (matchId) {
      await supabaseAdmin.from("matches").delete().eq("id", matchId);
    }
  });

  it("simula a Final do Premier Padel Madrid P1 completa ponto-a-ponto via match_events", async () => {
    // 1. Iniciar scoreboard
    const { error: startErr } = await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "start_scoreboard", initial_server_index: 0 },
    });
    expect(startErr).toBeNull();

    // 2. Inserir a sequência de pontos oficial via match_events
    const allPoints = generatePointSequenceForMatch(MADRID_P1_SPECS, MADRID_P1_RULES);
    for (const winnerIdx of allPoints) {
      const side = winnerIdx === 0 ? "home" : "away";
      const { error: ptErr } = await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_won", side },
      });
      if (ptErr) throw new Error(`Erro ao registar ponto de padel: ${ptErr.message}`);
    }

    // 3. Consultar o jogo final na base de dados
    const { data: finalMatch, error: fErr } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    expect(fErr).toBeNull();
    expect(finalMatch.status).toBe("completed");
    expect(finalMatch.scores.match_won).toBe(true);

    const setsData = extractSetsData(finalMatch.scores);
    expect(setsData).toHaveLength(2);
    expect(setsData[0]).toMatchObject({ home: 6, away: 4 });
    expect(setsData[1]).toMatchObject({ home: 7, away: 6 });
    expect(countSetsWon(setsData, 0)).toBe(2);
    expect(countSetsWon(setsData, 1)).toBe(0);
  }, 90000);
});
