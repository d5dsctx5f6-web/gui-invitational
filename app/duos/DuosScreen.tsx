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

type SlotKey = "A1" | "A2" | "B1" | "B2";

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
            submission={subX}
            iAmCaptain={iAmCaptainOfX}
            teamMembers={teamMembers}
            players={players}
            roundId={roundId}
            currentPlayerId={currentPlayerId}
            onCommitted={onCommitted}
          />
          <TeamStatusRow
            team={teamY}
            submission={subY}
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
  submission,
  iAmCaptain,
  teamMembers,
  players,
  roundId,
  currentPlayerId,
  onCommitted,
}: {
  team: Team | undefined;
  submission: DuoSubmission | null;
  iAmCaptain: boolean;
  teamMembers: TeamMember[];
  players: Player[];
  roundId: string;
  currentPlayerId: string;
  onCommitted: () => void;
}) {
  if (!team) return null;

  // Brief 13: a submission existing doesn't mean the captain is done looking at this — they
  // need to be able to review and correct their own picks right up until both teams reveal.
  // Only non-captain teammates (who can't act on it anyway) get the plain status line.
  if (!iAmCaptain) {
    return (
      <div className={styles.statusRow}>
        <b>{team.name}</b> — {submission ? "submitted, waiting on opponent" : "not yet submitted"}
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
      existingSubmission={submission}
      onCommitted={onCommitted}
    />
  );
}

function CaptainForm({
  team,
  roster,
  roundId,
  currentPlayerId,
  existingSubmission,
  onCommitted,
}: {
  team: Team;
  roster: Player[];
  roundId: string;
  currentPlayerId: string;
  existingSubmission: DuoSubmission | null;
  onCommitted: () => void;
}) {
  const [slots, setSlots] = useState<Record<SlotKey, string | null>>(() => ({
    A1: existingSubmission?.duoAPlayer1 ?? null,
    A2: existingSubmission?.duoAPlayer2 ?? null,
    B1: existingSubmission?.duoBPlayer1 ?? null,
    B2: existingSubmission?.duoBPlayer2 ?? null,
  }));
  const [pickingSlot, setPickingSlot] = useState<SlotKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const assignedIds = new Set(Object.values(slots).filter((id): id is string => id !== null));
  const available = roster.filter((p) => !assignedIds.has(p.id));

  function assign(slot: SlotKey, playerId: string) {
    setSlots((prev) => ({ ...prev, [slot]: playerId }));
    setPickingSlot(null);
  }

  function clear(slot: SlotKey) {
    setSlots((prev) => ({ ...prev, [slot]: null }));
  }

  function openSlot(slot: SlotKey) {
    setPickingSlot((prev) => (prev === slot ? null : slot));
  }

  const duoA = [slots.A1, slots.A2].filter((id): id is string => id !== null);
  const duoB = [slots.B1, slots.B2].filter((id): id is string => id !== null);

  async function commit() {
    if (duoA.length === 0) {
      setError("Duo A needs at least one player");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccessMessage(null);

    const supabase = createClient();
    const { error: upsertError } = await supabase.from("duo_submissions").upsert(
      {
        round_id: roundId,
        team_id: team.id,
        captain_player_id: currentPlayerId,
        duo_a_player_1: duoA[0],
        duo_a_player_2: duoA[1] ?? null,
        duo_b_player_1: duoB[0] ?? null,
        duo_b_player_2: duoB[1] ?? null,
        committed_at: new Date().toISOString(),
      },
      { onConflict: "round_id,team_id" },
    );

    setBusy(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setSuccessMessage(existingSubmission ? "Lineup updated" : "Lineup submitted");
    onCommitted();
  }

  return (
    <div className={styles.captainForm}>
      <div className={styles.hint}>
        {team.name} — tap an open slot, then tap a player to fill it
        {existingSubmission && " — you can still change this until both teams reveal"}
      </div>

      <div className={styles.duoZones}>
        <div className={styles.duoZone}>
          <div className={styles.duoZoneLabel}>Duo A</div>
          <div className={styles.slotRow}>
            <Slot slotKey="A1" playerId={slots.A1} roster={roster} active={pickingSlot === "A1"} onOpen={openSlot} onClear={clear} />
            <Slot slotKey="A2" playerId={slots.A2} roster={roster} active={pickingSlot === "A2"} onOpen={openSlot} onClear={clear} />
          </div>
        </div>
        <div className={styles.duoZone}>
          <div className={styles.duoZoneLabel}>Duo B</div>
          <div className={styles.slotRow}>
            <Slot slotKey="B1" playerId={slots.B1} roster={roster} active={pickingSlot === "B1"} onOpen={openSlot} onClear={clear} />
            <Slot slotKey="B2" playerId={slots.B2} roster={roster} active={pickingSlot === "B2"} onOpen={openSlot} onClear={clear} />
          </div>
        </div>
      </div>

      {pickingSlot && (
        <div className={styles.pickerPanel}>
          <div className={styles.pickerHead}>
            Filling {pickingSlot[0] === "A" ? "Duo A" : "Duo B"}
            <button className={styles.pickerClose} onClick={() => setPickingSlot(null)} aria-label="Cancel">
              ×
            </button>
          </div>
          <div className={styles.rosterGrid}>
            {available.length === 0 ? (
              <span className={styles.hint}>Everyone&apos;s already placed</span>
            ) : (
              available.map((p) => (
                <button
                  key={p.id}
                  className={styles.rosterChip}
                  onClick={() => assign(pickingSlot, p.id)}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {successMessage && <div className={styles.success}>{successMessage}</div>}
      {error && <div className={styles.error}>{error}</div>}
      <button className={styles.commitBtn} disabled={busy} onClick={commit}>
        {busy ? "Submitting…" : existingSubmission ? "Update duos" : "Commit duos"}
      </button>
      <div className={styles.hint}>Reveal fires the moment both captains have committed</div>
    </div>
  );
}

function Slot({
  slotKey,
  playerId,
  roster,
  active,
  onOpen,
  onClear,
}: {
  slotKey: SlotKey;
  playerId: string | null;
  roster: Player[];
  active: boolean;
  onOpen: (slot: SlotKey) => void;
  onClear: (slot: SlotKey) => void;
}) {
  if (playerId) {
    const name = playerName(roster, playerId);
    return (
      <div className={`${styles.slot} ${styles.slotFilled}`}>
        {name}
        <button
          className={styles.slotRemove}
          aria-label={`Remove ${name}`}
          onClick={() => onClear(slotKey)}
        >
          ×
        </button>
      </div>
    );
  }
  return (
    <button
      className={`${styles.slotEmpty} ${active ? styles.slotEmptyActive : ""}`}
      onClick={() => onOpen(slotKey)}
    >
      + Add player
    </button>
  );
}
