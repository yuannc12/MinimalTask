import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { TaskListView } from "./components/TaskListView";
import { useTimer } from "./lib/useTimer";
import { setTrayMenu } from "./lib/tray";
import { fmtClock } from "./lib/parseInput";
import { listTasks, type TaskStatus } from "./db";
import "./App.css";

const TRAY_REFRESH_MS = 60_000;

function App() {
  const [status, setStatus] = useState<TaskStatus>("today");
  const [counts, setCounts] = useState<Record<TaskStatus, number>>({
    today: 0,
    backlog: 0,
    done: 0,
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const bumpRefresh = () => setRefreshTick((n) => n + 1);
  const timer = useTimer(bumpRefresh);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // Tray menu sync — runs on data changes and on a coarse interval while running.
  useEffect(() => {
    let cancelled = false;
    async function push() {
      const rows = await listTasks("today");
      if (cancelled) return;
      const items = rows.slice(0, 12).map((t) => ({ id: t.id, title: t.title }));
      const running = timer.running
        ? {
            title:
              rows.find((r) => r.id === timer.running!.taskId)?.title ?? "Running",
            elapsed_label: fmtClock(timer.running.elapsedSec),
          }
        : null;
      await setTrayMenu(items, running);
    }
    push();
    const interval = timer.running
      ? window.setInterval(push, TRAY_REFRESH_MS)
      : undefined;
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [refreshTick, timer.running?.taskId, timer.running == null]);

  // Bridge tray + global-shortcut events into the timer + view state.
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    (async () => {
      unlisteners.push(
        await listen<number>("tray:start", (e) => {
          setStatus("today");
          timerRef.current.start(e.payload);
        }),
      );
      unlisteners.push(
        await listen("tray:stop", () => timerRef.current.stop()),
      );
      unlisteners.push(
        await listen("tray:complete", () => timerRef.current.complete()),
      );
      unlisteners.push(
        await listen("tray:focus-add", () => {
          setStatus("today");
          window.dispatchEvent(new CustomEvent("minimaltask:focus-add"));
        }),
      );
    })();

    return () => unlisteners.forEach((u) => u());
  }, []);

  return (
    <div className="app">
      <Sidebar active={status} onSelect={setStatus} counts={counts} />
      <TaskListView
        status={status}
        refreshTick={refreshTick}
        onCountsChange={setCounts}
        onExternalRefresh={bumpRefresh}
        timer={timer}
      />
    </div>
  );
}

export default App;
