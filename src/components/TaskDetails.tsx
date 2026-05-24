import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { Task } from "../db";
import { normalizeTag, parseTags, stringifyTags } from "../lib/tags";
import { parseDuration } from "../lib/parseInput";

interface Props {
  task: Task;
  knownTags: string[];
  onSave: (patch: {
    tag: string | null;
    estimated_minutes: number | null;
    note: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

const MAX_SUGGESTIONS = 6;
const SAVE_DEBOUNCE_MS = 400;

export function TaskDetails({ task, knownTags, onSave, onClose }: Props) {
  const [tags, setTags] = useState<string[]>(parseTags(task.tag));
  const [estimateRaw, setEstimateRaw] = useState(
    task.estimated_minutes ? formatMinutes(task.estimated_minutes) : "",
  );
  const [note, setNote] = useState(task.note ?? "");
  const [tagInput, setTagInput] = useState("");
  const [suggestIdx, setSuggestIdx] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const tagInputRef = useRef<HTMLInputElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const isFirstRun = useRef(true);

  // Reseed state when the panel switches to a different task (collapse + reopen
  // a different row). Reference change alone shouldn't reset — only the id.
  useEffect(() => {
    setTags(parseTags(task.tag));
    setEstimateRaw(task.estimated_minutes ? formatMinutes(task.estimated_minutes) : "");
    setNote(task.note ?? "");
    isFirstRun.current = true;
  }, [task.id]);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Autosave: debounce field changes and persist. The first effect run (right
  // after mount or task switch) is the seed — skip it so we don't fire an
  // unnecessary write for unchanged state.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const handle = window.setTimeout(async () => {
      const minutes = estimateRaw.trim() ? parseDuration(estimateRaw) : null;
      await onSave({
        tag: stringifyTags(tags),
        estimated_minutes: minutes,
        note: note.trim() ? note.trim() : null,
      });
      setSavedAt(Date.now());
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [tags, estimateRaw, note, onSave]);

  const trimmedInput = normalizeTag(tagInput);
  const suggestions = trimmedInput
    ? knownTags
        .filter((t) => t.startsWith(trimmedInput) && !tags.includes(t))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const canCreate =
    trimmedInput.length > 0 &&
    !tags.includes(trimmedInput) &&
    !knownTags.includes(trimmedInput);

  useEffect(() => {
    setSuggestIdx(0);
  }, [tagInput]);

  function addTag(name: string) {
    const clean = normalizeTag(name);
    if (!clean) return;
    if (!tags.includes(clean)) setTags([...tags, clean]);
    setTagInput("");
    tagInputRef.current?.focus();
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name));
  }

  function handleTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setSuggestIdx((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setSuggestIdx(
        (i) => (i - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions.length) {
        e.preventDefault();
        addTag(suggestions[suggestIdx]);
      } else if (canCreate) {
        e.preventDefault();
        addTag(trimmedInput);
      }
      return;
    }
    if (e.key === "Backspace" && !tagInput && tags.length) {
      e.preventDefault();
      setTags(tags.slice(0, -1));
    }
  }

  function handleRootKey(e: KeyboardEvent) {
    if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
      e.preventDefault();
      onClose();
    }
  }

  const savedAgoSec = savedAt
    ? Math.floor((Date.now() - savedAt) / 1000)
    : null;
  const statusText =
    savedAgoSec == null
      ? "Autosaves as you type"
      : savedAgoSec < 3
        ? "Saved"
        : "Autosaves as you type";

  return (
    <div className="task-details" onKeyDown={handleRootKey}>
      <div className="task-details-field">
        <label className="task-details-label">tags</label>
        <div className="task-details-tags">
          {tags.map((t) => (
            <button
              key={t}
              className="tag-chip is-active"
              onClick={() => removeTag(t)}
              title="Remove"
            >
              #{t} <span className="tag-chip-x">×</span>
            </button>
          ))}
          <input
            ref={tagInputRef}
            className="task-details-tag-input"
            value={tagInput}
            placeholder={tags.length ? "+ tag" : "add a tag"}
            onChange={(e) => setTagInput(e.target.value.replace(/^#+/, ""))}
            onKeyDown={handleTagKey}
          />
          {(suggestions.length > 0 || canCreate) && (
            <ul className="tag-suggest is-inline">
              {suggestions.map((t, i) => (
                <li
                  key={t}
                  className={`tag-suggest-item ${
                    i === suggestIdx ? "is-active" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(t);
                  }}
                >
                  #{t}
                </li>
              ))}
              {canCreate && (
                <li
                  className="tag-suggest-item is-create"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(trimmedInput);
                  }}
                >
                  create #{trimmedInput}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="task-details-row">
        <div className="task-details-field">
          <label className="task-details-label">estimate</label>
          <input
            ref={firstFieldRef}
            className="task-details-input"
            value={estimateRaw}
            placeholder="45m or 1h 30m"
            onChange={(e) => setEstimateRaw(e.target.value)}
          />
        </div>
      </div>

      <div className="task-details-field">
        <label className="task-details-label">note</label>
        <textarea
          className="task-details-textarea"
          value={note}
          placeholder="Anything to remember about this task"
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>

      <div className="task-details-status" aria-live="polite">
        {statusText}
        <span className="task-details-hint">esc to close</span>
      </div>
    </div>
  );
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
