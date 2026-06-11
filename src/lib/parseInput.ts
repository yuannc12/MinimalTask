import { normalizeTag } from "./tags";

export interface ParsedTaskInput {
  title: string;
  tags: string[];
  estimated_minutes: number | null;
}

const TAG_RE = /(?<=^|\s)#([A-Za-z0-9][\w-]*)\b/g;
const TIME_RE = /(?<=^|\s)(\d+)\s*([hm])(?=\s|$)/gi;

// "Sketch onboarding flow #design #client 1h 30m" =>
//   { title: "Sketch onboarding flow", tags: ["design","client"], estimated_minutes: 90 }
export function parseTaskInput(raw: string): ParsedTaskInput {
  let working = ` ${raw} `;

  const tags = Array.from(working.matchAll(TAG_RE))
    .map((m) => normalizeTag(m[1]))
    .filter((t) => t.length > 0);
  working = working.replace(TAG_RE, " ");

  let minutes = 0;
  let matched = false;
  for (const m of working.matchAll(TIME_RE)) {
    matched = true;
    const n = parseInt(m[1], 10);
    minutes += m[2].toLowerCase() === "h" ? n * 60 : n;
  }
  working = working.replace(TIME_RE, " ");

  const title = working.replace(/\s+/g, " ").trim();

  return {
    title,
    tags: Array.from(new Set(tags)),
    estimated_minutes: matched && minutes > 0 ? minutes : null,
  };
}

// Find the partial #tag the cursor is currently inside, if any.
// "Sketch #des|ign" with cursor at 10 returns { start: 7, end: 13, partial: "des" }
export function findTagAtCursor(
  text: string,
  cursor: number,
): { start: number; end: number; partial: string } | null {
  let i = cursor;
  while (i > 0 && /[\w-]/.test(text[i - 1])) i--;
  if (text[i - 1] !== "#") return null;
  const start = i - 1;
  let end = cursor;
  while (end < text.length && /[\w-]/.test(text[end])) end++;
  const partial = text.slice(start + 1, end);
  return { start, end, partial };
}

// Parse a free-form duration ("1h 30m", "45m", "2h") into minutes.
// Returns null if the string contains no recognizable duration.
export function parseDuration(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const re = /(\d+)\s*([hm])/gi;
  let minutes = 0;
  let matched = false;
  for (const m of trimmed.matchAll(re)) {
    matched = true;
    const n = parseInt(m[1], 10);
    minutes += m[2].toLowerCase() === "h" ? n * 60 : n;
  }
  return matched && minutes > 0 ? minutes : null;
}

export function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}

export function fmtMin(min: number): string {
  return fmtSec(min * 60);
}

// Calendar date from Unix seconds, e.g. "Jun 11, 2026".
export function fmtDate(sec: number): string {
  return new Date(sec * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Live clock format: m:ss under an hour, h:mm:ss above.
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h) {
    return `${h}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  }
  return `${m}:${ss.toString().padStart(2, "0")}`;
}
