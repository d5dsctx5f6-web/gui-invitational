"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { cupInputFrom, loadCupData } from "@/lib/cupData";
import { canRecordChipOff, cupStandings } from "@/engine/src";

// Brief 34: the commissioner's two Cup controls — record the chip-off winner, and declare the event
// shortened. Both are behind the admin passcode, both re-check the rules on the SERVER (the UI hiding
// a button is not the guard), and both have an undo.

function back(kind: "msg" | "err", message: string): never {
  redirect(`/admin?${kind}=${encodeURIComponent(message)}#cup`);
}

async function seasonScope(admin: ReturnType<typeof createAdminClient>, seasonId: string) {
  const { data } = await admin.from("seasons").select("id, is_test").eq("id", seasonId).maybeSingle();
  return data ? { id: data.id as string, scope: (data.is_test ? "qa" : "real") as "qa" | "real" } : null;
}

export async function recordChipOffWinner(formData: FormData) {
  await requireAdmin();
  const seasonId = String(formData.get("seasonId"));
  const side = String(formData.get("side"));
  if (side !== "A" && side !== "B") back("err", "Pick a team");

  const admin = createAdminClient();
  const season = await seasonScope(admin, seasonId);
  if (!season) back("err", "Season not found");

  // The rule lives here, not in the button: only a genuine chip-off can record a winner.
  const standings = cupStandings(cupInputFrom(await loadCupData(admin, season.scope)));
  const allowed = canRecordChipOff(standings);
  if (!allowed.ok) back("err", allowed.message ?? "No chip-off is required right now.");

  const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", seasonId);
  const teamId = teams?.find((t) => t.name === (side === "A" ? "North Hedges" : "South Hedges"))?.id;
  if (!teamId) back("err", "Team not found");

  const { error } = await admin.from("seasons").update({ chip_off_winner_team_id: teamId }).eq("id", seasonId);
  if (error) back("err", error.message);

  for (const p of ["/admin", "/leaderboard", "/board", "/champions"]) revalidatePath(p);
  back("msg", `Chip-off winner recorded: ${side === "A" ? "North" : "South"} Hedges`);
}

export async function clearChipOffWinner(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("seasons")
    .update({ chip_off_winner_team_id: null })
    .eq("id", String(formData.get("seasonId")));
  if (error) back("err", error.message);
  for (const p of ["/admin", "/leaderboard", "/board", "/champions"]) revalidatePath(p);
  back("msg", "Chip-off winner cleared");
}

/** value=true declares the event shortened; value=false undoes it. Never automatic. */
export async function setEventShortened(formData: FormData) {
  await requireAdmin();
  const value = String(formData.get("value")) === "true";
  const admin = createAdminClient();
  const { error } = await admin
    .from("seasons")
    .update({ event_shortened: value })
    .eq("id", String(formData.get("seasonId")));
  if (error) back("err", error.message);
  for (const p of ["/admin", "/leaderboard", "/board"]) revalidatePath(p);
  back("msg", value ? "Event declared shortened — standings after the last completed round" : "Shortened declaration undone");
}
