export type PerSetScore = {
  team1?: number;
  team2?: number;
  home?: number;
  away?: number;
};

export type SetsData = number[] | PerSetScore[] | null | undefined;

export function countSetsWon(setsData: SetsData, sideIdx: 0 | 1): number {
  if (!Array.isArray(setsData) || setsData.length === 0) return 0;

  if (typeof setsData[0] === "number") {
    return (setsData as number[])[sideIdx] ?? 0;
  }

  return (setsData as PerSetScore[]).reduce((acc, set) => {
    const s1 = set.team1 ?? set.home ?? 0;
    const s2 = set.team2 ?? set.away ?? 0;
    if (sideIdx === 0 && s1 > s2) return acc + 1;
    if (sideIdx === 1 && s2 > s1) return acc + 1;
    return acc;
  }, 0);
}
