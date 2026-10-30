import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("i18n Translation Consistency (Web vs Mobile)", () => {
  const currentDir = process.cwd();
  const webI18nDir = path.join(currentDir, "lib", "i18n");
  const mobileI18nDir = path.resolve(currentDir, "..", "scoreboard-mobile", "src", "lib", "i18n");

  const filesToVerify = [
    "types.ts",
    path.join("locales", "en.ts"),
    path.join("locales", "pt.ts"),
  ];

  it("ensures mobile translation dictionaries match web canonical source exactly", () => {
    // If mobile repo is not checked out (e.g. isolated web CI runner), skip test
    if (!fs.existsSync(mobileI18nDir)) {
      expect(true).toBe(true);
      return;
    }

    for (const relFile of filesToVerify) {
      const webPath = path.join(webI18nDir, relFile);
      const mobilePath = path.join(mobileI18nDir, relFile);

      expect(
        fs.existsSync(webPath),
        `Canonical web translation file missing: ${webPath}`
      ).toBe(true);

      expect(
        fs.existsSync(mobilePath),
        `Mobile translation file missing: ${mobilePath}. Run 'npm run sync:i18n' to sync.`
      ).toBe(true);

      const webContent = fs.readFileSync(webPath, "utf8").trim();
      const mobileContent = fs.readFileSync(mobilePath, "utf8").trim();

      expect(
        mobileContent,
        `Translation drift detected in ${relFile}! Run 'npm run sync:i18n' in scoreboard-web or scoreboard-mobile to align.`
      ).toBe(webContent);
    }
  });
});
