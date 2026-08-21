const STORAGE_KEY = "modortho_recently_seen";
const MAX_ITEMS = 10;

export interface RecentlySeenEntry {
  slug: string;
  viewedAt: number;
}

function readStorage(): RecentlySeenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlySeenEntry[];
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e.slug === "string") : [];
  } catch {
    return [];
  }
}

function writeStorage(entries: RecentlySeenEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
}

export function getRecentlySeenSlugs(excludeSlug?: string): string[] {
  return readStorage()
    .filter((e) => e.slug !== excludeSlug)
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .map((e) => e.slug);
}

export function recordProductView(slug: string) {
  const entries = readStorage().filter((e) => e.slug !== slug);
  entries.unshift({ slug, viewedAt: Date.now() });
  writeStorage(entries);
}

export function removeRecentlySeenSlug(slug: string) {
  const entries = readStorage().filter((e) => e.slug !== slug);
  writeStorage(entries);
}

