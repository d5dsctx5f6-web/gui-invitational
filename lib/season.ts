import type { SupabaseClient } from "@supabase/supabase-js";
import { applyScope, type Scope } from "./scope";

export interface SeasonRow {
  id: string;
  year: number;
  name: string;
}

// A deliberately small structural view of the query builder: the real supabase-js builder types
// are deep enough that threading them through a generic helper trips TypeScript's instantiation
// limit, and these helpers only ever chain these few calls.
interface ScopedQuery<T> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  eq(column: string, value: boolean): ScopedQuery<T>;
  order(column: string, options?: { ascending: boolean }): ScopedQuery<T>;
  limit(count: number): ScopedQuery<T>;
  maybeSingle(): PromiseLike<{ data: T | null }>;
}

function from<T>(supabase: SupabaseClient, table: string, columns: string): ScopedQuery<T> {
  return supabase.from(table).select(columns) as unknown as ScopedQuery<T>;
}

/**
 * The ONE definition of "current season": the newest season where is_test = false. Route every
 * "which season?" lookup through this — never `.limit(1)` on seasons directly, which would let the
 * QA season (year 1900) or any future test season leak into a real view.
 */
export async function getCurrentSeason(supabase: SupabaseClient): Promise<SeasonRow | null> {
  const { data } = await applyScope(from<SeasonRow>(supabase, "seasons", "id, year, name"), "real")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** The QA sandbox season (year 1900, is_test), or null before migration 0031 has run. */
export async function getQaSeason(supabase: SupabaseClient): Promise<SeasonRow | null> {
  const { data } = await applyScope(from<SeasonRow>(supabase, "seasons", "id, year, name"), "qa")
    .order("year", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Every season in scope, newest first (real seasons by default). */
export function seasonsQuery<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  columns: string,
  scope: Scope = "real",
) {
  return applyScope(from<T>(supabase, "seasons", columns), scope).order("year", { ascending: false });
}

/** The ONE roster read: players in scope (real players by default; test players never leak). */
export function rosterQuery<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  columns: string,
  scope: Scope = "real",
) {
  return applyScope(from<T>(supabase, "players", columns), scope).order("name");
}
