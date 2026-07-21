// Pure TypeScript scoring engine. No framework imports, ever — see /engine/README.md.

export type DerivedState = Record<string, never>;

export function deriveState(): DerivedState {
  return {};
}

export * from "./handicap";
export * from "./netScore";
export * from "./matchState";
export * from "./skins";
export * from "./reverseMulligan";
export * from "./individualRace";
