"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Best ball only: a player who PICKED UP has no row for the hole, so posting a hole may need to
 * remove a row he posted earlier. The scores tables have no DELETE policy (deletes are
 * service-role only), so this goes through here: the caller's own session must pass the same
 * can_score_duo() check RLS uses for writes, and only then does the service role delete exactly
 * those rows.
 */
export async function clearPlayerHoleScores(
  roundId: string,
  hole: number,
  playerIds: string[],
): Promise<{ ok: boolean; message?: string }> {
  if (playerIds.length === 0) return { ok: true };
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("player_hole_scores")
    .select("id, duo_id")
    .eq("round_id", roundId)
    .eq("hole", hole)
    .in("player_id", playerIds);
  if (error) return { ok: false, message: error.message };
  if (!rows || rows.length === 0) return { ok: true };

  for (const duoId of new Set(rows.map((r) => r.duo_id))) {
    const { data: allowed } = await supabase.rpc("can_score_duo", { p_duo_id: duoId });
    if (!allowed) return { ok: false, message: "You're not in this match." };
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("player_hole_scores")
    .delete()
    .in("id", rows.map((r) => r.id));
  if (deleteError) return { ok: false, message: deleteError.message };
  return { ok: true };
}

/**
 * Removes this device's QA link, but ONLY if it is linked to a test player. (A device never holds a
 * QA link and a real link at once; after this the person re-enters their own PIN.)
 */
export async function exitQa() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    const { data: link } = await admin
      .from("player_devices")
      .select("player_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (link) {
      const { data: player } = await admin.from("players").select("is_test").eq("id", link.player_id).maybeSingle();
      if (player?.is_test) await admin.from("player_devices").delete().eq("auth_user_id", user.id);
    }
  }
  redirect("/");
}
