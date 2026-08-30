// The mercy rule — double bogey cap. PRODUCT_SPEC_V2 §2 "Mercy rule": no duo score counts
// higher than par + 2 in match state. A scorekeeper can enter whatever the duo actually made
// on a disaster hole; the engine caps the number used for match play. Nothing else in the app
// reads a raw over-cap score, so this is a pace/match rule only — store the real number, cap
// it once, at computation. Every match-state computation must route through this rather than
// reading raw `strokes` directly (Brief 31 Part B).

export function cappedStrokes(strokes: number, par: number): number {
  return Math.min(strokes, par + 2);
}
