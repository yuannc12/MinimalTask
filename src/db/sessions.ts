import { getDb, nowSec } from "./client";
import type { EndedReason, Session } from "./types";

// A session is "open" while ended_reason IS NULL. ended_at acts as a heartbeat
// while open so app_quit recovery doesn't attribute downtime to worked time.

export async function startSession(taskId: number): Promise<Session> {
  const db = await getDb();
  await closeOrphanSessions(taskId, "stop");
  const started = nowSec();
  const res = await db.execute(
    "INSERT INTO sessions (task_id, started_at, ended_at) VALUES ($1, $2, $2)",
    [taskId, started],
  );
  const id = Number(res.lastInsertId);
  const rows = await db.select<Session[]>("SELECT * FROM sessions WHERE id = $1", [id]);
  return rows[0];
}

export async function heartbeatSession(sessionId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE sessions
     SET ended_at = $1
     WHERE id = $2 AND ended_reason IS NULL`,
    [nowSec(), sessionId],
  );
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
     WHERE id = $3 AND ended_reason IS NULL`,
    [ended, reason, sessionId],
  );
  const rows = await db.select<Session[]>("SELECT * FROM sessions WHERE id = $1", [sessionId]);
  return rows[0];
}

export async function getOpenSession(taskId: number): Promise<Session | null> {
  const db = await getDb();
  const rows = await db.select<Session[]>(
    "SELECT * FROM sessions WHERE task_id = $1 AND ended_reason IS NULL ORDER BY id DESC LIMIT 1",
    [taskId],
  );
  return rows[0] ?? null;
}

export async function getAnyOpenSession(): Promise<Session | null> {
  const db = await getDb();
  const rows = await db.select<Session[]>(
    "SELECT * FROM sessions WHERE ended_reason IS NULL ORDER BY id DESC LIMIT 1",
  );
  return rows[0] ?? null;
}

async function closeOrphanSessions(taskId: number, reason: EndedReason): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE sessions
     SET ended_at = COALESCE(ended_at, started_at),
         duration_sec = COALESCE(ended_at, started_at) - started_at,
         ended_reason = $1
     WHERE task_id = $2 AND ended_reason IS NULL`,
    [reason, taskId],
  );
}

export async function closeAllOpenSessions(reason: EndedReason): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `UPDATE sessions
     SET ended_at = COALESCE(ended_at, started_at),
         duration_sec = COALESCE(ended_at, started_at) - started_at,
         ended_reason = $1
     WHERE ended_reason IS NULL`,
    [reason],
  );
  return res.rowsAffected;
}
