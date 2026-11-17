"use client";

import SportIcon from "@/components/SportIcon";
import { useTranslation } from "@/lib/i18n";

/**
 * Technical Capabilities showcase for unauthenticated visitors on `/`.
 * Each card renders a compact preview styled directly after ScoreBoard's
 * real Scoreboard, TournamentBracket, and MatchOverlay views.
 */
export function TechnicalCapabilitiesSection() {
  const { locale } = useTranslation();
  const isPt = locale === "pt";

  return (
    <section
      aria-label={isPt ? "Capacidades Técnicas" : "Technical Capabilities"}
      className="mt-12 sm:mt-16 pt-2"
    >
      {/* Centered hairline divider heading */}
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <div className="h-px flex-1 bg-outline-variant" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary shrink-0">
          {isPt ? "Capacidades Técnicas" : "Technical Capabilities"}
        </h2>
        <div className="h-px flex-1 bg-outline-variant" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: Live Scoreboard preview (ScoreboardLayout / TennisScoreboard) */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-text-primary">
                {isPt ? "Sincronização Árbitro-Público" : "Umpire-to-Crowd Instant Sync"}
              </h3>
              <span className="material-symbols-outlined text-[18px] text-text-muted">
                sensors
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isPt
                ? "Consola tátil de campo com atualização instantânea para todos os espetadores."
                : "Compact courtside scorer console with instant live updates to every viewer."}
            </p>
          </div>

          {/* Mini ScoreboardMainCard */}
          <div className="bg-[#0b0d14] border border-outline-variant rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
                  <SportIcon sport="Tennis" className="text-[11px] text-text-primary" />
                </div>
                <span className="text-[11px] text-text-secondary truncate">
                  {isPt ? "Ténis • Set 1" : "Tennis • Set 1"}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant text-[10px] font-medium text-text-primary shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {isPt ? "Ao Vivo" : "Live"}
              </span>
            </div>

            <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2">
              {/* Left side-rail */}
              <div className="flex flex-col gap-1">
                <span className="w-7 h-7 rounded-md bg-text-primary text-surface-container-lowest text-[10px] font-semibold flex items-center justify-center">
                  +Pt
                </span>
                <span className="w-7 h-7 rounded-md bg-surface-container-high border border-outline-variant text-text-muted text-[10px] flex items-center justify-center">
                  -1
                </span>
              </div>

              {/* Home column */}
              <div className="text-center space-y-1">
                <div className="text-[11px] font-medium text-text-primary truncate">Braga</div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant text-[9px] text-text-primary">
                  <span className="w-1 h-1 rounded-full bg-text-primary" />
                  {isPt ? "Serviço" : "Serving"}
                </span>
                <div className="font-digital text-2xl font-semibold text-text-primary leading-none">
                  15
                </div>
              </div>

              <div className="text-center px-1">
                <div className="text-[10px] text-text-muted mb-1">
                  {isPt ? "Jogos" : "Games"}
                </div>
                <div className="font-digital text-xs text-text-primary bg-surface-container-high border border-outline-variant rounded px-2 py-1">
                  4 - 3
                </div>
              </div>

              {/* Away column */}
              <div className="text-center space-y-1">
                <div className="text-[11px] font-medium text-text-primary truncate">Évora</div>
                <span className="inline-block text-[9px] text-text-muted py-0.5">
                  {isPt ? "Recetor" : "Receiver"}
                </span>
                <div className="font-digital text-2xl font-semibold text-text-primary leading-none">
                  40
                </div>
              </div>

              {/* Right side-rail */}
              <div className="flex flex-col gap-1">
                <span className="w-7 h-7 rounded-md bg-text-primary text-surface-container-lowest text-[10px] font-semibold flex items-center justify-center">
                  +Pt
                </span>
                <span className="w-7 h-7 rounded-md bg-surface-container-high border border-outline-variant text-text-muted text-[10px] flex items-center justify-center">
                  -1
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Automated Tournament Engine (TournamentBracket MatchCards) */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-text-primary">
                {isPt ? "Motor de Torneios Automático" : "Automated Tournament Engine"}
              </h3>
              <span className="material-symbols-outlined text-[18px] text-text-muted">
                account_tree
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isPt
                ? "Fase de grupos, eliminação direta ou dupla com progressão automática de jogos."
                : "Group stages, single or double elimination brackets with automatic advancement."}
            </p>
          </div>

          {/* Mini TournamentBracket view */}
          <div className="bg-[#0b0d14] border border-outline-variant rounded-xl p-3">
            <div className="grid grid-cols-[1fr_16px_1fr] items-center gap-0">
              {/* Quarterfinals */}
              <div className="space-y-2.5">
                <div className="bg-surface-container border border-outline-variant rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-primary font-medium truncate">Porto FC</span>
                    <span className="font-digital tabular-nums text-text-primary">2</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-muted truncate">Braga</span>
                    <span className="font-digital tabular-nums text-text-muted">0</span>
                  </div>
                  <div className="pt-1 border-t border-outline-variant flex items-center justify-between text-[9px] text-text-muted">
                    <span>QF 1</span>
                    <span>{isPt ? "Terminado" : "Final"}</span>
                  </div>
                </div>

                <div className="bg-surface-container border border-outline-variant rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-primary font-medium truncate">Lisboa</span>
                    <span className="font-digital tabular-nums text-text-primary">1</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-primary font-medium truncate">Coimbra</span>
                    <span className="font-digital tabular-nums text-text-primary">1</span>
                  </div>
                  <div className="pt-1 border-t border-outline-variant flex items-center justify-between text-[9px]">
                    <span className="text-text-muted">QF 2</span>
                    <span className="inline-flex items-center gap-1 text-text-primary font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {isPt ? "Ao Vivo" : "Live"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hairline bracket connectors */}
              <div className="h-24 flex flex-col justify-center">
                <div className="h-16 border-y border-r border-outline rounded-r-sm relative">
                  <div className="absolute right-[-16px] top-1/2 w-4 h-px bg-outline" />
                </div>
              </div>

              {/* Semifinal */}
              <div className="bg-surface-container border border-outline-variant rounded-lg p-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-primary font-medium truncate">Porto FC</span>
                  <span className="font-digital tabular-nums text-text-muted">-</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted italic truncate">Winner QF 2</span>
                  <span className="font-digital tabular-nums text-text-muted">-</span>
                </div>
                <div className="pt-1 border-t border-outline-variant flex items-center justify-between text-[9px] text-text-muted">
                  <span>SF 1</span>
                  <span>{isPt ? "Agendado" : "Scheduled"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Broadcast Overlays (MatchOverlayClient) */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-text-primary">
                {isPt ? "Overlays de Transmissão (OBS / vMix)" : "Broadcast Overlays (OBS / vMix)"}
              </h3>
              <span className="material-symbols-outlined text-[18px] text-text-muted">
                podcasts
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isPt
                ? "Grafismo transparente em tempo real pronto para browser source em direto."
                : "Transparent lower-third score bug ready for live OBS or vMix browser sources."}
            </p>
          </div>

          {/* Mini MatchOverlayClient preview */}
          <div className="bg-[#07080d] border border-outline-variant rounded-xl p-4 flex flex-col items-center justify-center gap-3 min-h-[168px] relative overflow-hidden">
            {/* Subtle technical dot grid representing transparency */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(238,240,245,0.25) 1px, transparent 1px)",
                backgroundSize: "12px 12px",
              }}
            />

            <div className="relative z-10 w-full bg-[#0b0d14]/95 border border-outline-variant rounded-xl overflow-hidden shadow-lg">
              <div className="px-3 py-1 bg-surface-container-high/60 border-b border-outline-variant flex items-center justify-between text-[10px]">
                <span className="font-digital-logo text-text-secondary tracking-tight">
                  SCORE:BOARD
                </span>
                <span className="inline-flex items-center gap-1 text-text-primary font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  72:14
                </span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-primary truncate">MCI</span>
                <div className="px-2.5 py-0.5 rounded bg-surface-container border border-outline-variant font-digital text-base font-semibold text-text-primary tabular-nums">
                  2 - 1
                </div>
                <span className="text-xs font-semibold text-text-primary truncate">RMA</span>
              </div>
            </div>

            <span className="relative z-10 text-[10px] font-mono text-text-muted">
              /match/[id]/overlay?pos=bottom
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
