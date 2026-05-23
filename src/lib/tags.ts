// Tags are stored as a comma-separated string in the `tag` column on tasks.
// No schema migration: we serialize an array down to CSV at the boundary and
// fan back out in the UI.

export function parseTags(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function stringifyTags(tags: string[]): string | null {
  const cleaned = Array.from(
    new Set(tags.map((t) => normalizeTag(t)).filter((t) => t.length > 0)),
  );
  return cleaned.length ? cleaned.join(",") : null;
}

// Strip leading # and lowercase. Internal storage is the bare name; UI prefixes #.
export function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, "").trim().toLowerCase();
}

export function displayTag(name: string): string {
  return `#${name}`;
}
