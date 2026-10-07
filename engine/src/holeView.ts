// Brief 33 follow-up: the "who won this hole, from where I'm sitting" mapping, as pure functions.
// It used to live inline in the scorecard component, where no test could pin it. Duo A is ALWAYS
// North Hedges and duo B is ALWAYS South Hedges; everything the signed-in player sees (banner,
// W/L tile, N/S header) derives from the engine's A/B result through these functions.

import type { HoleWinner } from "./matchState";

export type Side = "A" | "B";
export type TileLabel = "W" | "L" | "H" | "·";
export type TileTone = "win" | "loss" | "halved" | "none";

export const SIDE_TEAM_NAME: Record<Side, string> = { A: "North", B: "South" };

/** Which side the signed-in player is on: A (North) if he is in duo A, otherwise B (South). */
export function viewerSide(duoAPlayerIds: (string | null)[], playerId: string): Side {
  return duoAPlayerIds.includes(playerId) ? "A" : "B";
}

/** "North won hole 7" / "South won hole 7" / "Hole 7 halved" — the same for every viewer. */
export function holeBanner(
  winner: HoleWinner | null,
  hole: number,
): { text: string; tone: "north" | "south" | "halved" } | null {
  if (winner === null) return null;
  if (winner === "halved") return { text: `Hole ${hole} halved`, tone: "halved" };
  return { text: `${SIDE_TEAM_NAME[winner]} won hole ${hole}`, tone: winner === "A" ? "north" : "south" };
}

/** The strip tile from the viewer's seat: W if his side won, L if the other side won, H halved. */
export function holeTile(winner: HoleWinner | null, mySide: Side): { label: TileLabel; tone: TileTone } {
  if (winner === null) return { label: "·", tone: "none" };
  if (winner === "halved") return { label: "H", tone: "halved" };
  return winner === mySide ? { label: "W", tone: "win" } : { label: "L", tone: "loss" };
}
