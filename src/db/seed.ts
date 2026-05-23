import { getDb } from "./client";
import { createTask } from "./tasks";

// Fully fictional. No real client names. Tags are stored as CSV.
const TODAY = [
  { title: "Sketch onboarding flow for Atlas OS", tag: "design,atlas", estimated_minutes: 60 },
  { title: "Reply to the Hollow Bay invoice email", tag: "admin", estimated_minutes: 10 },
  { title: "Refactor timer state machine", tag: "code", estimated_minutes: 45 },
  { title: "Read chapter on flow + interruption cost", tag: "read", estimated_minutes: 25 },
];

const BACKLOG = [
  { title: "Draft Q3 review for the Lumen project", tag: "write,lumen", estimated_minutes: 90 },
  { title: "Plan the Driftwood retreat agenda", tag: "ops,driftwood", estimated_minutes: 30 },
  { title: "Audit pinned tabs", tag: "admin", estimated_minutes: 15 },
  { title: "Wireframe Atlas dashboard v2", tag: "design,atlas", estimated_minutes: 60 },
  { title: "Hollow Bay onboarding doc", tag: "write,hollow-bay", estimated_minutes: 45 },
];

export async function seedDev(): Promise<{ inserted: number; skipped: boolean }> {
  const db = await getDb();
  const rows = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM tasks");
  if ((rows[0]?.n ?? 0) > 0) return { inserted: 0, skipped: true };

  let inserted = 0;
  for (const t of TODAY) {
    await createTask({ ...t, status: "today" });
    inserted++;
  }
  for (const t of BACKLOG) {
    await createTask({ ...t, status: "backlog" });
    inserted++;
  }
  return { inserted, skipped: false };
}

export async function wipeAll(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM sessions");
  await db.execute("DELETE FROM tasks");
}
