import type { TaskStatus } from "../db";

interface Props {
  active: TaskStatus;
  onSelect: (s: TaskStatus) => void;
  counts: Record<TaskStatus, number>;
}

const ITEMS: { key: TaskStatus; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "backlog", label: "Backlog" },
  { key: "done", label: "Done" },
];

export function Sidebar({ active, onSelect, counts }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">MinimalTask</div>
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`sidebar-item ${active === it.key ? "is-active" : ""}`}
          onClick={() => onSelect(it.key)}
        >
          <span>{it.label}</span>
          <span className="sidebar-item-count">{counts[it.key]}</span>
        </button>
      ))}
    </aside>
  );
}
