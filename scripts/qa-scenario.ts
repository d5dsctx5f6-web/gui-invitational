// Load a QA scenario from the terminal (QA season only; never touches 2027).
//   npx tsx scripts/qa-scenario.ts <1-6> [scramble|best_ball]      load scenario N (round 2 format optional)
//   npx tsx scripts/qa-scenario.ts reset [scramble|best_ball]      seed the full trip with no scores
// Reads .env.local; the service-role key is used but never printed.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { loadScenario, seedFullTrip } from "../lib/qaTrip";

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const [which, formatArg] = process.argv.slice(2);
  const format = formatArg === "best_ball" ? "best_ball" : "scramble";
  const e = env();
  const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (which === "reset") {
    await seedFullTrip(admin, format);
    console.log(`QA full trip seeded (round 2: ${format}), no scores`);
    return;
  }
  const result = await loadScenario(admin, Number(which), format);
  console.log(`Loaded: ${result.scenario} — ${result.scoreRows} score rows (round 2: ${result.round2Format})`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
