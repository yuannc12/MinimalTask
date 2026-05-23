import { useEffect, useState } from "react";
import {
  listTasks,
  createTask,
  deleteTask,
  updateTask,
  startSession,
  endSession,
  getOpenSession,
  getViewTotals,
  seedDev,
  wipeAll,
  type Task,
} from "./db";
import "./App.css";

function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}

function App() {
  const [today, setToday] = useState<Task[]>([]);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [done, setDone] = useState<Task[]>([]);
  const [totals, setTotals] = useState<{ worked_sec: number; estimated_min: number }>({
    worked_sec: 0,
    estimated_min: 0,
  });
  const [running, setRunning] = useState<{ taskId: number; sessionId: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const say = (s: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 20));

  async function refresh() {
    const [t, b, d, tot] = await Promise.all([
      listTasks("today"),
      listTasks("backlog"),
      listTasks("done"),
      getViewTotals("today"),
    ]);
    setToday(t);
    setBacklog(b);
    setDone(d);
    setTotals(tot);
  }

  useEffect(() => {
    refresh().catch((e) => say(`init: ${e}`));
  }, []);

  async function onSeed() {
    try {
      const r = await seedDev();
      say(r.skipped ? "seed: already has data" : `seed: inserted ${r.inserted}`);
      await refresh();
    } catch (e) {
      say(`seed error: ${e}`);
    }
  }

  async function onWipe() {
    await wipeAll();
    setRunning(null);
    say("wiped all");
    await refresh();
  }

  async function onAdd() {
    await createTask({
      title: `Quick task @ ${new Date().toLocaleTimeString()}`,
      tag: "#test",
      estimated_minutes: 15,
      status: "today",
    });
    say("created task");
    await refresh();
  }

  async function onStart(taskId: number) {
    const existing = await getOpenSession(taskId);
    if (existing) {
      setRunning({ taskId, sessionId: existing.id });
      say(`already running session ${existing.id}`);
      return;
    }
    const s = await startSession(taskId);
    setRunning({ taskId, sessionId: s.id });
    say(`started session ${s.id} for task ${taskId}`);
  }

  async function onStop(reason: "stop" | "complete") {
    if (!running) return;
    const s = await endSession(running.sessionId, reason);
    say(`ended session ${s.id} (${reason}) +${s.duration_sec}s`);
    if (reason === "complete") {
      await updateTask(running.taskId, { status: "done" });
    }
    setRunning(null);
    await refresh();
  }

  async function onDelete(id: number) {
    await deleteTask(id);
    if (running?.taskId === id) setRunning(null);
    say(`deleted task ${id}`);
    await refresh();
  }

  return (
    <main
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 32,
        color: "#111",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontWeight: 400, fontSize: 28, margin: 0 }}>
        Slice 2 — DB smoke test
      </h1>
      <p style={{ color: "#6B6B6B", fontSize: 13 }}>
        Today worked {fmtSec(totals.worked_sec)} / est {totals.estimated_min}m
        {running && (
          <>
            {" · "}
            <span style={{ color: "#F38D68" }}>
              running task {running.taskId} (session {running.sessionId})
            </span>
          </>
        )}
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button onClick={onSeed}>seed</button>
        <button onClick={onWipe}>wipe</button>
        <button onClick={onAdd}>add quick task</button>
        <button disabled={!running} onClick={() => onStop("stop")}>
          stop
        </button>
        <button disabled={!running} onClick={() => onStop("complete")}>
          complete
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
        <Section title={`Today (${today.length})`} tasks={today} onStart={onStart} onDelete={onDelete} runningId={running?.taskId} />
        <Section title={`Backlog (${backlog.length})`} tasks={backlog} onStart={onStart} onDelete={onDelete} runningId={running?.taskId} />
        <Section title={`Done (${done.length})`} tasks={done} onStart={onStart} onDelete={onDelete} runningId={running?.taskId} />
      </div>

      <h3 style={{ marginTop: 32, fontWeight: 500, fontSize: 14 }}>Log</h3>
      <pre style={{ fontSize: 12, background: "#FAFAFA", padding: 12, color: "#6B6B6B" }}>
        {log.join("\n") || "(empty)"}
      </pre>
    </main>
  );
}

function Section({
  title,
  tasks,
  onStart,
  onDelete,
  runningId,
}: {
  title: string;
  tasks: Task[];
  onStart: (id: number) => void;
  onDelete: (id: number) => void;
  runningId?: number;
}) {
  return (
    <section>
      <h2 style={{ fontWeight: 400, fontSize: 18 }}>{title}</h2>
      {tasks.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 0",
            borderBottom: "1px solid #ECECEC",
            borderLeft: runningId === t.id ? "2px solid #DEE780" : "2px solid transparent",
            paddingLeft: 8,
          }}
        >
          <span style={{ flex: 1, fontSize: 15 }}>{t.title}</span>
          <span style={{ color: "#9A9A9A", fontSize: 13 }}>{t.tag}</span>
          <span style={{ color: "#9A9A9A", fontSize: 13 }}>
            {t.estimated_minutes ? `${t.estimated_minutes}m` : ""}
          </span>
          <button onClick={() => onStart(t.id)} disabled={t.status === "done"}>
            start
          </button>
          <button onClick={() => onDelete(t.id)}>×</button>
        </div>
      ))}
    </section>
  );
}

export default App;
