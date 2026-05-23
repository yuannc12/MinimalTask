interface Props {
  tags: string[];
  active: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export function TagFilter({ tags, active, onToggle, onClear }: Props) {
  return (
    <div className="tag-filter">
      {tags.map((t) => {
        const isActive = active.includes(t);
        return (
          <button
            key={t}
            className={`tag-chip ${isActive ? "is-active" : ""}`}
            onClick={() => onToggle(t)}
          >
            #{t}
          </button>
        );
      })}
      {active.length > 0 && (
        <button className="tag-chip-clear" onClick={onClear}>
          clear
        </button>
      )}
    </div>
  );
}
