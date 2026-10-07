// F1 — mutation testing. Break one rule at a time, confirm the suite goes red, restore, and prove the
// file is byte-identical again. Any mutation that leaves the suite green is a missing test: the script
// exits non-zero so it can't be waved through.
//   npx tsx scripts/pressure-test/mutate.ts
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface Mutation {
  name: string;
  file: string;
  find: string;
  replace: string;
}

const MUTATIONS: Mutation[] = [
  { name: "points tally: a halve counts as 1", file: "engine/src/matchState.ts", find: "points = { a: 0.5, b: 0.5 };", replace: "points = { a: 1, b: 1 };" },
  { name: "possible points hardcoded to 24", file: "engine/src/cup.ts", find: "const possiblePoints = countedMatches.length * 3;", replace: "const possiblePoints = 24;" },
  {
    name: "tiebreak order: holes won before points",
    file: "engine/src/standings.ts",
    find: "let groups = splitByValue(teamIds, (id) => totalsById.get(id)!.points);",
    replace: "let groups = splitByValue(teamIds, (id) => totalsById.get(id)!.holesWon);",
  },
  {
    name: "chip-off auto-resolves instead of flagging",
    file: "engine/src/cup.ts",
    find: "const winner: \"A\" | \"B\" | null = final ? (leader ?? input.chipOffWinner) : null;",
    replace: "const winner: \"A\" | \"B\" | null = final ? (leader ?? input.chipOffWinner ?? \"A\") : null;",
  },
  { name: "chip-off never flagged", file: "engine/src/cup.ts", find: "chipOffRequired = final && input.chipOffWinner === null;", replace: "chipOffRequired = false;" },
  { name: "shortened event counts the partial round", file: "engine/src/shortenedEvent.ts", find: "if (!round.complete) break;", replace: "if (false) break;" },
  {
    name: "projection mixed into official points",
    file: "engine/src/cup.ts",
    find: "official: { ...standings.official },",
    replace: "official: { a: standings.official.a + extra.a, b: standings.official.b + extra.b },",
  },
  { name: "mercy cap removed", file: "engine/src/mercyCap.ts", find: "return Math.min(strokes, par + 2);", replace: "return strokes;" },
  { name: "engine comparison flipped (higher wins)", file: "engine/src/matchState.ts", find: "if (a < b) return \"A\";", replace: "if (a > b) return \"A\";" },
  {
    name: "perspective tile flipped (W/L swapped)",
    file: "engine/src/holeView.ts",
    find: "return winner === mySide ? { label: \"W\", tone: \"win\" } : { label: \"L\", tone: \"loss\" };",
    replace: "return winner === mySide ? { label: \"L\", tone: \"loss\" } : { label: \"W\", tone: \"win\" };",
  },
  { name: "QA scope filter removed (QA rows leak into real reads)", file: "lib/scope.ts", find: "return query.eq(\"is_test\", scope === \"qa\") as Q;", replace: "return query as Q;" },
  // extras beyond the brief's list
  { name: "chip-off guard always allows recording", file: "engine/src/cup.ts", find: "return c.chipOffRequired\n    ? { ok: true, message: null }", replace: "return true\n    ? { ok: true, message: null }" },
  { name: "points to win off by half (12 instead of 12.5)", file: "engine/src/cup.ts", find: "possiblePoints / 2 + 0.5 : null;", replace: "possiblePoints / 2 : null;" },
  { name: "clinch claimed while a round is unpaired", file: "engine/src/cup.ts", find: "const targetKnown = !pairingsPending || input.eventShortened;", replace: "const targetKnown = true;" },
  { name: "recorded chip-off winner ignored", file: "engine/src/cup.ts", find: "(leader ?? input.chipOffWinner)", replace: "leader" },
  { name: "round 'complete' when only SOME matches are decided", file: "engine/src/shortenedEvent.ts", find: "matchStates.every(isMatchDecided)", replace: "matchStates.some(isMatchDecided)" },
  {
    name: "projection: a segment that is up projects as a halve",
    file: "engine/src/cup.ts",
    find: "if (seg.holesUp > 0) return { a: 1, b: 0 };",
    replace: "if (seg.holesUp > 0) return { a: 0.5, b: 0.5 };",
  },
  {
    name: "viewer side inverted",
    file: "engine/src/holeView.ts",
    find: "duoAPlayerIds.includes(playerId) ? \"A\" : \"B\"",
    replace: "duoAPlayerIds.includes(playerId) ? \"B\" : \"A\"",
  },
];

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

function runSuite(): { failed: number; total: number } {
  const out = path.join(os.tmpdir(), `vitest-mutate-${process.pid}.json`);
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`], { stdio: "ignore" });
  } catch {
    /* a failing suite exits non-zero — that is what we want to see */
  }
  const json = JSON.parse(fs.readFileSync(out, "utf8"));
  fs.rmSync(out, { force: true });
  return { failed: json.numFailedTests as number, total: json.numTotalTests as number };
}

const baseline = runSuite();
console.log(`baseline: ${baseline.total - baseline.failed}/${baseline.total} passing`);
if (baseline.failed > 0) {
  console.error("Baseline suite is red — fix it before mutation testing.");
  process.exit(2);
}

const rows: { name: string; failing: number; restored: boolean; killed: boolean }[] = [];
for (const m of MUTATIONS) {
  const original = fs.readFileSync(m.file, "utf8");
  const occurrences = original.split(m.find).length - 1;
  if (occurrences !== 1) {
    console.error(`SETUP ERROR: "${m.name}" expected 1 match of its find string in ${m.file}, found ${occurrences}`);
    process.exit(2);
  }
  fs.writeFileSync(m.file, original.replace(m.find, m.replace));
  let result: { failed: number; total: number };
  try {
    result = runSuite();
  } finally {
    fs.writeFileSync(m.file, original); // always restore, even if the run blew up
  }
  const restored = sha(fs.readFileSync(m.file, "utf8")) === sha(original);
  rows.push({ name: m.name, failing: result.failed, restored, killed: result.failed > 0 });
}

const after = runSuite();
console.log("");
console.log("| # | Mutation | Failing tests | Killed | File restored |");
console.log("|---|---|---|---|---|");
rows.forEach((r, i) => console.log(`| ${i + 1} | ${r.name} | ${r.failing} | ${r.killed ? "yes" : "NO — SURVIVED"} | ${r.restored ? "yes" : "NO"} |`));
console.log("");
console.log(`after restore: ${after.total - after.failed}/${after.total} passing`);

const survived = rows.filter((r) => !r.killed);
const unrestored = rows.filter((r) => !r.restored);
if (survived.length || unrestored.length || after.failed > 0) {
  if (survived.length) console.error(`SURVIVED (add a test): ${survived.map((r) => r.name).join("; ")}`);
  if (unrestored.length) console.error(`NOT RESTORED: ${unrestored.map((r) => r.name).join("; ")}`);
  process.exit(1);
}
console.log("All mutations killed; every file restored byte-for-byte.");
