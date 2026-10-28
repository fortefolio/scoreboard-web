export * from "./LanguageContext";
export * from "./types";

export const getSportTranslation = (
  sport?: string | null,
  t?: (key: string, p?: any) => string
): string => {
  if (!sport) return "";
  if (!t) return sport;
  const normalized = sport.trim();
  switch (normalized) {
    case "Basketball":
      return t("sports.basketball");
    case "Volleyball":
      return t("sports.volleyball");
    case "Beach Volleyball":
    case "beach_volleyball":
    case "Beach volleyball":
      return t("sports.beachVolleyball");
    case "Football":
      return t("sports.football");
    case "Tennis":
      return t("sports.tennis");
    case "Padel":
      return t("sports.padel");
    default:
      return sport;
  }
};
