// Pure TypeScript scoring engine. No framework imports, ever — see /engine/README.md.

export type DerivedState = Record<string, never>;

export function deriveState(): DerivedState {
  return {};
}

export * from "./handicap";
export * from "./matchState";
export * from "./mercyCap";
export * from "./moneyLedger";
export * from "./reverseMulligan";
export * from "./standings";
export * from "./pairings";
export * from "./shortenedEvent";
export * from "./drivesUsed";
