// Brief 33: who may post or edit a duo's scores (and log its reverse mulligan call).
// A pure mirror of the database rule in can_score_duo() (migration 0028): a player may write for a
// duo when he is in EITHER duo of the match that duo belongs to — the duos sharing its round + slot.
// The database enforces this through RLS; this copy drives the UI (hide entry for non-players) and
// the tests. Because the match is defined by round + slot, a player in another match, another round
// or another season (e.g. a QA player against a 2027 duo) is denied automatically.

export interface PermissionDuo {
  id: string;
  roundId: string;
  matchSlot: number;
  playerIds: (string | null)[];
}

export function canScoreDuo(
  playerId: string | null,
  targetDuoId: string,
  duos: PermissionDuo[],
): boolean {
  if (!playerId) return false;
  const target = duos.find((d) => d.id === targetDuoId);
  if (!target) return false;
  return duos.some(
    (d) =>
      d.roundId === target.roundId &&
      d.matchSlot === target.matchSlot &&
      d.playerIds.includes(playerId),
  );
}
