import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  listTasksWithWorked,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
  getViewTotals,
  getAllTags,
  type TaskWithWorked,
  type Task,
  type TaskStatus,
  type NewTask,
} from "../db";
import { fmtSec, fmtMin } from "../lib/parseInput";
import { parseTags } from "../lib/tags";
import { AddTaskInput } from "./AddTaskInput";
import { TaskRow } from "./TaskRow";
import { TaskDetails } from "./TaskDetails";
import { DevFooter } from "./DevFooter";
import { TagFilter } from "./TagFilter";
import { DoneGroups } from "./DoneGroups";
import type { TimerApi } from "../lib/useTimer";

interface Props {
  status: TaskStatus;
  refreshTick?: number;
  onCountsChange?: (counts: Record<TaskStatus, number>) => void;
  onExternalRefresh?: () => void;
  timer: TimerApi;
}

const TITLES: Record<TaskStatus, string> = {
  today: "Today",
  backlog: "Backlog",
  done: "Done",
};

type SortMode = "manual" | "est";

const SORT_STORAGE_PREFIX = "minimaltask:sort:";

function loadSort(status: TaskStatus): SortMode {
  if (typeof localStorage === "undefined") return "manual";
  const v = localStorage.getItem(SORT_STORAGE_PREFIX + status);
  return v === "est" ? "est" : "manual";
}

function saveSort(status: TaskStatus, mode: SortMode) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SORT_STORAGE_PREFIX + status, mode);
}

type DragState = {
  draggedId: number;
  overId: number | null;
  edge: "above" | "below" | null;
};

export function TaskListView({
  status,
  refreshTick = 0,
  onCountsChange,
  onExternalRefresh,
  timer,
}: Props) {
  const [tasks, setTasks] = useState<TaskWithWorked[]>([]);
  const [totals, setTotals] = useState({ worked_sec: 0, estimated_min: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(() => loadSort(status));

  const refresh = useCallback(async () => {
    const [rows, tot, tags] = await Promise.all([
      listTasksWithWorked(status),
      getViewTotals(status),
      getAllTags(),
    ]);
    setTasks(rows);
    setTotals(tot);
    setKnownTags(tags);
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshTick]);

  useEffect(() => {
    setActiveFilters([]);
    setExpandedId(null);
    setSortMode(loadSort(status));
  }, [status]);

  const changeSort = (next: SortMode) => {
    setSortMode(next);
    saveSort(status, next);
  };

  useEffect(() => {
    if (!onCountsChange) return;
    Promise.all([
      listTasksWithWorked("today"),
      listTasksWithWorked("backlog"),
      listTasksWithWorked("done"),
    ]).then(([t, b, d]) => {
      onCountsChange({ today: t.length, backlog: b.length, done: d.length });
    });
  }, [tasks, onCountsChange]);

  const handleAdd = async (input: NewTask) => {
    await createTask(input);
    await refresh();
  };

  const handleToggleDone = async (task: Task) => {
    const next: TaskStatus = task.status === "done" ? "today" : "done";
    await updateTask(task.id, { status: next });
    await refresh();
  };

  const handleRename = async (task: Task, title: string) => {
    await updateTask(task.id, { title });
    await refresh();
  };

  const handleDelete = async (task: Task) => {
    await deleteTask(task.id);
    await refresh();
  };

  const handleMoveStatus = async (task: Task, to: TaskStatus) => {
    await updateTask(task.id, { status: to });
    await refresh();
  };

  const handleToggleExpand = (task: Task) => {
    setExpandedId((cur) => (cur === task.id ? null : task.id));
  };

  const handlePatch = async (
    task: Task,
    patch: Partial<{ tag: string | null; estimated_minutes: number | null }>,
  ) => {
    await updateTask(task.id, patch);
    await refresh();
  };

  const handleSaveDetails = async (
    task: Task,
    patch: { note: string | null },
  ) => {
    await updateTask(task.id, patch);
    await refresh();
  };

  const handleDragStart = (task: Task) => {
    setDrag({ draggedId: task.id, overId: null, edge: null });
  };

  const handleDragOver = (task: Task, edge: "above" | "below") => {
    setDrag((prev) =>
      prev && prev.draggedId !== task.id
        ? { ...prev, overId: task.id, edge }
        : prev,
    );
  };

  const handleDragEnd = () => setDrag(null);

  const handleDrop = async () => {
    if (!drag || drag.overId == null || drag.edge == null) {
      setDrag(null);
      return;
    }
    const dragged = tasks.find((t) => t.id === drag.draggedId);
    const target = tasks.find((t) => t.id === drag.overId);
    if (!dragged || !target || dragged.id === target.id) {
      setDrag(null);
      return;
    }

    if (sortMode === "manual") {
      const ordered = tasks.slice().sort((a, b) => a.position - b.position);
      const targetIdx = ordered.findIndex((t) => t.id === target.id);
      const insertIdx = drag.edge === "above" ? targetIdx : targetIdx + 1;
      const before = ordered[insertIdx - 1];
      const after = ordered[insertIdx];

      let newPos: number;
      if (before && after) {
        if (before.id === dragged.id || after.id === dragged.id) {
          setDrag(null);
          return;
        }
        newPos = (before.position + after.position) / 2;
      } else if (before) {
        newPos = before.position + 1;
      } else if (after) {
        newPos = after.position - 1;
      } else {
        newPos = 0;
      }
      await reorderTask(dragged.id, newPos);
    } else {
      // Est-sorted view: positions don't match visual order, so renumber the
      // displayed tasks to match the new visual order, then drop back to manual.
      const visible = filteredTasks;
      const draggedIdx = visible.findIndex((t) => t.id === dragged.id);
      const targetIdx = visible.findIndex((t) => t.id === target.id);
      if (draggedIdx < 0 || targetIdx < 0) {
        setDrag(null);
        return;
      }
      const without = visible.filter((t) => t.id !== dragged.id);
      let insertIdx = drag.edge === "above" ? targetIdx : targetIdx + 1;
      if (draggedIdx < targetIdx) insertIdx -= 1;
      const newOrder = [
        ...without.slice(0, insertIdx),
        dragged,
        ...without.slice(insertIdx),
      ];
      for (let i = 0; i < newOrder.length; i++) {
        await reorderTask(newOrder[i].id, i + 1);
      }
      changeSort("manual");
    }

    setDrag(null);
    await refresh();
  };

  const filteredTasks = useMemo(() => {
    const base =
      status === "backlog" && activeFilters.length > 0
        ? tasks.filter((t) => {
            const tags = parseTags(t.tag);
            return activeFilters.every((f) => tags.includes(f));
          })
        : tasks;
    if (sortMode === "est") {
      return base.slice().sort((a, b) => {
        const ae = a.estimated_minutes ?? Number.POSITIVE_INFINITY;
        const be = b.estimated_minutes ?? Number.POSITIVE_INFINITY;
        if (ae !== be) return ae - be;
        return a.position - b.position;
      });
    }
    return base;
  }, [tasks, status, activeFilters, sortMode]);

  const filterActive = status === "backlog" && activeFilters.length > 0;
  const displayTotals = useMemo(() => {
    if (!filterActive) return totals;
    let workedSec = 0;
    let estMin = 0;
    for (const t of filteredTasks) {
      workedSec += t.worked_sec;
      estMin += t.estimated_minutes ?? 0;
    }
    return { worked_sec: workedSec, estimated_min: estMin };
  }, [filterActive, filteredTasks, totals]);

  const runningTaskVisible =
    timer.running != null &&
    filteredTasks.some((t) => t.id === timer.running!.taskId);
  const liveWorkedSec = runningTaskVisible
    ? displayTotals.worked_sec + timer.running!.elapsedSec
    : displayTotals.worked_sec;
  const overBudget =
    liveWorkedSec > displayTotals.estimated_min * 60 && displayTotals.estimated_min > 0;

  return (
    <div className="pane">
      <header className="view-header">
        <h1 className="view-title">{TITLES[status]}</h1>
        {status !== "done" && (
          <div className="view-header-right">
            <div className="view-sort" role="group" aria-label="Sort">
              <button
                className={`view-sort-opt ${sortMode === "manual" ? "is-active" : ""}`}
                onClick={() => changeSort("manual")}
              >
                manual
              </button>
              <span className="view-sort-sep">/</span>
              <button
                className={`view-sort-opt ${sortMode === "est" ? "is-active" : ""}`}
                onClick={() => changeSort("est")}
              >
                est
              </button>
            </div>
            <div className="view-totals">
              <span className={overBudget ? "is-over" : ""}>
                {fmtSec(liveWorkedSec)}
              </span>
              {displayTotals.estimated_min > 0 && (
                <>
                  {" / "}
                  <span>{fmtMin(displayTotals.estimated_min)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <AddTaskInput status={status} knownTags={knownTags} onAdd={handleAdd} />

      {status === "backlog" && knownTags.length > 0 && (
        <TagFilter
          tags={knownTags}
          active={activeFilters}
          onToggle={(t) =>
            setActiveFilters((cur) =>
              cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
            )
          }
          onClear={() => setActiveFilters([])}
        />
      )}

      {status === "done" ? (
        <DoneGroups
          tasks={tasks}
          renderTask={(task) => renderRow(task)}
        />
      ) : (
        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              {status === "backlog"
                ? activeFilters.length
                  ? "No tasks match the selected tags."
                  : "Backlog is empty."
                : "Nothing on the plate today."}
            </div>
          ) : (
            filteredTasks.map(renderRow)
          )}
        </div>
      )}

      <DevFooter onChange={() => onExternalRefresh?.()} />
    </div>
  );

  function renderRow(task: TaskWithWorked) {
    const isRunning = timer.running?.taskId === task.id;
    const isExpanded = expandedId === task.id;
    return (
      <Fragment key={task.id}>
        <TaskRow
          task={task}
          onToggleDone={handleToggleDone}
          onRename={handleRename}
          onDelete={handleDelete}
          onStart={(t) => timer.start(t.id)}
          onStop={timer.stop}
          onComplete={timer.complete}
          onMoveStatus={handleMoveStatus}
          onToggleExpand={handleToggleExpand}
          onPatch={handlePatch}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          isRunning={isRunning}
          isExpanded={isExpanded}
          runningElapsedSec={isRunning ? timer.running!.elapsedSec : 0}
          priorWorkedSec={task.worked_sec}
          dragState={
            !drag
              ? null
              : drag.draggedId === task.id
                ? "dragging"
                : drag.overId === task.id && drag.edge === "above"
                  ? "drop-above"
                  : drag.overId === task.id && drag.edge === "below"
                    ? "drop-below"
                    : null
          }
        />
        {isExpanded && (
          <TaskDetails
            task={task}
            onSave={(patch) => handleSaveDetails(task, patch)}
            onClose={() => setExpandedId(null)}
            autoFocus={false}
          />
        )}
      </Fragment>
    );
  }
}
