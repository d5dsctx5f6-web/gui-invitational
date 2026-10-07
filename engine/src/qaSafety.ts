// Brief 33 Part C: the QA sandbox reset wipes scores, mulligans, duos and rounds. It must be
// impossible for it to touch a real season, so the guard lives here (pure, testable) and the admin
// action calls it before any delete.

export interface SeasonRef {
  id: string;
  isTest: boolean;
}

/** Deletion order that respects the ON DELETE RESTRICT foreign keys (children first). */
export const QA_RESET_ORDER = [
  "player_hole_scores",
  "hole_scores",
  "reverse_mulligans",
  "duos",
  "rounds",
] as const;

export function assertQaSeason(season: SeasonRef | null | undefined): asserts season is SeasonRef {
  if (!season) throw new Error("QA reset refused: season not found.");
  if (!season.isTest) {
    throw new Error("QA reset refused: that season is not a test season (is_test = false).");
  }
}
