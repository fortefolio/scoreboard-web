"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function MyWorkspaceTabs({ active }: { active: "matches" | "tournaments" }) {
  const { t } = useTranslation();

  const tabs = [
    { key: "matches" as const, href: "/my-matches", label: t("nav.myMatches") },
    { key: "tournaments" as const, href: "/my-tournaments", label: t("nav.myTournaments") },
  ];

  return (
    <nav
      aria-label="Workspace navigation"
      className="inline-flex items-center gap-1 bg-surface-container-high/50 p-1 rounded-xl border border-outline-variant mb-6"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? "bg-surface-container-highest text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
