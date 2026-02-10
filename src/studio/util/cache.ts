const STUDIO_CACHE_PREFIX = "hyperblog.studio.cache";
const STUDIO_DATA_CACHE_PREFIX = "hyperblog.studio.cache.data:v1:";

type StudioCacheEntryV1<T> = {
  v: 1;
  savedAt: number;
  value: T;
};

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeLocalStorageKeys(): string[] {
  try {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

export function studioDataCacheKey(baseUrl: string, parts: string[]): string {
  return `${STUDIO_DATA_CACHE_PREFIX}${baseUrl}:${parts.join(":")}`;
}

export function readStudioDataCache<T>(key: string): StudioCacheEntryV1<T> | null {
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StudioCacheEntryV1<T>;
    if (!v || typeof v !== "object") return null;
    if (v.v !== 1) return null;
    if (typeof v.savedAt !== "number") return null;
    return v;
  } catch {
    return null;
  }
}

export function writeStudioDataCache<T>(key: string, value: T): boolean {
  const payload: StudioCacheEntryV1<T> = { v: 1, savedAt: Date.now(), value };
  return safeLocalStorageSet(key, JSON.stringify(payload));
}

export function pruneStudioDataCache(prefix: string, maxEntries: number): void {
  if (!maxEntries || maxEntries < 1) return;
  const keys = safeLocalStorageKeys().filter((k) => k.startsWith(prefix));
  if (keys.length <= maxEntries) return;

  const items = keys
    .map((k) => {
      const e = readStudioDataCache<unknown>(k);
      return e ? { key: k, savedAt: e.savedAt } : null;
    })
    .filter((x): x is { key: string; savedAt: number } => Boolean(x))
    .sort((a, b) => a.savedAt - b.savedAt);

  const removeCount = Math.max(0, items.length - maxEntries);
  for (let i = 0; i < removeCount; i++) safeLocalStorageRemove(items[i]!.key);
}

export function clearStudioCaches(opts?: { publisherBaseUrl?: string }): number {
  const target = String(opts?.publisherBaseUrl ?? "").trim();
  const keys = safeLocalStorageKeys();
  let removed = 0;
  for (const k of keys) {
    if (!k.startsWith(STUDIO_CACHE_PREFIX)) continue;
    if (target && !k.includes(target)) continue;
    safeLocalStorageRemove(k);
    removed += 1;
  }
  return removed;
}

function hash32FNV1a(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function stableCacheKeySegment(input: string, opts?: { maxLen?: number }): string {
  const maxLen = opts?.maxLen ?? 72;
  const raw = input.trim().toLowerCase();
  if (!raw) return "_";
  const safe = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!safe) return `_${hash32FNV1a(raw)}`;
  if (safe.length <= maxLen) return safe;
  return `${safe.slice(0, maxLen)}-${hash32FNV1a(raw).slice(0, 8)}`;
}

