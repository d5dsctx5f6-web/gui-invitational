// F2 — live end-to-end pressure test against the REAL database, QA scope only.
//   npx tsx scripts/pressure-test/live.ts            (pages from http://localhost:3000, a dev or `next start` server)
//   BASE_URL=https://… npx tsx scripts/pressure-test/live.ts --no-admin-pages     (production: no passcode needed)
//
// Writes go through the SAME path the phones use: an anonymous Supabase session linked to a QA player,
// subject to RLS. The service role is used ONLY to seed/reset the QA season, to link QA devices, and to
// read counts for verification. Nothing here ever writes to a non-test season, and nothing is printed
// that could contain a key.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import {
  cupStandings,
  formatPoints,
  projectedStandings,
  QA_SCENARIOS,
  type RoundFormat,
} from "../../engine/src";
import { cupInputFrom, loadCupData } from "../../lib/cupData";
import { loadScenario, seedFullTrip } from "../../lib/qaTrip";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_PAGES = !process.argv.includes("--no-admin-pages");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fresh = () => createClient(url, anonKey, { auth: { persistSession: false } });

// ---- result table ---------------------------------------------------------------------------------
interface Row {
  id: string;
  check: string;
  pass: boolean;
  evidence: string;
}
const rows: Row[] = [];
function record(id: string, check: string, pass: boolean, evidence: string) {
  rows.push({ id, check, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${check}  —  ${evidence}`);
}

// ---- helpers --------------------------------------------------------------------------------------
async function device(playerName: string): Promise<{ client: SupabaseClient; playerId: string; userId: string }> {
  const client = fresh();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`anon sign-in failed: ${error?.message}`);
  const { data: player } = await admin.from("players").select("id, is_test").eq("name", playerName).eq("is_test", true).single();
  if (!player) throw new Error(`QA player not found: ${playerName}`);
  const { error: linkError } = await admin
    .from("player_devices")
    .upsert({ auth_user_id: data.user.id, player_id: player.id }, { onConflict: "auth_user_id" });
  if (linkError) throw new Error(linkError.message);
  return { client, playerId: player.id as string, userId: data.user.id };
}

function adminCookie(): string {
  // The same token isAdminAuthed() accepts (lib/auth/admin.ts): "<issuedAt>.<hmac-sha256(passcode, issuedAt)>".
  const issuedAt = Date.now();
  const sig = createHmac("sha256", env.ADMIN_PASSCODE).update(String(issuedAt)).digest("hex");
  return `gui_admin_session=${issuedAt}.${sig}`;
}

async function page(path: string, cookie?: string): Promise<{ status: number; text: string }> {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const html = await res.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  return { status: res.status, text };
}

async function qaIds() {
  const { data: season } = await admin.from("seasons").select("id").eq("year", 1900).eq("is_test", true).single();
  const { data: rounds } = await admin.from("rounds").select("id, round_number, format").eq("season_id", season!.id).order("round_number");
  return { seasonId: season!.id as string, rounds: rounds ?? [] };
}

async function count(table: string, roundIds: string[]) {
  const { count: c } = await admin.from(table).select("id", { count: "exact", head: true }).in("round_id", roundIds);
  return c ?? 0;
}

// ---- hand-written expected page text per scenario (independent of the engine's output) -------------
interface PageExpect {
  score: [string, string];
  /** Text both pages must show. */
  contains: string[];
  /** Page-specific wording (the TV board is deliberately terser than the phone leaderboard). */
  leaderboard?: string[];
  board?: string[];
}
const PAGE_EXPECT: Record<number, PageExpect> = {
  1: { score: ["15", "9"], contains: ["12½ to win", "24 of 24 points decided", "North Hedges win the Cup", "N wins 3–0", "S wins 3–0", "Halved 1½–1½"] },
  2: { score: ["12", "12"], contains: ["12½ to win", "24 of 24 points decided", "North Hedges win the Cup (on holes won)"] },
  3: { score: ["12", "12"], contains: ["12½ to win", "24 of 24 points decided", "Chip-off required"] },
  4: {
    score: ["7½", "4½"],
    contains: ["6½ to win", "12 of 12 points decided", "Shortened event — standings after Saturday", "North Hedges win the Cup — shortened event"],
    leaderboard: ["Not counted — the event was declared shortened"],
    board: ["not counted (shortened)"],
  },
  5: {
    score: ["12", "9"],
    contains: ["11 to win", "21 of 21 points decided", "North Hedges win the Cup"],
    leaderboard: ["9 of 9 points decided"],
    board: ["9 of 9 decided"],
  },
  6: { score: ["8½", "4½"], contains: ["12½ to win", "13 of 24 points decided", "If it ended now", "North 10½ – South 7½", "N 7 UP thru 7", "S 2 UP thru 3", "AS thru 4", "Not started"] },
};

async function scenarioChecks() {
  const anon = fresh(); // a signed-out reader, exactly what the TV board's server render uses
  const cookie = ADMIN_PAGES ? adminCookie() : undefined;
  for (const scenario of QA_SCENARIOS) {
    for (const format of ["scramble", "best_ball"] as RoundFormat[]) {
      const tag = `S${scenario.id}/${format === "best_ball" ? "BB" : "SC"}`;
      await loadScenario(admin, scenario.id, format);

      // (a) the live data path: read as a signed-out device through RLS, derive with the engine
      const data = await loadCupData(anon, "qa");
      const input = cupInputFrom(data);
      const c = cupStandings(input);
      const e = scenario.expected;
      const dataOk =
        c.official.a === e.official.a && c.official.b === e.official.b &&
        c.holesWon.a === e.holesWon.a && c.holesWon.b === e.holesWon.b &&
        c.possiblePoints === e.possiblePoints && c.pointsToWin === e.pointsToWin &&
        c.clinched === e.clinched && c.final === e.final && c.chipOffRequired === e.chipOffRequired &&
        c.winner === e.winner && c.banner === e.banner &&
        JSON.stringify(c.countedRoundNumbers) === JSON.stringify(e.countedRoundNumbers) &&
        (!e.projectedTotal || JSON.stringify(projectedStandings(input).projectedTotal) === JSON.stringify(e.projectedTotal));
      record(`F2.1 ${tag} data`, `live rows → engine equal the pinned result`, dataOk,
        `official ${formatPoints(c.official.a)}–${formatPoints(c.official.b)}, holes ${c.holesWon.a}–${c.holesWon.b}, possible ${c.possiblePoints}, banner ${c.banner ?? "none"}`);

      // (b) the rendered pages
      if (ADMIN_PAGES) {
        for (const path of ["/leaderboard?scope=qa", "/board?scope=qa"]) {
          const { status, text } = await page(path, cookie);
          const ex = PAGE_EXPECT[scenario.id];
          const scoreRe = /North Hedges\s+(\S+)\s+–\s+South Hedges\s+(\S+)/i;
          const m = text.match(scoreRe);
          const scoreOk = !!m && m[1] === ex.score[0] && m[2] === ex.score[1];
          const pageTokens = path.startsWith("/board") ? ex.board ?? [] : ex.leaderboard ?? [];
          const missing = [...ex.contains, ...pageTokens].filter((t) => !text.includes(t));
          record(`F2.1 ${tag} ${path.split("?")[0]}`, `rendered page matches the pinned result`, status === 200 && scoreOk && missing.length === 0,
            `HTTP ${status}, score ${m ? `${m[1]}–${m[2]}` : "not found"}${missing.length ? `, MISSING: ${missing.join(" | ")}` : ", all expected text present"}`);
        }
      }
    }
  }
}

async function chipOffRenderCheck() {
  if (!ADMIN_PAGES) return;
  await loadScenario(admin, 3, "scramble");
  const { seasonId } = await qaIds();
  const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", seasonId);
  const south = teams!.find((t) => t.name === "South Hedges")!.id;
  await admin.from("seasons").update({ chip_off_winner_team_id: south }).eq("id", seasonId).eq("is_test", true);
  const { text } = await page("/leaderboard?scope=qa", adminCookie());
  record("F2.1 S3 chip-off recorded", "a recorded chip-off winner replaces the banner with the winner",
    text.includes("South Hedges win the Cup (chip-off)") && !text.includes("Chip-off required —"), text.match(/South Hedges win the Cup[^.]{0,20}/)?.[0] ?? "winner text missing");
  await admin.from("seasons").update({ chip_off_winner_team_id: null }).eq("id", seasonId).eq("is_test", true);
}

async function permissionAttacks() {
  const trip = await seedFullTrip(admin, "scramble");
  const r1 = trip.rounds[0];
  const slot1 = trip.duos[1][1];
  const slot2 = trip.duos[1][2];
  const n1 = await device("QA North 1");
  const s1 = await device("QA South 1");
  const signedOut = fresh();

  // A1 another QA match
  let r = await n1.client.from("hole_scores").insert({ duo_id: slot2.north, round_id: r1.id, hole: 1, strokes: 4 });
  record("F2.2 A1", "QA player writes to ANOTHER QA match → denied", !!r.error && /row-level security/i.test(r.error.message), r.error?.message ?? "NOT DENIED");
  r = await n1.client.from("hole_scores").insert({ duo_id: slot2.south, round_id: r1.id, hole: 1, strokes: 4 });
  record("F2.2 A1b", "…and the other duo of that other match → denied", !!r.error, r.error?.message ?? "NOT DENIED");

  // A2 a 2027 duo — none exist (2027 has 0 duos and must not be written), so attack the rule itself
  const { data: gate } = await n1.client.rpc("can_score_duo", { p_duo_id: "00000000-0000-0000-0000-00000000dead" });
  r = await n1.client.from("hole_scores").insert({ duo_id: "00000000-0000-0000-0000-00000000dead", round_id: r1.id, hole: 1, strokes: 4 });
  const { count: real2027 } = await admin.from("duos").select("id", { count: "exact", head: true }).in(
    "round_id",
    ((await admin.from("rounds").select("id").eq("season_id", (await admin.from("seasons").select("id").eq("year", 2027).single()).data!.id)).data ?? []).map((x) => x.id),
  );
  record("F2.2 A2", "QA player writes to a duo outside the QA match / a 2027 duo → denied", gate === false && !!r.error,
    `can_score_duo(unknown duo)=${gate}; insert error: ${r.error?.message ?? "NOT DENIED"}; NOTE 2027 has ${real2027} duos, so a literal 2027 target can't exist without writing to 2027 (forbidden) — the same rule is proven on a synthetic 2027 season in the migration replay`);

  // A3 signed-out device
  r = await signedOut.from("hole_scores").insert({ duo_id: slot1.north, round_id: r1.id, hole: 1, strokes: 4 });
  record("F2.2 A3", "signed-out device writes → denied", !!r.error && /row-level security/i.test(r.error.message), r.error?.message ?? "NOT DENIED");
  r = await signedOut.from("reverse_mulligans").insert({ duo_id: slot1.north, round_id: r1.id, hole: 1 });
  record("F2.2 A3b", "signed-out device logs a reverse mulligan → denied", !!r.error, r.error?.message ?? "NOT DENIED");

  // legit writes first (so there is something to attack)
  r = await n1.client.from("hole_scores").upsert(
    [{ duo_id: slot1.north, round_id: r1.id, hole: 1, strokes: 4 }, { duo_id: slot1.south, round_id: r1.id, hole: 1, strokes: 5 }],
    { onConflict: "duo_id,round_id,hole" },
  );
  record("F2.2 control", "control: a player in the match CAN write both duos (through RLS)", !r.error, r.error?.message ?? "both rows written");

  // A4 delete
  const del = await n1.client.from("hole_scores").delete({ count: "exact" }).eq("round_id", r1.id);
  const { count: still } = await admin.from("hole_scores").select("id", { count: "exact", head: true }).eq("round_id", r1.id);
  record("F2.2 A4", "player deletes a score → nothing deleted", (del.count ?? 0) === 0 && still === 2, `delete removed ${del.count ?? 0} rows, ${still} still stored${del.error ? `, error: ${del.error.message}` : " (no DELETE policy: RLS filters them out)"}`);

  // A5 second reverse mulligan, same duo + round
  r = await n1.client.from("reverse_mulligans").insert({ duo_id: slot1.north, round_id: r1.id, hole: 3 });
  record("F2.2 A5a", "first reverse mulligan for a duo is allowed", !r.error, r.error?.message ?? "recorded");
  r = await n1.client.from("reverse_mulligans").insert({ duo_id: slot1.north, round_id: r1.id, hole: 9 });
  record("F2.2 A5b", "a second call for the SAME duo and round → denied", !!r.error && r.error.code === "23505", `${r.error?.code ?? "no error"}: ${r.error?.message ?? "NOT DENIED"}`);
  r = await s1.client.from("reverse_mulligans").insert({ duo_id: slot1.north, round_id: r1.id, hole: 12 });
  record("F2.2 A5c", "…even from the OTHER duo's player → denied", !!r.error && r.error.code === "23505", `${r.error?.code ?? "no error"}: ${r.error?.message ?? "NOT DENIED"}`);

  // A6 locked format
  const playerSwitch = await n1.client.from("rounds").update({ format: "best_ball" }).eq("id", r1.id).select();
  const { data: fmt } = await admin.from("rounds").select("format").eq("id", r1.id).single();
  record("F2.2 A6a", "player changes a locked round's format → blocked", (playerSwitch.data?.length ?? 0) === 0 && fmt?.format === "scramble",
    `player update touched ${playerSwitch.data?.length ?? 0} rows, format still ${fmt?.format}${playerSwitch.error ? `, error: ${playerSwitch.error.message}` : ""}`);
  const svc = await admin.from("rounds").update({ format: "best_ball" }).eq("id", r1.id);
  record("F2.2 A6b", "even the service role cannot change a locked format", !!svc.error && /Format is locked/.test(svc.error.message), svc.error?.message ?? "NOT BLOCKED");

  // extras
  r = await n1.client.from("hole_scores").update({ duo_id: slot2.north }).eq("duo_id", slot1.north).eq("hole", 1);
  record("F2.2 X1", "player moves a score to a duo outside his match → denied", !!r.error, r.error?.message ?? "NOT DENIED");
  r = await n1.client.from("player_hole_scores").insert({ round_id: r1.id, duo_id: slot1.north, player_id: n1.playerId, hole: 2, strokes: 4 });
  record("F2.2 X2", "best-ball row into a scramble round → rejected", !!r.error, r.error?.message ?? "NOT REJECTED");
  const duoEdit = await n1.client.from("duos").update({ match_slot: 4 }).eq("id", slot1.north).select();
  const duoAdd = await n1.client.from("duos").insert({ round_id: r1.id, team_id: (await admin.from("duos").select("team_id").eq("id", slot1.north).single()).data!.team_id, player_1_id: n1.playerId, match_slot: 4 });
  record("F2.2 X3", "player edits or creates duos → denied", (duoEdit.data?.length ?? 0) === 0 && !!duoAdd.error, `edit touched ${duoEdit.data?.length ?? 0} rows; insert: ${duoAdd.error?.message ?? "NOT DENIED"}`);
  const flags = await n1.client.from("seasons").update({ event_shortened: true, chip_off_winner_team_id: null }).eq("id", trip.seasonId).select();
  const { data: sFlag } = await admin.from("seasons").select("event_shortened").eq("id", trip.seasonId).single();
  record("F2.2 X4", "player forges the Cup flags (shortened / chip-off) → no effect", (flags.data?.length ?? 0) === 0 && sFlag?.event_shortened === false,
    `player update touched ${flags.data?.length ?? 0} rows, event_shortened still ${sFlag?.event_shortened}`);

  return { trip, n1, s1 };
}

async function concurrency() {
  const trip = await seedFullTrip(admin, "scramble");
  const r1 = trip.rounds[0];
  const d = trip.duos[1][1];
  const a = await device("QA North 1");
  const b = await device("QA South 1");
  const watcher = await device("QA North 2"); // the third subscribed session

  const TRIALS = 30;
  let mixes = 0, deadlocks = 0, aWins = 0, bWins = 0, nonConverged = 0, rowCountBad = 0;
  for (let i = 0; i < TRIALS; i++) {
    const hole = (i % 18) + 1;
    const rowsA = [
      { duo_id: d.north, round_id: r1.id, hole, strokes: 4 },
      { duo_id: d.south, round_id: r1.id, hole, strokes: 5 },
    ];
    const rowsB = [
      { duo_id: d.south, round_id: r1.id, hole, strokes: 4 }, // writer B: South 4, North 5 — and in the
      { duo_id: d.north, round_id: r1.id, hole, strokes: 5 }, // OPPOSITE row order on odd trials, to provoke lock-order trouble
    ];
    if (i % 2 === 1) rowsB.reverse();
    const results = await Promise.all([
      a.client.from("hole_scores").upsert(rowsA, { onConflict: "duo_id,round_id,hole" }),
      b.client.from("hole_scores").upsert(rowsB, { onConflict: "duo_id,round_id,hole" }),
    ]);
    for (const res of results) if (res.error && /deadlock/i.test(res.error.message)) deadlocks++;
    const { data: stored } = await admin.from("hole_scores").select("duo_id, strokes").eq("round_id", r1.id).eq("hole", hole);
    const north = stored?.find((x) => x.duo_id === d.north)?.strokes;
    const south = stored?.find((x) => x.duo_id === d.south)?.strokes;
    if (stored?.length !== 2) rowCountBad++;
    if (north === 4 && south === 5) aWins++;
    else if (north === 5 && south === 4) bWins++;
    else mixes++;
    // both clients converge: each reads back the same pair
    const seenA = await a.client.from("hole_scores").select("duo_id, strokes").eq("round_id", r1.id).eq("hole", hole);
    const seenB = await b.client.from("hole_scores").select("duo_id, strokes").eq("round_id", r1.id).eq("hole", hole);
    const pair = (rows: { duo_id: string; strokes: number }[] | null) => `${rows?.find((x) => x.duo_id === d.north)?.strokes}/${rows?.find((x) => x.duo_id === d.south)?.strokes}`;
    if (pair(seenA.data) !== `${north}/${south}` || pair(seenB.data) !== `${north}/${south}`) nonConverged++;
  }
  record("F2.3 race", `${TRIALS} same-hole races between two QA sessions: every outcome is ONE writer's complete pair`,
    mixes === 0 && rowCountBad === 0, `${aWins} trials ended with writer A's pair, ${bWins} with writer B's, ${mixes} mixed, ${rowCountBad} with a wrong row count, ${deadlocks} deadlock errors`);
  record("F2.3 converge", "both clients read back exactly what was stored", nonConverged === 0, `${nonConverged}/${TRIALS} trials where a client saw something different`);

  // realtime delivery to a third, subscribed session — 20 sequential posts
  const times: number[] = [];
  const pending = new Map<number, (ms: number) => void>();
  const sent = new Map<number, number>();
  const channel = watcher.client
    .channel("pressure-test")
    .on("postgres_changes", { event: "*", schema: "public", table: "hole_scores", filter: `round_id=eq.${r1.id}` }, (payload) => {
      const row = payload.new as { hole?: number; strokes?: number };
      if (row.hole === undefined) return;
      const key = row.hole * 100 + (row.strokes ?? 0);
      const t0 = sent.get(key);
      const resolve = pending.get(key);
      if (t0 !== undefined && resolve) {
        pending.delete(key);
        resolve(Date.now() - t0);
      }
    });
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("realtime subscribe timed out")), 15000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(to);
        resolve();
      }
    });
  });
  let missed = 0;
  for (let i = 0; i < 20; i++) {
    const hole = (i % 18) + 1;
    const strokes = 6 + (i % 3); // distinct value so the event can be matched to this post
    const key = hole * 100 + strokes;
    const arrived = new Promise<number>((resolve) => pending.set(key, resolve));
    sent.set(key, Date.now());
    const res = await a.client.from("hole_scores").upsert(
      [{ duo_id: d.north, round_id: r1.id, hole, strokes }, { duo_id: d.south, round_id: r1.id, hole, strokes: strokes + 1 }],
      { onConflict: "duo_id,round_id,hole" },
    );
    if (res.error) throw new Error(res.error.message);
    const ms = await Promise.race([arrived, new Promise<number>((r) => setTimeout(() => r(-1), 10000))]);
    if (ms < 0) missed++;
    else times.push(ms);
  }
  await watcher.client.removeChannel(channel);
  times.sort((x, y) => x - y);
  const median = times.length ? times[Math.floor(times.length / 2)] : -1;
  const worst = times.length ? times[times.length - 1] : -1;
  record("F2.3 realtime", "a third subscribed session receives every one of 20 posts, fast", missed === 0 && worst < 5000,
    `${times.length}/20 delivered, median ${median} ms, worst ${worst} ms${missed ? `, ${missed} MISSED` : ""} (budget: every post, worst < 5 s)`);
}

async function isolationChecks() {
  const { data: real } = await admin.from("seasons").select("id").eq("is_test", false);
  const realSeasonIds = (real ?? []).map((s) => s.id);
  const { data: realRounds } = await admin.from("rounds").select("id").in("season_id", realSeasonIds);
  const realRoundIds = (realRounds ?? []).map((r) => r.id);
  const { count: duos2027 } = await admin.from("duos").select("id", { count: "exact", head: true }).in("round_id", realRoundIds);
  const hs = await count("hole_scores", realRoundIds);
  const pbs = await count("player_hole_scores", realRoundIds);
  const rm = await count("reverse_mulligans", realRoundIds);
  record("F2.4 a", "2027 has 0 duos, 0 scores of either kind, 0 mulligans", duos2027 === 0 && hs === 0 && pbs === 0 && rm === 0, `duos ${duos2027}, hole_scores ${hs}, player_hole_scores ${pbs}, mulligans ${rm}`);

  const { data: realTeams } = await admin.from("teams").select("id").in("season_id", realSeasonIds);
  const { data: members } = await admin.from("team_members").select("player_id").in("team_id", (realTeams ?? []).map((t) => t.id));
  const { data: testPlayers } = await admin.from("players").select("id").eq("is_test", true);
  const leaked = (members ?? []).filter((m) => (testPlayers ?? []).some((p) => p.id === m.player_id)).length;
  record("F2.4 b", "no QA player sits on a 2027 team", leaked === 0, `${leaked} QA players on real teams`);

  const { qaRoundId } = await (async () => ({ qaRoundId: (await qaIds()).rounds[0]?.id as string }))();
  const noQa = (t: string) => !/QA (North|South|Sandbox)|1900/.test(t);
  for (const path of ["/leaderboard", "/board", "/schedule", "/champions", "/"]) {
    const { status, text } = await page(path);
    record(`F2.4 default ${path}`, `default view shows no QA data`, status === 200 && noQa(text), `HTTP ${status}, QA text ${noQa(text) ? "absent" : "PRESENT"}`);
  }
  for (const path of ["/leaderboard?scope=qa", "/board?scope=qa", `/leaderboard/match/${qaRoundId}/1?scope=qa`, `/leaderboard/match/${qaRoundId}/1`]) {
    const { status, text } = await page(path);
    record(`F2.4 no-cookie ${path.replace(qaRoundId, "<qa-round>")}`, `?scope=qa / a direct QA match URL without a session still shows no QA data`, status === 200 && noQa(text), `HTTP ${status}, QA text ${noQa(text) ? "absent" : "PRESENT"}`);
  }
  if (ADMIN_PAGES) {
    const forged = `gui_admin_session=${Date.now()}.${"0".repeat(64)}`;
    const { text } = await page("/leaderboard?scope=qa", forged);
    record("F2.4 forged cookie", "a FORGED admin cookie does not unlock QA scope", noQa(text), noQa(text) ? "QA data absent" : "QA DATA LEAKED");
    const { text: expired } = await page("/leaderboard?scope=qa", `gui_admin_session=${Date.now() - 9 * 3600_000}.${createHmac("sha256", env.ADMIN_PASSCODE).update(String(Date.now() - 9 * 3600_000)).digest("hex")}`);
    record("F2.4 expired cookie", "an EXPIRED (9h-old) admin cookie does not unlock QA scope", noQa(expired), noQa(expired) ? "QA data absent" : "QA DATA LEAKED");
  }
}

async function resetAndProveClean() {
  const trip = await seedFullTrip(admin, "scramble");
  const ids = trip.rounds.map((r) => r.id);
  const { data: season } = await admin.from("seasons").select("event_shortened, chip_off_winner_team_id").eq("id", trip.seasonId).single();
  const { count: duos } = await admin.from("duos").select("id", { count: "exact", head: true }).in("round_id", ids);
  const hs = await count("hole_scores", ids);
  const pbs = await count("player_hole_scores", ids);
  const rm = await count("reverse_mulligans", ids);
  const { data: qa } = await admin.from("players").select("id").eq("is_test", true);
  const { count: links } = await admin.from("player_devices").select("auth_user_id", { count: "exact", head: true }).in("player_id", (qa ?? []).map((p) => p.id));
  await admin.from("player_devices").delete().in("player_id", (qa ?? []).map((p) => p.id)); // remove this run's QA device links
  record("F2.5 reset", "QA reset leaves a clean, freshly seeded sandbox", hs === 0 && pbs === 0 && rm === 0 && duos === 16 && season?.event_shortened === false && season?.chip_off_winner_team_id === null,
    `rounds ${ids.length}, duos ${duos}, hole_scores ${hs}, player_hole_scores ${pbs}, mulligans ${rm}, shortened ${season?.event_shortened}, chip-off winner ${season?.chip_off_winner_team_id ?? "none"}; ${links} QA device links removed`);
}

async function main() {
  console.log(`pressure test — pages from ${BASE}${ADMIN_PAGES ? "" : " (no-passcode checks only)"}\n`);
  await scenarioChecks();
  await chipOffRenderCheck();
  await permissionAttacks();
  await concurrency();
  await isolationChecks();
  await resetAndProveClean();

  const failed = rows.filter((r) => !r.pass);
  console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
  fs.writeFileSync("pressure-test-report.json", JSON.stringify(rows, null, 2));
  if (failed.length) {
    console.error("FAILED:\n" + failed.map((r) => `  ${r.id} ${r.check}: ${r.evidence}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err instanceof Error ? err.message : err);
  process.exit(2);
});
