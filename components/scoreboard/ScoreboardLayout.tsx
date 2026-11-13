"use client";

import React, { createContext, useContext } from "react";
import SportIcon from "@/components/SportIcon";
import { useTranslation } from "@/lib/i18n";

interface ScoreboardChromeContextValue {
  onBack?: () => void;
  onOpenObs?: () => void;
}

const ScoreboardChromeContext = createContext<ScoreboardChromeContextValue>({});

export function ScoreboardProvider({
  onBack,
  onOpenObs,
  children,
}: ScoreboardChromeContextValue & { children: React.ReactNode }) {
  return (
    <ScoreboardChromeContext.Provider value={{ onBack, onOpenObs }}>
      {children}
    </ScoreboardChromeContext.Provider>
  );
}

export interface CompactHeaderConfig {
  sportType: string;
  sportLabel: string;
  eventName: string;
  statusBadge?: string;
  onFinish?: () => void;
  finishLabel?: string;
}

export interface ScoreboardHeaderProps {
  sportType: string;
  sportLabel: string;
  eventName: string;
  teamHome: string;
  teamAway: string;
  rightSlot?: React.ReactNode;
}

/**
 * Shared top banner for all sport scoreboards (Tennis/Padel, Volleyball, Basketball, Football).
 */
export function ScoreboardHeader({
  sportType,
  sportLabel,
  eventName,
  teamHome,
  teamAway,
  rightSlot,
}: ScoreboardHeaderProps) {
  return (
    <div className="flex compact:hidden w-full bg-surface-container rounded-xl border border-outline-variant p-4 mb-6 flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
          <SportIcon sport={sportType} className="w-4 h-4 text-text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-text-secondary">{sportLabel}</span>
            <span className="text-text-muted" aria-hidden>•</span>
            <span className="text-text-muted truncate">{eventName}</span>
          </div>
          <h2 className="text-sm font-semibold text-text-primary mt-0.5 truncate">
            {teamHome} <span className="text-text-muted font-normal">vs</span> {teamAway}
          </h2>
        </div>
      </div>

      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}

/**
 * Shared 3-column command center container for all sport scoreboards.
 */
export function ScoreboardMainCard({
  left,
  leftActions,
  center,
  right,
  rightActions,
  mobileHeader,
  compactHeader,
}: {
  left: React.ReactNode;
  leftActions?: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  rightActions?: React.ReactNode;
  mobileHeader?: React.ReactNode;
  compactHeader?: CompactHeaderConfig;
}) {
  const { onBack, onOpenObs } = useContext(ScoreboardChromeContext);
  const { translations } = useTranslation();

  const renderedMobileHeader =
    mobileHeader ??
    (compactHeader ? (
      <>
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Match Overview"
              aria-label="Match Overview"
              className="w-7 h-7 rounded-lg bg-surface-container-high border border-outline-variant text-text-muted hover:text-text-primary flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
            <SportIcon sport={compactHeader.sportType} className="w-3.5 h-3.5 text-text-primary" />
          </div>
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="font-medium text-text-secondary shrink-0">{compactHeader.sportLabel}</span>
            <span className="text-text-muted shrink-0" aria-hidden>•</span>
            <span className="text-text-muted truncate">{compactHeader.eventName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {compactHeader.statusBadge && (
            <span className="px-2 py-1 rounded-lg bg-surface-container-high border border-outline-variant text-[11px] font-medium text-text-primary">
              {compactHeader.statusBadge}
            </span>
          )}
          {onOpenObs && (
            <button
              type="button"
              onClick={onOpenObs}
              title="OBS / vMix Overlay"
              aria-label="OBS Overlay"
              className="h-7 px-2 rounded-lg bg-surface-container-high border border-outline-variant text-text-secondary hover:text-text-primary text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">podcasts</span>
              <span className="hidden sm:inline">OBS</span>
            </button>
          )}
          {compactHeader.onFinish && (
            <button
              type="button"
              onClick={compactHeader.onFinish}
              title={compactHeader.finishLabel || translations.scoreboard.endMatch}
              className="h-7 px-2.5 rounded-lg bg-surface-container-high hover:bg-error/10 text-text-secondary hover:text-error border border-outline-variant hover:border-error/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>{compactHeader.finishLabel || translations.scoreboard.endMatch}</span>
            </button>
          )}
        </div>
      </>
    ) : null);

  return (
    <div className="w-full flex-1 flex flex-col justify-between bg-surface-container rounded-2xl border border-outline-variant p-6 md:p-8 compact:p-3.5 mb-6 compact:mb-0 relative overflow-hidden">
      {renderedMobileHeader && (
        <div className="hidden compact:flex items-center justify-between gap-2 pb-2 mb-2 border-b border-outline-variant/60 shrink-0">
          {renderedMobileHeader}
        </div>
      )}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 landscape-compact:grid-cols-[1.25fr_0.85fr_1.25fr] gap-x-2.5 gap-y-2 md:gap-6 landscape-compact:gap-x-3 items-stretch">
        <div className="flex flex-col landscape-compact:flex-row-reverse items-center justify-between gap-2 landscape-compact:gap-3 text-center order-2 sm:order-1 min-w-0 h-full">
          <div className="flex flex-col items-center min-w-0 w-full flex-1 h-full">{left}</div>
          {leftActions && (
            <div className="w-full max-w-xs landscape-compact:w-10 landscape-compact:shrink-0 landscape-compact:self-center">
              {leftActions}
            </div>
          )}
        </div>
        <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center order-1 sm:order-2 py-2 sm:py-0 compact:py-1 border-b sm:border-b-0 sm:border-x border-outline-variant/60 px-2 md:px-4">
          {center}
        </div>
        <div className="flex flex-col landscape-compact:flex-row items-center justify-between gap-2 landscape-compact:gap-3 text-center order-3 min-w-0 h-full">
          <div className="flex flex-col items-center min-w-0 w-full flex-1 h-full">{right}</div>
          {rightActions && (
            <div className="w-full max-w-xs landscape-compact:w-10 landscape-compact:shrink-0 landscape-compact:self-center">
              {rightActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shared summary / stats card shell below the main scoreboard.
 */
export function ScoreboardSummaryCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block compact:hidden w-full bg-surface-container rounded-xl border border-outline-variant overflow-hidden p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-outline-variant pb-2.5">
        <span className="text-xs font-semibold text-text-primary">{title}</span>
        {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export type ScoreboardActionVariant = "primary" | "secondary" | "warning" | "danger";

/**
 * Shared team column layout for all sport scoreboards so team name, sub-label,
 * score typography, and bottom stat pills align identically across sports.
 */
export function ScoreboardTeamColumn({
  teamName,
  subLabel,
  score,
  pills,
}: {
  teamName: string;
  subLabel: React.ReactNode;
  score: React.ReactNode;
  pills?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-between text-center min-w-0 w-full h-full flex-1">
      <div className="flex flex-col items-center my-auto w-full min-w-0">
        <h2 className="text-base md:text-xl compact:text-sm font-semibold text-text-primary truncate max-w-[240px] mb-1 compact:mb-0.5 px-1">
          {teamName}
        </h2>

        <div className="h-6 compact:h-5 flex items-center justify-center mb-2 compact:mb-1">
          {subLabel}
        </div>

        <div className="text-7xl md:text-9xl compact:text-5xl landscape-compact:text-7xl font-digital text-text-primary tracking-wider my-1.5 compact:my-0.5 select-none">
          {score}
        </div>
      </div>

      {pills && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs compact:text-[11px] pt-2 compact:pt-1 mt-auto">
          {pills}
        </div>
      )}
    </div>
  );
}

/**
 * Shared action button for all sport scoreboards so sizing, typography, and
 * primary/secondary semantics stay uniform across sports and viewports.
 */
export function ScoreboardActionButton({
  variant = "secondary",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ScoreboardActionVariant;
}) {
  const variantClasses: Record<ScoreboardActionVariant, string> = {
    primary:
      "bg-text-primary hover:opacity-90 text-surface-container-lowest shadow-sm",
    secondary:
      "bg-surface-container-high hover:bg-surface-container-highest text-text-secondary hover:text-text-primary border border-outline-variant",
    warning:
      "bg-surface-container-high hover:bg-amber-500/20 text-amber-300 border border-outline-variant",
    danger:
      "bg-surface-container-high hover:bg-rose-500/20 text-rose-300 border border-outline-variant",
  };

  return (
    <button
      type="button"
      className={`h-8 landscape-compact:w-10 landscape-compact:h-10 landscape-compact:flex-none px-2.5 landscape-compact:p-0 rounded-lg text-xs landscape-compact:text-[10px] font-medium flex landscape-compact:flex-col items-center justify-center gap-1 landscape-compact:gap-0 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap overflow-hidden shrink-0 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Shared finalize match button at the bottom of the scoreboard.
 */
export function ScoreboardFinalizeButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="w-full flex compact:hidden justify-end">
      <button
        type="button"
        onClick={onClick}
        className="bg-surface-container hover:bg-error/10 text-text-secondary hover:text-error border border-outline-variant hover:border-error/30 px-4 py-2 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">check_circle</span>
        {label}
      </button>
    </div>
  );
}
