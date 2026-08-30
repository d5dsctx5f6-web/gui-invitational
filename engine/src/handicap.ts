// Course handicap conversion. PRODUCT_SPEC_V2 §2 "Handicaps — display only":
// Index × (Slope ÷ 113) + (Rating − Par), rounded.
//
// ============================================================================================
// DISPLAY ONLY — DO NOT WIRE THIS INTO SCORING. Read this before adding a call site.
// ============================================================================================
// v2.0 gives no strokes anywhere, in any format ("Gross scramble, straight up, both days" —
// PRODUCT_SPEC_V2 §2). courseHandicap() survives Brief 31 purely as captain intel on the
// Pairings Night board (Ryder Cup style matchmaking info) — "it computes into nothing
// downstream; it's shown, not scored" (PRODUCT_SPEC_V2 §2). v1.0's playingHandicap()/
// strokesForHoles()/dotsForPlayer() — the pipeline that turned a course handicap into actual
// per-hole strokes for net scoring — are deleted outright, not kept-but-unused: that pipeline's
// entire purpose (allocating strokes to holes) has no meaning once no strokes are given at all.
// If a later brief ever needs this number to affect match state, skins, or any competitive
// result, that is a spec change, not an engineering call — flag it, don't just wire it back in.

export interface TeeSetup {
  rating: number;
  slope: number;
  par: number;
}

export function courseHandicap(index: number, tee: TeeSetup): number {
  return Math.round(index * (tee.slope / 113) + (tee.rating - tee.par));
}
