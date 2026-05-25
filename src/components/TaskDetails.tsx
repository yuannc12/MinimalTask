import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Task } from "../db";
import { extractLinks, linkLabel } from "../lib/links";

interface Props {
  task: Task;
  onSave: (patch: { note: string | null }) => Promise<void>;
  onClose: () => void;
  autoFocus?: boolean;
}

const SAVE_DEBOUNCE_MS = 400;
const NOTE_LINE_HEIGHT_PX = 21; // 14px * 1.5
const NOTE_VERTICAL_PADDING_PX = 10; // 4 top + 6 bottom
const NOTE_MIN_LINES = 2;
const NOTE_MAX_LINES = 4;

export function TaskDetails({ task, onSave, onClose, autoFocus = true }: Props) {
  const [note, setNote] = useState(task.note ?? "");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    setNote(task.note ?? "");
    isFirstRun.current = true;
  }, [task.id]);

  useEffect(() => {
    if (autoFocus) noteRef.current?.focus();
  }, [autoFocus]);

  // Auto-grow the textarea from 2 → 4 lines, then let it scroll.
  useLayoutEffect(() => {
    const ta = noteRef.current;
    if (!ta) return;
    const min = NOTE_LINE_HEIGHT_PX * NOTE_MIN_LINES + NOTE_VERTICAL_PADDING_PX;
    const max = NOTE_LINE_HEIGHT_PX * NOTE_MAX_LINES + NOTE_VERTICAL_PADDING_PX;
    ta.style.height = "auto";
    ta.style.height = Math.min(Math.max(ta.scrollHeight, min), max) + "px";
  }, [note]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const handle = window.setTimeout(async () => {
      await onSave({ note: note.trim() ? note.trim() : null });
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [note, onSave]);

  function handleRootKey(e: KeyboardEvent) {
    if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
      e.preventDefault();
      onClose();
    }
  }

  const links = useMemo(() => extractLinks(note), [note]);

  return (
    <div className="task-details" onKeyDown={handleRootKey}>
      <textarea
        ref={noteRef}
        className="task-details-note"
        value={note}
        placeholder="Note"
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />
      {links.length > 0 && (
        <div className="task-details-links">
          {links.map((url) => (
            <button
              key={url}
              className="task-details-link"
              onClick={() => void openUrl(url)}
              title={url}
            >
              {linkLabel(url)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
