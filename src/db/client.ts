import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:minimaltask.db").then(async (db) => {
      // WAL lets readers and writers coexist, so an external tool (e.g. an MCP
      // or Claude) can touch the same file while the app is running without
      // "database is locked". busy_timeout waits out the rare writer collision.
      await db.execute("PRAGMA journal_mode=WAL;");
      await db.execute("PRAGMA busy_timeout=3000;");
      return db;
    });
  }
  return dbPromise;
}

export const nowSec = (): number => Math.floor(Date.now() / 1000);
