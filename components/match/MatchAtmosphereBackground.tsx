"use client";

import React from "react";
import Image from "next/image";
import { useScreenOrientation, ScreenOrientation } from "@/lib/hooks/useScreenOrientation";

export type SportType =
  | "football"
  | "tennis"
  | "beach_volleyball"
  | "volleyball"
  | "basketball"
  | "padel";

export interface MatchAtmosphereBackgroundProps {
  sportType?: string | null;
  mode?: "spectator" | "umpire";
  forcedOrientation?: ScreenOrientation;
  children?: React.ReactNode;
  className?: string;
}

export function normalizeSportType(sport?: string | null): SportType {
  const s = (sport || "").toLowerCase().trim();

  if (s.includes("padel")) return "padel";
  if (
    s.includes("beach volleyball") ||
    s.includes("beach_volleyball") ||
    s.includes("beachvolleyball")
  ) {
    return "beach_volleyball";
  }
  if (s.includes("volleyball")) return "volleyball";
  if (s.includes("basketball") || s.includes("basket")) return "basketball";
  if (s.includes("football") || s.includes("soccer") || s.includes("futebol")) {
    return "football";
  }
  if (s.includes("tennis") || s.includes("ténis")) return "tennis";

  return "tennis"; // Universal clean fallback
}

function MatchAtmosphereBackgroundComponent({
  sportType,
  mode = "spectator",
  forcedOrientation,
  children,
  className = "",
}: MatchAtmosphereBackgroundProps) {
  const detectedOrientation = useScreenOrientation();
  const orientation = forcedOrientation || detectedOrientation;
  const normalizedSport = normalizeSportType(sportType);

  const imageSrc = `/backgrounds/${normalizedSport}-${orientation}.webp`;
  const isUmpire = mode === "umpire";

  return (
    <>
      {/* Layer 1 & 2: Atmospheric Background (never blocks clicks/touches) */}
      <div
        data-testid="match-atmosphere-background"
        data-sport={normalizedSport}
        data-orientation={orientation}
        data-mode={mode}
        style={{
          transform: "translate3d(0, 0, 0)",
          WebkitTransform: "translate3d(0, 0, 0)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
        className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none ${className}`}
        aria-hidden="true"
      >
        {/* Layer 1: 3D Court Canvas */}
        <Image
          src={imageSrc}
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Layer 2a: Semi-transparent Occlusion Mask (No backdrop-blur to avoid scroll GPU invalidation) */}
        <div
          className={`absolute inset-0 ${
            isUmpire ? "bg-[#0b0d14]/85" : "bg-[#0b0d14]/75"
          }`}
        />

        {/* Layer 2b: Top & Bottom Vignette Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0d14]/90 via-transparent to-[#0b0d14]" />
      </div>

      {/* Layer 3: Interactive UI content */}
      {children}
    </>
  );
}

export default React.memo(MatchAtmosphereBackgroundComponent);
