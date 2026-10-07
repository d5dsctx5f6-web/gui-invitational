"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

// Brief 33 Part E — admin Corrections for duo scores. Service-role writes (behind the admin
// passcode), so the "updated by" trigger records the commissioner (player null). Every action
// returns to the same round/match/hole drill-down via the `returnTo` hidden field.

function back(returnTo: string, kind: "msg" | "err", message: string): never {
  const safe = returnTo.startsWith("/admin") ? returnTo : "/admin";
  const [path, hash = "corrections"] = safe.split("#");
  const joiner = path.includes("?") ? "&" : "?";
  redirect(`${path}${joiner}${kind}=${encodeURIComponent(message)}#${hash}`);
}

function intOrNull(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : NaN;
}

function validStrokes(n: number | null): boolean {
  return n === null || (Number.isInteger(n) && n >= 1 && n <= 20);
}

export async function correctScrambleScore(formData: FormData) {
  await requireAdmin();
  const returnTo = String(formData.get("returnTo"));
  const duoId = String(formData.get("duoId"));
  const roundId = String(formData.get("roundId"));
  const hole = Number(formData.get("hole"));
  const strokes = intOrNull(formData.get("strokes"));
  const teeShot = String(formData.get("teeShotPlayerId") ?? "") || null;
  if (strokes === null || !validStrokes(strokes)) back(returnTo, "err", "Strokes must be a whole number from 1 to 20");

  const admin = createAdminClient();
  const { error } = await admin
    .from("hole_scores")
    .upsert(
      { duo_id: duoId, round_id: roundId, hole, strokes, tee_shot_used_player_id: teeShot },
      { onConflict: "duo_id,round_id,hole" },
    );
  if (error) back(returnTo, "err", error.message);

  revalidatePath("/score");
  back(returnTo, "msg", `Hole ${hole} corrected`);
}

/** Best ball: one form per duo with a strokes box per player. Blank = no row (picked up). */
export async function correctBestBallScores(formData: FormData) {
  await requireAdmin();
  const returnTo = String(formData.get("returnTo"));
  const duoId = String(formData.get("duoId"));
  const roundId = String(formData.get("roundId"));
  const hole = Number(formData.get("hole"));
  const playerIds = String(formData.get("playerIds") ?? "").split(",").filter(Boolean);

  const admin = createAdminClient();
  for (const playerId of playerIds) {
    const strokes = intOrNull(formData.get(`strokes_${playerId}`));
    if (!validStrokes(strokes)) back(returnTo, "err", "Strokes must be a whole number from 1 to 20");
    if (strokes === null) {
      const { error } = await admin.from("player_hole_scores").delete().eq("round_id", roundId).eq("hole", hole).eq("player_id", playerId);
      if (error) back(returnTo, "err", error.message);
    } else {
      const { error } = await admin
        .from("player_hole_scores")
        .upsert({ round_id: roundId, duo_id: duoId, player_id: playerId, hole, strokes }, { onConflict: "player_id,round_id,hole" });
      if (error) back(returnTo, "err", error.message);
    }
  }

  revalidatePath("/score");
  back(returnTo, "msg", `Hole ${hole} corrected`);
}

/** Deletes one hole's scores for BOTH duos of a match (either format). */
export async function deleteHoleScores(formData: FormData) {
  await requireAdmin();
  const returnTo = String(formData.get("returnTo"));
  const duoIds = String(formData.get("duoIds") ?? "").split(",").filter(Boolean);
  const hole = Number(formData.get("hole"));

  const admin = createAdminClient();
  for (const table of ["hole_scores", "player_hole_scores"] as const) {
    const { error } = await admin.from(table).delete().in("duo_id", duoIds).eq("hole", hole);
    if (error) back(returnTo, "err", error.message);
  }
  revalidatePath("/score");
  back(returnTo, "msg", `Hole ${hole} scores deleted`);
}

/** Deletes EVERY score for both duos of a match — required before a duo can be deleted (RESTRICT). */
export async function deleteMatchScores(formData: FormData) {
  await requireAdmin();
  const returnTo = String(formData.get("returnTo"));
  const duoIds = String(formData.get("duoIds") ?? "").split(",").filter(Boolean);

  const admin = createAdminClient();
  for (const table of ["hole_scores", "player_hole_scores"] as const) {
    const { error } = await admin.from(table).delete().in("duo_id", duoIds);
    if (error) back(returnTo, "err", error.message);
  }
  revalidatePath("/score");
  back(returnTo, "msg", "All scores for this match deleted");
}

/** The only undo path for a reverse mulligan call. */
export async function removeReverseMulliganCall(formData: FormData) {
  await requireAdmin();
  const returnTo = String(formData.get("returnTo"));
  const id = String(formData.get("id"));

  const admin = createAdminClient();
  const { error } = await admin.from("reverse_mulligans").delete().eq("id", id);
  if (error) back(returnTo, "err", error.message);

  revalidatePath("/score");
  back(returnTo, "msg", "Reverse mulligan call removed");
}
