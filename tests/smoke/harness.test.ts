import { describe, expect, it } from "vitest";

describe("vitest harness", () => {
  it("runs pure-logic tests", () => {
    expect(1 + 1).toBe(2);
  });
});
