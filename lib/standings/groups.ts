import { countSetsWon, extractSetsData, type SetsData } from "@/lib/scoring/sets";

export interface GroupMatch {
  group_label: string | null;
  status: string;
  participants: ({ name: string } | null | undefined)[];
  scores: { sets?: SetsData; [key: string]: any } | null;
}

export interface Standing {
  group_label: string;
  team_name: string;
  played: number;
  wins: number;
  losses: number;
  total_sets_won: number;
  total_sets_lost: number;
  point_diff: number;
}

export function calculateStandings(matches: GroupMatch[]): Standing[] {
  const standings: Record<string, Standing> = {};

  for (const match of matches) {
    const groupLabel = match.group_label;
    if (!groupLabel) continue;

    match.participants.forEach((participant, idx) => {
      const name = participant?.name;
      if (!name) return;

      const key = `${groupLabel}-${name}`;
      if (!standings[key]) {
        standings[key] = {
          group_label: groupLabel,
          team_name: name,
          played: 0,
          wins: 0,
          losses: 0,
          total_sets_won: 0,
          total_sets_lost: 0,
          point_diff: 0,
        };
      }

      if (match.status !== "completed" || !match.scores) return;

      const rawSets = Array.isArray(match.scores.sets) && typeof match.scores.sets[0] === "number"
        ? match.scores.sets
        : extractSetsData(match.scores);
      const own = countSetsWon(rawSets, idx as 0 | 1);
      const opp = countSetsWon(rawSets, (idx === 0 ? 1 : 0) as 0 | 1);

      standings[key].played++;
      if (own > opp) standings[key].wins++;
      else standings[key].losses++;
      standings[key].total_sets_won += own;
      standings[key].total_sets_lost += opp;
      standings[key].point_diff = standings[key].total_sets_won - standings[key].total_sets_lost;
    });
  }

  return Object.values(standings);
}
