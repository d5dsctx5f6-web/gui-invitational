// Duo (stopgap pairing form) validation — Brief 32 Part C. Pure functions so the rules are
// testable without the database. The database also enforces what it can (unique round/team/slot,
// FKs); these give the admin a plain-language reason before a write is attempted.

export interface DuoInput {
  id?: string; // present when editing, so a duo is never compared against itself
  roundId: string;
  teamId: string;
  player1Id: string;
  player2Id: string | null; // null = short-handed
  matchSlot: number;
}

export interface ExistingDuo extends DuoInput {
  id: string;
}

export interface DuoValidationContext {
  /** Every duo already saved, any round. */
  existingDuos: ExistingDuo[];
  /** team id -> player ids on that team's roster. */
  rosterByTeam: Record<string, string[]>;
}

export interface DuoValidationResult {
  errors: string[];
  shortHanded: boolean;
}

export const MAX_MATCH_SLOT = 4;

export function validateDuo(input: DuoInput, ctx: DuoValidationContext): DuoValidationResult {
  const errors: string[] = [];
  const roster = new Set(ctx.rosterByTeam[input.teamId] ?? []);

  if (!input.player1Id) errors.push("Player 1 is required.");

  if (!Number.isInteger(input.matchSlot) || input.matchSlot < 1 || input.matchSlot > MAX_MATCH_SLOT) {
    errors.push(`Match slot must be a whole number from 1 to ${MAX_MATCH_SLOT}.`);
  }

  if (input.player2Id !== null && input.player2Id === input.player1Id) {
    errors.push("A duo can't have the same player twice.");
  }

  for (const [label, pid] of [
    ["Player 1", input.player1Id],
    ["Player 2", input.player2Id],
  ] as const) {
    if (pid && !roster.has(pid)) errors.push(`${label} isn't on this team.`);
  }

  const others = ctx.existingDuos.filter((d) => d.id !== input.id && d.roundId === input.roundId);

  for (const pid of [input.player1Id, input.player2Id]) {
    if (!pid) continue;
    if (others.some((d) => d.player1Id === pid || d.player2Id === pid)) {
      errors.push("A player can't be in two duos in the same round.");
      break;
    }
  }

  if (others.some((d) => d.teamId === input.teamId && d.matchSlot === input.matchSlot)) {
    errors.push("That team already has a duo in this slot for this round.");
  }

  return { errors, shortHanded: input.player2Id === null };
}

export function isShortHanded(duo: { player2Id: string | null }): boolean {
  return duo.player2Id === null;
}

export interface DerivedMatch<T extends { teamId: string; matchSlot: number }> {
  matchSlot: number;
  north: T | null;
  south: T | null;
}

/** A match is derived, never stored (Brief 31): a North duo and a South duo sharing round + slot. */
export function deriveMatches<T extends { teamId: string; matchSlot: number }>(
  duos: T[],
  northTeamId: string,
  southTeamId: string,
): DerivedMatch<T>[] {
  const slots = [...new Set(duos.map((d) => d.matchSlot))].sort((a, b) => a - b);
  return slots.map((matchSlot) => ({
    matchSlot,
    north: duos.find((d) => d.matchSlot === matchSlot && d.teamId === northTeamId) ?? null,
    south: duos.find((d) => d.matchSlot === matchSlot && d.teamId === southTeamId) ?? null,
  }));
}
