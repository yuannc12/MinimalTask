import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import type { Task, TaskStatus } from "../db";
import { fmtClock, fmtSec } from "../lib/parseInput";
import { parseTags } from "../lib/tags";

interface Props {
  task: Task;
  onToggleDone: (task: Task) => void;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
  onStart: (task: Task) => void;
  onStop: () => void;
  onComplete: () => void;
  onMoveStatus: (task: Task, to: TaskStatus) => void;
  onToggleExpand: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDragOver: (task: Task, position: "above" | "below") => void;
  onDragEnd: () => void;
  onDrop: () => void;
  dragState?: "dragging" | "drop-above" | "drop-below" | null;
  isRunning: boolean;
  isExpanded: boolean;
  runningElapsedSec: number;
  /** Closed-session worked total for this task. Drives both live cumulative (running) and post-pause display. */
  priorWorkedSec?: number;
}

export function TaskRow({
  task,
  onToggleDone,
  onRename,
  onDelete,
  onStart,
  onStop,
  onComplete,
  onMoveStatus,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  dragState,
  isRunning,
  isExpanded,
  runningElapsedSec,
  priorWorkedSec = 0,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) {
      onRename(task, trimmed);
    } else {
      setDraft(task.title);
    }
    setEditing(false);
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setDraft(task.title);
      setEditing(false);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const half = rect.top + rect.height / 2;
    onDragOver(task, e.clientY < half ? "above" : "below");
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    onDrop();
  }

  const isDone = task.status === "done";

  const cumulativeSec = priorWorkedSec + runningElapsedSec;
  const overage =
    isRunning &&
    task.estimated_minutes &&
    cumulativeSec > task.estimated_minutes * 60;

  const classes = [
    "task-row",
    isDone ? "is-done" : "",
    isRunning ? "is-running" : "",
    dragState === "dragging" ? "is-dragging" : "",
    dragState === "drop-above" ? "is-drop-above" : "",
    dragState === "drop-below" ? "is-drop-below" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      draggable={!editing && !isRunning}
      onDragStart={() => onDragStart(task)}
      onDragOver={handleDragOver}
      onDragEnd={onDragEnd}
      onDrop={handleDrop}
    >
      <button
        className={`task-checkbox ${isDone ? "is-done" : ""}`}
        onClick={() => onToggleDone(task)}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
      />
      <div className="task-title-wrap">
        {editing ? (
          <input
            ref={inputRef}
            className="task-title-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKey}
          />
        ) : (
          <span
            className="task-title"
            onClick={() => !isDone && setEditing(true)}
          >
            {task.title}
          </span>
        )}
      </div>

      <div className="task-meta">
        {parseTags(task.tag).map((t) => (
          <span key={t} className="task-tag">#{t}</span>
        ))}
        {task.tag &&
        (task.estimated_minutes || isRunning || priorWorkedSec > 0) ? (
          <span className="task-meta-sep">·</span>
        ) : null}
        {isRunning ? (
          <span className={`task-elapsed ${overage ? "is-over" : ""}`}>
            {fmtClock(cumulativeSec)}
            {task.estimated_minutes ? (
              <span className="task-elapsed-est"> / {task.estimated_minutes}m</span>
            ) : null}
          </span>
        ) : priorWorkedSec > 0 ? (
          <span className="task-worked">
            {fmtSec(priorWorkedSec)}
            {task.estimated_minutes ? (
              <span className="task-elapsed-est"> / {task.estimated_minutes}m</span>
            ) : null}
          </span>
        ) : task.estimated_minutes ? (
          <span>{task.estimated_minutes}m</span>
        ) : null}
        {task.note ? <span className="task-note-dot" title="Has a note">·</span> : null}
      </div>

      <div className="task-actions">
        {isRunning ? (
          <>
            <button className="task-action" onClick={onStop} title="Stop">
              stop
            </button>
            <button
              className="task-action is-complete"
              onClick={onComplete}
              title="Complete"
            >
              complete
            </button>
          </>
        ) : !isDone ? (
          <>
            <button
              className="task-action task-action-start"
              onClick={() => onStart(task)}
              title="Start timer"
            >
              start
            </button>
            {task.status === "backlog" ? (
              <button
                className="task-action"
                onClick={() => onMoveStatus(task, "today")}
                title="Move to Today"
              >
                → today
              </button>
            ) : task.status === "today" ? (
              <button
                className="task-action"
                onClick={() => onMoveStatus(task, "backlog")}
                title="Move to Backlog"
              >
                → backlog
              </button>
            ) : null}
            <button
              className={`task-action ${isExpanded ? "is-active" : ""}`}
              onClick={() => onToggleExpand(task)}
              title="Edit details"
            >
              edit
            </button>
          </>
        ) : (
          <button
            className={`task-action ${isExpanded ? "is-active" : ""}`}
            onClick={() => onToggleExpand(task)}
            title="Edit details"
          >
            edit
          </button>
        )}
        {!isRunning && (
          <button
            className="task-delete"
            onClick={() => onDelete(task)}
            aria-label="Delete task"
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
