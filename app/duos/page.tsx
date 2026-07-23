import Link from "next/link";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import { IdentityPicker } from "../IdentityPicker";
import pageStyles from "../page.module.css";
import { DuosScreen } from "./DuosScreen";
import styles from "./duos.module.css";

export const dynamic = "force-dynamic";

export default async function DuosPage({
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
          Sign in with your name and PIN to submit duos.
        </p>
        <IdentityPicker players={players ?? []} currentPlayer={null} redirectTo="/duos" />
      </main>
    );
  }

  const supabase = await createClient();

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, date, format, course_id")
    .order("date");

  if (!rounds || rounds.length === 0) {
    return (
      <main style={{ padding: 24, color: "var(--cream)" }}>
        <Link href="/" className={pageStyles.backLink}>
          ← Home
        </Link>
        <p>No rounds set up yet — check back after admin publishes the schedule.</p>
      </main>
    );
  }

  const round = rounds.find((r) => r.id === roundParam) ?? rounds[0];

  const { data: courses } = await supabase
    .from("courses")
    .select("id, name")
    .in(
      "id",
      rounds.map((r) => r.course_id),
    );
  const courseName = (courseId: string) =>
    courses?.find((c) => c.id === courseId)?.name ?? "Unknown course";
  const formatName = (format: string) =>
    format === "shamble" ? "Shamble" : format === "four_ball" ? "Four-ball" : format;
  const roundLabel = (r: { course_id: string; format: string }) =>
    `${courseName(r.course_id)} — ${formatName(r.format)}`;

  const [{ data: matches }, { data: teams }, { data: teamMembers }, { data: players }, { data: submissions }] =
    await Promise.all([
      supabase.from("matches").select("team_a_id, team_b_id").eq("round_id", round.id),
      supabase.from("teams").select("id, name, captain_player_id"),
      supabase.from("team_members").select("team_id, player_id"),
      supabase.from("players").select("id, name").order("name"),
      supabase
        .from("duo_submissions")
        .select(
          "id, team_id, captain_player_id, duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2, committed_at",
        )
        .eq("round_id", round.id),
    ]);

  return (
    <main className={styles.page}>
      <Link href="/" className={pageStyles.backLink}>
        ← Home
      </Link>
      <div className={styles.eyebrow}>
        Duo submissions · <b>{roundLabel(round)}</b>
        <span> · {round.date}</span>
      </div>
      <div className={styles.deadline}>
        Deadline: 30 minutes before {round.date}&apos;s first tee — not hard-blocked after, but
        get it in
      </div>

      {rounds.length > 1 && (
        <div className={styles.roundPicker}>
          {rounds.map((r) => (
            <a
              key={r.id}
              href={`/duos?round=${r.id}`}
              className={`${styles.roundLink} ${r.id === round.id ? styles.roundLinkActive : ""}`}
            >
              {roundLabel(r)}
            </a>
          ))}
        </div>
      )}

      <DuosScreen
        roundId={round.id}
        matches={matches ?? []}
        teams={teams ?? []}
        teamMembers={teamMembers ?? []}
        players={players ?? []}
        currentPlayerId={player.id}
        initialSubmissions={
          (submissions ?? []).map((s) => ({
            id: s.id,
            teamId: s.team_id,
            captainPlayerId: s.captain_player_id,
            duoAPlayer1: s.duo_a_player_1,
            duoAPlayer2: s.duo_a_player_2,
            duoBPlayer1: s.duo_b_player_1,
            duoBPlayer2: s.duo_b_player_2,
            committedAt: s.committed_at,
          }))
        }
      />
    </main>
  );
}
