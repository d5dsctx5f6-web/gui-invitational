// Brief 9 Part A: builds the confirm() message for a dependency-aware delete. Counts are
// computed by the caller (page.tsx, from already-loaded admin data plus a few lightweight
// FK-only queries) — this just formats them into the "Deleting X will also delete Y, Z, and W"
// sentence the brief asked for, or a plain confirm if there's nothing dependent.

const LABELS: Record<string, [string, string]> = {
  teeSetups: ["tee setup", "tee setups"],
  rounds: ["round", "rounds"],
  matches: ["match", "matches"],
  holeScores: ["hole score", "hole scores"],
  duoSubmissions: ["duo submission", "duo submissions"],
  skinsEntries: ["skins entry", "skins entries"],
  reverseMulligans: ["reverse mulligan", "reverse mulligans"],
  teamMembers: ["team member", "team members"],
};

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function buildDeleteWarning(entityLabel: string, counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const [singular, plural] = LABELS[key];
      return `${n} ${n === 1 ? singular : plural}`;
    });

  if (parts.length === 0) {
    return `Delete ${entityLabel}? This cannot be undone.`;
  }
  return `Deleting ${entityLabel} will also delete ${joinWithAnd(parts)}. This cannot be undone. Continue?`;
}
