"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "hedges-theme-preference";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// useSyncExternalStore, not useState+useEffect: preference and system-dark both live in an
// external system (localStorage, matchMedia) outside React, and this needs to read them
// safely across server/client without a hydration-mismatch flash-then-flip render.
function subscribeToExternalChanges(callback: () => void) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", callback);
  mql.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    mql.removeEventListener("change", callback);
  };
}

function getSystemPrefersDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function getServerSystemPrefersDarkSnapshot(): boolean {
  return false;
}

export function ThemeProvider({
  children,
  defaultPreference = "system",
}: {
  children: ReactNode;
  /** What to use until the user picks one (the TV board defaults to dark). */
  defaultPreference?: ThemePreference;
}) {
  const getPreference = useCallback(
    (): ThemePreference => (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? defaultPreference,
    [defaultPreference],
  );
  const getServerPreference = useCallback((): ThemePreference => defaultPreference, [defaultPreference]);
  const preference = useSyncExternalStore(subscribeToExternalChanges, getPreference, getServerPreference);
  const systemPrefersDark = useSyncExternalStore(
    subscribeToExternalChanges,
    getSystemPrefersDarkSnapshot,
    getServerSystemPrefersDarkSnapshot,
  );
  const resolvedTheme: ResolvedTheme =
    preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;

  const setPreference = useCallback((pref: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, pref);
    // The native `storage` event only fires in *other* tabs, never the one that wrote the
    // value, so nudge this tab's own subscribers to re-read the new snapshot.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      <div data-theme={resolvedTheme} style={{ width: "100%" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
