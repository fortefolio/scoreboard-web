# ScoreBoard Web

> **Social Live Scoring Platform — Web Application**  
> Built with [Next.js 16](https://nextjs.org), [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), and [Supabase](https://supabase.com).

---

## 🌐 Visão Geral

O **ScoreBoard Web** é a plataforma web em tempo real do ecossistema ScoreBoard. Permite aos utilizadores e fãs acompanhar resultados em direto, seguir jogos e torneios com notificações instantâneas, consultar calendários, tabelas classificativas e perfis de atletas e equipas, além de disponibilizar aos organizadores e árbitros consolas completas de arbitragem digital em tempo real.

---

## ✨ Funcionalidades Principais

### 1. Consola de Arbitragem Oficial Unificada
Marcadores desenhados para arbitragem rápida com tipografia digital (`font-digital`):
- **Layout Unificado em 3 Colunas**:
  - **Coluna Esquerda (Casa)**: Jogador/equipa da casa, indicador de serviço/posse, parciais acumulados, pontuação digital e ações rápidas com botão de anulação/correção (`-1`).
  - **Coluna Central (Painel Principal)**: Cronómetro oficial, período/set/quarto, alertas técnicos contextuais (*Ponto de Break*, *Deuce*, *Ponto de Ouro*, *Bónus*, *Troca de Campo*) e botão para terminar partida.
  - **Coluna Direita (Visitante)**: Controlos e estatísticas espelhadas para a equipa visitante.
- **Sincronização em Tempo Real**: Atualizações instantâneas via Supabase Realtime WebSockets (`matches` e `match_events`).

### 2. Ações de Pontuação Específicas por Desporto
- 🏀 **Basquetebol**: Cestos de `+1` (Lance Livre), `+2` (Campo) e `+3` (Triplo), correção (`-1`), acumulação de faltas coletivas com alerta de `(BÓNUS)` à 5ª falta, descontos de tempo, período (Q1 a Q4, OT) e relógio oficial com posse de bola (24s / 14s).
- ⚽ **Futebol**: `+1 Golo`, anulação por VAR (`-1 Corrigir`), ações disciplinares com cartões amarelos e vermelhos, contadores de estatísticas (`+ Canto` e `+ Falta`), tempo de compensação ajustável (`+1m`) e gestão de partes (1ª/2ª Parte, Intervalo, Fim).
- 🏐 **Voleibol & Vólei de Praia**: Pontuação ponto a ponto, sorteio inicial (*Toss*), rotação de serviço em *side-out* com `Marcar Serviço`, pedidos de desconto de tempo, diferença de 2 pontos em *Deuce*, limite de sets e 5º set decisivo a 15 pontos (`Set Decisivo (Negra)`).
- 🎾 **Ténis & Padel**: Pontuação tradicional (`0, 15, 30, 40, AD`), *Ponto de Ouro* (*Golden Point / No-Ad*) em Padel, registo de estatísticas de serviço com `Ás (Ace)` e `Falta Dupla`, indicador de lado de campo (*Deuce/Ad Court*) e alertas visuais de *Break Point*.

### 3. Feeds, Exploração e Social
- Listagem e grelha de jogos com filtros rápidos por modalidade e estado (*Live*, *Scheduled*, *Finished*).
- Exploração e gestão de torneios (quadros eliminatórios, fases de grupos com cálculo automático de tabelas classificativas e regras de desempate).
- Sistema de seguimento (*Following*) de equipas, jogadores e partidas com agregação de notificações.

### 4. Internacionalização (i18n)
- Suporte nativo para Português (`pt`) e Inglês (`en`).
- Teste automatizado de drift (`npm run check:i18n`) para garantir paridade total entre idiomas.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Server Components)
- **UI & Estilização**: [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), Material Symbols
- **Base de Dados & Auth**: [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Realtime WebSockets)
- **Notificações**: [Sonner](https://sonner.emilkowal.ski)
- **Testes**: [Vitest 3](https://vitest.dev), `@testing-library/react`, [Playwright](https://playwright.dev)

---

## 📁 Estrutura de Pastas

```text
scoreboard-web/
├── app/                       # Rotas da aplicação (App Router)
│   ├── match/[matchId]/       # Detalhes do jogo e consola de arbitragem
│   │   └── scoreboard/        # Componentes de consola por modalidade
│   ├── tournaments/           # Gestão e acompanhamento de torneios
│   ├── user/[username]/       # Perfil público e jogos seguidos
│   └── page.tsx               # Feed principal e explorador de jogos
├── components/                # Componentes partilhados (NavBar, Modais, Paginação)
├── lib/                       # Utilitários, i18n, Supabase e motores de regras
│   ├── scoring/               # Lógica de cálculo de sets, jogos e regras desportivas
│   ├── standings/             # Classificações de grupos e desempates
│   └── i18n/                  # Dicionários de idiomas e hooks
├── tests/                     # Suíte de testes automatizados
│   ├── ui/                    # Testes de interação de UI com dados reais
│   ├── tennis/                # Testes de regras ATP e JeffSackmann charting
│   ├── padel/                 # Testes de regras FIP e Premier Padel
│   ├── basketball/            # Testes de regras FIBA
│   ├── volleyball/            # Testes de regras FPV Liga UNA e FIVB
│   └── rls/                   # Testes de segurança Row Level Security
└── test-results/              # Relatórios de testes e exports HTML
```

---

## 🚀 Como Executar

### Pré-requisitos
- [Node.js](https://nodejs.org) (v20 ou superior)
- `npm`

### 1. Instalar Dependências
```bash
cd scoreboard-web
npm install
```

### 2. Configurar Variáveis de Ambiente
Cria um ficheiro `.env.local` na raiz com as credenciais do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=tua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY=tua-chave-service-role
```

### 3. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
Acede a [http://localhost:3000](http://localhost:3000) no teu browser.

---

## 🧪 Testes Automatizados

O projeto utiliza o **Vitest** em conjunto com `@testing-library/react` para testes de componentes e integração, bem como o **Playwright** para testes E2E:

```bash
# Executar todos os testes unitários e de integração
npm run test:run

# Executar testes em modo watch
npm test

# Gerar relatório HTML estático dos testes
npm run test:report

# Visualizar o relatório HTML no browser (abre em http://localhost:4173)
npm run test:report:preview

# Abrir a dashboard gráfica interativa do Vitest em tempo real
npm run test:ui

# Executar testes end-to-end
npm run test:e2e

# Verificar paridade entre ficheiros de tradução PT e EN
npm run check:i18n
```

### Testes de Interação de UI com Dados Reais (`tests/ui/`):
Validação da UX através de simulação de cliques reais de arbitragem em partidas oficiais históricas:
- [tests/ui/tennis-atp-wimbledon.ui.test.tsx](tests/ui/tennis-atp-wimbledon.ui.test.tsx): Replay do épico 5º jogo do 3º set da Final de Wimbledon 2023 (Alcaraz vs Djokovic) — 13 igualdades (*deuces*), ases (`Ás (Ace)`), duplas-faltas (`Falta Dupla`), pontos de break (`PONTO DE BREAK!`), vantagens (`AD`) e troca de servidor.
- [tests/ui/padel-madrid-p1.ui.test.tsx](tests/ui/padel-madrid-p1.ui.test.tsx): Final Masculina Madrid Premier Padel P1 2024 (Coello/Tapia vs Galán/Chingotto) — ativação de `PONTO DE OURO (SUDDEN DEATH)` a 40-40, correção de pontos (`-1 Corrigir`) e finalização de partida.
- [tests/ui/basketball-fiba-liga.ui.test.tsx](tests/ui/basketball-fiba-liga.ui.test.tsx): Jogo oficial FIBA Liga Betclic (SL Benfica vs FC Porto) — cestos de `+1`, `+2` e `+3`, reposição de posse a 24s, acumulação de faltas até bónus (5ª falta exibindo `(BÓNUS)`), descontos de tempo e avanço de quarto para `Q2`.
- [tests/ui/volleyball-liga-una.ui.test.tsx](tests/ui/volleyball-liga-una.ui.test.tsx): Ficha Oficial FPV Jogo nº 136 (Clube Kairós vs VC Viana) — sorteio de serviço (*toss*), ralis com rotação de serviço em *side-out* (`Marcar Serviço`), anulação de ponto (`-1 Corrigir`), timeouts (`Desconto`) e 5º set decisivo a 15 pontos (`Set Decisivo (Negra)`).
- [tests/ui/football-official-match.ui.test.tsx](tests/ui/football-official-match.ui.test.tsx): Jogo oficial Taça de Portugal (Sporting CP vs AC Viseu) — `+1 Golo`, anulação por VAR (`-1 Corrigir`), cartões amarelos e vermelhos, cantos, faltas, compensação (`+1m`) e gestão de partes (`Intervalo` e `2ª Parte`).

---

## 📄 Licença
Propriedade do projeto ScoreBoard. Todos os direitos reservados.
