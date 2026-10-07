"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCupData, type CupData } from "@/lib/cupData";
import { useRealtimeRefetch } from "@/lib/supabase/useRealtimeRefetch";

/**
 * Live Cup data: realtime on every table the Cup reads, a refetch on focus (built into the hook),
 * and an optional interval fallback (the TV board polls every 30s so a dropped socket can never
 * leave it frozen). A failed or empty-looking refetch NEVER replaces good data — the screen keeps
 * the last good numbers and flags `stale` instead of going blank.
 */
export function useCupData(initial: CupData, pollMs?: number) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<CupData>(initial);
  const [stale, setStale] = useState(false);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });

  const refetch = useCallback(async () => {
    try {
      const next = await loadCupData(supabase, initial.scope);
      // A season that vanishes between refetches means the read failed, not that the Cup is gone.
      if (dataRef.current.season && !next.season) throw new Error("empty read");
      setData(next);
      setStale(false);
    } catch {
      setStale(true);
    }
  }, [supabase, initial.scope]);

  for (const table of ["hole_scores", "player_hole_scores", "reverse_mulligans", "duos", "rounds", "seasons"]) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed list, same order every render
    useRealtimeRefetch(table, null, refetch);
  }

  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(refetch, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refetch]);

  return { data, stale, refetch };
}
