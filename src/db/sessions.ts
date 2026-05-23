import { getDb, nowSec } from "./client";
import type { EndedReason, Session } from "./types";

export async function startSession(taskId: number): Promise<Session> {
  const db = await getDb();
  await closeOrphanSessions(taskId, "stop");
  const started = nowSec();
  const res = await db.execute(
    "INSERT INTO sessions (task_id, started_at) VALUES ($1, $2)",
    [taskId, started],
  );
  const id = Number(res.lastInsertId);
  const rows = await db.select<Session[]>("SELECT * FROM sessions WHERE id = $1", [id]);
  return rows[0];
}

export async function endSession(
  sessionId: number,
  reason: EndedReason,
): Promise<Session> {
  const db = await getDb();
  const ended = nowSec();
  await db.execute(
    `UPDATE sessions
     SET ended_at = $1,
         duration_sec = $1 - started_at,
         ended_reason = $2
     WHERE id = $3 AND ended_at IS NULL`,
    [ended, reason, sessionId],
  );
  const rows = await db.select<Session[]>("SELECT * FROM sessions WHERE id = $1", [sessionId]);
  return rows[0];
}

export async function getOpenSession(taskId: number): Promise<Session | null> {
  const db = await getDb();
  const rows = await db.select<Session[]>(
    "SELECT * FROM sessions WHERE task_id = $1 AND ended_at IS NULL ORDER BY id DESC LIMIT 1",
    [taskId],
  );
  return rows[0] ?? null;
}

export async function getAnyOpenSession(): Promise<Session | null> {
  const db = await getDb();
  const rows = await db.select<Session[]>(
    "SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1",
  );
  return rows[0] ?? null;
}

async function closeOrphanSessions(taskId: number, reason: EndedReason): Promise<void> {
  const db = await getDb();
  const ended = nowSec();
  await db.execute(
    `UPDATE sessions
     SET ended_at = $1,
         duration_sec = $1 - started_at,
         ended_reason = $2
     WHERE task_id = $3 AND ended_at IS NULL`,
    [ended, reason, taskId],
  );
}

export async function closeAllOpenSessions(reason: EndedReason): Promise<number> {
  const db = await getDb();
  const ended = nowSec();
  const res = await db.execute(
    `UPDATE sessions
     SET ended_at = $1,
         duration_sec = $1 - started_at,
         ended_reason = $2
     WHERE ended_at IS NULL`,
    [ended, reason],
  );
  return res.rowsAffected;
}
