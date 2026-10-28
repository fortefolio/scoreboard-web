/**
 * Utilities for formatting player and team display names.
 * When names are too long (e.g. doubles pairs in padel, beach volleyball, or tennis),
 * first names are abbreviated to their initial (e.g. "Arturo Coello" -> "A. Coello").
 */

/**
 * Abbreviates the first name of a person to an initial.
 * e.g. "Arturo Coello" -> "A. Coello"
 * e.g. "Federico Chingotto" -> "F. Chingotto"
 * Preserves team acronyms like "SL Benfica", "FC Porto", "VC Viana".
 */
export function formatSinglePlayerName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  // Extract country/nationality or affiliation suffix in parentheses or brackets, e.g. "(BRA)", "[USA]"
  let suffix = "";
  let baseName = trimmed;
  const countryMatch = trimmed.match(/\s*(\([A-Za-z0-9\s-]+\)|\[[A-Za-z0-9\s-]+\])$/);
  if (countryMatch && countryMatch.index !== undefined) {
    suffix = " " + countryMatch[1].trim();
    baseName = trimmed.slice(0, countryMatch.index).trim();
  }

  const words = baseName.split(/\s+/);
  // If only 1 name (e.g. "Duda", "Hughes", "Cheng"), do not abbreviate
  if (words.length < 2) return baseName + suffix;

  const firstWord = words[0];
  // Preserve already abbreviated names ("A.", "J.") or team acronyms ("SL", "FC", "VC", "CD")
  if (
    firstWord.endsWith(".") ||
    (firstWord.length <= 3 && firstWord === firstWord.toUpperCase() && !firstWord.includes("-"))
  ) {
    return baseName + suffix;
  }

  const initial = firstWord.charAt(0).toUpperCase();
  const rest = words.slice(1).join(" ");
  return `${initial}. ${rest}${suffix}`;
}

/**
 * Formats a player or team name.
 * If the name is a doubles pair (contains "/" or "&") or exceeds `maxLength`,
 * the first name(s) are abbreviated:
 * e.g. "Arturo Coello / Agustín Tapia" -> "A. Coello / A. Tapia"
 * e.g. "Alejandro Galán / Federico Chingotto" -> "A. Galán / F. Chingotto"
 * e.g. "Federico Chingotto" (if > maxLength) -> "F. Chingotto"
 */
export function formatTeamOrPlayerName(name?: string | null, maxLength = 16): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  // Doubles / Pairs (separated by "/" or "&")
  if (trimmed.includes("/")) {
    return trimmed
      .split("/")
      .map((part) => formatSinglePlayerName(part))
      .join(" / ");
  }

  if (trimmed.includes("&")) {
    return trimmed
      .split("&")
      .map((part) => formatSinglePlayerName(part))
      .join(" & ");
  }

  // Single player / team longer than threshold
  if (trimmed.length > maxLength) {
    return formatSinglePlayerName(trimmed);
  }

  return trimmed;
}

/**
 * Formats a string containing " vs " or " vs. " or " VS ",
 * abbreviating player names on both sides.
 * e.g. "Arturo Coello / Agustín Tapia vs Alejandro Galán / Federico Chingotto"
 *   -> "A. Coello / A. Tapia vs A. Galán / F. Chingotto"
 */
export function formatVersusTitle(title?: string | null): string {
  if (!title) return "";
  const trimmed = title.trim();
  if (!trimmed) return "";

  // Check if title has " vs " or " vs. " or " x " (case-insensitive)
  const vsMatch = trimmed.match(/\s+(vs\.?|x)\s+/i);
  if (vsMatch && vsMatch.index !== undefined) {
    const separator = vsMatch[0];
    const left = trimmed.slice(0, vsMatch.index);
    const right = trimmed.slice(vsMatch.index + separator.length);
    return `${formatTeamOrPlayerName(left)}${separator}${formatTeamOrPlayerName(right)}`;
  }

  return formatTeamOrPlayerName(trimmed);
}
