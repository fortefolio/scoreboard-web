import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

describe("FIBA Basketball Game — Supabase Scoring Trigger & Mechanics", () => {
  let supabaseAdmin: SupabaseClient;
  let matchId: string;
  let organizerId: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Encontrar ou criar um utilizador para organizer
    const { data: users } = await supabaseAdmin.from("users").select("id").limit(1);
    if (users && users.length > 0) {
      organizerId = users[0].id;
    } else {
      const email = `bball-test-${Date.now()}@scoreboard.test`;
      const { data: authData } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "BballPassword!23",
        email_confirm: true,
      });
      organizerId = authData.user!.id;
    }

    // Criar jogo de Basquetebol
    const { data: createdMatch, error: mErr } = await supabaseAdmin
      .from("matches")
      .insert({
        organizer_id: organizerId,
        sport_type: "Basketball",
        court: "Pavilhão Fidelidade — Lisboa",
        scheduled_at: "2026-10-27T18:00:00Z",
        status: "scheduled",
        participants: [
          { name: "SL Benfica" },
          { name: "FC Porto" },
        ],
        settings: {
          quarter_minutes: 10,
          quarters_count: 4,
          shot_clock_seconds: 24,
          fouls_bonus: 5,
        },
        scores: { current: { home: 0, away: 0 } },
      })
      .select()
      .single();

    if (mErr) throw new Error(`Falha ao criar jogo de basquetebol: ${mErr.message}`);
    matchId = createdMatch.id;
  });

  afterAll(async () => {
    if (matchId) {
      await supabaseAdmin.from("matches").delete().eq("id", matchId);
    }
  });

  it("inicia o jogo com start_scoreboard e muda status para ongoing", async () => {
    const { error: startErr } = await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "start_scoreboard" },
    });
    expect(startErr).toBeNull();

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("status, scores")
      .eq("id", matchId)
      .single();

    expect(match?.status).toBe("ongoing");
    expect(match?.scores?.current).toEqual({ home: 0, away: 0 });
  });

  it("processa cestos de 1, 2 e 3 pontos através do trigger da base de dados", async () => {
    // 1. Lance livre (+1) para SL Benfica (Home)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "home", points: 1 },
    });

    let { data: match } = await supabaseAdmin
      .from("matches")
      .select("scores")
      .eq("id", matchId)
      .single();
    expect(match?.scores?.current?.home).toBe(1);
    expect(match?.scores?.current?.away).toBe(0);

    // 2. Cesto de 2 pontos (+2) para SL Benfica (Home)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "home", points: 2 },
    });

    ({ data: match } = await supabaseAdmin
      .from("matches")
      .select("scores")
      .eq("id", matchId)
      .single());
    expect(match?.scores?.current?.home).toBe(3);

    // 3. Triplo (+3) para FC Porto (Away)
    await supabaseAdmin.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_scored", side: "away", points: 3 },
    });

    ({ data: match } = await supabaseAdmin
      .from("matches")
      .select("scores")
      .eq("id", matchId)
      .single());
    expect(match?.scores?.current?.away).toBe(3);
    expect(match?.scores?.current).toEqual({ home: 3, away: 3 });
  });

  it("simula uma sequência de 4 quartos e finaliza o jogo com vitória do Benfica", async () => {
    // Simular mais pontos até 88 - 82
    // Adicionar 85 pontos para Home e 79 pontos para Away
    // Usando múltiplos cestos de 2 e 3 pontos
    const scoringEvents = [
      // Home: 20 cestos de 3 (60 pts) + 12 cestos de 2 (24 pts) + 1 lance livre (1 pt) -> 85 pts (+ 3 anteriores = 88)
      ...Array.from({ length: 20 }, () => ({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home", points: 3 },
      })),
      ...Array.from({ length: 12 }, () => ({
        match_id: matchId,
        event_data: { type: "point_scored", side: "home", points: 2 },
      })),
      {
        match_id: matchId,
        event_data: { type: "point_scored", side: "home", points: 1 },
      },
      // Away: 20 cestos de 3 (60 pts) + 9 cestos de 2 (18 pts) + 1 lance livre (1 pt) -> 79 pts (+ 3 anteriores = 82)
      ...Array.from({ length: 20 }, () => ({
        match_id: matchId,
        event_data: { type: "point_scored", side: "away", points: 3 },
      })),
      ...Array.from({ length: 9 }, () => ({
        match_id: matchId,
        event_data: { type: "point_scored", side: "away", points: 2 },
      })),
      {
        match_id: matchId,
        event_data: { type: "point_scored", side: "away", points: 1 },
      },
    ];

    for (const ev of scoringEvents) {
      await supabaseAdmin.from("match_events").insert(ev);
    }

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("scores, status")
      .eq("id", matchId)
      .single();

    expect(match?.scores?.current?.home).toBe(88);
    expect(match?.scores?.current?.away).toBe(82);

    // Finalizar o jogo
    await supabaseAdmin
      .from("matches")
      .update({ status: "completed" })
      .eq("id", matchId);

    const { data: finalMatch } = await supabaseAdmin
      .from("matches")
      .select("status, scores")
      .eq("id", matchId)
      .single();

    expect(finalMatch?.status).toBe("completed");
    expect(finalMatch?.scores?.current).toEqual({ home: 88, away: 82 });
  });
});
