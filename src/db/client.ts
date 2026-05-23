import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:minimaltask.db");
  }
  return dbPromise;
}

export const nowSec = (): number => Math.floor(Date.now() / 1000);
