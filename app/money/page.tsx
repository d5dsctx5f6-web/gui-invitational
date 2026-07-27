import Link from "next/link";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import { SignInGate } from "../SignInGate";
import pageStyles from "../page.module.css";
import { MoneyScreen } from "./MoneyScreen";
import styles from "./money.module.css";

export const dynamic = "force-dynamic";

// Brief 22: skins opt-in's cutoff is the signed-in player's own match tee time — no early
// offset (unlike duo submissions' round-wide earliest-tee-minus-30, which stays as-is). Resolved
// the same way /score routes a player to their match (Brief 10): team -> this round's
// duo_submissions -> which slot the player landed in -> the match row for that slot. Null at any
// step (no team, no duo picks yet, match not set up, tee time not assigned) means "unknown" —
// the caller falls back to generic informational text, never a hard block either way.
async function resolveMyMatchTeeTime(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
  roundId: string,
): Promise<string | null> {
  const { data: myTeamRows } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("player_id", playerId);
  const myTeamIds = (myTeamRows ?? []).map((r) => r.team_id);
  if (myTeamIds.length === 0) return null;

  const { data: matchesCore } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, slot")
    .eq("round_id", roundId);
  const myMatchesCore = (matchesCore ?? []).filter(
    (m) => myTeamIds.includes(m.team_a_id) || myTeamIds.includes(m.team_b_id),
  );
  if (myMatchesCore.length === 0) return null;

  const teamId = myTeamIds.find((id) =>
    myMatchesCore.some((m) => m.team_a_id === id || m.team_b_id === id),
  )!;

  const { data: duoRow } = await supabase
    .from("duo_submissions")
    .select("duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2")
    .eq("round_id", roundId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!duoRow) return null;

  const mySlot: "A" | "B" | null =
    duoRow.duo_a_player_1 === playerId || duoRow.duo_a_player_2 === playerId
      ? "A"
      : duoRow.duo_b_player_1 === playerId || duoRow.duo_b_player_2 === playerId
        ? "B"
        : null;
  if (!mySlot) return null;

  const myMatchCore = myMatchesCore.find(
    (m) => m.slot === mySlot && (m.team_a_id === teamId || m.team_b_id === teamId),
  );
  if (!myMatchCore) return null;

  // Decoupled from the core matches fetch (same standing pattern as skins_buy_in/season
  // trophies) so this resolution keeps working on a database that hasn't run migration 0023 yet.
  const { data: teeTimeRow } = await supabase
    .from("matches")
    .select("tee_time")
    .eq("id", myMatchCore.id)
    .maybeSingle();
  return teeTimeRow?.tee_time ?? null;
}

export default async function MoneyPage({
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
          Sign in with your name and PIN to see the Money screen.
        </p>
        <SignInGate players={players ?? []} />
      </main>
    );
  }

  const supabase = await createClient();

  const { data: roundsCore } = await supabase
    .from("rounds")
    .select("id, date, format, course_id")
    .order("date");

  if (!roundsCore || roundsCore.length === 0) {
    return (
      <main style={{ padding: 24, color: "var(--cream)" }}>
        <Link href="/" className={pageStyles.backLink}>
          ← Home
        </Link>
        <p>No rounds set up yet — check back after admin publishes the schedule.</p>
      </main>
    );
  }

  // Fetched separately so a database that hasn't run 0019 (skins_buy_in) yet still shows
  // rounds and lets skins/ledger work — just with buy-in treated as unset.
  const { data: buyIns } = await supabase.from("rounds").select("id, skins_buy_in");
  const buyInByRoundId = new Map<string, number | null>(
    (buyIns ?? []).map((r) => [r.id, r.skins_buy_in]),
  );
  const rounds = roundsCore.map((r) => ({
    ...r,
    skins_buy_in: buyInByRoundId.get(r.id) ?? null,
  }));

  const selectedRoundId = rounds.find((r) => r.id === roundParam)?.id ?? rounds[0].id;

  const [
    { data: players },
    { data: skinsEntries },
    { data: holeScores },
    { data: bets },
    { data: courses },
    mySkinsCutoffTeeTime,
  ] = await Promise.all([
    supabase.from("players").select("id, name").order("name"),
    supabase.from("skins_entries").select("id, player_id, round_id"),
    supabase.from("hole_scores").select("player_id, round_id, hole, strokes"),
    supabase
      .from("challenge_bets")
      .select("id, proposer_id, acceptor_id, terms, stake, status, winner_player_id"),
    supabase.from("courses").select("id, name"),
    resolveMyMatchTeeTime(supabase, player.id, selectedRoundId),
  ]);

  const courseName = (courseId: string) =>
    courses?.find((c) => c.id === courseId)?.name ?? "Unknown course";
  const formatName = (format: string) =>
    format === "shamble" ? "Shamble" : format === "four_ball" ? "Four-ball" : format;
  const roundLabel = (r: { course_id: string; format: string }) =>
    `${courseName(r.course_id)} — ${formatName(r.format)}`;

  return (
    <main className={styles.page}>
      <Link href="/" className={pageStyles.backLink}>
        ← Home
      </Link>
      <div className={styles.eyebrow}>
        Money · <b>skins + the Challenge Ledger — nothing else</b>
      </div>

      {rounds.length > 1 && (
        <div className={styles.roundPicker}>
          {rounds.map((r) => (
            <a
              key={r.id}
              href={`/money?round=${r.id}`}
              className={`${styles.roundLink} ${r.id === selectedRoundId ? styles.roundLinkActive : ""}`}
            >
              {roundLabel(r)}
            </a>
          ))}
        </div>
      )}

      <MoneyScreen
        rounds={rounds}
        selectedRoundId={selectedRoundId}
        players={players ?? []}
        initialSkinsEntries={skinsEntries ?? []}
        initialHoleScores={holeScores ?? []}
        initialBets={bets ?? []}
        currentPlayerId={player.id}
        courses={courses ?? []}
        mySkinsCutoffTeeTime={mySkinsCutoffTeeTime}
      />
    </main>
  );
}
