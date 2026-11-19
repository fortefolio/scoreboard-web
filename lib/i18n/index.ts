import { findSport } from "@/lib/sports";

export * from "./LanguageContext";
export * from "./types";

export const getSportTranslation = (
  sport?: string | null,
  t?: (key: string, p?: any) => string
): string => {
  if (!sport) return "";
  if (!t) return sport;
  const matched = findSport(sport);
  if (matched) {
    return t(`sports.${matched.i18nKey}`);
  }
  return sport;
};
