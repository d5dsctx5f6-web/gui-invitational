// Gross skins, opt-in, paid nightly. PRODUCT_SPEC §2 "Money" / Addendum A §2.
// Reads real gross strokes only — dots never apply here, and a reverse-mulliganed
// hole still pays out on the player's real, holed score (see reverseMulligan.ts).

export interface SkinsHoleScore {
  playerId: string;
  hole: number;
  strokes: number;
}

export type SkinsHoleStatus = "unplayed" | "carried" | "won" | "void";

export interface SkinsHoleResult {
  hole: number;
  status: SkinsHoleStatus;
  winner: string | null;
}

export interface SkinsWin {
  /** The hole where the tie broke and the pot was claimed. */
  resolvingHole: number;
  /** Every hole this win pays out for, including any carried-in ties. */
  coveredHoles: number[];
  winner: string;
}

export interface SkinsResult {
  holes: SkinsHoleResult[];
  wins: SkinsWin[];
  skinsWonByPlayer: Record<string, number>;
  /** Holes tied all the way through 18 with nowhere left to carry — unclaimed for the round. */
  voidHoles: number[];
}

/**
 * Computes one round's gross skins in isolation (Addendum A: paid nightly, no cross-round
 * carry). Non-entrants are invisible — pass only `entrantPlayerIds` for this round's opt-ins.
 */
export function computeSkins(
  scores: SkinsHoleScore[],
  entrantPlayerIds: string[],
): SkinsResult {
  const holes: SkinsHoleResult[] = [];
  const wins: SkinsWin[] = [];
  const skinsWonByPlayer: Record<string, number> = {};
  const voidHoles: number[] = [];
  let pending: number[] = [];

  for (let hole = 1; hole <= 18; hole++) {
    const entrantScores = entrantPlayerIds
      .map((id) => scores.find((s) => s.playerId === id && s.hole === hole))
      .filter((s): s is SkinsHoleScore => s !== undefined);

    if (entrantScores.length === 0) {
      holes.push({ hole, status: "unplayed", winner: null });
      continue;
    }

    const low = Math.min(...entrantScores.map((s) => s.strokes));
    const lowScorers = entrantScores.filter((s) => s.strokes === low);

    if (lowScorers.length === 1) {
      const coveredHoles = [...pending, hole];
      const winner = lowScorers[0].playerId;
      wins.push({ resolvingHole: hole, coveredHoles, winner });
      skinsWonByPlayer[winner] =
        (skinsWonByPlayer[winner] ?? 0) + coveredHoles.length;
      holes.push({ hole, status: "won", winner });
      pending = [];
    } else {
      pending.push(hole);
      holes.push({ hole, status: "carried", winner: null });

      if (hole === 18) {
        // Nowhere left to carry to — this chain is unclaimed for the round.
        for (const voided of pending) {
          const result = holes.find((h) => h.hole === voided)!;
          result.status = "void";
        }
        voidHoles.push(...pending);
        pending = [];
      }
    }
  }

  return { holes, wins, skinsWonByPlayer, voidHoles };
}
