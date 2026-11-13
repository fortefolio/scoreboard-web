"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function Footer() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [currentYear, setCurrentYear] = useState(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Hide footer on transparent live broadcast overlays
  if (pathname?.includes("/overlay") || pathname?.includes("/scoreboard")) {
    return null;
  }

  return (
    <footer className="w-full mt-auto border-t border-outline-variant bg-surface-container-lowest/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand & Subtitle */}
          <div className="flex flex-col items-center md:items-start gap-1.5 text-center md:text-left">
            <Link
              href="/"
              className="font-label text-sm font-black tracking-widest text-text-primary uppercase hover:opacity-80 transition-opacity"
            >
              ScoreBoard
            </Link>
            <p className="text-xs text-text-muted max-w-sm">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Quick Nav Links */}
          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center justify-center gap-6 text-xs text-text-secondary">
            <Link
              href="/"
              className="hover:text-text-primary transition-colors"
            >
              {t("footer.matches")}
            </Link>
            <Link
              href="/?tab=tournaments"
              className="hover:text-text-primary transition-colors"
            >
              {t("footer.tournaments")}
            </Link>
            <Link
              href="/terms"
              className="hover:text-text-primary transition-colors"
            >
              {t("footer.terms")}
            </Link>
            <Link
              href="/settings"
              className="hover:text-text-primary transition-colors"
            >
              {t("footer.settings")}
            </Link>
          </nav>

          {/* Copyright */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right">
            <p className="font-mono text-[11px] text-text-tertiary">
              © {currentYear} ScoreBoard · {t("footer.allRightsReserved")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
