"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPasscode, clearAdminSession, requireAdmin, setAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { arizonaLocalToUtcIso } from "@/lib/timezone";
import { validateDuo, type ExistingDuo } from "@/engine/src";

function flash(message: string): never {
  redirect(`/admin?msg=${encodeURIComponent(message)}`);
}

function flashError(message: string): never {
  redirect(`/admin?err=${encodeURIComponent(message)}`);
}

// Postgres foreign_key_violation. Brief 32: the scoring tables reference duos/rounds/courses with
// ON DELETE RESTRICT (0026), so the database refuses to delete anything that has scores. Every
// delete below catches that and shows a plain message instead of the raw constraint text.
const FK_VIOLATION = "23503";

function flashDeleteError(error: { code?: string; message: string }, blockedMessage: string): never {
  flashError(error.code === FK_VIOLATION ? blockedMessage : error.message);
}

export async function adminLogin(formData: FormData) {
  const passcode = String(formData.get("passcode") ?? "");
  if (!checkPasscode(passcode)) {
    redirect(`/admin?err=${encodeURIComponent("Wrong passcode")}`);
  }
  await setAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/admin");
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function addTeamMember(formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId"));
  const playerId = String(formData.get("playerId") ?? "");
  if (!playerId) flashError("Pick a player to add");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, player_id: playerId });
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash("Player added to team");
}

export async function removeTeamMember(formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId"));
  const playerId = String(formData.get("playerId"));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("player_id", playerId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash("Player removed from team (count-agnostic — a team can run short)");
}

// ---------------------------------------------------------------------------
// (Brief 32: the old Rounds + Matchups actions are gone — rounds are seeded, and a "match" is
// derived from duos. The skins actions below are dead, left in place, and not reachable from
// the admin UI.)
// ---------------------------------------------------------------------------

// Brief 9 Part G: skins opt-in is a one-way door for players once confirmed — this is the
// escape hatch for a genuine mistake (wrong player opted in, etc.), a commissioner override
// same as everything else in this file, not a player-facing action.
export async function removeSkinsEntry(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("skins_entries").delete().eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/money");
  flash("Skins entry removed");
}

export async function setSkinsBuyIn(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));
  const raw = String(formData.get("skinsBuyIn") ?? "").trim();
  const skinsBuyIn = raw === "" ? null : Number(raw);
  if (skinsBuyIn !== null && Number.isNaN(skinsBuyIn)) flashError("Buy-in must be a number");

  const supabase = createAdminClient();
  const { error } = await supabase.from("rounds").update({ skins_buy_in: skinsBuyIn }).eq("id", roundId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/money");
  flash("Skins buy-in updated");
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

export async function updatePlayerIndex(formData: FormData) {
  await requireAdmin();
  const playerId = String(formData.get("playerId"));
  const indexRaw = String(formData.get("index") ?? "").trim();
  const index = indexRaw === "" ? null : Number(indexRaw);
  if (index !== null && Number.isNaN(index)) flashError("Index must be a number");

  const supabase = createAdminClient();
  const { error } = await supabase.from("players").update({ index }).eq("id", playerId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash("Index updated");
}

// Brief 7.5 Part B: a commissioner override for a locked-out player or a lost device —
// consistent with the friends-trip threat model (ARCHITECTURE §2), no email/recovery flow.
// Clears the PIN hash so their next sign-in is treated as first-time (prompted to set a new
// PIN), and also clears every device this player was ever linked to: a PIN reset implies the
// old device linkage shouldn't silently keep working, since the whole point is "this device/PIN
// is no longer trusted."
export async function resetPlayerPin(formData: FormData) {
  await requireAdmin();
  const playerId = String(formData.get("playerId"));

  const supabase = createAdminClient();

  const { error: authError } = await supabase
    .from("player_auth")
    .delete()
    .eq("player_id", playerId);
  if (authError) flashError(authError.message);

  const { error: deviceError } = await supabase
    .from("player_devices")
    .delete()
    .eq("player_id", playerId);
  if (deviceError) flashError(deviceError.message);

  revalidatePath("/admin");
  flash("PIN reset — their next sign-in will prompt to set a new one");
}

// ---------------------------------------------------------------------------
// Course setups
// ---------------------------------------------------------------------------

function parseNumberList(raw: string, label: string, length: number): number[] {
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "")
    .map(Number);
  if (values.length !== length || values.some(Number.isNaN)) {
    flashError(`${label} must be exactly ${length} comma-separated numbers`);
  }
  return values;
}

export async function createCourse(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) flashError("Course name is required");

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses").insert({ name });
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(`Course "${name}" created`);
}

export async function upsertCourseTee(formData: FormData) {
  await requireAdmin();
  const teeId = String(formData.get("teeId") ?? "") || null;
  const courseId = String(formData.get("courseId") ?? "");
  const teeName = String(formData.get("teeName") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const slope = Number(formData.get("slope"));
  const par = Number(formData.get("par"));

  if (!courseId || !teeName || Number.isNaN(rating) || Number.isNaN(slope) || Number.isNaN(par)) {
    flashError("Course, tee name, rating, slope, and par are all required");
  }

  const strokeIndex = parseNumberList(String(formData.get("strokeIndex") ?? ""), "Stroke index", 18);
  const validStrokeIndex = new Set(strokeIndex).size === 18 && strokeIndex.every((n) => n >= 1 && n <= 18);
  if (!validStrokeIndex) flashError("Stroke index must contain each of 1-18 exactly once");

  const parByHole = parseNumberList(String(formData.get("parByHole") ?? ""), "Par by hole", 18);

  const yardageRaw = String(formData.get("yardageByHole") ?? "").trim();
  const yardageByHole = yardageRaw === "" ? null : parseNumberList(yardageRaw, "Yardage by hole", 18);

  const supabase = createAdminClient();
  const row = {
    course_id: courseId,
    tee_name: teeName,
    rating,
    slope,
    par,
    stroke_index: strokeIndex,
    par_by_hole: parByHole,
    yardage_by_hole: yardageByHole,
  };
  const { error } = teeId
    ? await supabase.from("course_tees").update(row).eq("id", teeId)
    : await supabase.from("course_tees").insert(row);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(teeId ? "Tee setup updated" : "Tee setup created");
}

// ---------------------------------------------------------------------------
// Corrections — the key capability: edit an existing hole_scores row directly.
// ---------------------------------------------------------------------------

export async function correctHoleScore(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const strokes = Number(formData.get("strokes"));
  const matchStrokesRaw = String(formData.get("matchStrokes") ?? "").trim();
  const matchStrokes = matchStrokesRaw === "" ? null : Number(matchStrokesRaw);
  const breakfastBall = formData.get("breakfastBall") === "on";
  const mulligan = formData.get("mulligan") === "on";
  const mercyCalled = formData.get("mercyCalled") === "on";

  // Brief 20: Corrections is now a round -> match -> hole drill-down. Without carrying this
  // context through the redirect, every save would bounce back to round 1 / no match / hole 1
  // — exactly the "wall of rows" friction this brief exists to remove, just relocated to
  // "re-navigate after every single save" instead. These three are optional (the old flat-list
  // behavior — redirect straight to /admin — still works if ever called without them).
  const roundId = formData.get("roundId");
  const matchId = formData.get("matchId");
  const hole = formData.get("hole");
  const returnParams = new URLSearchParams();
  if (roundId) returnParams.set("round", String(roundId));
  if (matchId) returnParams.set("cmatch", String(matchId));
  if (hole) returnParams.set("chole", String(hole));

  function flashHere(kind: "msg" | "err", message: string): never {
    const params = new URLSearchParams(returnParams);
    params.set(kind, message);
    redirect(`/admin?${params.toString()}`);
  }

  if (Number.isNaN(strokes) || strokes < 1) flashHere("err", "Strokes must be a positive number");
  if (matchStrokes !== null && Number.isNaN(matchStrokes)) {
    flashHere("err", "Match strokes must be a number");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("hole_scores")
    .update({
      strokes,
      match_strokes: matchStrokes,
      breakfast_ball: breakfastBall,
      mulligan,
      mercy_called: mercyCalled,
    })
    .eq("id", id);
  if (error) flashHere("err", error.message);

  revalidatePath("/admin");
  revalidatePath("/score");
  flashHere("msg", "Score corrected — recomputes everywhere downstream");
}

// ---------------------------------------------------------------------------
// Challenge Ledger — dispute/void/reassign (PRODUCT_SPEC §3 commissioner control).
// Logging, accepting, and settling happen player-side under their own RLS scoping (0018);
// this is the escape hatch for when a bet needs correcting after the fact.
// ---------------------------------------------------------------------------

export async function voidChallengeBet(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("challenge_bets")
    .update({ status: "void" })
    .eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/money");
  flash("Challenge bet voided");
}

export async function reassignChallengeBetWinner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const winnerPlayerId = String(formData.get("winnerPlayerId") ?? "") || null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("challenge_bets")
    .update({ status: winnerPlayerId ? "settled" : "open", winner_player_id: winnerPlayerId })
    .eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/money");
  flash("Challenge bet winner reassigned");
}

// Brief 9 Part A: a real delete, distinct from void — nothing else references challenge_bets,
// so this is a plain leaf delete, no cascade to worry about.
export async function deleteChallengeBet(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("challenge_bets").delete().eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/money");
  flash("Challenge bet removed");
}

// ---------------------------------------------------------------------------
// Reverse mulligans (Brief 9 Part E) — admin never had a removal capability at all before
// this; whatever produced the stale match_strokes bug was a raw delete against the table
// directly (e.g. via the Supabase dashboard), which only ever removes the event row and
// can't know to undo its effect on hole_scores. This is the real fix: removing an RM also
// clears match_strokes back to null on the hole it affected, restoring coalesce(match_strokes,
// strokes) to reading the plain strokes value again — fully undoing the RM, not just its record.
// ---------------------------------------------------------------------------

export async function removeReverseMulligan(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  const supabase = createAdminClient();

  const { data: rm, error: fetchError } = await supabase
    .from("reverse_mulligans")
    .select("round_id, victim_player_id, hole")
    .eq("id", id)
    .single();
  if (fetchError) flashError(fetchError.message);

  const { error: deleteError } = await supabase.from("reverse_mulligans").delete().eq("id", id);
  if (deleteError) flashError(deleteError.message);

  const { error: clearError } = await supabase
    .from("hole_scores")
    .update({ match_strokes: null })
    .eq("round_id", rm.round_id)
    .eq("player_id", rm.victim_player_id)
    .eq("hole", rm.hole);
  if (clearError) flashError(clearError.message);

  revalidatePath("/admin");
  revalidatePath("/score");
  flash("Reverse mulligan removed — the hole reverts to its real score for match play too");
}

// ---------------------------------------------------------------------------
// Duo submissions (Brief 13 Part C) — a commissioner override, deliberately exempt from the
// blind-until-both-commit rule that governs a captain's own /duos view: admin needs to see
// and set BOTH teams' lineups regardless of the other side's status (a captain's phone died,
// a fix is needed mid-round, etc). Same underlying upsert as a captain's own submission
// (Part B), just triggered from here instead.
// ---------------------------------------------------------------------------

export async function setDuoSubmission(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));
  const teamId = String(formData.get("teamId"));
  const captainPlayerId = String(formData.get("captainPlayerId") ?? "");
  const duoAPlayer1 = String(formData.get("duoAPlayer1") ?? "");
  const duoAPlayer2 = String(formData.get("duoAPlayer2") ?? "") || null;
  const duoBPlayer1 = String(formData.get("duoBPlayer1") ?? "") || null;
  const duoBPlayer2 = String(formData.get("duoBPlayer2") ?? "") || null;

  if (!captainPlayerId) {
    flashError("This team has no captain on record — assign one first, under Teams");
  }
  if (!duoAPlayer1) flashError("Duo A needs at least one player");

  const chosen = [duoAPlayer1, duoAPlayer2, duoBPlayer1, duoBPlayer2].filter(
    (id): id is string => id !== null,
  );
  if (new Set(chosen).size !== chosen.length) {
    flashError("A player can only be in one duo slot");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("duo_submissions").upsert(
    {
      round_id: roundId,
      team_id: teamId,
      captain_player_id: captainPlayerId,
      duo_a_player_1: duoAPlayer1,
      duo_a_player_2: duoAPlayer2,
      duo_b_player_1: duoBPlayer1,
      duo_b_player_2: duoBPlayer2,
      committed_at: new Date().toISOString(),
    },
    { onConflict: "round_id,team_id" },
  );
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/duos");
  revalidatePath("/score");
  flash("Duo lineup saved");
}

export async function resetDuoSubmission(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));
  const teamId = String(formData.get("teamId"));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("duo_submissions")
    .delete()
    .eq("round_id", roundId)
    .eq("team_id", teamId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/duos");
  revalidatePath("/score");
  flash("Duo submission reset — the captain can submit again");
}

// ---------------------------------------------------------------------------
// Schedule items (Brief 8 Part B) — admin-authored content, no player-facing editing.
// ---------------------------------------------------------------------------

export async function createScheduleItem(formData: FormData) {
  await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  if (!seasonId || !title) flashError("Season and title are required");

  const supabase = createAdminClient();
  const { error } = await supabase.from("schedule_items").insert({
    season_id: seasonId,
    title,
    // Brief 26: same Arizona-anchoring as tee_time — every schedule item happens on the trip,
    // in Phoenix, regardless of where Chris is entering it from.
    starts_at: startsAtRaw === "" ? null : arizonaLocalToUtcIso(startsAtRaw),
    notes: notesRaw === "" ? null : notesRaw,
  });
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/schedule");
  flash(`"${title}" added to the schedule`);
}

export async function updateScheduleItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  if (!title) flashError("Title is required");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("schedule_items")
    .update({
      title,
      // Brief 26: same Arizona-anchoring as tee_time — every schedule item happens on the trip,
    // in Phoenix, regardless of where Chris is entering it from.
    starts_at: startsAtRaw === "" ? null : arizonaLocalToUtcIso(startsAtRaw),
      notes: notesRaw === "" ? null : notesRaw,
    })
    .eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/schedule");
  flash("Schedule item updated");
}

export async function deleteScheduleItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("schedule_items").delete().eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/schedule");
  flash("Schedule item removed");
}

// ---------------------------------------------------------------------------
// Champions wall (Brief 8 Part C) — a simple trip-end close-out, not derived live.
// ---------------------------------------------------------------------------

export async function setSeasonTrophies(formData: FormData) {
  await requireAdmin();
  const seasonId = String(formData.get("seasonId"));
  const cupWinnerTeamId = String(formData.get("cupWinnerTeamId") ?? "") || null;
  const individualChampionPlayerId =
    String(formData.get("individualChampionPlayerId") ?? "") || null;
  const skinsKingPlayerId = String(formData.get("skinsKingPlayerId") ?? "") || null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("seasons")
    .update({
      cup_winner_team_id: cupWinnerTeamId,
      individual_champion_player_id: individualChampionPlayerId,
      skins_king_player_id: skinsKingPlayerId,
    })
    .eq("id", seasonId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/champions");
  flash("Champions wall updated");
}

// ---------------------------------------------------------------------------
// Brief 32 — Teams (North Hedges / South Hedges are seeded structural rows: no create, rename
// or delete. Captain and roster are data entered here, never hardcoded.)
// ---------------------------------------------------------------------------

export async function setTeamCaptain(formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId"));
  const captainPlayerId = String(formData.get("captainPlayerId") ?? "") || null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teams")
    .update({ captain_player_id: captainPlayerId })
    .eq("id", teamId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash("Captain saved");
}

// ---------------------------------------------------------------------------
// Brief 32 — Courses
// ---------------------------------------------------------------------------

export async function deleteCourse(formData: FormData) {
  await requireAdmin();
  const courseId = String(formData.get("courseId"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) {
    flashDeleteError(error, "This course is used by a round — switch or remove the round first.");
  }

  revalidatePath("/admin");
  flash("Course removed");
}

// ---------------------------------------------------------------------------
// Brief 32 — Rounds. Seeded (Saturday = 1, Sunday = 2); admin edits course, active tee, and the
// raw tee-time fields. Per-group times are derived (first tee + (slot - 1) x interval), never stored.
// ---------------------------------------------------------------------------

/** Sunday's Purple <-> White switch. Display-only by construction: it only changes which tee's
 *  yardage and rating/slope are shown — scoring is gross and both Saguaro tees share pars. */
export async function setRoundTee(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));
  const teeId = String(formData.get("teeId"));

  const supabase = createAdminClient();
  const [{ data: round }, { data: tee }] = await Promise.all([
    supabase.from("rounds").select("course_id").eq("id", roundId).maybeSingle(),
    supabase.from("course_tees").select("course_id, tee_name").eq("id", teeId).maybeSingle(),
  ]);
  if (!round || !tee) flashError("Round or tee not found");
  if (round.course_id !== tee.course_id) flashError("That tee belongs to a different course");

  const { error } = await supabase.from("rounds").update({ default_tee_id: teeId }).eq("id", roundId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(`Active tee set to ${tee.tee_name}`);
}

/** Scramble <-> best ball for one round. The database trigger (0030) locks this once any score
 *  exists for the round and raises the plain message shown below. */
export async function setRoundFormat(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));
  const format = String(formData.get("format"));
  if (format !== "scramble" && format !== "best_ball") flashError("Unknown format");

  const supabase = createAdminClient();
  const { error } = await supabase.from("rounds").update({ format }).eq("id", roundId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/score");
  flash(`Round format set to ${format === "best_ball" ? "best ball" : "scramble"}`);
}

export async function updateRound(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));
  const courseId = String(formData.get("courseId") ?? "");
  const teeId = String(formData.get("teeId") ?? "") || null;
  const firstTeeRaw = String(formData.get("firstTeeTime") ?? "").trim();
  const intervalRaw = Number(formData.get("groupIntervalMinutes"));
  const noteRaw = String(formData.get("teeTimeNote") ?? "").trim();

  if (!courseId) flashError("Course is required");
  if (!Number.isInteger(intervalRaw) || intervalRaw < 1 || intervalRaw > 60) {
    flashError("Group interval must be a whole number of minutes from 1 to 60");
  }

  const supabase = createAdminClient();
  if (teeId) {
    const { data: tee } = await supabase.from("course_tees").select("course_id").eq("id", teeId).maybeSingle();
    if (!tee || tee.course_id !== courseId) flashError("That tee doesn't belong to the chosen course");
  }

  const { error } = await supabase
    .from("rounds")
    .update({
      course_id: courseId,
      default_tee_id: teeId,
      // Arizona-anchored (lib/timezone.ts): the stored value is the correct UTC instant no matter
      // where Chris is typing it from.
      first_tee_time: firstTeeRaw === "" ? null : arizonaLocalToUtcIso(firstTeeRaw),
      group_interval_minutes: intervalRaw,
      tee_time_note: noteRaw === "" ? null : noteRaw,
    })
    .eq("id", roundId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/schedule");
  flash("Round saved");
}

export async function deleteRound(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("rounds").delete().eq("id", roundId);
  if (error) {
    flashDeleteError(error, "This round has duos or scores — remove them first (scores: Corrections).");
  }

  revalidatePath("/admin");
  revalidatePath("/schedule");
  flash("Round removed");
}

// ---------------------------------------------------------------------------
// Brief 32 — Duos (the stopgap pairing form, until the Pairings Night board exists; afterwards
// the commissioner's override). A match is derived from two duos sharing round + match_slot.
// ---------------------------------------------------------------------------

async function loadDuoValidationContext() {
  const supabase = createAdminClient();
  const [{ data: duos }, { data: members }] = await Promise.all([
    supabase.from("duos").select("id, round_id, team_id, player_1_id, player_2_id, match_slot"),
    supabase.from("team_members").select("team_id, player_id"),
  ]);
  const existingDuos: ExistingDuo[] = (duos ?? []).map((d) => ({
    id: d.id,
    roundId: d.round_id,
    teamId: d.team_id,
    player1Id: d.player_1_id,
    player2Id: d.player_2_id,
    matchSlot: d.match_slot,
  }));
  const rosterByTeam: Record<string, string[]> = {};
  for (const m of members ?? []) (rosterByTeam[m.team_id] ??= []).push(m.player_id);
  return { existingDuos, rosterByTeam };
}

function readDuoForm(formData: FormData) {
  return {
    roundId: String(formData.get("roundId") ?? ""),
    teamId: String(formData.get("teamId") ?? ""),
    player1Id: String(formData.get("player1Id") ?? ""),
    player2Id: String(formData.get("player2Id") ?? "") || null,
    matchSlot: Number(formData.get("matchSlot")),
  };
}

export async function createDuo(formData: FormData) {
  await requireAdmin();
  const input = readDuoForm(formData);
  if (!input.roundId || !input.teamId) flashError("Round and team are required");

  const result = validateDuo(input, await loadDuoValidationContext());
  if (result.errors.length > 0) flashError(result.errors.join(" "));

  const supabase = createAdminClient();
  const { error } = await supabase.from("duos").insert({
    round_id: input.roundId,
    team_id: input.teamId,
    player_1_id: input.player1Id,
    player_2_id: input.player2Id,
    match_slot: input.matchSlot,
  });
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(result.shortHanded ? "Duo created (short-handed)" : "Duo created");
}

export async function updateDuo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const input = { ...readDuoForm(formData), id };

  const result = validateDuo(input, await loadDuoValidationContext());
  if (result.errors.length > 0) flashError(result.errors.join(" "));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("duos")
    .update({ player_1_id: input.player1Id, player_2_id: input.player2Id, match_slot: input.matchSlot })
    .eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(result.shortHanded ? "Duo saved (short-handed)" : "Duo saved");
}

const DUO_HAS_SCORES = "This duo has scores — remove them in Corrections first.";

export async function deleteDuo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  const supabase = createAdminClient();
  // Friendly pre-check; the ON DELETE RESTRICT FK (0026) is the real enforcement and is caught below.
  const [{ count: scores }, { count: mulligans }] = await Promise.all([
    supabase.from("hole_scores").select("id", { count: "exact", head: true }).eq("duo_id", id),
    supabase.from("reverse_mulligans").select("id", { count: "exact", head: true }).eq("duo_id", id),
  ]);
  if ((scores ?? 0) > 0 || (mulligans ?? 0) > 0) flashError(DUO_HAS_SCORES);

  const { error } = await supabase.from("duos").delete().eq("id", id);
  if (error) flashDeleteError(error, DUO_HAS_SCORES);

  revalidatePath("/admin");
  flash("Duo deleted");
}
