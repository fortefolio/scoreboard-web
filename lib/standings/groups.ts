export interface GroupMatch {
  group_label: string | null;
  status: string;
  participants: ({ name: string } | null | undefined)[];
  scores: { sets?: number[] } | null;
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

      const sets = match.scores.sets ?? [0, 0];
      const own = sets[idx] ?? 0;
      const opp = sets[idx === 0 ? 1 : 0] ?? 0;

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
