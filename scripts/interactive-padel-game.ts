import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import {
  generatePointSequenceForMatch,
  type TennisRules,
} from "../lib/scoring/tennis-engine";
import { extractSetsData } from "../lib/scoring/sets";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RULES: TennisRules = {
  max_sets: 3,
  set_type: "tiebreak",
  match_format: "best_of_3",
  no_ad: true, // Ponto de Ouro / Golden Point
};

const DEFAULT_DELAY_MS = process.env.POINT_DELAY_MS !== undefined
  ? Number(process.env.POINT_DELAY_MS)
  : 1500; // 1.5s entre pontos por predefinição

async function askUser(rl: readline.Interface, questionText: string): Promise<boolean> {
  try {
    const answer = await rl.question(`\n👉 ${questionText} [Enter = Continuar / 'q' = Sair]: `);
    if (answer.trim().toLowerCase() === "q") {
      console.log("\nExecução cancelada pelo utilizador.");
      return false;
    }
    return true;
  } catch (err: any) {
    if (err?.code === "ERR_USE_AFTER_CLOSE") return false;
    throw err;
  }
}

async function playPointsWithRealtime(
  matchId: string,
  points: { side: "home" | "away"; desc?: string }[],
  delayMs = DEFAULT_DELAY_MS
) {
  let ptCount = 1;
  for (const pt of points) {
    const { error } = await supabase.from("match_events").insert({
      match_id: matchId,
      event_data: { type: "point_won", side: pt.side },
    });
    if (error) throw new Error(`Erro ao registar ponto: ${error.message}`);

    const pair = pt.side === "home" ? "Coello / Tapia" : "Galán / Chingotto";
    const desc = pt.desc ? ` — ${pt.desc}` : "";
    const delaySec = (delayMs / 1000).toFixed(1);

    process.stdout.write(
      `   🎾 Ponto ${ptCount++}/${points.length} para ${pair}${desc}${
        delayMs > 0 ? ` (pausa ${delaySec}s...)\r` : "\n"
      }`
    );

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  process.stdout.write("\n");
}

async function runInteractivePadelGame() {
  const rl = readline.createInterface({ input, output });

  console.clear();
  console.log("================================================================================");
  console.log("  SIMULADOR INTERATIVO — PREMIER PADEL MADRID P1 (FINAL MASCULINA)               ");
  console.log("  Arturo Coello / Agustín Tapia vs Alejandro Galán / Federico Chingotto         ");
  console.log("  WiZink Center — Pista Central (Madrid)                                        ");
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

  // 2. Criar jogo agendado de Padel
  const { data: match, error: mErr } = await supabase
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
      settings: RULES,
    })
    .select()
    .single();

  if (mErr) {
    console.error("Erro ao criar o jogo de padel:", mErr.message);
    rl.close();
    return;
  }

  const matchUrl = `http://localhost:3000/match/${match.id}`;
  const scoreboardUrl = `http://localhost:3000/match/${match.id}/scoreboard`;

  console.log("\n✅ Jogo de Padel criado na base de dados com sucesso!");
  console.log(`🔗 Abre no teu browser para veres as atualizações em tempo real:`);
  console.log(`   Página do Jogo:  \x1b[36m${matchUrl}\x1b[0m`);
  console.log(`   Marcador Umpire: \x1b[36m${scoreboardUrl}\x1b[0m\n`);
  console.log(`⏱️ Pausa entre pontos: ${(DEFAULT_DELAY_MS / 1000).toFixed(1)}s (configurável com POINT_DELAY_MS)\n`);

  // PASSO 1: Iniciar Marcador
  const ok1 = await askUser(
    rl,
    "PASSO 1: Iniciar o marcador oficial (Coello / Tapia a servir primeiro)?"
  );
  if (!ok1) {
    rl.close();
    return;
  }

  await supabase.from("match_events").insert({
    match_id: match.id,
    event_data: { type: "start_scoreboard", initial_server_index: 0 },
  });
  console.log("▶️ Marcador iniciado! Estado do jogo: ONGOING. Coello / Tapia com o serviço.");

  // PASSO 2: Game 1 com Ponto de Ouro (Golden Point)
  const ok2 = await askUser(
    rl,
    "PASSO 2: Jogar o 1.º Jogo ponto a ponto até 40-40 e executar o PONTO DE OURO (Golden Point)?"
  );
  if (!ok2) {
    rl.close();
    return;
  }

  console.log("🌟 A simular o 1.º Jogo com Ponto de Ouro a 40-40...");
  const game1Points: { side: "home" | "away"; desc: string }[] = [
    { side: "home", desc: "15-0 (Smash de Arturo Coello)" },
    { side: "away", desc: "15-15 (Volley cruzado de Galán)" },
    { side: "home", desc: "30-15 (Chiquita perfeita de Tapia)" },
    { side: "away", desc: "30-30 (Bandeja profunda de Chingotto)" },
    { side: "home", desc: "40-30 (Víbora no canto de Coello)" },
    { side: "away", desc: "40-40 (PONTO DE OURO / GOLDEN POINT ALCANÇADO!)" },
    { side: "home", desc: "DECISÃO: Smash vencedor de Agustín Tapia! JOGO FECHADO (1-0 sem vantagens)" },
  ];
  await playPointsWithRealtime(match.id, game1Points, DEFAULT_DELAY_MS);

  let { data: currMatch } = await supabase.from("matches").select("scores").eq("id", match.id).single();
  console.log(`✅ 1.º Jogo concluído via Ponto de Ouro!`);
  console.log(`   Jogos: Coello/Tapia ${currMatch?.scores?.tennis?.games?.[0]} - ${currMatch?.scores?.tennis?.games?.[1]} Galán/Chingotto`);
  console.log(`   Pontos no jogo seguinte: 0 - 0`);

  // PASSO 3: Concluir o 1.º Set (6-4)
  const ok3 = await askUser(
    rl,
    "PASSO 3: Jogar os restantes jogos do 1.º Set até ao 6-4 (com quebra decisiva no 10.º jogo)?"
  );
  if (!ok3) {
    rl.close();
    return;
  }

  console.log("🎾 A simular os restantes jogos do 1.º Set (Games 2 a 10)...");
  // Games 2 a 9: alternados até 5-4
  const set1Points: { side: "home" | "away"; desc?: string }[] = [];
  // G2 (Away): 1-1
  for (let i = 0; i < 4; i++) set1Points.push({ side: "away" });
  // G3 (Home): 2-1
  for (let i = 0; i < 4; i++) set1Points.push({ side: "home" });
  // G4 (Away): 2-2
  for (let i = 0; i < 4; i++) set1Points.push({ side: "away" });
  // G5 (Home): 3-2
  for (let i = 0; i < 4; i++) set1Points.push({ side: "home" });
  // G6 (Away): 3-3
  for (let i = 0; i < 4; i++) set1Points.push({ side: "away" });
  // G7 (Home): 4-3
  for (let i = 0; i < 4; i++) set1Points.push({ side: "home" });
  // G8 (Away): 4-4
  for (let i = 0; i < 4; i++) set1Points.push({ side: "away" });
  // G9 (Home): 5-4
  for (let i = 0; i < 4; i++) set1Points.push({ side: "home" });
  // G10 (Home Break): 6-4
  for (let i = 0; i < 4; i++) set1Points.push({ side: "home", desc: i === 3 ? "Break point convertido e Set 1 fechado!" : undefined });

  await playPointsWithRealtime(match.id, set1Points, Math.max(200, Math.round(DEFAULT_DELAY_MS / 3)));

  ({ data: currMatch } = await supabase.from("matches").select("scores").eq("id", match.id).single());
  console.log(`\n================================================================================`);
  console.log(`✅ 1.º SET CONCLUÍDO: Coello / Tapia 6 - 4 Galán / Chingotto`);
  console.log(`   Sets registados: ${JSON.stringify(currMatch?.scores?.tennis?.sets)}`);
  console.log(`   Novo Set iniciado: Set ${currMatch?.scores?.tennis?.current_set} (0-0 em jogos)`);
  console.log(`================================================================================`);

  // PASSO 4: 2.º Set até 6-6 (Entrada em Tie-break)
  const ok4 = await askUser(
    rl,
    "PASSO 4: Jogar o 2.º Set até ao 6-6 e ativação automática do Tie-break?"
  );
  if (!ok4) {
    rl.close();
    return;
  }

  console.log("🎾 A simular 12 jogos de grande nível no 2.º Set até ao 6-6...");
  const set2GamesPoints: { side: "home" | "away" }[] = [];
  for (let g = 0; g < 6; g++) {
    for (let p = 0; p < 4; p++) set2GamesPoints.push({ side: "home" });
    for (let p = 0; p < 4; p++) set2GamesPoints.push({ side: "away" });
  }
  await playPointsWithRealtime(match.id, set2GamesPoints, Math.max(150, Math.round(DEFAULT_DELAY_MS / 4)));

  ({ data: currMatch } = await supabase.from("matches").select("scores").eq("id", match.id).single());
  console.log(`\n================================================================================`);
  console.log(`🚨 EMPATE A 6-6 NO 2.º SET!`);
  console.log(`   Sinalizador 'is_tiebreak': ${currMatch?.scores?.tennis?.is_tiebreak ? "TRUE (Ativado!)" : "FALSE"}`);
  console.log(`   Vamos para o Tie-break à melhor de 7 pontos.`);
  console.log(`================================================================================`);

  // PASSO 5: Tie-break (7-4) e Fecho do Jogo
  const ok5 = await askUser(
    rl,
    "PASSO 5: Jogar o Tie-break ponto a ponto até à consagração de Coello / Tapia (7-4)?"
  );
  if (!ok5) {
    rl.close();
    return;
  }

  console.log("🔥 A simular o Tie-break decisivo ponto a ponto...");
  const tiebreakPoints: { side: "home" | "away"; desc: string }[] = [
    { side: "home", desc: "1-0 (Serviço potente de Coello)" },
    { side: "away", desc: "1-1 (Remate de Galán)" },
    { side: "away", desc: "1-2 (Mini-break de Galán / Chingotto)" },
    { side: "home", desc: "2-2 (Recuperação no bloco de Tapia)" },
    { side: "home", desc: "3-2 (Smash cruzado de Coello)" },
    { side: "away", desc: "3-3 (Troca de campo com empate a 3)" },
    { side: "home", desc: "4-3 (Defesa incrível de Tapia e contra-ataque)" },
    { side: "home", desc: "5-3 (Erro não forçado de Chingotto)" },
    { side: "away", desc: "5-4 (Vencedor de Galán)" },
    { side: "home", desc: "6-4 (Dois Championship Points para Coello / Tapia!)" },
    { side: "home", desc: "7-4 (Smash decisivo de Arturo Coello!)" },
  ];
  await playPointsWithRealtime(match.id, tiebreakPoints, DEFAULT_DELAY_MS);

  const { data: finalMatch } = await supabase.from("matches").select("*").eq("id", match.id).single();
  const setsData = extractSetsData(finalMatch?.scores);

  console.log("\n================================================================================");
  console.log("🏆 JOGO CONCLUÍDO — ARTURO COELLO & AGUSTÍN TAPIA CAMPEÕES!");
  console.log(`   Resultado Oficial: 2 - 0 em Sets`);
  console.log(`   Set 1: ${setsData?.[0]?.home} - ${setsData?.[0]?.away}`);
  console.log(`   Set 2: ${setsData?.[1]?.home} - ${setsData?.[1]?.away} (Tie-break: ${finalMatch?.scores?.tennis?.sets?.[1]?.tiebreak?.home || 7}-${finalMatch?.scores?.tennis?.sets?.[1]?.tiebreak?.away || 4})`);
  console.log(`   Estado do jogo na BD: ${finalMatch?.status?.toUpperCase()}`);
  console.log(`\n🔗 Podes ver todos os detalhes e o gráfico de pontos no browser em:`);
  console.log(`   \x1b[36m${matchUrl}\x1b[0m`);
  console.log("================================================================================\n");

  rl.close();
}

runInteractivePadelGame().catch((err) => {
  console.error("Erro no simulador interativo de padel:", err);
  process.exit(1);
});
