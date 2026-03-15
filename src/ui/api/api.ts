import type {
  Category,
  Note,
  NoteListItem,
  Profile,
  Project,
} from "../types";
import { preloadNotePage } from "../navigation/preloaders";

const DEFAULT_TIMEOUT_MS = 12_000;

type ApiWindow = Window & { __HB_BUILD__?: unknown; __HB_PROFILE__?: unknown };

function basePath(): string {
  const base = import.meta.env.BASE_URL || "/";
  if (!base) return "/";
  return base.endsWith("/") ? base.slice(0, -1) || "/" : base;
}

let hbBuildId: string | null | undefined = undefined;
function getBuildId(): string | null {
  if (hbBuildId !== undefined) return hbBuildId;
  if (typeof window === "undefined") return (hbBuildId = null);
  const w = window as ApiWindow;
  const raw = w.__HB_BUILD__;
  hbBuildId = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  return hbBuildId;
}

function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = basePath();
  const buildId = getBuildId();
  const url = base === "/" ? p : `${base}${p}`;
  if (!buildId) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}v=${encodeURIComponent(buildId)}`;
}

function readEmbeddedProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  const w = window as ApiWindow;
  if (w.__HB_PROFILE__ && typeof w.__HB_PROFILE__ === "object") return w.__HB_PROFILE__ as Profile;

  const el = document.getElementById("hb-profile");
  if (!el?.textContent) return null;
  try {
    const p = JSON.parse(el.textContent) as Profile;
    w.__HB_PROFILE__ = p;
    return p;
  } catch {
    return null;
  }
}

async function apiFetch<T>(input: string, opts?: { timeoutMs?: number }): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const cacheMode: RequestCache | undefined =
    !import.meta.env.DEV && getBuildId() && input.includes("/api/") && input.includes(".json") ? "force-cache" : undefined;

  try {
    const res = await fetch(input, {
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: cacheMode,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if ((err instanceof DOMException || err instanceof Error) && err.name === "AbortError") {
      throw new Error(`API timeout after ${timeoutMs}ms: ${input}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const fetchMemo = new Map<string, Promise<unknown>>();
function apiFetchCached<T>(input: string): Promise<T> {
  const hit = fetchMemo.get(input);
  if (hit) return hit as Promise<T>;
  const p = apiFetch<T>(input).catch((err) => {
    fetchMemo.delete(input);
    throw err;
  });
  fetchMemo.set(input, p as Promise<unknown>);
  return p;
}

function dateMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

let notesIndexPromise: Promise<NoteListItem[]> | null = null;
function getNotesIndex(): Promise<NoteListItem[]> {
  if (!notesIndexPromise) {
    notesIndexPromise = apiFetchCached<NoteListItem[]>(apiUrl("/api/notes.json"))
      .then((all) => {
        const list = all.filter((n) => !n.draft);
        list.sort((a, b) => dateMs(b.updated) - dateMs(a.updated));
        return list;
      })
      .catch((err) => {
        notesIndexPromise = null;
        throw err;
      });
  }
  return notesIndexPromise;
}

const noteMemo = new Map<string, Note>();
function safeId(input: string): string {
  return String(input ?? "").trim();
}

function peekNote(id: string): Note | null {
  const key = safeId(id);
  if (!key) return null;
  return noteMemo.get(key) ?? null;
}

function prefetchNote(id: string): Promise<Note | null> {
  const key = safeId(id);
  if (!key) return Promise.resolve(null);
  preloadNotePage();
  if (noteMemo.has(key)) return Promise.resolve(noteMemo.get(key) ?? null);
  return apiFetchCached<Note>(apiUrl(`/api/notes/${key}.json`))
    .then((n) => {
      if (n.draft) return null;
      noteMemo.set(key, n);
      return n;
    })
    .catch(() => null);
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function filterNotes(all: NoteListItem[], params?: { q?: string; category?: string }) {
  const q = params?.q ? normalize(params.q) : "";
  const category = params?.category ?? "";

  return all.filter((n) => {
    if (category && !n.categories.includes(category)) return false;
    if (q) {
      const hay = `${n.title} ${n.excerpt} ${n.tags.join(" ")} ${n.categories.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const api = {
  profile: () => {
    const embedded = readEmbeddedProfile();
    if (embedded) return Promise.resolve(embedded);
    return apiFetchCached<Profile>(apiUrl("/api/profile.json"));
  },
  prefetchNote,
  peekNote,
  categories: () => apiFetchCached<Category[]>(apiUrl("/api/categories.json")),
  notes: async (params?: { q?: string; category?: string }) => {
    const all = await getNotesIndex();
    return filterNotes(all, params);
  },
  note: async (id: string) => {
    const key = safeId(id);
    if (!key) throw new Error("note_not_found");
    const cached = noteMemo.get(key);
    if (cached) return cached;

    const n = await apiFetchCached<Note>(apiUrl(`/api/notes/${key}.json`));
    if (n.draft) throw new Error("note_not_found");
    noteMemo.set(key, n);
    return n;
  },
  projects: () => apiFetchCached<Project[]>(apiUrl("/api/projects.json")),
  project: async (id: string) => {
    const list = await apiFetchCached<Project[]>(apiUrl("/api/projects.json"));
    const p = list.find((x) => x.id === id);
    if (!p) throw new Error("project_not_found");
    return p;
  },
};
