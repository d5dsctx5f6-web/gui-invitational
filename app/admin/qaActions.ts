"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  assertQaSeason,
  BEST_BALL_FIXTURE,
  BEST_BALL_FIXTURE_REVERSE_MULLIGANS,
  QA_RESET_ORDER,
  SCRAMBLE_FIXTURE,
  SCRAMBLE_FIXTURE_REVERSE_MULLIGANS,
} from "@/engine/src";

// Brief 33 Part C — the QA sandbox: a self-contained test world (season year 1900, is_test) that
// can never touch the 2027 trip data. Everything here is behind the admin passcode and works on
// production. Every write targets the QA season only, and the reset asserts that in code
// (assertQaSeason) before deleting anything.

function flash(message: string): never {
  redirect(`/admin?msg=${encodeURIComponent(message)}#qa`);
}
function flashError(message: string): never {
  redirect(`/admin?err=${encodeURIComponent(message)}#qa`);
}

type Admin = ReturnType<typeof createAdminClient>;

async function loadQaSeason(admin: Admin) {
  const { data: season } = await admin.from("seasons").select("id, is_test").eq("year", 1900).maybeSingle();
  const ref = season ? { id: season.id as string, isTest: season.is_test as boolean } : null;
  assertQaSeason(ref); // throws unless it exists AND is_test = true
  return ref;
}

async function loadQaMatch(admin: Admin, seasonId: string) {
  const { data: round } = await admin
    .from("rounds")
    .select("id, format")
    .eq("season_id", seasonId)
    .order("round_number")
    .limit(1)
    .maybeSingle();
  if (!round) return null;
  const { data: duos } = await admin
    .from("duos")
    .select("id, team_id, player_1_id, player_2_id")
    .eq("round_id", round.id);
  const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", seasonId);
  const north = (duos ?? []).find((d) => teams?.find((t) => t.id === d.team_id)?.name === "North Hedges");
  const south = (duos ?? []).find((d) => teams?.find((t) => t.id === d.team_id)?.name === "South Hedges");
  if (!north || !south) return null;
  return { round, north, south };
}

/** Wipes the QA season's data (RESTRICT-safe order) and re-seeds one round + one slot-1 match. */
export async function seedQaSandbox(formData: FormData) {
  await requireAdmin();
  const format = String(formData.get("format")) === "best_ball" ? "best_ball" : "scramble";
  const admin = createAdminClient();

  let failure: string | null = null;
  try {
    const season = await loadQaSeason(admin);

    const { data: rounds } = await admin.from("rounds").select("id").eq("season_id", season.id);
    const roundIds = (rounds ?? []).map((r) => r.id);
    if (roundIds.length > 0) {
      for (const table of QA_RESET_ORDER) {
        const column = table === "rounds" ? "id" : "round_id";
        const { error } = await admin.from(table).delete().in(column, roundIds);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    }

    const { data: course } = await admin.from("courses").select("id").eq("name", "Talking Stick Golf Club — O'odham").maybeSingle();
    if (!course) throw new Error("O'odham course not found (run migration 0027).");
    const { data: tee } = await admin.from("course_tees").select("id").eq("course_id", course.id).eq("tee_name", "Gold").maybeSingle();
    if (!tee) throw new Error("O'odham Gold tee not found.");

    const { data: round, error: roundError } = await admin
      .from("rounds")
      .insert({
        season_id: season.id,
        round_number: 1,
        date: "1900-01-01",
        course_id: course.id,
        default_tee_id: tee.id,
        format,
        first_tee_time: "2027-03-27T18:00:00Z",
        group_interval_minutes: 10,
        tee_time_note: "QA sandbox",
      })
      .select("id")
      .single();
    if (roundError || !round) throw new Error(roundError?.message ?? "Couldn't create the QA round");

    const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", season.id);
    const { data: players } = await admin.from("players").select("id, name").eq("is_test", true);
    const team = (name: string) => teams?.find((t) => t.name === name)?.id;
    const player = (name: string) => players?.find((p) => p.name === name)?.id;
    const ids = [team("North Hedges"), team("South Hedges"), player("QA North 1"), player("QA North 2"), player("QA South 1"), player("QA South 2")];
    if (ids.some((i) => !i)) throw new Error("QA teams/players missing (run migration 0031).");

    const { error: duoError } = await admin.from("duos").insert([
      { round_id: round.id, team_id: ids[0], player_1_id: ids[2], player_2_id: ids[3], match_slot: 1 },
      { round_id: round.id, team_id: ids[1], player_1_id: ids[4], player_2_id: ids[5], match_slot: 1 },
    ]);
    if (duoError) throw new Error(duoError.message);
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }
  if (failure) flashError(failure);

  revalidatePath("/admin");
  revalidatePath("/score");
  flash(`QA sandbox reset — ${format === "best_ball" ? "best ball" : "scramble"} match seeded`);
}

/** Points THIS device at a QA player (replacing any link it holds — never both a QA and a real
 *  link at once). Only is_test players can be opened this way. */
export async function openAsQaPlayer(formData: FormData) {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");
  const admin = createAdminClient();

  const { data: player } = await admin.from("players").select("id, is_test").eq("id", playerId).maybeSingle();
  if (!player) flashError("Player not found");
  if (!player.is_test) flashError("Only QA players can be opened this way.");

  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) flashError(error?.message ?? "Couldn't start a device session");
    user = data.user;
  }

  const { error } = await admin
    .from("player_devices")
    .upsert({ auth_user_id: user.id, player_id: player.id, linked_at: new Date().toISOString() }, { onConflict: "auth_user_id" });
  if (error) flashError(error.message);

  redirect("/score");
}

/** Posts the remaining unposted holes of the QA match from the pinned fixture for the round's format. */
export async function autofillFromFixture() {
  await requireAdmin();
  const admin = createAdminClient();

  let message = "";
  let failure: string | null = null;
  try {
    const season = await loadQaSeason(admin);
    const match = await loadQaMatch(admin, season.id);
    if (!match) throw new Error("Seed / reset the QA sandbox first.");
    const { round, north, south } = match;

    let holesPosted = 0;
    if (round.format === "scramble") {
      const { data: existing } = await admin.from("hole_scores").select("duo_id, hole").eq("round_id", round.id);
      const have = new Set((existing ?? []).map((r) => `${r.duo_id}:${r.hole}`));
      const rows = SCRAMBLE_FIXTURE.flatMap((f) => {
        const out = [];
        if (!have.has(`${north.id}:${f.hole}`))
          out.push({ duo_id: north.id, round_id: round.id, hole: f.hole, strokes: f.a, tee_shot_used_player_id: f.teeShotA === 1 ? north.player_1_id : f.teeShotA === 2 ? north.player_2_id : null });
        if (!have.has(`${south.id}:${f.hole}`))
          out.push({ duo_id: south.id, round_id: round.id, hole: f.hole, strokes: f.b, tee_shot_used_player_id: f.teeShotB === 1 ? south.player_1_id : f.teeShotB === 2 ? south.player_2_id : null });
        return out;
      });
      if (rows.length > 0) {
        const { error } = await admin.from("hole_scores").insert(rows);
        if (error) throw new Error(error.message);
      }
      holesPosted = new Set(rows.map((r) => r.hole)).size;
    } else {
      const { data: existing } = await admin.from("player_hole_scores").select("player_id, hole").eq("round_id", round.id);
      const have = new Set((existing ?? []).map((r) => `${r.player_id}:${r.hole}`));
      const rows = BEST_BALL_FIXTURE.flatMap((f) => {
        const out: { duo_id: string; round_id: string; player_id: string; hole: number; strokes: number }[] = [];
        const add = (duoId: string, playerId: string | null, strokes: number | null) => {
          if (strokes !== null && playerId && !have.has(`${playerId}:${f.hole}`))
            out.push({ duo_id: duoId, round_id: round.id, player_id: playerId, hole: f.hole, strokes });
        };
        add(north.id, north.player_1_id, f.a[0]);
        add(north.id, north.player_2_id, f.a[1]);
        add(south.id, south.player_1_id, f.b[0]);
        add(south.id, south.player_2_id, f.b[1]);
        return out;
      });
      if (rows.length > 0) {
        const { error } = await admin.from("player_hole_scores").insert(rows);
        if (error) throw new Error(error.message);
      }
      holesPosted = new Set(rows.map((r) => r.hole)).size;
    }

    // The fixture's reverse mulligan call(s), if that duo hasn't used its one already.
    const events = round.format === "scramble" ? SCRAMBLE_FIXTURE_REVERSE_MULLIGANS : BEST_BALL_FIXTURE_REVERSE_MULLIGANS;
    const { data: used } = await admin.from("reverse_mulligans").select("duo_id").eq("round_id", round.id);
    for (const ev of events) {
      const duo = ev.side === "A" ? north : south;
      if ((used ?? []).some((u) => u.duo_id === duo.id)) continue;
      const { error } = await admin.from("reverse_mulligans").insert({ duo_id: duo.id, round_id: round.id, hole: ev.hole });
      if (error) throw new Error(error.message);
    }

    message = `Autofilled ${holesPosted} hole${holesPosted === 1 ? "" : "s"} from the ${round.format === "scramble" ? "scramble" : "best-ball"} fixture`;
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }
  if (failure) flashError(failure);

  revalidatePath("/admin");
  revalidatePath("/score");
  flash(message);
}
