import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import {
  generateRallySequenceForSet,
  type VolleyballRules,
} from "../lib/scoring/volleyball-engine";
import { countSetsWon, extractSetsData } from "../lib/scoring/sets";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RULES: VolleyballRules = {
  sport_type: "Volleyball",
  max_sets: 5,
  points_per_set: 25,
  deciding_set_points: 15,
};

const SETS_DATA = [
  { set: 1, home: 19, away: 25, server: "Clube Kairós", desc: "VC Viana vence o 1º set por 25-19" },
  { set: 2, home: 25, away: 22, server: "VC Viana", desc: "Clube Kairós empata 1-1 vencendo 25-22" },
  { set: 3, home: 25, away: 20, server: "Clube Kairós", desc: "Clube Kairós passa para a frente 2-1 com 25-20" },
  { set: 4, home: 18, away: 25, server: "VC Viana", desc: "VC Viana vence 25-18 e empata 2-2, forçando o 5º set decisivo" },
];

const DEFAULT_DELAY_MS = process.env.POINT_DELAY_MS !== undefined
  ? Number(process.env.POINT_DELAY_MS)
  : 5000; // 5 segundos entre cada ponto para acompanhar confortavelmente

async function askUser(rl: readline.Interface, questionText: string): Promise<boolean> {
  const answer = await rl.question(`\n👉 ${questionText} [Enter = Continuar / 'q' = Sair]: `);
  if (answer.trim().toLowerCase() === "q") {
    console.log("\nExecução cancelada pelo utilizador.");
    return false;
  }
  return true;
}

async function playRalliesWithRealtime(
  matchId: string,
  rallies: ("home" | "away")[],
  delayMs = DEFAULT_DELAY_MS
) {
  let ptCount = 1;
  for (const side of rallies) {
    const { error } = await supabase.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_won", side },
    });
    if (error) throw new Error(`Erro ao registar ponto: ${error.message}`);

    const team = side === "home" ? "Clube Kairós" : "VC Viana";
    const delaySec = Math.round(delayMs / 1000);
    process.stdout.write(
      `   • Ponto ${ptCount++}/${rallies.length} para ${team}${
        delayMs > 0 ? ` (pausa de ${delaySec}s...)\r` : "\n"
      }`
    );

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  process.stdout.write("\n");
}

async function runInteractiveMatch136() {
  const rl = readline.createInterface({ input, output });

  console.clear();
  console.log("================================================================================");
  console.log("  SIMULADOR INTERATIVO — FICHA DE JOGO OFICIAL Nº 136 (LIGA UNA SEGUROS)        ");
  console.log("  Clube Kairós vs VC Viana (Pavilhão CD Laranjeiras, Ponta Delgada)            ");
  console.log("================================================================================\n");

  // 1. Obter utilizador para associar o jogo
  const targetEmail = process.env.TEST_USER_EMAIL || "gjoforte@proton.me";
  const { data: realUser } = await supabase
    .from("users")
    .select("id, email, username")
    .eq("email", targetEmail)
    .single();

  let organizerId: string;
  if (realUser) {
    organizerId = realUser.id;
    console.log(`👤 Utilizador associado: ${realUser.username || realUser.email}`);
  } else {
    const { data: fallbackUser } = await supabase.from("users").select("id").limit(1).single();
    organizerId = fallbackUser!.id;
  }

  // 2. Criar jogo agendado
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .insert({
      organizer_id: organizerId,
      sport_type: "Volleyball",
      court: "Pav. CD Laranjeiras (Jogo nº 136)",
      scheduled_at: "2026-10-17T16:00:00Z",
      status: "scheduled",
      participants: [
        { name: "Clube Kairós" },
        { name: "VC Viana" },
      ],
      settings: RULES,
    })
    .select()
    .single();

  if (mErr) {
    console.error("Erro ao criar o jogo:", mErr.message);
    rl.close();
    return;
  }

  const matchUrl = `http://localhost:3000/match/${match.id}`;
  const scoreboardUrl = `http://localhost:3000/match/${match.id}/scoreboard`;

  console.log("\n✅ Jogo criado na base de dados com sucesso!");
  console.log(`🔗 Abre no teu browser para veres em direto:`);
  console.log(`   Página do Jogo:  \x1b[36m${matchUrl}\x1b[0m`);
  console.log(`   Marcador Umpire: \x1b[36m${scoreboardUrl}\x1b[0m\n`);
  console.log(`⏱️ Pausa entre pontos: ${Math.round(DEFAULT_DELAY_MS / 1000)} segundos (para acompanhar confortavelmente o ecrã)`);

  // PASSO 1: Iniciar Marcador
  const ok1 = await askUser(
    rl,
    "PASSO 1: Podes avançar para iniciar o marcador oficial (Clube Kairós a servir primeiro)?"
  );
  if (!ok1) {
    rl.close();
    return;
  }

  await supabase.from("match_events").insert({
    match_id: match.id,
    event_data: { type: "start_scoreboard", initial_server_index: 0 },
  });
  console.log("▶️ Marcador iniciado! Estado do jogo: ONGOING. Clube Kairós com o serviço.");

  // PASSOS 2 a 5: Sets 1 a 4
  for (const s of SETS_DATA) {
    const ok = await askUser(
      rl,
      `PASSO ${s.set + 1}: Jogar o Set ${s.set} (${s.desc})?`
    );
    if (!ok) {
      rl.close();
      return;
    }

    console.log(`🏐 A simular os pontos do Set ${s.set} (${Math.round(DEFAULT_DELAY_MS / 1000)}s por ponto)...`);
    const rallies = generateRallySequenceForSet({ home: s.home, away: s.away }, 25);
    await playRalliesWithRealtime(match.id, rallies, DEFAULT_DELAY_MS);

    const { data: updated } = await supabase.from("matches").select("scores").eq("id", match.id).single();
    const sets = extractSetsData(updated?.scores);
    const setsWonHome = countSetsWon(sets, 0);
    const setsWonAway = countSetsWon(sets, 1);
    console.log(`✅ Set ${s.set} concluído: Clube Kairós ${s.home} - ${s.away} VC Viana`);
    console.log(`📊 Marcador geral em sets: Clube Kairós ${setsWonHome} - ${setsWonAway} VC Viana`);
  }

  // PASSO 6: 5º Set — Pré-Troca de Campo (até aos 7-8)
  const ok5a = await askUser(
    rl,
    "PASSO 6 (5º SET DECISIVO): Empate a 2-2 em sets! Jogar o 5º set até à Troca de Campo aos 7:8?"
  );
  if (!ok5a) {
    rl.close();
    return;
  }

  console.log(`🏐 A simular o início do 5º set até aos 7-7 e o 8º ponto do Kairós (${Math.round(DEFAULT_DELAY_MS / 1000)}s por ponto)...`);
  const set5Part1: ("home" | "away")[] = [];
  for (let i = 0; i < 7; i++) {
    set5Part1.push("away", "home");
  }
  set5Part1.push("home"); // 8º ponto do Clube Kairós (8-7)
  await playRalliesWithRealtime(match.id, set5Part1, DEFAULT_DELAY_MS);

  const { data: atTurn } = await supabase.from("matches").select("scores").eq("id", match.id).single();
  const changeEnds = atTurn?.scores?.volleyball?.change_ends;
  console.log("\n================================================================================");
  console.log(`🚨 TROCA DE CAMPO REGISTADA NA FICHA (7:8)!`);
  console.log(`   Placar no momento: Clube Kairós 8 - 7 VC Viana`);
  console.log(`   Sinalizador 'change_ends' na Base de Dados: ${changeEnds ? "TRUE (Ativado!)" : "FALSE"}`);
  console.log(`   As equipas mudam agora de lado do campo para jogar a segunda metade da negra.`);
  console.log("================================================================================");

  // PASSO 7: Fechar 5º Set e Jogo (15-10)
  const ok5b = await askUser(
    rl,
    "PASSO 7: Jogar após a troca de campo até ao fecho da partida (15-10 para o Clube Kairós)?"
  );
  if (!ok5b) {
    rl.close();
    return;
  }

  console.log(`🏐 A simular os pontos finais do 5º set (${Math.round(DEFAULT_DELAY_MS / 1000)}s por ponto)...`);
  const set5Part2: ("home" | "away")[] = [];
  for (let i = 0; i < 3; i++) {
    set5Part2.push("away");
  }
  for (let i = 0; i < 7; i++) {
    set5Part2.push("home");
  }
  await playRalliesWithRealtime(match.id, set5Part2, DEFAULT_DELAY_MS);

  const { data: completedMatch } = await supabase.from("matches").select("*").eq("id", match.id).single();
  const finalSets = extractSetsData(completedMatch?.scores);

  console.log("\n================================================================================");
  console.log("🏆 JOGO CONCLUÍDO!");
  console.log(`   Vencedor Oficial: CLUBE KAIRÓS 3 - 2 VC VIANA`);
  console.log(`   Sets: ${finalSets.map((s: any) => `${s.home}-${s.away}`).join(", ")}`);
  console.log(`   Total de Pontos: ${finalSets.reduce((a: number, b: any) => a + b.home, 0)} - ${finalSets.reduce((a: number, b: any) => a + b.away, 0)} (102 - 102)`);
  console.log(`   Estado do jogo na BD: ${completedMatch?.status ? completedMatch.status.toUpperCase() : "COMPLETED"}`);
  console.log(`\n🔗 Podes ver todos os detalhes e o gráfico de pontos no browser em:`);
  console.log(`   \x1b[36m${matchUrl}\x1b[0m`);
  console.log("================================================================================\n");

  rl.close();
}

runInteractiveMatch136().catch((err) => {
  console.error("Erro no script:", err);
  process.exit(1);
});
