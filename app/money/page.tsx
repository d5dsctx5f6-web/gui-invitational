import Link from "next/link";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import { IdentityPicker } from "../IdentityPicker";
import pageStyles from "../page.module.css";
import { MoneyScreen } from "./MoneyScreen";
import styles from "./money.module.css";

export const dynamic = "force-dynamic";

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
        <IdentityPicker players={players ?? []} currentPlayer={null} redirectTo="/money" />
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

  const [{ data: players }, { data: skinsEntries }, { data: holeScores }, { data: bets }, { data: courses }] =
    await Promise.all([
      supabase.from("players").select("id, name").order("name"),
      supabase.from("skins_entries").select("id, player_id, round_id"),
      supabase.from("hole_scores").select("player_id, round_id, hole, strokes"),
      supabase
        .from("challenge_bets")
        .select("id, proposer_id, acceptor_id, terms, stake, status, winner_player_id"),
      supabase.from("courses").select("id, name"),
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
      />
    </main>
  );
}
