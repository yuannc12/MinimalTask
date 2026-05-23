import { getDb, nowSec } from "./client";
import type { NewTask, Task, TaskStatus, TaskTotals } from "./types";
import { parseTags } from "../lib/tags";

export async function listTasks(status: TaskStatus): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE status = $1 ORDER BY position ASC, id ASC",
    [status],
  );
}

export type TaskWithWorked = Task & { worked_sec: number };

export async function listTasksWithWorked(
  status: TaskStatus,
): Promise<TaskWithWorked[]> {
  const db = await getDb();
  return db.select<TaskWithWorked[]>(
    `SELECT t.*,
       COALESCE((
         SELECT SUM(duration_sec)
         FROM sessions
         WHERE task_id = t.id AND ended_reason IS NOT NULL
       ), 0) AS worked_sec
     FROM tasks t
     WHERE t.status = $1
     ORDER BY
       CASE WHEN $1 = 'done' THEN t.completed_at ELSE NULL END DESC,
       t.position ASC,
       t.id ASC`,
    [status],
  );
}

export async function getTask(id: number): Promise<Task | null> {
  const db = await getDb();
  const rows = await db.select<Task[]>("SELECT * FROM tasks WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function createTask(input: NewTask): Promise<Task> {
  const db = await getDb();
  const status = input.status ?? "today";
  const created = nowSec();

  const maxRow = await db.select<{ max_pos: number | null }[]>(
    "SELECT MAX(position) AS max_pos FROM tasks WHERE status = $1",
    [status],
  );
  const position = (maxRow[0]?.max_pos ?? 0) + 1;

  const res = await db.execute(
    `INSERT INTO tasks (title, note, tag, estimated_minutes, status, position, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.title,
      input.note ?? null,
      input.tag ?? null,
      input.estimated_minutes ?? null,
      status,
      position,
      created,
    ],
  );
  const id = Number(res.lastInsertId);
  const row = await getTask(id);
  if (!row) throw new Error(`createTask: row ${id} not found after insert`);
  return row;
}

export async function updateTask(
  id: number,
  patch: Partial<Pick<Task, "title" | "note" | "tag" | "estimated_minutes" | "status">>,
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) return;

  if (patch.status === "done") {
    fields.push(`completed_at = $${i++}`);
    values.push(nowSec());
  } else if (patch.status) {
    fields.push(`completed_at = NULL`);
  }

  values.push(id);
  await db.execute(`UPDATE tasks SET ${fields.join(", ")} WHERE id = $${i}`, values);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

export async function reorderTask(id: number, newPosition: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET position = $1 WHERE id = $2", [newPosition, id]);
}

// Both totals queries count only *closed* sessions (ended_reason IS NOT NULL).
// The currently-running session's elapsed time is added at the UI layer to keep
// per-second tick updates cheap (no DB roundtrip per tick).
export async function getTaskTotals(taskId: number): Promise<TaskTotals> {
  const db = await getDb();
  const rows = await db.select<{ worked_sec: number | null }[]>(
    `SELECT COALESCE(SUM(duration_sec), 0) AS worked_sec
     FROM sessions
     WHERE task_id = $1 AND ended_reason IS NOT NULL`,
    [taskId],
  );
  const task = await getTask(taskId);
  return {
    worked_sec: rows[0]?.worked_sec ?? 0,
    estimated_min: task?.estimated_minutes ?? 0,
  };
}

export async function getAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ tag: string }[]>(
    "SELECT DISTINCT tag FROM tasks WHERE tag IS NOT NULL AND tag <> ''",
  );
  const set = new Set<string>();
  for (const row of rows) {
    for (const t of parseTags(row.tag)) set.add(t);
  }
  return Array.from(set).sort();
}

export async function getViewTotals(status: TaskStatus): Promise<TaskTotals> {
  const db = await getDb();
  const rows = await db.select<{ worked_sec: number | null; est_min: number | null }[]>(
    `SELECT
       COALESCE((
         SELECT SUM(s.duration_sec)
         FROM sessions s
         JOIN tasks t2 ON t2.id = s.task_id
         WHERE t2.status = $1 AND s.ended_reason IS NOT NULL
       ), 0) AS worked_sec,
       COALESCE((
         SELECT SUM(estimated_minutes) FROM tasks WHERE status = $1
       ), 0) AS est_min`,
    [status],
  );
  return {
    worked_sec: rows[0]?.worked_sec ?? 0,
    estimated_min: rows[0]?.est_min ?? 0,
  };
}
