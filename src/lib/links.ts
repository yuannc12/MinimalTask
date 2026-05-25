const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    if (path && path !== "/") {
      const segs = path.split("/").filter(Boolean);
      return segs.length > 1
        ? `${u.hostname}/${segs[0]}/…`
        : `${u.hostname}${path}`;
    }
    return u.hostname;
  } catch {
    return url;
  }
}
