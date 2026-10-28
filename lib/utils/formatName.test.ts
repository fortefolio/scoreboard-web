import { describe, expect, it } from "vitest";
import { formatSinglePlayerName, formatTeamOrPlayerName, formatVersusTitle } from "./formatName";

describe("formatSinglePlayerName", () => {
  it("abbreviates first name to initial with dot", () => {
    expect(formatSinglePlayerName("Arturo Coello")).toBe("A. Coello");
    expect(formatSinglePlayerName("Federico Chingotto")).toBe("F. Chingotto");
    expect(formatSinglePlayerName("Alejandro Galán")).toBe("A. Galán");
    expect(formatSinglePlayerName("Agustín Tapia")).toBe("A. Tapia");
  });

  it("handles multi-word last names correctly", () => {
    expect(formatSinglePlayerName("Alejandro Davidovich Fokina")).toBe("A. Davidovich Fokina");
  });

  it("preserves single-word names and acronyms", () => {
    expect(formatSinglePlayerName("Benfica")).toBe("Benfica");
    expect(formatSinglePlayerName("SL Benfica")).toBe("SL Benfica");
    expect(formatSinglePlayerName("FC Porto")).toBe("FC Porto");
    expect(formatSinglePlayerName("VC Viana")).toBe("VC Viana");
    expect(formatSinglePlayerName("Duda (BRA)")).toBe("Duda (BRA)");
    expect(formatSinglePlayerName("Cheng (USA)")).toBe("Cheng (USA)");
  });

  it("handles country codes with multi-word names", () => {
    expect(formatSinglePlayerName("Ana Patrícia (BRA)")).toBe("A. Patrícia (BRA)");
  });

  it("preserves already abbreviated names", () => {
    expect(formatSinglePlayerName("A. Coello")).toBe("A. Coello");
  });
});

describe("formatTeamOrPlayerName", () => {
  it("formats doubles pairs with slash (/) by abbreviating both first names", () => {
    expect(
      formatTeamOrPlayerName("Arturo Coello / Agustín Tapia")
    ).toBe("A. Coello / A. Tapia");

    expect(
      formatTeamOrPlayerName("Alejandro Galán / Federico Chingotto")
    ).toBe("A. Galán / F. Chingotto");
  });

  it("handles doubles pairs with country abbreviations and single-word names", () => {
    expect(
      formatTeamOrPlayerName("Ana Patrícia / Duda (BRA)")
    ).toBe("A. Patrícia / Duda (BRA)");

    expect(
      formatTeamOrPlayerName("Hughes / Cheng (USA)")
    ).toBe("Hughes / Cheng (USA)");
  });

  it("formats doubles pairs with ampersand (&)", () => {
    expect(
      formatTeamOrPlayerName("Arturo Coello & Agustín Tapia")
    ).toBe("A. Coello & A. Tapia");
  });

  it("abbreviates long individual names exceeding maxLength", () => {
    expect(formatTeamOrPlayerName("Federico Chingotto", 16)).toBe("F. Chingotto");
    expect(formatTeamOrPlayerName("Alejandro Galán", 14)).toBe("A. Galán");
  });

  it("keeps short individual names intact if within maxLength", () => {
    expect(formatTeamOrPlayerName("Rafael Nadal", 16)).toBe("Rafael Nadal");
    expect(formatTeamOrPlayerName("Carlos Alcaraz", 16)).toBe("Carlos Alcaraz");
  });

  it("handles empty or null gracefully", () => {
    expect(formatTeamOrPlayerName("")).toBe("");
    expect(formatTeamOrPlayerName(null)).toBe("");
    expect(formatTeamOrPlayerName(undefined)).toBe("");
  });
});

describe("formatVersusTitle", () => {
  it("formats notification and browser titles with 'vs'", () => {
    expect(
      formatVersusTitle("Arturo Coello / Agustín Tapia vs Alejandro Galán / Federico Chingotto")
    ).toBe("A. Coello / A. Tapia vs A. Galán / F. Chingotto");
  });

  it("handles single-player vs matchups", () => {
    expect(
      formatVersusTitle("Carlos Alcaraz vs Novak Djokovic")
    ).toBe("Carlos Alcaraz vs Novak Djokovic");

    expect(
      formatVersusTitle("Alejandro Davidovich Fokina vs Federico Chingotto")
    ).toBe("A. Davidovich Fokina vs F. Chingotto");
  });

  it("handles uppercase VS", () => {
    expect(
      formatVersusTitle("Arturo Coello / Agustín Tapia VS Alejandro Galán / Federico Chingotto")
    ).toBe("A. Coello / A. Tapia VS A. Galán / F. Chingotto");
  });
});
