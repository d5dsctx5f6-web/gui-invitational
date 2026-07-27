// Gross skins, opt-in. PRODUCT_SPEC §2 "Money" / Addendum A §2 (revised Jul 26, 2026: an
// unresolved round-ending chain now carries forward into the next round's pool, rather than
// voiding outright — see the `carryIn` param below).
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
  /** Every hole *within this round* this win pays out for, including any carried-in ties. */
  coveredHoles: number[];
  /** Extra skins riding in from a prior round's unresolved carryover, absorbed by this win. */
  carriedIn: number;
  winner: string;
}

export interface SkinsResult {
  holes: SkinsHoleResult[];
  wins: SkinsWin[];
  skinsWonByPlayer: Record<string, number>;
  /** Holes tied all the way through 18 with nowhere left to carry within this round. */
  voidHoles: number[];
  /**
   * `carryIn` that arrived but was never claimed — only nonzero when this round's own final
   * chain also went unresolved. For any round but the last, that value rides into the next
   * round via `voidHoles.length`; for the last round it has nowhere left to go and must be
   * settled manually (Addendum A §2).
   */
  unresolvedCarryIn: number;
}

/**
 * Computes one round's gross skins. `carryIn` is the count of unresolved skins riding in from
 * a prior round's unclaimed carryover chain (Addendum A §2, revised Jul 26 2026) — pass 0 (the
 * default) for a round with nothing carrying in. It has no hole numbers of its own; it's added
 * to whichever win resolves first, on top of that win's own `coveredHoles`, and valued at this
 * round's own entrant pool/buy-in by `skinsPayouts`. Non-entrants are invisible — pass only
 * `entrantPlayerIds` for this round's opt-ins.
 */
export function computeSkins(
  scores: SkinsHoleScore[],
  entrantPlayerIds: string[],
  carryIn = 0,
): SkinsResult {
  const holes: SkinsHoleResult[] = [];
  const wins: SkinsWin[] = [];
  const skinsWonByPlayer: Record<string, number> = {};
  const voidHoles: number[] = [];
  let pending: number[] = [];
  let pendingCarryIn = carryIn;

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
      const carriedIn = pendingCarryIn;
      wins.push({ resolvingHole: hole, coveredHoles, carriedIn, winner });
      skinsWonByPlayer[winner] =
        (skinsWonByPlayer[winner] ?? 0) + coveredHoles.length + carriedIn;
      holes.push({ hole, status: "won", winner });
      pending = [];
      pendingCarryIn = 0;
    } else {
      pending.push(hole);
      holes.push({ hole, status: "carried", winner: null });

      if (hole === 18) {
        // Nowhere left to carry to within this round — this chain rides into the next round
        // via voidHoles.length (or, for the final round of the trip, is genuinely unresolved).
        for (const voided of pending) {
          const result = holes.find((h) => h.hole === voided)!;
          result.status = "void";
        }
        voidHoles.push(...pending);
        pending = [];
      }
    }
  }

  return { holes, wins, skinsWonByPlayer, voidHoles, unresolvedCarryIn: pendingCarryIn };
}
