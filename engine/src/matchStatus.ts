// Brief 33 / Brief 23's pattern: a compact status per segment, readable at a glance, plus the
// "decided but still live" note. Duo A is North, duo B is South throughout.

import type { MatchState, SegmentState } from "./matchState";

export type SegmentTone = "north" | "south" | "even" | "halved" | "none";

export interface SegmentLabel {
  text: string;
  tone: SegmentTone;
  decided: boolean;
}

export function segmentLabel(seg: SegmentState): SegmentLabel {
  if (seg.thru === 0) return { text: "—", tone: "none", decided: false };

  if (seg.status === "closed") {
    if (seg.winner === "A") return { text: "✓ N", tone: "north", decided: true };
    if (seg.winner === "B") return { text: "✓ S", tone: "south", decided: true };
    return { text: "½", tone: "halved", decided: true };
  }

  if (seg.holesUp > 0) return { text: `N ${seg.holesUp} UP`, tone: "north", decided: false };
  if (seg.holesUp < 0) return { text: `S ${-seg.holesUp} UP`, tone: "south", decided: false };
  return { text: "AS", tone: "even", decided: false };
}

/** "18 decided — back 9 still live" when the overall 18 closed early while a 9 is still open. */
export function liveNote(state: MatchState): string | null {
  if (state.overall18.status !== "closed") return null;
  const open: string[] = [];
  if (state.front9.status === "in_progress") open.push("front 9");
  if (state.back9.status === "in_progress") open.push("back 9");
  if (open.length === 0) return null;
  return `18 decided — ${open.join(" and ")} still live`;
}

/** Points shown as "2½" style (whole and half points only). */
export function formatPoints(points: number): string {
  const whole = Math.floor(points);
  const half = points - whole >= 0.5;
  if (half) return whole === 0 ? "½" : `${whole}½`;
  return String(whole);
}
