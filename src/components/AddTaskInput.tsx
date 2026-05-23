import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { parseTaskInput, findTagAtCursor } from "../lib/parseInput";
import { stringifyTags } from "../lib/tags";
import type { NewTask, TaskStatus } from "../db";

interface Props {
  status: TaskStatus;
  knownTags: string[];
  onAdd: (input: NewTask) => Promise<void>;
}

const PLACEHOLDERS: Record<TaskStatus, string> = {
  today: "Add a task for today. Use #tag and 30m to estimate.",
  backlog: "Add to backlog. Use #tag and 1h 15m to estimate.",
  done: "",
};

const MAX_SUGGESTIONS = 6;

export function AddTaskInput({ status, knownTags, onAdd }: Props) {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const tagCtx = findTagAtCursor(value, cursor);
  const suggestions = tagCtx
    ? knownTags
        .filter(
          (t) =>
            t.startsWith(tagCtx.partial.toLowerCase()) &&
            !insertedTagsBefore(value, tagCtx.start).includes(t),
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];

  useEffect(() => {
    setSuggestIdx(0);
  }, [tagCtx?.partial, suggestions.length]);

  async function submit() {
    const raw = value.trim();
    if (!raw) return;
    const parsed = parseTaskInput(raw);
    if (!parsed.title) return;
    await onAdd({
      title: parsed.title,
      tag: stringifyTags(parsed.tags),
      estimated_minutes: parsed.estimated_minutes,
      status,
    });
    setValue("");
    setCursor(0);
  }

  function applySuggestion(tag: string) {
    if (!tagCtx) return;
    const before = value.slice(0, tagCtx.start);
    const after = value.slice(tagCtx.end);
    const insert = `#${tag}`;
    const next = `${before}${insert}${after.startsWith(" ") ? "" : " "}${after}`;
    const newCursor = before.length + insert.length + 1;
    setValue(next);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(newCursor, newCursor);
      setCursor(newCursor);
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (suggestions.length > 0 && tagCtx) {
      applySuggestion(suggestions[suggestIdx]);
      return;
    }
    submit();
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[suggestIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setCursor(-1);
        return;
      }
    }
    if (e.key === "Escape") {
      setValue("");
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleSelection() {
    const el = inputRef.current;
    if (el) setCursor(el.selectionStart ?? 0);
  }

  if (status === "done") return null;

  return (
    <form className="add-row" onSubmit={handleSubmit} autoComplete="off">
      <input
        ref={inputRef}
        className="add-input"
        placeholder={PLACEHOLDERS[status]}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCursor(e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={handleKey}
        onKeyUp={handleSelection}
        onMouseUp={handleSelection}
        onFocus={handleSelection}
        autoFocus
      />
      {suggestions.length > 0 && tagCtx && (
        <ul className="tag-suggest">
          {suggestions.map((t, i) => (
            <li
              key={t}
              className={`tag-suggest-item ${i === suggestIdx ? "is-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(t);
              }}
            >
              #{t}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function insertedTagsBefore(text: string, end: number): string[] {
  const re = /(?<=^|\s)#([A-Za-z0-9][\w-]*)\b/g;
  const head = text.slice(0, end);
  return Array.from(head.matchAll(re)).map((m) => m[1].toLowerCase());
}
