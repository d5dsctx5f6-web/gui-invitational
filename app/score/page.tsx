import { IdentityPicker } from "../IdentityPicker";
import { courseHandicap, playingHandicap, strokesForHoles } from "@/engine/src";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import pageStyles from "../page.module.css";
import { Scorecard } from "./Scorecard";
import type {
  ExistingHoleScore,
  ScorecardData,
  ScorecardDuo,
  ScorecardHoleMeta,
  ScorecardPlayer,
  ScorecardReverseMulligan,
} from "./types";

export const dynamic = "force-dynamic";

interface DuoSubmissionRow {
  team_id: string;
  duo_a_player_1: string;
  duo_a_player_2: string | null;
  duo_b_player_1: string | null;
  duo_b_player_2: string | null;
}

async function loadScorecardData(): Promise<ScorecardData | null> {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, round_id, team_a_id, team_b_id, slot")
    .limit(1)
    .maybeSingle();
  if (!match) return null;

  const { data: round } = await supabase
    .from("rounds")
    .select("id, course_id, default_tee_id")
    .eq("id", match.round_id)
    .single();
  if (!round?.default_tee_id) return null;

  const { data: tee } = await supabase
    .from("course_tees")
    .select("rating, slope, par, stroke_index, par_by_hole, yardage_by_hole")
    .eq("id", round.default_tee_id)
    .single();
  if (!tee) return null;

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [match.team_a_id, match.team_b_id]);

  const { data: duoRows } = await supabase
    .from("duo_submissions")
    .select(
      "team_id, duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2",
    )
    .eq("round_id", match.round_id)
    .in("team_id", [match.team_a_id, match.team_b_id]);

  const duoByTeam = new Map<string, DuoSubmissionRow>(
    (duoRows ?? []).map((row) => [row.team_id, row]),
  );

  function duoPlayerIds(teamId: string, slot: "A" | "B"): string[] {
    const row = duoByTeam.get(teamId);
    if (!row) return [];
    const [p1, p2] =
      slot === "A"
        ? [row.duo_a_player_1, row.duo_a_player_2]
        : [row.duo_b_player_1, row.duo_b_player_2];
    return [p1, p2].filter((id): id is string => id !== null);
  }

  const slot: "A" | "B" = match.slot === "A" ? "A" : "B";
  const teamAPlayerIds = duoPlayerIds(match.team_a_id, slot);
  const teamBPlayerIds = duoPlayerIds(match.team_b_id, slot);
  const allPlayerIds = [...teamAPlayerIds, ...teamBPlayerIds];
  if (allPlayerIds.length === 0) return null;

  const { data: players } = await supabase
    .from("players")
    .select("id, name, index")
    .in("id", allPlayerIds);

  const { data: holeScores } = await supabase
    .from("hole_scores")
    .select("player_id, hole, strokes, match_strokes, breakfast_ball, mulligan")
    .eq("round_id", match.round_id)
    .in("player_id", allPlayerIds);

  const { data: rmRows } = await supabase
    .from("reverse_mulligans")
    .select("id, team_id, hole, victim_player_id, original_holed_score")
    .eq("round_id", match.round_id)
    .in("team_id", [match.team_a_id, match.team_b_id]);

  const reverseMulligans: ScorecardReverseMulligan[] = (rmRows ?? []).map((row) => ({
    id: row.id,
    teamId: row.team_id,
    hole: row.hole,
    victimPlayerId: row.victim_player_id,
    originalHoledScore: row.original_holed_score,
  }));

  const strokeIndexByHole: number[] = tee.stroke_index;
  const parByHole: number[] | null = tee.par_by_hole;
  const yardageByHole: number[] | null = tee.yardage_by_hole;
  const teeSetup = { rating: tee.rating, slope: tee.slope, par: tee.par };

  function buildPlayer(id: string): ScorecardPlayer | null {
    const player = players?.find((p) => p.id === id);
    if (!player) return null;
    const handicap = courseHandicap(player.index ?? 0, teeSetup);
    const dotsByHole = strokesForHoles(
      playingHandicap(handicap),
      strokeIndexByHole,
    );
    return { id: player.id, name: player.name, dotsByHole };
  }

  function buildDuo(teamId: string, playerIds: string[]): ScorecardDuo {
    const team = teams?.find((t) => t.id === teamId);
    return {
      teamId,
      teamName: team?.name ?? "Unnamed team",
      players: playerIds
        .map(buildPlayer)
        .filter((p): p is ScorecardPlayer => p !== null),
    };
  }

  const holes: ScorecardHoleMeta[] = strokeIndexByHole.map((si, i) => ({
    hole: i + 1,
    par: parByHole?.[i] ?? tee.par / 18,
    yardage: yardageByHole?.[i] ?? null,
    strokeIndex: si,
  }));

  const existingScores: ExistingHoleScore[] = (holeScores ?? []).map(
    (row) => ({
      playerId: row.player_id,
      hole: row.hole,
      strokes: row.strokes,
      matchStrokes: row.match_strokes,
      breakfastBall: row.breakfast_ball,
      mulligan: row.mulligan,
    }),
  );

  return {
    matchId: match.id,
    roundId: match.round_id,
    duoA: buildDuo(match.team_a_id, teamAPlayerIds),
    duoB: buildDuo(match.team_b_id, teamBPlayerIds),
    holes,
    existingScores,
    reverseMulligans,
  };
}

export default async function ScorePage() {
  const player = await getCurrentPlayer();

  if (!player) {
    const supabase = await createClient();
    const { data: players } = await supabase
      .from("players")
      .select("id, name")
      .order("name");

    return (
      <main className={pageStyles.page}>
        <p style={{ color: "var(--cream)", textAlign: "center" }}>
          Sign in with your name and PIN to score this round.
        </p>
        <IdentityPicker players={players ?? []} currentPlayer={null} redirectTo="/score" />
      </main>
    );
  }

  const data = await loadScorecardData();

  if (!data) {
    return (
      <main style={{ padding: 24, color: "var(--cream)" }}>
        <p>No match seeded yet. Run the Brief 3 demo-seed migration.</p>
      </main>
    );
  }

  return <Scorecard data={data} currentPlayerId={player.id} />;
}
