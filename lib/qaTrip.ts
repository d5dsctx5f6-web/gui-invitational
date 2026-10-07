import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertQaSeason,
  bestBallScores,
  QA_RESET_ORDER,
  QA_SCENARIOS,
  qaTripPairing,
  scrambleScores,
  type RoundFormat,
} from "@/engine/src";

// Brief 34 Part E: the QA sandbox's FULL-TRIP mode — 16 QA players, two QA rounds, four matches each —
// and the six scenario loaders. Shared by the admin buttons and scripts/qa-scenario.ts, so it takes a
// service-role client as an argument (no "server-only" import, no framework). Everything targets the
// QA season only, and every entry point asserts that in code (assertQaSeason) before deleting anything.

type Client = SupabaseClient;

export async function qaSeason(admin: Client) {
  const { data } = await admin.from("seasons").select("id, is_test").eq("year", 1900).maybeSingle();
  const ref = data ? { id: data.id as string, isTest: data.is_test as boolean } : null;
  assertQaSeason(ref); // throws unless it exists AND is_test = true
  return ref;
}

/** Wipes the QA season (children first, RESTRICT-safe) and clears its Cup flags. QA only. */
export async function wipeQaSeason(admin: Client, seasonId: string) {
  const { data: rounds } = await admin.from("rounds").select("id").eq("season_id", seasonId);
  const roundIds = (rounds ?? []).map((r) => r.id as string);
  if (roundIds.length > 0) {
    for (const table of QA_RESET_ORDER) {
      const column = table === "rounds" ? "id" : "round_id";
      const { error } = await admin.from(table).delete().in(column, roundIds);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
  const { error } = await admin
    .from("seasons")
    .update({ event_shortened: false, chip_off_winner_team_id: null })
    .eq("id", seasonId)
    .eq("is_test", true); // belt and braces: this update can only ever match a test season
  if (error) throw new Error(error.message);
}

interface TripRefs {
  seasonId: string;
  rounds: { id: string; roundNumber: 1 | 2; format: RoundFormat; parByHole: number[] }[];
  /** duo ids by round number and slot */
  duos: Record<number, Record<number, { north: string; south: string; northPlayers: [string, string]; southPlayers: [string, string] }>>;
}

/** Two QA rounds (1: scramble on O'odham Gold, 2: round2Format on Saguaro Purple), four matches each. */
export async function seedFullTrip(admin: Client, round2Format: RoundFormat): Promise<TripRefs> {
  const season = await qaSeason(admin);
  await wipeQaSeason(admin, season.id);

  const [{ data: gold }, { data: purple }, { data: teams }, { data: players }] = await Promise.all([
    admin.from("course_tees").select("id, course_id, par_by_hole, courses!inner(name)").eq("tee_name", "Gold").eq("courses.name", "Talking Stick Golf Club — O'odham").maybeSingle(),
    admin.from("course_tees").select("id, course_id, par_by_hole, courses!inner(name)").eq("tee_name", "Purple").eq("courses.name", "WeKoPa Golf Club — Saguaro").maybeSingle(),
    admin.from("teams").select("id, name").eq("season_id", season.id),
    admin.from("players").select("id, name").eq("is_test", true),
  ]);
  if (!gold || !purple) throw new Error("O'odham Gold / Saguaro Purple tees not found (run migration 0027).");

  const teamId = (name: string) => teams?.find((t) => t.name === name)?.id as string | undefined;
  const north = teamId("North Hedges");
  const south = teamId("South Hedges");
  if (!north || !south) throw new Error("QA teams missing (run migration 0031).");
  const player = (side: "North" | "South", n: number) => {
    const id = players?.find((p) => p.name === `QA ${side} ${n}`)?.id as string | undefined;
    if (!id) throw new Error(`QA ${side} ${n} missing (run migrations 0031 and 0033).`);
    return id;
  };

  const roundSpecs = [
    { n: 1 as const, tee: gold, format: "scramble" as RoundFormat, date: "1900-01-01", first: "2027-03-27T18:00:00Z" },
    { n: 2 as const, tee: purple, format: round2Format, date: "1900-01-02", first: "2027-03-28T18:40:00Z" },
  ];

  const refs: TripRefs = { seasonId: season.id, rounds: [], duos: {} };
  for (const spec of roundSpecs) {
    const { data: round, error } = await admin
      .from("rounds")
      .insert({
        season_id: season.id,
        round_number: spec.n,
        date: spec.date,
        course_id: spec.tee.course_id,
        default_tee_id: spec.tee.id,
        format: spec.format,
        first_tee_time: spec.first,
        group_interval_minutes: 10,
        tee_time_note: "QA sandbox",
      })
      .select("id")
      .single();
    if (error || !round) throw new Error(error?.message ?? "Couldn't create a QA round");
    refs.rounds.push({ id: round.id as string, roundNumber: spec.n, format: spec.format, parByHole: spec.tee.par_by_hole as number[] });

    const rows = [];
    refs.duos[spec.n] = {};
    for (let slot = 1; slot <= 4; slot++) {
      const [p1, p2] = qaTripPairing(spec.n, slot);
      rows.push(
        { round_id: round.id, team_id: north, player_1_id: player("North", p1), player_2_id: player("North", p2), match_slot: slot },
        { round_id: round.id, team_id: south, player_1_id: player("South", p1), player_2_id: player("South", p2), match_slot: slot },
      );
    }
    const { data: inserted, error: duoError } = await admin.from("duos").insert(rows).select("id, team_id, match_slot, player_1_id, player_2_id");
    if (duoError) throw new Error(duoError.message);
    for (let slot = 1; slot <= 4; slot++) {
      const n = inserted!.find((d) => d.match_slot === slot && d.team_id === north)!;
      const s = inserted!.find((d) => d.match_slot === slot && d.team_id === south)!;
      refs.duos[spec.n][slot] = {
        north: n.id as string,
        south: s.id as string,
        northPlayers: [n.player_1_id as string, n.player_2_id as string],
        southPlayers: [s.player_1_id as string, s.player_2_id as string],
      };
    }
  }
  return refs;
}

/** Seeds the full trip, then writes scenario 1-6's scores in each round's format. */
export async function loadScenario(admin: Client, scenarioId: number, round2Format: RoundFormat) {
  const scenario = QA_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario ${scenarioId}`);

  const refs = await seedFullTrip(admin, round2Format);
  let scoreRows = 0;

  for (const [ri, slots] of scenario.rounds.entries()) {
    const round = refs.rounds[ri];
    const scramble: Record<string, unknown>[] = [];
    const bestBall: Record<string, unknown>[] = [];

    for (const [si, script] of slots.entries()) {
      const slot = si + 1;
      const duo = refs.duos[round.roundNumber][slot];
      if (script === null) {
        // A short-handed round: that slot has no match at all (no duos), so possible points shrink.
        const { error } = await admin.from("duos").delete().in("id", [duo.north, duo.south]);
        if (error) throw new Error(error.message);
        continue;
      }
      if (round.format === "scramble") {
        for (const r of scrambleScores(script, round.parByHole)) {
          scramble.push({ duo_id: duo.north, round_id: round.id, hole: r.hole, strokes: r.a });
          scramble.push({ duo_id: duo.south, round_id: round.id, hole: r.hole, strokes: r.b });
        }
      } else {
        for (const r of bestBallScores(script, round.parByHole)) {
          duo.northPlayers.forEach((pid, i) => bestBall.push({ duo_id: duo.north, round_id: round.id, player_id: pid, hole: r.hole, strokes: r.a[i] }));
          duo.southPlayers.forEach((pid, i) => bestBall.push({ duo_id: duo.south, round_id: round.id, player_id: pid, hole: r.hole, strokes: r.b[i] }));
        }
      }
    }

    if (scramble.length > 0) {
      const { error } = await admin.from("hole_scores").insert(scramble);
      if (error) throw new Error(error.message);
    }
    if (bestBall.length > 0) {
      const { error } = await admin.from("player_hole_scores").insert(bestBall);
      if (error) throw new Error(error.message);
    }
    scoreRows += scramble.length + bestBall.length;
  }

  if (scenario.eventShortened) {
    const { error } = await admin.from("seasons").update({ event_shortened: true }).eq("id", refs.seasonId).eq("is_test", true);
    if (error) throw new Error(error.message);
  }

  return { scenario: scenario.name, scoreRows, round2Format };
}
