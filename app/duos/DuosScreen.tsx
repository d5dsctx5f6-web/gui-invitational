"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/supabase/useRealtimeRefetch";
import styles from "./duos.module.css";

interface Team {
  id: string;
  name: string;
  captain_player_id: string | null;
}

interface Player {
  id: string;
  name: string;
}

interface TeamMember {
  team_id: string;
  player_id: string;
}

interface Match {
  team_a_id: string;
  team_b_id: string;
}

export interface DuoSubmission {
  id: string;
  teamId: string;
  captainPlayerId: string;
  duoAPlayer1: string;
  duoAPlayer2: string | null;
  duoBPlayer1: string | null;
  duoBPlayer2: string | null;
  committedAt: string | null;
}

type Assignment = "A" | "B" | null;

function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

export function DuosScreen({
  roundId,
  matches,
  teams,
  teamMembers,
  players,
  currentPlayerId,
  initialSubmissions,
}: {
  roundId: string;
  matches: Match[];
  teams: Team[];
  teamMembers: TeamMember[];
  players: Player[];
  currentPlayerId: string;
  initialSubmissions: DuoSubmission[];
}) {
  const [submissions, setSubmissions] = useState<DuoSubmission[]>(initialSubmissions);

  async function refetch() {
    const supabase = createClient();
    const { data } = await supabase
      .from("duo_submissions")
      .select(
        "id, team_id, captain_player_id, duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2, committed_at",
      )
      .eq("round_id", roundId);
    setSubmissions(
      (data ?? []).map((s) => ({
        id: s.id,
        teamId: s.team_id,
        captainPlayerId: s.captain_player_id,
        duoAPlayer1: s.duo_a_player_1,
        duoAPlayer2: s.duo_a_player_2,
        duoBPlayer1: s.duo_b_player_1,
        duoBPlayer2: s.duo_b_player_2,
        committedAt: s.committed_at,
      })),
    );
  }

  const roundFilter = useMemo(() => ({ column: "round_id", value: roundId }), [roundId]);
  useRealtimeRefetch("duo_submissions", roundFilter, refetch);

  // Unique team pairings for this round — matches has one row per slot (A/B), both sharing
  // the same team_a_id/team_b_id, so dedupe by team id pair.
  const pairings = useMemo(() => {
    const seen = new Set<string>();
    const result: { teamXId: string; teamYId: string }[] = [];
    for (const m of matches) {
      const key = [m.team_a_id, m.team_b_id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ teamXId: m.team_a_id, teamYId: m.team_b_id });
    }
    return result;
  }, [matches]);

  const myTeam = teams.find((t) => t.captain_player_id === currentPlayerId) ?? null;

  if (pairings.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.hint}>
          Matchups for this round haven&apos;t been set yet — check back after admin
          publishes them.
        </p>
      </div>
    );
  }

  return (
    <>
      {pairings.map((pairing) => (
        <Matchup
          key={`${pairing.teamXId}:${pairing.teamYId}`}
          teamXId={pairing.teamXId}
          teamYId={pairing.teamYId}
          teams={teams}
          teamMembers={teamMembers}
          players={players}
          submissions={submissions}
          myTeam={myTeam}
          roundId={roundId}
          currentPlayerId={currentPlayerId}
          onCommitted={refetch}
        />
      ))}
    </>
  );
}

function Matchup({
  teamXId,
  teamYId,
  teams,
  teamMembers,
  players,
  submissions,
  myTeam,
  roundId,
  currentPlayerId,
  onCommitted,
}: {
  teamXId: string;
  teamYId: string;
  teams: Team[];
  teamMembers: TeamMember[];
  players: Player[];
  submissions: DuoSubmission[];
  myTeam: Team | null;
  roundId: string;
  currentPlayerId: string;
  onCommitted: () => void;
}) {
  const teamX = teams.find((t) => t.id === teamXId);
  const teamY = teams.find((t) => t.id === teamYId);
  const subX = submissions.find((s) => s.teamId === teamXId) ?? null;
  const subY = submissions.find((s) => s.teamId === teamYId) ?? null;
  const bothCommitted = subX !== null && subY !== null;

  const iAmCaptainOfX = myTeam?.id === teamXId;
  const iAmCaptainOfY = myTeam?.id === teamYId;

  return (
    <div className={styles.card}>
      <div className={styles.cardhead}>
        <h2>
          {teamX?.name ?? "?"} v {teamY?.name ?? "?"}
        </h2>
      </div>

      {bothCommitted ? (
        <>
          <RevealedDuo label={`${teamX?.name} — Duo A`} playerIds={[subX!.duoAPlayer1, subX!.duoAPlayer2]} players={players} />
          <RevealedDuo label={`${teamX?.name} — Duo B`} playerIds={[subX!.duoBPlayer1, subX!.duoBPlayer2]} players={players} />
          <RevealedDuo label={`${teamY?.name} — Duo A`} playerIds={[subY!.duoAPlayer1, subY!.duoAPlayer2]} players={players} />
          <RevealedDuo label={`${teamY?.name} — Duo B`} playerIds={[subY!.duoBPlayer1, subY!.duoBPlayer2]} players={players} />
        </>
      ) : (
        <>
          <TeamStatusRow
            team={teamX}
            submitted={subX !== null}
            iAmCaptain={iAmCaptainOfX}
            teamMembers={teamMembers}
            players={players}
            roundId={roundId}
            currentPlayerId={currentPlayerId}
            onCommitted={onCommitted}
          />
          <TeamStatusRow
            team={teamY}
            submitted={subY !== null}
            iAmCaptain={iAmCaptainOfY}
            teamMembers={teamMembers}
            players={players}
            roundId={roundId}
            currentPlayerId={currentPlayerId}
            onCommitted={onCommitted}
          />
        </>
      )}
    </div>
  );
}

function RevealedDuo({
  label,
  playerIds,
  players,
}: {
  label: string;
  playerIds: (string | null)[];
  players: Player[];
}) {
  const names = playerIds.filter((id): id is string => id !== null).map((id) => playerName(players, id));
  if (names.length === 0) return null;
  return (
    <div className={styles.duoRow}>
      <span className={styles.duoLabel}>{label}</span>
      <span className={styles.duoNames}>{names.join(" & ")}</span>
    </div>
  );
}

function TeamStatusRow({
  team,
  submitted,
  iAmCaptain,
  teamMembers,
  players,
  roundId,
  currentPlayerId,
  onCommitted,
}: {
  team: Team | undefined;
  submitted: boolean;
  iAmCaptain: boolean;
  teamMembers: TeamMember[];
  players: Player[];
  roundId: string;
  currentPlayerId: string;
  onCommitted: () => void;
}) {
  if (!team) return null;

  if (submitted) {
    return (
      <div className={styles.statusRow}>
        <b>{team.name}</b> — submitted, waiting on opponent
      </div>
    );
  }

  if (!iAmCaptain) {
    return (
      <div className={styles.statusRow}>
        <b>{team.name}</b> — not yet submitted
      </div>
    );
  }

  const roster = teamMembers
    .filter((tm) => tm.team_id === team.id)
    .map((tm) => players.find((p) => p.id === tm.player_id))
    .filter((p): p is Player => p !== undefined);

  return (
    <CaptainForm
      team={team}
      roster={roster}
      roundId={roundId}
      currentPlayerId={currentPlayerId}
      onCommitted={onCommitted}
    />
  );
}

function CaptainForm({
  team,
  roster,
  roundId,
  currentPlayerId,
  onCommitted,
}: {
  team: Team;
  roster: Player[];
  roundId: string;
  currentPlayerId: string;
  onCommitted: () => void;
}) {
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cycle(playerId: string) {
    setAssignments((prev) => {
      const current = prev[playerId] ?? null;
      const next: Assignment = current === null ? "A" : current === "A" ? "B" : null;
      return { ...prev, [playerId]: next };
    });
  }

  const duoA = roster.filter((p) => assignments[p.id] === "A");
  const duoB = roster.filter((p) => assignments[p.id] === "B");

  async function commit() {
    if (duoA.length === 0) {
      setError("Duo A needs at least one player");
      return;
    }
    if (duoA.length > 2 || duoB.length > 2) {
      setError("A duo can have at most two players");
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: upsertError } = await supabase.from("duo_submissions").upsert(
      {
        round_id: roundId,
        team_id: team.id,
        captain_player_id: currentPlayerId,
        duo_a_player_1: duoA[0].id,
        duo_a_player_2: duoA[1]?.id ?? null,
        duo_b_player_1: duoB[0]?.id ?? null,
        duo_b_player_2: duoB[1]?.id ?? null,
        committed_at: new Date().toISOString(),
      },
      { onConflict: "round_id,team_id" },
    );

    setBusy(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    onCommitted();
  }

  return (
    <div className={styles.captainForm}>
      <div className={styles.hint}>{team.name} — tap a player to cycle Duo A / Duo B / off</div>
      <div className={styles.rosterGrid}>
        {roster.map((p) => {
          const a = assignments[p.id] ?? null;
          return (
            <button
              key={p.id}
              className={`${styles.rosterChip} ${
                a === "A" ? styles.rosterChipA : a === "B" ? styles.rosterChipB : ""
              }`}
              onClick={() => cycle(p.id)}
            >
              {p.name}
              {a && <span className={styles.rosterChipTag}> · {a}</span>}
            </button>
          );
        })}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <button className={styles.commitBtn} disabled={busy} onClick={commit}>
        {busy ? "Submitting…" : "Commit duos"}
      </button>
      <div className={styles.hint}>Reveal fires the moment both captains have committed</div>
    </div>
  );
}
