import { seedDev, wipeAll } from "../db";

interface Props {
  onChange: () => void;
}

export function DevFooter({ onChange }: Props) {
  if (!import.meta.env.DEV) return null;

  async function handleSeed() {
    const r = await seedDev();
    if (r.skipped) console.log("seed: db non-empty, skipped");
    onChange();
  }

  async function handleWipe() {
    if (!confirm("Delete all tasks and sessions?")) return;
    await wipeAll();
    onChange();
  }

  return (
    <div className="pane-footer">
      <button onClick={handleSeed}>seed dev data</button>
      <button onClick={handleWipe}>wipe all</button>
    </div>
  );
}
