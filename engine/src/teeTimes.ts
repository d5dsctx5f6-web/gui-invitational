// Tee-time derivation (Brief 32 Part B). Store raw, derive per-group times: only the first
// tee time and the group interval are stored on the round; match_slot k tees off at
// first_tee_time + (k - 1) x interval. Per-slot times are never stored.
//
// Pure UTC arithmetic — no timezone logic here. Converting "11:00 AM Phoenix" to the stored
// UTC instant, and rendering it back, is lib/timezone.ts's job (America/Phoenix).

export function groupTeeTimeIso(
  firstTeeTimeIso: string,
  intervalMinutes: number,
  matchSlot: number,
): string {
  if (!Number.isInteger(matchSlot) || matchSlot < 1) {
    throw new Error(`match slot must be a positive integer, got ${matchSlot}`);
  }
  const firstMs = new Date(firstTeeTimeIso).getTime();
  if (Number.isNaN(firstMs)) throw new Error(`Invalid first tee time: "${firstTeeTimeIso}"`);
  return new Date(firstMs + (matchSlot - 1) * intervalMinutes * 60_000).toISOString();
}
