import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoundFormat } from "@/engine/src";
import type { ScoreSnapshot } from "./types";

/**
 * Every score and mulligan for one match, for the round's format. Used for the server render and
 * (with the browser client) for every realtime / focus refetch. RLS lets any signed-in device read.
 */
export async function fetchSnapshot(
  supabase: SupabaseClient,
  format: RoundFormat,
  roundId: string,
  duoIds: string[],
): Promise<ScoreSnapshot> {
  const [mulligans, scores] = await Promise.all([
    supabase.from("reverse_mulligans").select("id, duo_id, hole").eq("round_id", roundId).in("duo_id", duoIds),
    format === "scramble"
      ? supabase
          .from("hole_scores")
          .select("duo_id, hole, strokes, tee_shot_used_player_id, updated_by_player_id, updated_at")
          .eq("round_id", roundId)
          .in("duo_id", duoIds)
      : supabase
          .from("player_hole_scores")
          .select("duo_id, player_id, hole, strokes, updated_by_player_id, updated_at")
          .eq("round_id", roundId)
          .in("duo_id", duoIds),
  ]);

  if (mulligans.error) throw new Error(mulligans.error.message);
  if (scores.error) throw new Error(scores.error.message);

  type Row = Record<string, string | number | null>;
  const rows = (scores.data ?? []) as Row[];

  return {
    mulligans: ((mulligans.data ?? []) as Row[]).map((m) => ({
      id: m.id as string,
      duoId: m.duo_id as string,
      hole: m.hole as number,
    })),
    scramble:
      format === "scramble"
        ? rows.map((r) => ({
            duoId: r.duo_id as string,
            hole: r.hole as number,
            strokes: r.strokes as number,
            teeShotPlayerId: (r.tee_shot_used_player_id as string | null) ?? null,
            updatedBy: (r.updated_by_player_id as string | null) ?? null,
            updatedAt: r.updated_at as string,
          }))
        : [],
    bestBall:
      format === "best_ball"
        ? rows.map((r) => ({
            duoId: r.duo_id as string,
            playerId: r.player_id as string,
            hole: r.hole as number,
            strokes: r.strokes as number,
            updatedBy: (r.updated_by_player_id as string | null) ?? null,
            updatedAt: r.updated_at as string,
          }))
        : [],
  };
}
