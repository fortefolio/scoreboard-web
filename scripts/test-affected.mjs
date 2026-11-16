import { execSync, spawnSync } from "node:child_process";

const runGit = (cmd) =>
  execSync(cmd, { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

// 1. Prefer uncommitted working-tree changes (staged, unstaged, untracked)
let changedFiles = [
  ...new Set([
    ...runGit("git diff --name-only HEAD"),
    ...runGit("git ls-files --others --exclude-standard"),
  ]),
];

// 2. If working tree is clean, compare current branch against main (or HEAD~1)
if (changedFiles.length === 0) {
  try {
    changedFiles = runGit("git diff --name-only main...HEAD");
  } catch {
    changedFiles = runGit("git diff --name-only HEAD~1..HEAD");
  }
}

const sourceFiles = changedFiles.filter((f) => /\.(ts|tsx|js|jsx|css)$/.test(f));

if (sourceFiles.length === 0) {
  console.log("No changed source files detected.");
  process.exit(0);
}

console.log(`Running tests related to ${sourceFiles.length} changed file(s):`);
for (const file of sourceFiles) {
  console.log(`  - ${file}`);
}

const result = spawnSync(
  "npx",
  ["vitest", "related", "--run", "--passWithNoTests", ...sourceFiles],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
