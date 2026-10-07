// Brief 33 Part B: season and roster isolation, enforced in the data queries (not just the UI).
// Every read of `seasons` or `players` goes through applyScope(), which adds is_test = false (the
// real 2027 world) or is_test = true (the QA sandbox). Structurally typed so the test suite can
// exercise it with a fake query builder.

export type Scope = "real" | "qa";

export function applyScope<Q extends { eq: (column: string, value: boolean) => unknown }>(
  query: Q,
  scope: Scope = "real",
): Q {
  return query.eq("is_test", scope === "qa") as Q;
}
