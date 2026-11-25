"use client";

import { useEffect } from "react";

const MATERIAL_SYMBOLS_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";

/**
 * Loads the Material Symbols icon stylesheet after hydration so it never render-blocks FCP or LCP.
 */
export default function NonBlockingIconFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${MATERIAL_SYMBOLS_HREF}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MATERIAL_SYMBOLS_HREF;
    document.head.appendChild(link);
  }, []);

  return null;
}
