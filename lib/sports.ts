import type { Translations } from "@/lib/i18n/types";

export interface SportDefinition {
  /** Canonical sport_type value stored in Supabase (matches & tournaments). */
  value: "Basketball" | "Beach Volleyball" | "Football" | "Padel" | "Tennis" | "Volleyball";
  /** Lowercase snake_case slug used for background assets and user preferences. */
  slug: "basketball" | "beach_volleyball" | "football" | "padel" | "tennis" | "volleyball";
  /** Key under `t("sports.<key>")`. */
  i18nKey: Exclude<keyof Translations["sports"], "all">;
}

/**
 * Single source of truth for all supported sports, ordered alphabetically.
 */
export const SUPPORTED_SPORTS: readonly SportDefinition[] = [
  { value: "Basketball", slug: "basketball", i18nKey: "basketball" },
  { value: "Beach Volleyball", slug: "beach_volleyball", i18nKey: "beachVolleyball" },
  { value: "Football", slug: "football", i18nKey: "football" },
  { value: "Padel", slug: "padel", i18nKey: "padel" },
  { value: "Tennis", slug: "tennis", i18nKey: "tennis" },
  { value: "Volleyball", slug: "volleyball", i18nKey: "volleyball" },
] as const;

export type SportValue = (typeof SUPPORTED_SPORTS)[number]["value"];
export type SportSlug = (typeof SUPPORTED_SPORTS)[number]["slug"];

export const SUPPORTED_SPORT_VALUES: SportValue[] = SUPPORTED_SPORTS.map((s) => s.value);
export const SUPPORTED_SPORT_SLUGS: SportSlug[] = SUPPORTED_SPORTS.map((s) => s.slug);

export function findSport(input?: string | null): SportDefinition | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toLowerCase().replace(/\s+/g, "_");
  return SUPPORTED_SPORTS.find(
    (s) => s.slug === normalized || s.value.toLowerCase() === input.trim().toLowerCase()
  );
}

/**
 * Normalizes a free-form sport label into a canonical background asset slug.
 */
export function normalizeSportType(sport?: string | null): SportSlug {
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

  return "tennis";
}

export function normalizeSportSlug(input?: string | null): SportSlug {
  const matched = findSport(input);
  if (matched) return matched.slug;
  const lower = (input ?? "").toLowerCase();
  if (lower.includes("beach")) return "beach_volleyball";
  if (lower.includes("volley")) return "volleyball";
  if (lower.includes("padel")) return "padel";
  if (lower.includes("tennis")) return "tennis";
  if (lower.includes("basket")) return "basketball";
  return "football";
}

export function getDefaultTournamentRules(sport: string): {
  max_sets?: number;
  points_per_set?: number;
  no_ad?: boolean;
  period_duration?: number;
} {
  switch (findSport(sport)?.value ?? sport) {
    case "Tennis":
      return { max_sets: 3, points_per_set: 6 };
    case "Volleyball":
      return { max_sets: 5, points_per_set: 25 };
    case "Beach Volleyball":
      return { max_sets: 3, points_per_set: 21 };
    case "Padel":
      return { max_sets: 3, points_per_set: 6, no_ad: true };
    case "Football":
      return { period_duration: 45 };
    case "Basketball":
      return { period_duration: 10 };
    default:
      return {};
  }
}
