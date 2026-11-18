"use client";

import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

export interface GuestLandingHeroProps {
  onGetStarted: () => void;
  onExploreLive: () => void;
}

/**
 * Unauthenticated hero section for `/` matching ScoreBoard's dark telemetry
 * visual language and the two-column hero reference.
 */
export function GuestLandingHero({
  onGetStarted,
  onExploreLive,
}: GuestLandingHeroProps) {
  const { locale } = useTranslation();
  const isPt = locale === "pt";

  return (
    <section
      aria-label="ScoreBoard overview"
      className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center mb-8 sm:mb-10"
    >
      {/* Left: Headline, copy & CTAs */}
      <div className="space-y-4 sm:space-y-5">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-primary leading-[1.08]">
          {isPt ? (
            <>
              Não te limites a seguir o resultado.
              <br />
              Faz parte do jogo.
            </>
          ) : (
            <>
              Don&apos;t just follow the score.
              <br />
              Be part of the game.
            </>
          )}
        </h1>

        <p className="text-sm sm:text-base text-text-secondary max-w-lg leading-relaxed">
          {isPt
            ? "Pontuação em tempo real à beira do campo, quadros competitivos automáticos e overlays de transmissão para cada torneio e jogo."
            : "Court-side live scorekeeping, automated tournament brackets, and broadcast-ready overlays for every match and competition."}
        </p>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onGetStarted}
            className="h-9 sm:h-10 px-4 sm:px-5 rounded-lg bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            {isPt ? "Começar Agora" : "Get Started"}
          </button>

          <button
            type="button"
            onClick={onExploreLive}
            className="h-9 sm:h-10 px-4 sm:px-5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant text-text-primary font-medium text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            {isPt ? "Ver Jogos em Direto" : "Watch Live Feeds"}
          </button>
        </div>
      </div>

      {/* Right: Courtside over-the-shoulder live scoring preview */}
      <div className="relative rounded-2xl bg-surface-container border border-outline-variant overflow-hidden shadow-xl aspect-[16/10] w-full">
        <Image
          src="/backgrounds/hero-courtside.webp"
          alt="Courtside scorer tracking a live basketball match on a tablet"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d14]/85 via-transparent to-[#0b0d14]/25" />

        <div className="relative z-10 p-3.5 sm:p-5 h-full flex flex-col justify-end">
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5 bg-[#0b0d14]/85 backdrop-blur-sm border border-outline-variant rounded-md px-2.5 py-1">
              <span className="material-symbols-outlined text-[13px] text-text-secondary">
                scoreboard
              </span>
              {isPt ? "Sincronização em tempo real" : "Real-time telemetry sync"}
            </span>
            <span className="hidden sm:inline font-digital-logo text-sm text-text-secondary tracking-tight">
              SCORE:BOARD
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
