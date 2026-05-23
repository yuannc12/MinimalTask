import type { ReactNode } from "react";
import type { TaskWithWorked } from "../db";
import { fmtSec } from "../lib/parseInput";

interface Props {
  tasks: TaskWithWorked[];
  renderTask: (task: TaskWithWorked) => ReactNode;
}

// Bucket completed tasks by local date and label the buckets with friendly
// labels ("Today", "Yesterday", "Tue 19 May") for the Done view.
export function DoneGroups({ tasks, renderTask }: Props) {
  if (tasks.length === 0) {
    return <div className="empty-state">Nothing finished yet.</div>;
  }

  const groups = groupByDay(tasks);

  return (
    <div className="done-groups">
      {groups.map(({ key, label, tasks: bucket }) => {
        const total = bucket.reduce((s, t) => s + (t.worked_sec ?? 0), 0);
        return (
          <section key={key} className="done-group">
            <header className="done-group-header">
              <h3 className="done-group-label">{label}</h3>
              <span className="done-group-total">{fmtSec(total)}</span>
            </header>
            <div className="task-list">{bucket.map(renderTask)}</div>
          </section>
        );
      })}
    </div>
  );
}

function groupByDay(tasks: TaskWithWorked[]) {
  const buckets = new Map<
    string,
    { label: string; sortKey: number; tasks: TaskWithWorked[] }
  >();

  for (const t of tasks) {
    const ts = t.completed_at ?? t.created_at;
    const d = new Date(ts * 1000);
    const key = isoDate(d);
    if (!buckets.has(key)) {
      buckets.set(key, { label: labelForDate(d), sortKey: dayStart(d), tasks: [] });
    }
    buckets.get(key)!.tasks.push(t);
  }

  return Array.from(buckets.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((g) => ({
      ...g,
      tasks: g.tasks.sort(
        (a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0),
      ),
    }));
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function dayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function labelForDate(d: Date): string {
  const todayStart = dayStart(new Date());
  const oneDay = 86_400_000;
  const diff = todayStart - dayStart(d);
  if (diff === 0) return "Today";
  if (diff === oneDay) return "Yesterday";
  if (diff > 0 && diff < 7 * oneDay) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
