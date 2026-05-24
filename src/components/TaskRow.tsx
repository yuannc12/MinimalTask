import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import type { Task, TaskStatus } from "../db";
import { fmtClock, fmtMin, fmtSec, parseDuration } from "../lib/parseInput";
import { normalizeTag, parseTags, stringifyTags } from "../lib/tags";

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
  onPatch: (
    task: Task,
    patch: Partial<Pick<Task, "tag" | "estimated_minutes">>,
  ) => Promise<void> | void;
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

type InlineEdit =
  | { kind: "tag"; original: string }
  | { kind: "addTag" }
  | { kind: "estimate" }
  | null;

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
  onPatch,
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

  const [inlineEdit, setInlineEdit] = useState<InlineEdit>(null);
  const [inlineDraft, setInlineDraft] = useState("");
  const inlineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (inlineEdit) {
      inlineInputRef.current?.focus();
      inlineInputRef.current?.select();
    }
  }, [inlineEdit]);

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
      if (isExpanded) onToggleExpand(task);
    }
  }

  function startEditTag(name: string) {
    if (isDone) return;
    setInlineEdit({ kind: "tag", original: name });
    setInlineDraft(name);
  }

  function startEditEstimate() {
    if (isDone) return;
    setInlineEdit({ kind: "estimate" });
    setInlineDraft(
      task.estimated_minutes ? fmtMin(task.estimated_minutes) : "",
    );
  }

  function startAddTag() {
    if (isDone) return;
    setInlineEdit({ kind: "addTag" });
    setInlineDraft("");
  }

  function applyTagCommit(raw: string, edit: InlineEdit) {
    const trimmed = raw.trim();
    if (!edit) return;
    if (edit.kind === "tag") {
      const next = normalizeTag(trimmed);
      const current = parseTags(task.tag);
      let updated: string[];
      if (!next) {
        updated = current.filter((t) => t !== edit.original);
      } else if (next === edit.original) {
        updated = current;
      } else {
        updated = current
          .map((t) => (t === edit.original ? next : t))
          .filter((t, i, arr) => arr.indexOf(t) === i);
      }
      void onPatch(task, { tag: stringifyTags(updated) });
    } else if (edit.kind === "addTag") {
      const next = normalizeTag(trimmed);
      if (next) {
        const current = parseTags(task.tag);
        if (!current.includes(next)) {
          void onPatch(task, { tag: stringifyTags([...current, next]) });
        }
      }
    }
  }

  function commitInlineEdit() {
    if (!inlineEdit) return;
    if (inlineEdit.kind === "tag" || inlineEdit.kind === "addTag") {
      applyTagCommit(inlineDraft, inlineEdit);
    } else if (inlineEdit.kind === "estimate") {
      const trimmed = inlineDraft.trim();
      const minutes = trimmed ? parseDuration(trimmed) : null;
      void onPatch(task, { estimated_minutes: minutes });
    }
    setInlineEdit(null);
  }

  function handleTagInputChange(raw: string) {
    const value = raw.replace(/^#+/, "");
    if (
      value.includes(",") &&
      inlineEdit &&
      (inlineEdit.kind === "tag" || inlineEdit.kind === "addTag")
    ) {
      const [first, rest] = value.split(",", 2);
      applyTagCommit(first, inlineEdit);
      setInlineEdit({ kind: "addTag" });
      setInlineDraft(rest);
      return;
    }
    setInlineDraft(value);
  }

  function handleInlineKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInlineEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInlineEdit(null);
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
    isExpanded ? "is-expanded" : "",
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
      <div className="task-row-main">
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
            onClick={() => {
              if (isDone) {
                onToggleExpand(task);
                return;
              }
              if (isExpanded) {
                onToggleExpand(task);
              } else {
                onToggleExpand(task);
                setEditing(true);
              }
            }}
          >
            {task.title}
          </span>
        )}
      </div>

      <div className="task-row-secondary">
      <div className="task-meta">
        {parseTags(task.tag).map((t) =>
          inlineEdit?.kind === "tag" && inlineEdit.original === t ? (
            <span key={t} className="task-tag-edit">
              <span className="task-tag-edit-prefix">#</span>
              <input
                ref={inlineInputRef}
                className="task-tag-input"
                value={inlineDraft}
                onChange={(e) => handleTagInputChange(e.target.value)}
                onBlur={commitInlineEdit}
                onKeyDown={handleInlineKey}
                size={Math.max(inlineDraft.length || 1, t.length)}
              />
            </span>
          ) : (
            <button
              key={t}
              className="task-tag"
              onClick={() => startEditTag(t)}
            >
              #{t}
            </button>
          ),
        )}
        {inlineEdit?.kind === "addTag" ? (
          <span className="task-tag-edit">
            <span className="task-tag-edit-prefix">#</span>
            <input
              ref={inlineInputRef}
              className="task-tag-input"
              value={inlineDraft}
              onChange={(e) => handleTagInputChange(e.target.value)}
              onBlur={commitInlineEdit}
              onKeyDown={handleInlineKey}
              size={Math.max(inlineDraft.length || 1, 4)}
              placeholder="tag"
            />
          </span>
        ) : !isDone && parseTags(task.tag).length === 0 ? (
          <button
            className="task-tag task-tag-add"
            onClick={startAddTag}
          >
            +tag
          </button>
        ) : null}
        {(task.tag || inlineEdit?.kind === "addTag") &&
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
        ) : inlineEdit?.kind === "estimate" ? (
          <input
            ref={inlineInputRef}
            className="task-estimate-input"
            value={inlineDraft}
            placeholder="45m"
            onChange={(e) => setInlineDraft(e.target.value)}
            onBlur={commitInlineEdit}
            onKeyDown={handleInlineKey}
            size={6}
          />
        ) : priorWorkedSec > 0 ? (
          <button className="task-worked" onClick={startEditEstimate} title="Click to edit estimate">
            {priorWorkedSec < 60 ? "<1m" : fmtSec(priorWorkedSec)}
            {task.estimated_minutes ? (
              <span className="task-elapsed-est"> / {task.estimated_minutes}m</span>
            ) : null}
          </button>
        ) : task.estimated_minutes ? (
          <button className="task-estimate" onClick={startEditEstimate} title="Click to edit estimate">
            {task.estimated_minutes}m
          </button>
        ) : !isDone ? (
          <button
            className="task-estimate task-estimate-empty"
            onClick={startEditEstimate}
            title="Add an estimate"
          >
            +est
          </button>
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
                →today
              </button>
            ) : task.status === "today" ? (
              <button
                className="task-action"
                onClick={() => onMoveStatus(task, "backlog")}
                title="Move to Backlog"
              >
                →backlog
              </button>
            ) : null}
          </>
        ) : null}
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
      </div>
    </div>
  );
}
