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
  }, [status]);

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

  const handleSaveDetails = async (
    task: Task,
    patch: { tag: string | null; estimated_minutes: number | null; note: string | null },
  ) => {
    await updateTask(task.id, patch);
    setExpandedId(null);
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
    setDrag(null);
    await refresh();
  };

  const filteredTasks = useMemo(() => {
    if (status !== "backlog" || activeFilters.length === 0) return tasks;
    return tasks.filter((t) => {
      const tags = parseTags(t.tag);
      return activeFilters.every((f) => tags.includes(f));
    });
  }, [tasks, status, activeFilters]);

  const liveWorkedSec =
    timer.running && tasks.some((t) => t.id === timer.running!.taskId)
      ? totals.worked_sec + timer.running.elapsedSec
      : totals.worked_sec;
  const overBudget = liveWorkedSec > totals.estimated_min * 60 && totals.estimated_min > 0;

  return (
    <div className="pane">
      <header className="view-header">
        <h1 className="view-title">{TITLES[status]}</h1>
        {status !== "done" && (
          <div className="view-totals">
            <span className={overBudget ? "is-over" : ""}>
              {fmtSec(liveWorkedSec)}
            </span>
            {totals.estimated_min > 0 && (
              <>
                {" / "}
                <span>{fmtMin(totals.estimated_min)}</span>
              </>
            )}
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
            knownTags={knownTags}
            onSave={(patch) => handleSaveDetails(task, patch)}
            onCancel={() => setExpandedId(null)}
          />
        )}
      </Fragment>
    );
  }
}
