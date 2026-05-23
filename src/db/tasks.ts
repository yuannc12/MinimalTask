import { getDb, nowSec } from "./client";
import type { NewTask, Task, TaskStatus, TaskTotals } from "./types";

export async function listTasks(status: TaskStatus): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE status = $1 ORDER BY position ASC, id ASC",
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

export async function getTaskTotals(taskId: number): Promise<TaskTotals> {
  const db = await getDb();
  const rows = await db.select<{ worked_sec: number | null }[]>(
    `SELECT COALESCE(SUM(
       CASE
         WHEN duration_sec IS NOT NULL THEN duration_sec
         WHEN ended_at IS NOT NULL THEN ended_at - started_at
         ELSE 0
       END
     ), 0) AS worked_sec
     FROM sessions WHERE task_id = $1`,
    [taskId],
  );
  const task = await getTask(taskId);
  return {
    worked_sec: rows[0]?.worked_sec ?? 0,
    estimated_min: task?.estimated_minutes ?? 0,
  };
}

export async function getViewTotals(status: TaskStatus): Promise<TaskTotals> {
  const db = await getDb();
  const rows = await db.select<{ worked_sec: number | null; est_min: number | null }[]>(
    `SELECT
       COALESCE(SUM(
         CASE WHEN s.duration_sec IS NOT NULL THEN s.duration_sec
              WHEN s.ended_at IS NOT NULL THEN s.ended_at - s.started_at
              ELSE 0 END
       ), 0) AS worked_sec,
       COALESCE(SUM(t.estimated_minutes), 0) AS est_min
     FROM tasks t
     LEFT JOIN sessions s ON s.task_id = t.id
     WHERE t.status = $1`,
    [status],
  );
  return {
    worked_sec: rows[0]?.worked_sec ?? 0,
    estimated_min: rows[0]?.est_min ?? 0,
  };
}
