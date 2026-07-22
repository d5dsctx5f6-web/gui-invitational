"use client";

import { useEffect, useRef } from "react";
import { createClient } from "./client";

export interface RealtimeFilter {
  column: string;
  value: string;
}

/**
 * Subscribes to postgres_changes on `table` (optionally filtered to one column=value, e.g.
 * round_id) and calls `onChange` on any insert/update/delete. RLS still applies — a
 * subscriber only ever receives rows it could otherwise SELECT.
 *
 * Also refetches on tab focus/visibility regain: a realtime subscription doesn't survive a
 * phone being backgrounded reliably, so a device coming back from someone's pocket needs a
 * fresh fetch rather than trusting whatever the (possibly dropped) subscription last saw.
 *
 * `onChange` is read via a ref so callers can pass an inline closure without it re-triggering
 * the subscription on every render — only `table`/`filter` changes do that.
 */
export function useRealtimeRefetch(
  table: string,
  filter: RealtimeFilter | null,
  onChange: () => void,
) {
  const onChangeRef = useRef(onChange);
  // Kept current outside of render (in an effect, not during render itself) so the
  // subscription effect below can close over a stable ref without re-subscribing on
  // every render a caller passes a fresh inline callback.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const supabase = createClient();
    const channelName = filter
      ? `${table}:${filter.column}=${filter.value}`
      : `${table}:all`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        },
        () => onChangeRef.current(),
      )
      .subscribe();

    function handleVisible() {
      if (document.visibilityState === "visible") onChangeRef.current();
    }
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [table, filter]);
}
