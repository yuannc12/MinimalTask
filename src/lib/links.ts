const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;

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

/** Prepend https:// when a match is scheme-less (e.g. www.ramp.com). */
export function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function linkLabel(url: string): string {
  try {
    const u = new URL(toHref(url));
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
