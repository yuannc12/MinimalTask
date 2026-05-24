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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Window-scoped shortcuts: Cmd+1/2/3 switch view, Cmd+B toggles sidebar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const inInput =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }
      if (inInput) return;
      if (e.key === "1") {
        e.preventDefault();
        setStatus("today");
      } else if (e.key === "2") {
        e.preventDefault();
        setStatus("backlog");
      } else if (e.key === "3") {
        e.preventDefault();
        setStatus("done");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <div className={`app ${sidebarOpen ? "" : "sidebar-hidden"}`}>
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
