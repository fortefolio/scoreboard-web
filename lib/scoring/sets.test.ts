import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { countSetsWon } from "./sets";

describe("countSetsWon — boundaries", () => {
  it("returns 0 for null / undefined / non-array input", () => {
    expect(countSetsWon(null, 0)).toBe(0);
    expect(countSetsWon(undefined, 0)).toBe(0);
    // typed as SetsData on purpose; runtime guard handles unexpected shapes
    expect(countSetsWon([] as never, 0)).toBe(0);
  });

  it("returns 0 for an empty array", () => {
    expect(countSetsWon([], 0)).toBe(0);
    expect(countSetsWon([], 1)).toBe(0);
  });

  it("reads numeric-tally format directly", () => {
    expect(countSetsWon([2, 1], 0)).toBe(2);
    expect(countSetsWon([2, 1], 1)).toBe(1);
    expect(countSetsWon([0, 0], 0)).toBe(0);
  });

  it("counts wins from per-set scores using team1/team2 keys", () => {
    const sets = [
      { team1: 6, team2: 4 },
      { team1: 3, team2: 6 },
      { team1: 7, team2: 5 },
    ];
    expect(countSetsWon(sets, 0)).toBe(2);
    expect(countSetsWon(sets, 1)).toBe(1);
  });

  it("falls back to home/away keys when team1/team2 missing", () => {
    const sets = [
      { home: 6, away: 4 },
      { home: 6, away: 3 },
    ];
    expect(countSetsWon(sets, 0)).toBe(2);
    expect(countSetsWon(sets, 1)).toBe(0);
  });

  it("does not count tied sets toward either side", () => {
    // Tied set is unusual but shouldn't credit a win to either side.
    expect(countSetsWon([{ team1: 5, team2: 5 }], 0)).toBe(0);
    expect(countSetsWon([{ team1: 5, team2: 5 }], 1)).toBe(0);
  });

  it("treats missing per-set keys as 0 (defensive)", () => {
    expect(countSetsWon([{ team1: 1 }], 0)).toBe(1);
    expect(countSetsWon([{ team1: 1 }], 1)).toBe(0);
  });

  it("returns 0 when numeric-tally is missing the side's index", () => {
    // Only one entry — asking for side 1 should be 0, not undefined or NaN.
    expect(countSetsWon([3], 1)).toBe(0);
  });
});

describe("countSetsWon — invariants (property-based)", () => {
  const arbPerSet = fc.record({
    team1: fc.integer({ min: 0, max: 7 }),
    team2: fc.integer({ min: 0, max: 7 }),
  });

  it("per-set: sum across both sides ≤ total sets played (ties don't count)", () => {
    fc.assert(
      fc.property(fc.array(arbPerSet, { maxLength: 5 }), sets => {
        const home = countSetsWon(sets, 0);
        const away = countSetsWon(sets, 1);
        expect(home + away).toBeLessThanOrEqual(sets.length);
      })
    );
  });

  it("per-set: sum across both sides equals total sets played when there are no ties", () => {
    const arbNoTie = arbPerSet.filter(s => s.team1 !== s.team2);
    fc.assert(
      fc.property(fc.array(arbNoTie, { maxLength: 5 }), sets => {
        expect(countSetsWon(sets, 0) + countSetsWon(sets, 1)).toBe(sets.length);
      })
    );
  });

  it("numeric-tally: result equals the indexed value", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 10 })),
        ([home, away]) => {
          expect(countSetsWon([home, away], 0)).toBe(home);
          expect(countSetsWon([home, away], 1)).toBe(away);
        }
      )
    );
  });

  it("result is non-negative", () => {
    fc.assert(
      fc.property(fc.array(arbPerSet, { maxLength: 5 }), sets => {
        expect(countSetsWon(sets, 0)).toBeGreaterThanOrEqual(0);
        expect(countSetsWon(sets, 1)).toBeGreaterThanOrEqual(0);
      })
    );
  });
});
