// Brief 33 Part B: season and player isolation. 2027 (real) and QA (is_test) never see each other.
// The app enforces this in its data queries (lib/scope.ts adds `is_test = false/true` to every
// season and roster read); these pure functions define the same rule for the tests.

export type Scope = "real" | "qa";

export interface Scoped {
  isTest: boolean;
}

export function inScope<T extends Scoped>(rows: T[], scope: Scope): T[] {
  return rows.filter((r) => r.isTest === (scope === "qa"));
}

/** The "current season": newest non-test season. QA seasons are never current. */
export function currentSeason<T extends Scoped & { year: number }>(seasons: T[]): T | null {
  const real = inScope(seasons, "real").sort((a, b) => b.year - a.year);
  return real[0] ?? null;
}
