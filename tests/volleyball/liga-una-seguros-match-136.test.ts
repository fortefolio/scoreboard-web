import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateVolleyballScore,
  createInitialVolleyballScores,
  generateRallySequenceForMatch,
  type VolleyballRules,
  type VolleyballSetScoreSpec,
} from "@/lib/scoring/volleyball-engine";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Ficha Oficial da Federação Portuguesa de Voleibol — Liga UNA Seguros 2026/27 (1ª Fase Masculina)
 * Jogo nº 136: Clube Kairós (A) vs VC Viana (B)
 * Pavilhão CD Laranjeiras, Ponta Delgada — 17 Out 2026
 *
 * Resultados Oficiais dos Sets:
 *  - Set 1: 19 - 25 (VC Viana vence; Kairós começou a servir)
 *  - Set 2: 25 - 22 (Clube Kairós vence; VC Viana começou a servir)
 *  - Set 3: 25 - 20 (Clube Kairós vence; Kairós começou a servir)
 *  - Set 4: 18 - 25 (VC Viana vence; VC Viana começou a servir)
 *  - Set 5: 15 - 10 (Clube Kairós vence; Kairós começou a servir; Troca de campo obrigatória a 7-8)
 *
 * Total de pontos: 102 - 102 | Vencedor: Clube Kairós 3 - 2
 */
export const MATCH_136_SPECS: VolleyballSetScoreSpec[] = [
  { home: 19, away: 25 },
  { home: 25, away: 22 },
  { home: 25, away: 20 },
  { home: 18, away: 25 },
  { home: 15, away: 10 },
];

export const MATCH_136_RULES: VolleyballRules = {
  sport_type: "Volleyball",
  max_sets: 5,
  points_per_set: 25,
  deciding_set_points: 15,
};

describe("Ficha de Jogo Oficial nº 136 (Liga UNA Seguros) — Mecânicas de Voleibol em Memória", () => {
  it("valida Set 1: Clube Kairós inicia no serviço, VC Viana vence 25-19 e totaliza 44 pontos", () => {
    let state = createInitialVolleyballScores(0); // Clube Kairós a servir (0)
    expect(state.serving_index).toBe(0);

    const rallies = generateRallySequenceForMatch([MATCH_136_SPECS[0]], MATCH_136_RULES);
    for (const side of rallies) {
      state = calculateVolleyballScore(state, side, MATCH_136_RULES);
    }

    expect(state.sets).toHaveLength(1);
    expect(state.sets[0]).toMatchObject({ home: 19, away: 25 });
    expect(state.final_sets).toEqual([0, 1]);
    expect(state.current_set).toBe(2);
    expect(state.match_won).toBe(false);
  });

  it("valida Set 2: Alternância de serviço para VC Viana (1), Kairós empata 1-1 fechando 25-22", () => {
    let state = createInitialVolleyballScores(0);

    // Jogar Set 1 e Set 2
    const rallies = generateRallySequenceForMatch(
      [MATCH_136_SPECS[0], MATCH_136_SPECS[1]],
      MATCH_136_RULES
    );
    for (const side of rallies) {
      state = calculateVolleyballScore(state, side, MATCH_136_RULES);
    }

    expect(state.sets).toHaveLength(2);
    expect(state.sets[1]).toMatchObject({ home: 25, away: 22 });
    expect(state.final_sets).toEqual([1, 1]);
    expect(state.current_set).toBe(3);
    expect(state.match_won).toBe(false);
  });

  it("valida Sets 3 e 4: Kairós faz 2-1 (25-20) e VC Viana força a 'negra' no 4º set (25-18)", () => {
    let state = createInitialVolleyballScores(0);

    const rallies = generateRallySequenceForMatch(
      MATCH_136_SPECS.slice(0, 4),
      MATCH_136_RULES
    );
    for (const side of rallies) {
      state = calculateVolleyballScore(state, side, MATCH_136_RULES);
    }

    expect(state.sets).toHaveLength(4);
    expect(state.sets[2]).toMatchObject({ home: 25, away: 20 });
    expect(state.sets[3]).toMatchObject({ home: 18, away: 25 });
    expect(state.final_sets).toEqual([2, 2]);
    expect(state.current_set).toBe(5);
    expect(state.volleyball.is_deciding_set).toBe(true);
    expect(state.match_won).toBe(false);
  });

  it("valida Set 5 (Decisivo): deteta Troca de Campo rigorosamente aos 7:8 (Kairós a liderar 8-7) e vitória final por 3-2", () => {
    let state = createInitialVolleyballScores(0);

    // 1. Jogar os primeiros 4 sets (2-2)
    const first4Rallies = generateRallySequenceForMatch(
      MATCH_136_SPECS.slice(0, 4),
      MATCH_136_RULES
    );
    for (const side of first4Rallies) {
      state = calculateVolleyballScore(state, side, MATCH_136_RULES);
    }
    expect(state.sets).toHaveLength(4);

    // 2. No 5º Set, Clube Kairós serve primeiro (ganhou o sorteio da negra)
    // Simular o percurso até ao 7-7
    for (let i = 0; i < 7; i++) {
      state = calculateVolleyballScore(state, "away", MATCH_136_RULES); // VC Viana
      state = calculateVolleyballScore(state, "home", MATCH_136_RULES); // Kairós
    }
    expect(state.current).toEqual({ home: 7, away: 7 });
    expect(state.volleyball.change_ends).toBe(false);

    // 3. Ponto para o Clube Kairós -> 8-7 (8º ponto da equipa na frente!)
    // Conforme a ficha oficial: "Troca de Lado - Pontos na troca: 7:8"
    state = calculateVolleyballScore(state, "home", MATCH_136_RULES);
    expect(state.current).toEqual({ home: 8, away: 7 });
    expect(state.volleyball.change_ends).toBe(true);

    // 4. Continuar após a troca de campo até ao resultado final da ficha: 15-10
    // VC Viana faz mais 3 pontos (7 + 3 = 10) e Kairós faz mais 7 pontos (8 + 7 = 15)
    for (let i = 0; i < 3; i++) {
      state = calculateVolleyballScore(state, "away", MATCH_136_RULES);
    }
    for (let i = 0; i < 7; i++) {
      state = calculateVolleyballScore(state, "home", MATCH_136_RULES);
    }

    expect(state.sets).toHaveLength(5);
    expect(state.sets[4]).toMatchObject({ home: 15, away: 10 });
    expect(state.final_sets).toEqual([3, 2]);
    expect(state.match_won).toBe(true);

    // Conferência da soma de pontos oficial: 102 - 102
    const totalHome = state.sets.reduce((sum, s) => sum + s.home, 0);
    const totalAway = state.sets.reduce((sum, s) => sum + s.away, 0);
    expect(totalHome).toBe(102);
    expect(totalAway).toBe(102);
  });
});

describe("Ficha de Jogo Oficial nº 136 — End-to-End no Supabase (Triggers, Realtime & Base de Dados)", () => {
  let supabaseAdmin: SupabaseClient;
  let organizerId: string;
  let matchId: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Encontrar conta do utilizador real ou criar organizer
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
      const email = `fpv-match136-${Date.now()}@scoreboard.test`;
      const { data: authData } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "FpvPassword!23",
        email_confirm: true,
      });
      organizerId = authData.user!.id;
      await supabaseAdmin.from("users").update({ subscription_tier: "pro" }).eq("id", organizerId);
    }

    // Criar o jogo nº 136 da Liga UNA Seguros
    const { data: createdMatch, error: mErr } = await supabaseAdmin
      .from("matches")
      .insert({
        organizer_id: organizerId,
        sport_type: "Volleyball",
        court: "Pav. CD Laranjeiras — Ponta Delgada (Jogo nº 136)",
        scheduled_at: "2026-10-17T16:00:00Z",
        status: "scheduled",
        participants: [
          { name: "Clube Kairós" },
          { name: "VC Viana" },
        ],
        settings: MATCH_136_RULES,
      })
      .select()
      .single();

    if (mErr) throw new Error(`Falha ao criar jogo 136: ${mErr.message}`);
    matchId = createdMatch.id;
  });

  afterAll(async () => {
    if (process.env.KEEP_TEST_DATA === "true" || process.env.KEEP_TEST_DATA === "1") {
      console.log(`\n[KEEP_TEST_DATA] Jogo nº 136 da Liga UNA Seguros preservado na base de dados:`);
      console.log(`  -> http://localhost:3000/match/${matchId}`);
      return;
    }
    if (matchId) {
      await supabaseAdmin.from("matches").delete().eq("id", matchId);
    }
  });

  it("simula o Jogo nº 136 completo através de match_events na base de dados e valida o resultado 3-2", async () => {
    // 1. Iniciar scoreboard com Clube Kairós a servir primeiro (initial_server_index: 0)
    const { error: startErr } = await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "start_scoreboard", initial_server_index: 0 },
    });
    expect(startErr).toBeNull();

    // 2. Jogar os 5 sets da ficha de jogo completa ponto-a-ponto via match_events
    const allRallies = generateRallySequenceForMatch(MATCH_136_SPECS, MATCH_136_RULES);
    for (const side of allRallies) {
      const { error: ptErr } = await supabaseAdmin.from("match_events").insert({
        match_id: matchId,
        event_data: { type: "point_won", side },
      });
      if (ptErr) throw new Error(`Erro ao registar rally: ${ptErr.message}`);
    }

    // 3. Consultar o jogo na base de dados após o processamento da trigger `update_match_score`
    const { data: finalMatch, error: fErr } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    expect(fErr).toBeNull();
    expect(finalMatch.status).toBe("completed");
    expect(finalMatch.scores.match_won).toBe(true);
    expect(finalMatch.scores.final_sets).toEqual([3, 2]);

    const setsData = extractSetsData(finalMatch.scores);
    expect(setsData).toHaveLength(5);
    expect(setsData[0]).toMatchObject({ home: 19, away: 25 });
    expect(setsData[1]).toMatchObject({ home: 25, away: 22 });
    expect(setsData[2]).toMatchObject({ home: 25, away: 20 });
    expect(setsData[3]).toMatchObject({ home: 18, away: 25 });
    expect(setsData[4]).toMatchObject({ home: 15, away: 10 });
    expect(countSetsWon(setsData, 0)).toBe(3);
    expect(countSetsWon(setsData, 1)).toBe(2);
  }, 90000);
});
