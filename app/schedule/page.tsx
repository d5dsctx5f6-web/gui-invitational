import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import pageStyles from "../page.module.css";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";

interface ScheduleItem {
  id: string;
  title: string;
  starts_at: string | null;
  notes: string | null;
}
interface RoundRow {
  id: string;
  date: string;
  format: string;
  course_id: string;
}
interface MatchRow {
  round_id: string;
  team_a_id: string;
  team_b_id: string;
  slot: string;
  tee_time: string | null;
}
interface TeamRow {
  id: string;
  name: string;
}
interface CourseRow {
  id: string;
  name: string;
}

function formatName(format: string): string {
  return format === "shamble" ? "Shamble" : format === "four_ball" ? "Four-ball" : format;
}

function dayLabel(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SchedulePage() {
  const supabase = await createClient();

  // Content this simple changes rarely — a plain server-rendered refetch on navigation
  // (revalidatePath from the admin actions) is enough; no realtime subscription needed.
  const { data: season } = await supabase
    .from("seasons")
    .select("id, year, name")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  // Brief 17 Part C: tee times per round, as their own clearly-labeled section rather than
  // merged into the day cards above — schedule_items and rounds/matches are different data
  // shapes (a timestamp vs. a plain date), and matching them into one combined timeline risked
  // a fragile date-label join for no real benefit over a separate, equally visible section.
  const [{ data: rounds }, { data: matches }, { data: teams }, { data: courses }] =
    await Promise.all([
      supabase.from("rounds").select("id, date, format, course_id").order("date"),
      supabase.from("matches").select("round_id, team_a_id, team_b_id, slot, tee_time"),
      supabase.from("teams").select("id, name"),
      supabase.from("courses").select("id, name"),
    ]);
  const roundsList = (rounds ?? []) as RoundRow[];
  const matchesList = (matches ?? []) as MatchRow[];
  const teamsList = (teams ?? []) as TeamRow[];
  const coursesList = (courses ?? []) as CourseRow[];
  const teamName = (id: string) => teamsList.find((t) => t.id === id)?.name ?? "?";
  const courseName = (id: string) => coursesList.find((c) => c.id === id)?.name ?? "Unknown course";

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

      {roundsList.map((round) => {
        const roundMatches = matchesList
          .filter((m) => m.round_id === round.id)
          .sort((a, b) => (a.tee_time ?? "").localeCompare(b.tee_time ?? ""));
        if (roundMatches.length === 0) return null;
        return (
          <div className={styles.card} key={round.id}>
            <h3 className={styles.dayTitle}>
              Tee times — {courseName(round.course_id)} · {formatName(round.format)}
            </h3>
            {roundMatches.map((m, i) => (
              <div className={styles.eventRow} key={`${m.round_id}-${m.slot}-${i}`}>
                <div className={styles.eventTime}>
                  {m.tee_time ? timeLabel(m.tee_time) : "TBD"}
                </div>
                <div>
                  <div className={styles.eventTitle}>
                    {teamName(m.team_a_id)} v {teamName(m.team_b_id)} — Slot {m.slot}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </main>
  );
}
