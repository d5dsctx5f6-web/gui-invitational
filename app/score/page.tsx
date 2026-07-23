import Link from "next/link";
import { IdentityPicker } from "../IdentityPicker";
import { courseHandicap, playingHandicap, strokesForHoles } from "@/engine/src";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import pageStyles from "../page.module.css";
import { Scorecard } from "./Scorecard";
import styles from "./picker.module.css";
import type {
  ExistingHoleScore,
  ScorecardData,
  ScorecardDuo,
  ScorecardHoleMeta,
  ScorecardPlayer,
  ScorecardReverseMulligan,
} from "./types";

export const dynamic = "force-dynamic";

interface MatchRow {
  id: string;
  round_id: string;
  team_a_id: string;
  team_b_id: string;
  slot: string;
}

interface DuoSubmissionRow {
  team_id: string;
  duo_a_player_1: string;
  duo_a_player_2: string | null;
  duo_b_player_1: string | null;
  duo_b_player_2: string | null;
}

function formatName(format: string): string {
  return format === "shamble" ? "Shamble" : format === "four_ball" ? "Four-ball" : format;
}

async function loadScorecardData(match: MatchRow): Promise<ScorecardData | null> {
  const supabase = await createClient();

  const { data: round } = await supabase
    .from("rounds")
    .select("id, date, format, course_id, default_tee_id")
    .eq("id", match.round_id)
    .single();
  if (!round?.default_tee_id) return null;

  const { data: tee } = await supabase
    .from("course_tees")
    .select("rating, slope, par, stroke_index, par_by_hole, yardage_by_hole")
    .eq("id", round.default_tee_id)
    .single();
  if (!tee) return null;

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", round.course_id)
    .single();

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
    courseName: course?.name ?? "Unknown course",
    format: round.format,
    date: round.date,
    duoA: buildDuo(match.team_a_id, teamAPlayerIds),
    duoB: buildDuo(match.team_b_id, teamBPlayerIds),
    holes,
    existingScores,
    reverseMulligans,
  };
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: 24, color: "var(--cream)" }}>
      <Link href="/" className={pageStyles.backLink}>
        ← Home
      </Link>
      <p>{children}</p>
    </main>
  );
}

export default async function ScorePage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const player = await getCurrentPlayer();
  const { round: roundParam } = await searchParams;

  if (!player) {
    const supabase = await createClient();
    const { data: players } = await supabase
      .from("players")
      .select("id, name")
      .order("name");

    return (
      <main className={pageStyles.page}>
        <Link href="/" className={pageStyles.backLink}>
          ← Home
        </Link>
        <p style={{ color: "var(--cream)", textAlign: "center" }}>
          Sign in with your name and PIN to score this round.
        </p>
        <IdentityPicker players={players ?? []} currentPlayer={null} redirectTo="/score" />
      </main>
    );
  }

  const supabase = await createClient();

  // Brief 10: which match is this signed-in player actually in? A team pairing is two match
  // rows (slot A + slot B) sharing the same team_a_id/team_b_id — team membership alone can't
  // tell them apart, since both belong to the player's team either way. The real disambiguator
  // is duo_submissions: which slot the player's own duo landed in for that round. "Which round"
  // is the only genuine ambiguity (if their team has matches recorded in more than one round at
  // once) — "which of the two identical-looking match rows" is never a real player choice.
  const { data: myTeamRows } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("player_id", player.id);
  const myTeamIds = (myTeamRows ?? []).map((r) => r.team_id);

  if (myTeamIds.length === 0) {
    return (
      <Message>
        You&apos;re not assigned to a team yet — check back after admin publishes the teams.
      </Message>
    );
  }

  const { data: allMatches } = await supabase
    .from("matches")
    .select("id, round_id, team_a_id, team_b_id, slot");
  const myMatches: MatchRow[] = (allMatches ?? []).filter(
    (m) => myTeamIds.includes(m.team_a_id) || myTeamIds.includes(m.team_b_id),
  );
  const myRoundIds = [...new Set(myMatches.map((m) => m.round_id))];

  if (myRoundIds.length === 0) {
    return (
      <Message>
        You&apos;re not in any matchup yet — check back after admin publishes the matchups.
      </Message>
    );
  }

  const targetRoundId =
    myRoundIds.length === 1
      ? myRoundIds[0]
      : myRoundIds.includes(roundParam ?? "")
        ? roundParam!
        : null;

  if (!targetRoundId) {
    // Genuinely ambiguous: this player's team has matches recorded in more than one round.
    const [{ data: rounds }, { data: courses }] = await Promise.all([
      supabase.from("rounds").select("id, date, format, course_id").in("id", myRoundIds),
      supabase.from("courses").select("id, name"),
    ]);

    return (
      <main className={styles.page}>
        <Link href="/" className={pageStyles.backLink}>
          ← Home
        </Link>
        <div className={styles.eyebrow}>Which round?</div>
        <div className={styles.list}>
          {myRoundIds.map((rId) => {
            const round = rounds?.find((r) => r.id === rId);
            const courseNm =
              courses?.find((c) => c.id === round?.course_id)?.name ?? "Unknown course";
            return (
              <Link key={rId} href={`/score?round=${rId}`} className={styles.item}>
                <div className={styles.itemTitle}>
                  {courseNm} — {round ? formatName(round.format) : "?"}
                </div>
                <div className={styles.itemMeta}>{round?.date}</div>
              </Link>
            );
          })}
        </div>
      </main>
    );
  }

  const teamId = myTeamIds.find((id) =>
    myMatches.some(
      (m) => m.round_id === targetRoundId && (m.team_a_id === id || m.team_b_id === id),
    ),
  )!;

  const { data: duoRow } = await supabase
    .from("duo_submissions")
    .select("duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2")
    .eq("round_id", targetRoundId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (!duoRow) {
    return (
      <Message>
        Your team&apos;s duos haven&apos;t been submitted for this round yet — check back once
        your captain commits.
      </Message>
    );
  }

  const mySlot: "A" | "B" | null =
    duoRow.duo_a_player_1 === player.id || duoRow.duo_a_player_2 === player.id
      ? "A"
      : duoRow.duo_b_player_1 === player.id || duoRow.duo_b_player_2 === player.id
        ? "B"
        : null;

  if (!mySlot) {
    return <Message>You&apos;re not in this round&apos;s lineup for your team.</Message>;
  }

  const myMatch = myMatches.find(
    (m) =>
      m.round_id === targetRoundId &&
      m.slot === mySlot &&
      (m.team_a_id === teamId || m.team_b_id === teamId),
  );

  if (!myMatch) {
    return (
      <Message>
        Your matchup isn&apos;t fully set up yet — check back after admin publishes it.
      </Message>
    );
  }

  const data = await loadScorecardData(myMatch);

  if (!data) {
    return (
      <Message>
        The opposing duo hasn&apos;t been submitted yet — check back once both captains
        commit.
      </Message>
    );
  }

  return <Scorecard data={data} currentPlayerId={player.id} />;
}
