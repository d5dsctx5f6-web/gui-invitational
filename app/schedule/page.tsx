import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import { loadCupData } from "@/lib/cupData";
import { groupTeeTimeIso } from "@/engine/src";
import { formatLabel, namesOf } from "../leaderboard/cupModel";
import { formatArizonaDate, formatArizonaTime } from "@/lib/timezone";
import pageStyles from "../page.module.css";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";

interface ScheduleItem {
  id: string;
  title: string;
  starts_at: string | null;
  notes: string | null;
}
// Brief 26: both always Arizona time, regardless of the viewing device's own timezone — every
// event on this page happens on the trip, in Phoenix.
function dayLabel(startsAt: string): string {
  return formatArizonaDate(startsAt);
}

function timeLabel(startsAt: string): string {
  return formatArizonaTime(startsAt);
}

export default async function SchedulePage() {
  const supabase = await createClient();

  // Content this simple changes rarely — a plain server-rendered refetch on navigation
  // (revalidatePath from the admin actions) is enough; no realtime subscription needed.
  // Brief 33 Part B: the one definition of "current season" (newest non-test season).
  const season = await getCurrentSeason(supabase);

  const { data: items } = season
    ? await supabase
        .from("schedule_items")
        .select("id, title, starts_at, notes")
        .eq("season_id", season.id)
        .order("starts_at", { ascending: true, nullsFirst: false })
    : { data: null };

  const scheduleItems = (items ?? []) as ScheduleItem[];
  const timed = scheduleItems.filter((i) => i.starts_at !== null);
  const untimed = scheduleItems.filter((i) => i.starts_at === null);

  const days = new Map<string, ScheduleItem[]>();
  for (const item of timed) {
    const label = dayLabel(item.starts_at!);
    if (!days.has(label)) days.set(label, []);
    days.get(label)!.push(item);
  }

  // Brief 34 Part C: round cards come from `rounds` + `duos` (the v1 `matches` table is gone). Tee
  // times are raw first-tee + interval, derived per group, always in Arizona time.
  const cup = season ? await loadCupData(supabase, "real") : null;

  return (
    <main className={styles.page}>
      <Link href="/" className={pageStyles.backLink}>
        ← Home
      </Link>
      <div className={styles.eyebrow}>
        Schedule · <b>{season?.name ?? "No season yet"}</b>
      </div>

      {scheduleItems.length === 0 && (
        <div className={styles.card}>
          <p className={styles.hint}>
            Nothing on the schedule yet — check back after admin publishes it.
          </p>
        </div>
      )}

      {[...days.entries()].map(([day, dayItems]) => (
        <div className={styles.card} key={day}>
          <h3 className={styles.dayTitle}>{day}</h3>
          {dayItems.map((item) => (
            <div className={styles.eventRow} key={item.id}>
              <div className={styles.eventTime}>{timeLabel(item.starts_at!)}</div>
              <div>
                <div className={styles.eventTitle}>{item.title}</div>
                {item.notes && <div className={styles.eventNotes}>{item.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}

      {untimed.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.dayTitle}>Time TBD</h3>
          {untimed.map((item) => (
            <div className={styles.eventRow} key={item.id}>
              <div className={styles.eventTime}>—</div>
              <div>
                <div className={styles.eventTitle}>{item.title}</div>
                {item.notes && <div className={styles.eventNotes}>{item.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {(cup?.rounds ?? []).map((round) => {
        const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }).format(
          new Date(`${round.date}T12:00:00Z`),
        );
        const groups = [1, 2, 3, 4].map((slot) => {
          const match = round.matches.find((m) => m.slot === slot);
          return {
            slot,
            time: round.firstTeeTime ? formatArizonaTime(groupTeeTimeIso(round.firstTeeTime, round.intervalMinutes, slot)) : null,
            matchup:
              match?.north && match?.south
                ? `${namesOf(match.north, cup!.playerNames)} v ${namesOf(match.south, cup!.playerNames)}`
                : null,
          };
        });
        return (
          <div className={styles.card} key={round.id}>
            <h3 className={styles.dayTitle}>
              Round {round.roundNumber} · {date}
            </h3>
            <div className={styles.eventNotes}>
              {round.courseName}
              {round.teeName ? ` · ${round.teeName} tees` : ""} · {formatLabel(round.format)}
            </div>
            {round.teeTimeNote && <div className={styles.eventTitle}>{round.teeTimeNote}</div>}
            {!round.firstTeeTime && <div className={styles.eventNotes}>Tee times not set yet.</div>}
            {groups.map((g) => (
              <div className={styles.eventRow} key={g.slot}>
                <div className={styles.eventTime}>{g.time ?? "TBD"}</div>
                <div>
                  <div className={styles.eventTitle}>Group {g.slot}</div>
                  <div className={styles.eventNotes}>{g.matchup ?? "Pairings not set yet"}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </main>
  );
}
