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
