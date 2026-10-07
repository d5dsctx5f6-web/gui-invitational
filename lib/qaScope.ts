import "server-only";
import { isAdminAuthed } from "@/lib/auth/admin";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import type { Scope } from "./scope";

/**
 * Brief 34: QA data is viewable on /leaderboard and /board only on request (?scope=qa) AND only for
 * the commissioner (a valid admin session) or a device signed in as a QA player. Everyone else asking
 * for ?scope=qa silently gets the real view — and the default view never contains QA data at all.
 */
export async function resolveScope(requested: string | undefined): Promise<Scope> {
  if (requested !== "qa") return "real";
  if (await isAdminAuthed()) return "qa";
  const me = await getCurrentPlayer();
  if (!me) return "real";
  const supabase = await createClient();
  const { data } = await supabase.from("players").select("is_test").eq("id", me.id).maybeSingle();
  return data?.is_test ? "qa" : "real";
}
