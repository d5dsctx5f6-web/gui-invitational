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
    </main>
  );
}
