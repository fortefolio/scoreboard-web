"use client";

import { useEffect, useState } from "react";

export type ScreenOrientation = "portrait" | "landscape";

export function useScreenOrientation(): ScreenOrientation {
  const [orientation, setOrientation] = useState<ScreenOrientation>("portrait");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(orientation: landscape)");

    const updateOrientation = () => {
      // Check both mediaQuery and inner dimensions for reliability on all viewports/browsers
      const isLandscape =
        mediaQuery.matches || window.innerWidth > window.innerHeight;
      setOrientation(isLandscape ? "landscape" : "portrait");
    };

    // Initial check on mount
    updateOrientation();

    // Listen to media query changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateOrientation);
    } else {
      // Legacy fallback
      mediaQuery.addListener(updateOrientation);
    }

    // Also listen to window resize to catch responsive design toolbar toggles in DevTools
    window.addEventListener("resize", updateOrientation);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", updateOrientation);
      } else {
        mediaQuery.removeListener(updateOrientation);
      }
      window.removeEventListener("resize", updateOrientation);
    };
  }, []);

  return orientation;
}
