// Brief 26: every tee time in this app means "Arizona wall-clock time" — the trip only ever
// happens in Phoenix, regardless of what timezone Chris's laptop or a player's phone happens to
// be set to. Arizona doesn't observe DST, so it's a fixed UTC-7 offset year-round — no calendar
// math beyond that fixed constant is ever needed. Every read and write of a tee time (or any
// other trip-local timestamp) should go through these functions rather than relying on the
// ambient local-timezone behavior of whatever browser or server happens to execute the code,
// since that's exactly the bug this brief fixes.

const ARIZONA_TIME_ZONE = "America/Phoenix";
const ARIZONA_UTC_OFFSET_HOURS = 7;

/**
 * Parses a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", no timezone info) as
 * Arizona wall-clock time and returns the correct UTC ISO string for storage. Manual offset
 * math, not `new Date(string)` — that would interpret the naive string using whatever timezone
 * the executing process (browser or server) happens to be in, which is exactly the bug.
 */
export function arizonaLocalToUtcIso(datetimeLocal: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(datetimeLocal);
  if (!match) throw new Error(`Invalid datetime-local value: "${datetimeLocal}"`);
  const [, year, month, day, hour, minute] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + ARIZONA_UTC_OFFSET_HOURS,
    Number(minute),
  );
  return new Date(utcMs).toISOString();
}

/**
 * Formats a stored UTC ISO timestamp as Arizona wall-clock time for display — correct
 * regardless of the viewing device's own timezone, since `Intl.DateTimeFormat`'s `timeZone`
 * option does the conversion explicitly rather than relying on the runtime's ambient zone.
 */
export function formatArizonaTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ARIZONA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Same as formatArizonaTime, for a date (weekday + month + day) rather than a time. */
export function formatArizonaDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: ARIZONA_TIME_ZONE }).format(
    new Date(iso),
  );
}

/**
 * The inverse of arizonaLocalToUtcIso — converts a stored UTC ISO timestamp back into a
 * `<input type="datetime-local">`-shaped string ("YYYY-MM-DDTHH:mm") representing Arizona
 * wall-clock time, so an admin edit form re-opens showing the time Chris originally intended
 * rather than a value shifted by the server's own ambient timezone.
 */
export function utcIsoToArizonaDatetimeLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARIZONA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  // Some ICU implementations render midnight as "24" with hour12: false — normalize to "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
