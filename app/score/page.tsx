import Link from "next/link";
import { SignInGate } from "../SignInGate";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import { rosterQuery } from "@/lib/season";
import { Card } from "../design-preview/components/Card";
import hedges from "../_hedges/hedges.module.css";
import { Scorecard } from "./Scorecard";
import { fetchSnapshot } from "./fetchSnapshot";
import type { ScoreData, ScoreDuo } from "./types";

export const dynamic = "force-dynamic";

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <main className={hedges.placeholder}>
      <Link href="/" className={hedges.back}>
        ← Home
      </Link>
      <h1 className={hedges.title}>{title}</h1>
      <Card>
        <p className={hedges.body}>{message}</p>
      </Card>
    </main>
  );
}

export default async function ScorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const me = await getCurrentPlayer();

  if (!me) {
    const { data: players } = await rosterQuery<{ id: string; name: string }>(supabase, "id, name");
    return (
      <main className={hedges.placeholder}>
        <Link href="/" className={hedges.back}>
          ← Home
        </Link>
        <h1 className={hedges.title}>Score</h1>
        <p className={hedges.body}>Sign in with your name and PIN to post scores.</p>
        <SignInGate players={players ?? []} />
      </main>
    );
  }

  // The signed-in player's duos, across rounds. The match is the two duos sharing round + slot.
  const { data: myDuos } = await supabase
    .from("duos")
    .select("id, round_id, team_id, match_slot, player_1_id, player_2_id")
    .or(`player_1_id.eq.${me.id},player_2_id.eq.${me.id}`);

  if (!myDuos || myDuos.length === 0) {
    return (
      <EmptyState
        title="Score"
        message="You're not in a match yet. Once the commissioner sets the pairings, your match shows up here."
      />
    );
  }

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, round_number, date, format, course_id, default_tee_id, first_tee_time, group_interval_minutes")
    .in("id", myDuos.map((d) => d.round_id));

  const sortedRounds = (rounds ?? []).slice().sort((a, b) => (b.round_number ?? 0) - (a.round_number ?? 0));
  // "Current round": the latest round this player has a duo in, unless a switcher chip picked one.
  const round = sortedRounds.find((r) => r.id === params.round) ?? sortedRounds[0];
  if (!round) {
    return <EmptyState title="Score" message="Couldn't find your round. Try again in a moment." />;
  }

  const myDuo = myDuos.find((d) => d.round_id === round.id)!;
  const { data: matchDuos } = await supabase
    .from("duos")
    .select("id, team_id, match_slot, player_1_id, player_2_id")
    .eq("round_id", round.id)
    .eq("match_slot", myDuo.match_slot);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", (matchDuos ?? []).map((d) => d.team_id));
  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? "";

  const north = (matchDuos ?? []).find((d) => teamName(d.team_id) === "North Hedges");
  const south = (matchDuos ?? []).find((d) => teamName(d.team_id) === "South Hedges");
  if (!north || !south) {
    return (
      <EmptyState
        title="Score"
        message="Your match isn't complete yet — it needs both a North and a South duo. The commissioner sets that."
      />
    );
  }

  const playerIds = [north.player_1_id, north.player_2_id, south.player_1_id, south.player_2_id].filter(
    (id): id is string => !!id,
  );
  const { data: players } = await supabase.from("players").select("id, name, is_test").in("id", playerIds);
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  const toPlayer = (id: string) => ({ id, name: playerById.get(id)?.name ?? "?" });

  const buildDuo = (d: typeof north, side: "A" | "B"): ScoreDuo => ({
    id: d.id,
    side,
    teamName: teamName(d.team_id),
    matchSlot: d.match_slot,
    player1: toPlayer(d.player_1_id),
    player2: d.player_2_id ? toPlayer(d.player_2_id) : null,
  });

  const [{ data: tee }, { data: course }] = await Promise.all([
    round.default_tee_id
      ? supabase.from("course_tees").select("tee_name, par_by_hole, yardage_by_hole").eq("id", round.default_tee_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("courses").select("name").eq("id", round.course_id).maybeSingle(),
  ]);

  if (!tee?.par_by_hole) {
    return (
      <EmptyState
        title="Score"
        message="This round has no tee with per-hole pars yet. The commissioner sets the tee in admin."
      />
    );
  }

  const initial = await fetchSnapshot(supabase, round.format, round.id, [north.id, south.id]);

  const data: ScoreData = {
    me: { id: me.id, name: me.name, isTest: !!playerById.get(me.id)?.is_test },
    round: {
      id: round.id,
      roundNumber: round.round_number,
      format: round.format,
      courseName: course?.name ?? "",
      teeName: tee.tee_name,
      firstTeeTime: round.first_tee_time,
      intervalMinutes: round.group_interval_minutes,
    },
    parByHole: tee.par_by_hole,
    yardageByHole: tee.yardage_by_hole ?? Array(18).fill(null),
    duoA: buildDuo(north, "A"),
    duoB: buildDuo(south, "B"),
    otherRounds: sortedRounds
      .filter((r) => r.id !== round.id)
      .map((r) => ({ id: r.id, label: r.round_number ? `Round ${r.round_number}` : r.date })),
    initial,
  };

  return <Scorecard data={data} />;
}
