// Brief 30 — single source of truth for the event's display identity. The event was
// renamed from "The GUI Invitational" to "The Hedges Invitational"; every screen should
// read the name from here rather than hardcoding it, so a future rename is a one-line change.

export const EVENT_NAME = "The Hedges Invitational";
export const EVENT_SHORT_NAME = "Hedges Inv";

// North/South Hedges: fixed team identity for the v2.0 two-team scramble format (see
// PRODUCT_SPEC_V2.md §2). Not yet consumed anywhere — the live app is still v1.0's four-team
// format; this constant exists so Brief 31's schema/engine migration has a name to reach for
// instead of hardcoding it fresh.
export const TEAM_NAMES = {
  north: "North Hedges",
  south: "South Hedges",
} as const;
