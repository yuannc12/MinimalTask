import { useCallback, useEffect, useRef, useState } from "react";
import {
  startSession,
  endSession,
  heartbeatSession,
  closeAllOpenSessions,
  updateTask,
  nowSec,
} from "../db";

const TICK_MS = 1000;
const HEARTBEAT_EVERY_TICKS = 5;

export interface RunningState {
  taskId: number;
  sessionId: number;
  startedAt: number;
  elapsedSec: number;
}

export interface TimerApi {
  running: RunningState | null;
  ready: boolean;
  start: (taskId: number) => Promise<void>;
  stop: () => Promise<void>;
  complete: () => Promise<void>;
}

export function useTimer(onChange?: () => void): TimerApi {
  const [running, setRunning] = useState<RunningState | null>(null);
  const [ready, setReady] = useState(false);
  const tickCountRef = useRef(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const closed = await closeAllOpenSessions("app_quit");
      if (cancelled) return;
      if (closed > 0) {
        console.log(`closed ${closed} orphan session(s) as app_quit`);
        onChangeRef.current?.();
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRunning((cur) => {
        if (!cur) return cur;
        return { ...cur, elapsedSec: nowSec() - cur.startedAt };
      });
      tickCountRef.current += 1;
      if (tickCountRef.current % HEARTBEAT_EVERY_TICKS === 0 && running) {
        heartbeatSession(running.sessionId).catch((e) =>
          console.error("heartbeat failed", e),
        );
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running?.sessionId]);

  const start = useCallback(async (taskId: number) => {
    if (running) {
      await endSession(running.sessionId, "stop");
    }
    const session = await startSession(taskId);
    setRunning({
      taskId,
      sessionId: session.id,
      startedAt: session.started_at,
      elapsedSec: nowSec() - session.started_at,
    });
    tickCountRef.current = 0;
    onChangeRef.current?.();
  }, [running]);

  const stop = useCallback(async () => {
    if (!running) return;
    await endSession(running.sessionId, "stop");
    setRunning(null);
    onChangeRef.current?.();
  }, [running]);

  const complete = useCallback(async () => {
    if (!running) return;
    const taskId = running.taskId;
    await endSession(running.sessionId, "complete");
    await updateTask(taskId, { status: "done" });
    setRunning(null);
    onChangeRef.current?.();
  }, [running]);

  return { running, ready, start, stop, complete };
}
