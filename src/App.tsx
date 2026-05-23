import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TaskListView } from "./components/TaskListView";
import { useTimer } from "./lib/useTimer";
import type { TaskStatus } from "./db";
import "./App.css";

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
