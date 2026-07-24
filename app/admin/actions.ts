"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPasscode, clearAdminSession, requireAdmin, setAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

function flash(message: string): never {
  redirect(`/admin?msg=${encodeURIComponent(message)}`);
}

function flashError(message: string): never {
  redirect(`/admin?err=${encodeURIComponent(message)}`);
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

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) flashError("Team name is required");

  const supabase = createAdminClient();
  const { data: season } = await supabase.from("seasons").select("id").limit(1).maybeSingle();
  if (!season) flashError("No season exists yet");

  const { error } = await supabase.from("teams").insert({ season_id: season.id, name });
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(`Team "${name}" created`);
}

export async function updateTeam(formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId"));
  const name = String(formData.get("name") ?? "").trim();
  const captainPlayerId = String(formData.get("captainPlayerId") ?? "") || null;
  if (!name) flashError("Team name is required");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teams")
    .update({ name, captain_player_id: captainPlayerId })
    .eq("id", teamId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(`Team "${name}" updated`);
}

// Brief 9 Part A: cascades to team_members, matches (either side), duo_submissions, and
// reverse_mulligans (0021) — a team's cup-winner reference on any season is cleared (set null),
// not cascaded, so deleting a team never silently erases champions-wall history.
export async function deleteTeam(formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/score");
  revalidatePath("/duos");
  revalidatePath("/champions");
  flash("Team removed");
}

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
// Rounds + Matchups
// ---------------------------------------------------------------------------

export async function createRound(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const format = String(formData.get("format") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const teeId = String(formData.get("teeId") ?? "") || null;
  if (!date || !["shamble", "four_ball"].includes(format) || !courseId) {
    flashError("Date, format, and course are required");
  }

  const supabase = createAdminClient();
  const { data: season } = await supabase.from("seasons").select("id").limit(1).maybeSingle();
  if (!season) flashError("No season exists yet");

  const { error } = await supabase.from("rounds").insert({
    season_id: season.id,
    date,
    format,
    course_id: courseId,
    default_tee_id: teeId,
  });
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash("Round created");
}

export async function upsertMatch(formData: FormData) {
  await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "") || null;
  const roundId = String(formData.get("roundId") ?? "");
  const teamAId = String(formData.get("teamAId") ?? "");
  const teamBId = String(formData.get("teamBId") ?? "");
  const slot = String(formData.get("slot") ?? "");
  if (!roundId || !teamAId || !teamBId || !["A", "B"].includes(slot)) {
    flashError("Round, both teams, and slot are required");
  }
  if (teamAId === teamBId) flashError("A team can't play itself");

  const supabase = createAdminClient();
  const row = { round_id: roundId, team_a_id: teamAId, team_b_id: teamBId, slot };
  const { error } = matchId
    ? await supabase.from("matches").update(row).eq("id", matchId)
    : await supabase.from("matches").insert(row);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash(matchId ? "Matchup updated" : "Matchup added");
}

export async function deleteMatch(formData: FormData) {
  await requireAdmin();
  const matchId = String(formData.get("matchId"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  flash("Matchup removed");
}

// Brief 9 Part A: deleting a round cascades to its matches, hole_scores, duo_submissions,
// skins_entries, and reverse_mulligans — enforced at the DB level (0021), not walked manually
// here, so it's atomic. The confirmation UI computes what's about to go before this ever runs.
export async function deleteRound(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("rounds").delete().eq("id", roundId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/score");
  revalidatePath("/duos");
  revalidatePath("/money");
  revalidatePath("/schedule");
  flash("Round removed");
}

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

// Brief 9 Part A: cascades to course_tees and (through rounds' own cascade, 0021) every
// round played there and everything scored in those rounds. This is the deepest cascade admin
// exposes — the confirmation message sums dependents across every round on the course, not
// just direct course_tees.
export async function deleteCourse(formData: FormData) {
  await requireAdmin();
  const courseId = String(formData.get("courseId"));

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/score");
  revalidatePath("/duos");
  revalidatePath("/money");
  flash("Course removed");
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

  if (Number.isNaN(strokes) || strokes < 1) flashError("Strokes must be a positive number");
  if (matchStrokes !== null && Number.isNaN(matchStrokes)) flashError("Match strokes must be a number");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("hole_scores")
    .update({
      strokes,
      match_strokes: matchStrokes,
      breakfast_ball: breakfastBall,
      mulligan,
    })
    .eq("id", id);
  if (error) flashError(error.message);

  revalidatePath("/admin");
  revalidatePath("/score");
  flash("Score corrected — recomputes everywhere downstream");
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
    starts_at: startsAtRaw === "" ? null : new Date(startsAtRaw).toISOString(),
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
      starts_at: startsAtRaw === "" ? null : new Date(startsAtRaw).toISOString(),
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
