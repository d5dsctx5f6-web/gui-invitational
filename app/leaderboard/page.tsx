import { createClient } from "@/lib/supabase/server";
import { LeaderboardScreen, type Snapshot } from "./LeaderboardScreen";

export const dynamic = "force-dynamic";

// Public — no sign-in required, same as /schedule and /champions. Standings aren't
// player-specific, and "who's winning right now" is exactly what Chris wants reachable in
// one tap with zero friction.
export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [rounds, teams, players, matches, duoSubmissions, holeScores, courseTees] =
    await Promise.all([
      supabase.from("rounds").select("id, date, default_tee_id").order("date"),
      supabase.from("teams").select("id, name, captain_player_id"),
      supabase.from("players").select("id, name, index"),
      supabase.from("matches").select("id, round_id, team_a_id, team_b_id, slot"),
      supabase
        .from("duo_submissions")
        .select(
          "round_id, team_id, duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2",
        ),
      supabase
        .from("hole_scores")
        .select("player_id, round_id, hole, strokes, match_strokes"),
      supabase.from("course_tees").select("id, rating, slope, par, stroke_index"),
    ]);

  const initialSnapshot: Snapshot = {
    rounds: rounds.data ?? [],
    teams: teams.data ?? [],
    players: players.data ?? [],
    matches: matches.data ?? [],
    duoSubmissions: duoSubmissions.data ?? [],
    holeScores: holeScores.data ?? [],
    courseTees: courseTees.data ?? [],
  };

  return <LeaderboardScreen initialSnapshot={initialSnapshot} />;
}
