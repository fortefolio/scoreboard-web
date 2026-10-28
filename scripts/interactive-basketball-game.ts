import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface BasketEvent {
  side: "home" | "away";
  points: 1 | 2 | 3;
  desc: string;
}

interface QuarterSpec {
  quarter: string;
  baskets: BasketEvent[];
  endHome: number;
  endAway: number;
}

// Jogo Clássico: SL Benfica vs FC Porto (Liga Betclic de Basquetebol)
const GAME_QUARTERS: QuarterSpec[] = [
  {
    quarter: "Q1",
    endHome: 24,
    endAway: 20,
    baskets: [
      { side: "home", points: 2, desc: "Cesto de 2 pts de Aaron Broussard" },
      { side: "away", points: 3, desc: "Triplo de Max Landis" },
      { side: "home", points: 3, desc: "Triplo de Betinho Gomes" },
      { side: "away", points: 2, desc: "Afundanço de Miguel Maria Cardoso" },
      { side: "home", points: 2, desc: "Bandeja de Toney Douglas" },
      { side: "away", points: 2, desc: "Lançamento de meia distância de Charlon Kloof" },
      { side: "home", points: 1, desc: "Lance livre convertido" },
      { side: "home", points: 1, desc: "Segundo lance livre convertido" },
      { side: "away", points: 3, desc: "Triplo do canto de Anthony Barber" },
      { side: "home", points: 3, desc: "Triplo da cabeça do garrafão de Makram Ben Romdhane" },
      { side: "away", points: 2, desc: "Gancho interior de Miguel Queiroz" },
      { side: "home", points: 2, desc: "Contragolpe e cesto fácil" },
      { side: "away", points: 2, desc: "Cesto após ressalto ofensivo" },
      { side: "home", points: 3, desc: "Triplo a fechar o 1º quarto no buzzer!" },
      { side: "away", points: 2, desc: "Cesto no garrafão" },
      { side: "home", points: 2, desc: "Penetração e cesto na tabela" },
      { side: "home", points: 2, desc: "Lançamento em suspensão de média distância" },
      { side: "away", points: 2, desc: "Cesto rápido em transição" },
      { side: "away", points: 2, desc: "Bandeja e finalização elegante" },
    ],
  },
  {
    quarter: "Q2",
    endHome: 48,
    endAway: 45,
    baskets: [
      { side: "away", points: 3, desc: "Triplo de Anthony Barber para empatar" },
      { side: "home", points: 2, desc: "Cesto interior de Ben Romdhane" },
      { side: "away", points: 2, desc: "Bandeja rápida de Cleveland Melvin" },
      { side: "home", points: 3, desc: "Bomba de 3 pontos de Toney Douglas" },
      { side: "away", points: 3, desc: "Resposta imediata com triplo de Max Landis" },
      { side: "home", points: 2, desc: "Cesto no garrafão" },
      { side: "away", points: 2, desc: "Entrada e cesto de costas para o cesto" },
      { side: "home", points: 2, desc: "Lançamento curto no poste alto" },
      { side: "away", points: 3, desc: "Triplo após excelente circulação de bola" },
      { side: "home", points: 3, desc: "Triplo amortecido na tabela" },
      { side: "away", points: 2, desc: "Cesto na passada" },
      { side: "home", points: 2, desc: "Cesto acrobático com falta sofrida" },
      { side: "home", points: 1, desc: "Lance livre de bónus convertido (and-one)" },
      { side: "away", points: 2, desc: "Lançamento em suspensão" },
      { side: "home", points: 3, desc: "Triplo de Betinho Gomes a levantar o pavilhão" },
      { side: "away", points: 2, desc: "Cesto após bloqueio direto (pick and roll)" },
      { side: "home", points: 2, desc: "Afundanço de costas!" },
      { side: "away", points: 2, desc: "Bandeja a fechar a primeira parte" },
      { side: "home", points: 1, desc: "Lance livre técnico convertido" },
    ],
  },
  {
    quarter: "Q3",
    endHome: 71,
    endAway: 69,
    baskets: [
      { side: "home", points: 2, desc: "Cesto de entrada forte no garrafão" },
      { side: "away", points: 3, desc: "Triplo de transição rápida" },
      { side: "away", points: 2, desc: "Ressalto e cesto sob a tabela" },
      { side: "home", points: 3, desc: "Triplo do topo do arco" },
      { side: "away", points: 2, desc: "Passe picado e cesto fácil" },
      { side: "home", points: 2, desc: "Fadeaway shot no poste baixo" },
      { side: "away", points: 3, desc: "Triplo de Max Landis em passada lateral" },
      { side: "home", points: 2, desc: "Bandeja após drible estonteante" },
      { side: "away", points: 2, desc: "Lançamento curto" },
      { side: "home", points: 3, desc: "Triplo longo a 8 metros!" },
      { side: "away", points: 2, desc: "Cesto na passada com apoio do vidro" },
      { side: "home", points: 2, desc: "Roubo de bola e afundanço em contra-ataque!" },
      { side: "away", points: 2, desc: "Lançamento em suspensão de meia distância" },
      { side: "home", points: 3, desc: "Triplo no limite da posse dos 24s!" },
      { side: "away", points: 3, desc: "Triplo em resposta sobre a buzina" },
      { side: "home", points: 2, desc: "Cesto no garrafão" },
      { side: "away", points: 2, desc: "Dois lances livres: 1º convertido" },
      { side: "away", points: 1, desc: "Dois lances livres: 2º convertido" },
    ],
  },
  {
    quarter: "Q4",
    endHome: 95,
    endAway: 91,
    baskets: [
      { side: "away", points: 3, desc: "Triplo do FC Porto a empatar o jogo (71-72)" },
      { side: "home", points: 2, desc: "Cesto interior sob pressão" },
      { side: "away", points: 2, desc: "Entrada decidida até ao cesto" },
      { side: "home", points: 3, desc: "Triplo crucial de Aaron Broussard" },
      { side: "away", points: 2, desc: "Lançamento em suspensão frontal" },
      { side: "home", points: 2, desc: "Cesto em rotação no poste" },
      { side: "away", points: 2, desc: "Cesto na passada em corte para o cesto" },
      { side: "home", points: 2, desc: "Bandeja invertida espetacular" },
      { side: "away", points: 3, desc: "Grande triplo sob contestação severa" },
      { side: "home", points: 3, desc: "Resposta colossal com triplo de Toney Douglas" },
      { side: "away", points: 2, desc: "Dois pontos rápidos na transição" },
      { side: "home", points: 2, desc: "Passe picado para cesto de Ben Romdhane" },
      { side: "away", points: 2, desc: "Cesto após ressalto ofensivo aos 25 segundos do fim" },
      { side: "home", points: 1, desc: "Falta intencional: 1º lance livre convertido" },
      { side: "home", points: 1, desc: "Falta intencional: 2º lance livre convertido" },
      { side: "away", points: 2, desc: "Cesto rápido aos 6 segundos do fim" },
      { side: "home", points: 1, desc: "Falta tática no reinício: 1º lance livre convertido" },
      { side: "home", points: 2, desc: "Roubo de bola na reposição e cesto no buzzer para selar a vitória!" },
    ],
  },
];

const DEFAULT_DELAY_MS = process.env.POINT_DELAY_MS !== undefined
  ? Number(process.env.POINT_DELAY_MS)
  : 2500; // 2.5s por cesto por omissão

async function askUser(rl: readline.Interface, questionText: string): Promise<boolean> {
  const answer = await rl.question(`\n👉 ${questionText} [Enter = Continuar / 'q' = Sair]: `);
  if (answer.trim().toLowerCase() === "q") {
    console.log("\nExecução cancelada pelo utilizador.");
    return false;
  }
  return true;
}

async function runInteractiveBasketballGame() {
  const rl = readline.createInterface({ input, output });

  console.clear();
  console.log("================================================================================");
  console.log("  SIMULADOR INTERATIVO — LIGA DE BASQUETEBOL (SL Benfica vs FC Porto)           ");
  console.log("  Pavilhão Fidelidade, Lisboa — Jogo Decisivo                                   ");
  console.log("================================================================================\n");

  // 1. Obter utilizador
  const targetEmail = process.env.TEST_USER_EMAIL || "gjoforte@proton.me";
  const { data: realUser } = await supabase
    .from("users")
    .select("id, email, username")
    .eq("email", targetEmail)
    .single();

  let organizerId: string;
  if (realUser) {
    organizerId = realUser.id;
    console.log(`✅ Utilizador associado: @${realUser.username || realUser.email} (${realUser.email})`);
  } else {
    const { data: anyUser } = await supabase.from("users").select("id, email, username").limit(1).single();
    if (anyUser) {
      organizerId = anyUser.id;
      console.log(`ℹ️ Utilizador fallback: @${anyUser.username || anyUser.email}`);
    } else {
      const email = `bball-organizer-${Date.now()}@scoreboard.test`;
      const { data: authData } = await supabase.auth.admin.createUser({
        email,
        password: "BballPassword!23",
        email_confirm: true,
      });
      organizerId = authData.user!.id;
      console.log(`ℹ️ Novo utilizador criado: ${email}`);
    }
  }

  // 2. Criar jogo de Basquetebol
  console.log("\n🏀 A criar jogo oficial de Basquetebol na base de dados...");
  const { data: createdMatch, error: mErr } = await supabase
    .from("matches")
    .insert({
      organizer_id: organizerId,
      sport_type: "Basketball",
      court: "Pavilhão Fidelidade — Lisboa",
      scheduled_at: new Date().toISOString(),
      status: "scheduled",
      participants: [
        { name: "SL Benfica" },
        { name: "FC Porto" },
      ],
      settings: {
        quarter_minutes: 10,
        quarters_count: 4,
        shot_clock_seconds: 24,
        overtime_minutes: 5,
        fouls_bonus: 5,
      },
      scores: {
        current: { home: 0, away: 0 },
        basketball: {
          period: "Q1",
          quarters: [
            { home: 0, away: 0 },
            { home: 0, away: 0 },
            { home: 0, away: 0 },
            { home: 0, away: 0 },
          ],
          fouls: { home: 0, away: 0 },
          timeouts: { home: 5, away: 5 },
          quarter_seconds: 10 * 60,
          is_clock_running: false,
        },
      },
    })
    .select()
    .single();

  if (mErr) {
    console.error(`❌ Erro ao criar jogo: ${mErr.message}`);
    process.exit(1);
  }

  const matchId = createdMatch.id;
  const matchUrl = `http://localhost:3000/match/${matchId}`;
  const scoreboardUrl = `http://localhost:3000/match/${matchId}/scoreboard`;

  console.log("\n🎉 Jogo criado com sucesso!");
  console.log("--------------------------------------------------------------------------------");
  console.log(`  🌐 PÁGINA DO JOGO:        ${matchUrl}`);
  console.log(`  📊 MARCADOR DO ÁRBITRO:   ${scoreboardUrl}`);
  console.log("--------------------------------------------------------------------------------");
  console.log("💡 Abre o link no teu browser para veres os pontos e quartos a atualizarem em direto!\n");

  const continueStart = await askUser(rl, "Iniciar o cronómetro e colocar o jogo LIVE?");
  if (!continueStart) {
    rl.close();
    return;
  }

  // Iniciar jogo
  await supabase.from("match_events").insert({
    match_id: matchId,
    event_data: { type: "start_scoreboard" },
  });
  await supabase.from("matches").update({ status: "ongoing" }).eq("id", matchId);
  console.log("🔥 Jogo iniciado (STATUS = ONGOING)!");

  // Simular quarto a quarto
  let currentRunningScore = { home: 0, away: 0 };
  const quarterScores = [
    { home: 0, away: 0 },
    { home: 0, away: 0 },
    { home: 0, away: 0 },
    { home: 0, away: 0 },
  ];

  for (let qIdx = 0; qIdx < GAME_QUARTERS.length; qIdx++) {
    const qSpec = GAME_QUARTERS[qIdx];
    const canContinue = await askUser(rl, `Jogar ${qSpec.quarter}? (Total de ${qSpec.baskets.length} lançamentos)`);
    if (!canContinue) break;

    console.log(`\n▶️ INÍCIO DO ${qSpec.quarter}...\n`);

    // Atualizar período ativo no match
    await supabase.from("matches").update({
      scores: {
        current: currentRunningScore,
        basketball: {
          period: qSpec.quarter,
          quarters: quarterScores,
          fouls: { home: 0, away: 0 },
          timeouts: { home: 5 - qIdx, away: 5 - qIdx },
          quarter_seconds: 10 * 60,
          is_clock_running: true,
        },
      },
      updated_at: new Date().toISOString(),
    }).eq("id", matchId);

    let basketIndex = 1;
    for (const b of qSpec.baskets) {
      currentRunningScore[b.side] += b.points;
      quarterScores[qIdx][b.side] += b.points;

      // Inserir evento de pontuação
      const { error } = await supabase.from("match_events").insert({
        match_id: matchId,
        event_data: {
          type: "point_scored",
          side: b.side,
          points: b.points,
          period: qSpec.quarter,
          desc: b.desc,
        },
      });

      if (error) {
        console.error(`Erro no cesto: ${error.message}`);
      }

      // Atualizar também o estado rico no match
      await supabase.from("matches").update({
        scores: {
          current: currentRunningScore,
          basketball: {
            period: qSpec.quarter,
            quarters: quarterScores,
            fouls: { home: Math.min(5, Math.floor(basketIndex / 3)), away: Math.min(5, Math.floor(basketIndex / 4)) },
            timeouts: { home: 5 - qIdx, away: 5 - qIdx },
            quarter_seconds: Math.max(0, (10 * 60) - (basketIndex * 30)),
            is_clock_running: true,
          },
        },
        updated_at: new Date().toISOString(),
      }).eq("id", matchId);

      const teamName = b.side === "home" ? "SL Benfica" : "FC Porto";
      const ptsBadge = b.points === 3 ? "🟢 [3 PTS]" : b.points === 2 ? "🔵 [2 PTS]" : "🟡 [1 PT]";
      console.log(
        `  ${ptsBadge} ${teamName.padEnd(12)} -> ${b.desc.padEnd(45)} | Placar: ${currentRunningScore.home} - ${currentRunningScore.away}`
      );

      if (DEFAULT_DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, DEFAULT_DELAY_MS));
      }
      basketIndex++;
    }

    console.log(`\n🏁 FIM DO ${qSpec.quarter}! Parcial do quarto: ${quarterScores[qIdx].home} - ${quarterScores[qIdx].away} | Placar acumulado: ${currentRunningScore.home} - ${currentRunningScore.away}`);
  }

  // Finalizar jogo
  const canFinish = await askUser(rl, "Terminar a partida e colocar status = 'completed'?");
  if (canFinish) {
    await supabase.from("matches").update({
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", matchId);

    console.log("\n🏆 PARTIDA FINALIZADA!");
    console.log(`   Resultado Oficial: SL Benfica ${currentRunningScore.home} - ${currentRunningScore.away} FC Porto`);
    console.log(`   Vencedor: SL Benfica`);
    console.log(`   Página do Jogo: ${matchUrl}\n`);
  }

  rl.close();
}

runInteractiveBasketballGame().catch((err) => {
  console.error("Erro no simulador:", err);
  process.exit(1);
});
