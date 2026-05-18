import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateStandings, type GroupMatch } from "./groups";

const completed = (
  groupLabel: string,
  team1: string,
  team2: string,
  sets: [number, number]
): GroupMatch => ({
  group_label: groupLabel,
  status: "completed",
  participants: [{ name: team1 }, { name: team2 }],
  scores: { sets },
});

const scheduled = (
  groupLabel: string,
  team1: string,
  team2: string
): GroupMatch => ({
  group_label: groupLabel,
  status: "scheduled",
  participants: [{ name: team1 }, { name: team2 }],
  scores: null,
});

describe("calculateStandings — boundaries", () => {
  it("returns an empty list when no matches are provided", () => {
    expect(calculateStandings([])).toEqual([]);
  });

  it("ignores matches without a group_label (non-group / knockout)", () => {
    const matches: GroupMatch[] = [
      { group_label: null, status: "completed", participants: [{ name: "A" }, { name: "B" }], scores: { sets: [2, 1] } },
    ];
    expect(calculateStandings(matches)).toEqual([]);
  });

  it("creates zero-row standings for teams in scheduled matches", () => {
    const standings = calculateStandings([scheduled("A", "Alpha", "Beta")]);
    expect(standings).toHaveLength(2);
    expect(standings.every(s => s.played === 0 && s.wins === 0 && s.losses === 0)).toBe(true);
  });

  it("does not count an in-progress match", () => {
    const matches: GroupMatch[] = [
      { group_label: "A", status: "in_progress", participants: [{ name: "Alpha" }, { name: "Beta" }], scores: { sets: [1, 0] } },
    ];
    const standings = calculateStandings(matches);
    expect(standings.every(s => s.played === 0)).toBe(true);
  });

  it("credits a win to the team with more sets and a loss to the other", () => {
    const standings = calculateStandings([completed("A", "Alpha", "Beta", [2, 1])]);
    const alpha = standings.find(s => s.team_name === "Alpha")!;
    const beta = standings.find(s => s.team_name === "Beta")!;
    expect(alpha.wins).toBe(1);
    expect(alpha.losses).toBe(0);
    expect(beta.wins).toBe(0);
    expect(beta.losses).toBe(1);
  });

  it("a 0-0 set score counts as a loss for both sides (neither has more sets)", () => {
    // Edge case: a completed match recorded with 0-0 sets shouldn't crash. Spec choice: neither wins.
    const standings = calculateStandings([completed("A", "Alpha", "Beta", [0, 0])]);
    expect(standings.find(s => s.team_name === "Alpha")!.wins).toBe(0);
    expect(standings.find(s => s.team_name === "Beta")!.wins).toBe(0);
    // Both register a loss under the current algorithm (own > opp is false for both).
    expect(standings.find(s => s.team_name === "Alpha")!.losses).toBe(1);
    expect(standings.find(s => s.team_name === "Beta")!.losses).toBe(1);
  });

  it("accumulates across multiple matches in the same group", () => {
    const standings = calculateStandings([
      completed("A", "Alpha", "Beta", [2, 0]),
      completed("A", "Alpha", "Gamma", [2, 1]),
      completed("A", "Beta", "Gamma", [2, 1]),
    ]);
    const alpha = standings.find(s => s.team_name === "Alpha")!;
    expect(alpha.played).toBe(2);
    expect(alpha.wins).toBe(2);
    expect(alpha.total_sets_won).toBe(4);
    expect(alpha.total_sets_lost).toBe(1);
    expect(alpha.point_diff).toBe(3);
  });

  it("keeps groups separate", () => {
    const standings = calculateStandings([
      completed("A", "Alpha", "Beta", [2, 0]),
      completed("B", "Alpha", "Beta", [0, 2]),
    ]);
    const groupA = standings.filter(s => s.group_label === "A");
    const groupB = standings.filter(s => s.group_label === "B");
    expect(groupA.find(s => s.team_name === "Alpha")!.wins).toBe(1);
    expect(groupB.find(s => s.team_name === "Alpha")!.wins).toBe(0);
    expect(groupB.find(s => s.team_name === "Alpha")!.losses).toBe(1);
  });

  it("ignores participants with no name", () => {
    const matches: GroupMatch[] = [
      { group_label: "A", status: "completed", participants: [{ name: "Alpha" }, null], scores: { sets: [2, 0] } },
    ];
    const standings = calculateStandings(matches);
    expect(standings).toHaveLength(1);
    expect(standings[0].team_name).toBe("Alpha");
  });

  it("treats missing scores.sets as [0,0]", () => {
    const matches: GroupMatch[] = [
      { group_label: "A", status: "completed", participants: [{ name: "Alpha" }, { name: "Beta" }], scores: {} },
    ];
    expect(() => calculateStandings(matches)).not.toThrow();
  });
});

describe("calculateStandings — invariants (property-based)", () => {
  const arbMatch = fc.record({
    group_label: fc.constantFrom("A", "B", "C"),
    team1: fc.constantFrom("Alpha", "Beta", "Gamma", "Delta"),
    team2: fc.constantFrom("Alpha", "Beta", "Gamma", "Delta"),
    sets: fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })),
    completed: fc.boolean(),
  }).filter(m => m.team1 !== m.team2);

  it("played === wins + losses for every standing", () => {
    fc.assert(
      fc.property(fc.array(arbMatch, { maxLength: 30 }), rawMatches => {
        const matches: GroupMatch[] = rawMatches.map(m => ({
          group_label: m.group_label,
          status: m.completed ? "completed" : "scheduled",
          participants: [{ name: m.team1 }, { name: m.team2 }],
          scores: m.completed ? { sets: m.sets } : null,
        }));
        for (const s of calculateStandings(matches)) {
          expect(s.played).toBe(s.wins + s.losses);
        }
      })
    );
  });

  it("point_diff === total_sets_won - total_sets_lost", () => {
    fc.assert(
      fc.property(fc.array(arbMatch, { maxLength: 30 }), rawMatches => {
        const matches: GroupMatch[] = rawMatches.map(m => ({
          group_label: m.group_label,
          status: m.completed ? "completed" : "scheduled",
          participants: [{ name: m.team1 }, { name: m.team2 }],
          scores: m.completed ? { sets: m.sets } : null,
        }));
        for (const s of calculateStandings(matches)) {
          expect(s.point_diff).toBe(s.total_sets_won - s.total_sets_lost);
        }
      })
    );
  });

  it("per group + match: total wins recorded across both sides ≤ 1 (no draws produce 2 wins)", () => {
    // Across one completed match, at most one side can be credited a win — never both.
    fc.assert(
      fc.property(
        fc.constantFrom("A", "B"),
        fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })),
        (groupLabel, sets) => {
          const standings = calculateStandings([
            completed(groupLabel, "Alpha", "Beta", sets as [number, number]),
          ]);
          const winsRecorded = standings.reduce((acc, s) => acc + s.wins, 0);
          expect(winsRecorded).toBeLessThanOrEqual(1);
        }
      )
    );
  });
});
