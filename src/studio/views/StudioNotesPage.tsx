import {
  Check,
  Eye,
  ImagePlus,
  PencilLine,
  Plus,
  RefreshCw,
  SplitSquareHorizontal,
  Trash2,
  X,
} from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import YAML from "yaml";
import { publisherFetchJson } from "../../ui/publisher/client";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import type { Category, MindmapListItem, RoadmapNodeEntry } from "../../ui/types";
import { useStudioState } from "../state/StudioState";
import { emitWorkspaceChanged } from "../state/StudioWorkspace";
import { pruneStudioDataCache, readStudioDataCache, studioDataCacheKey, writeStudioDataCache } from "../util/cache";
import { formatStudioError } from "../util/errors";

type NoteInput = {
  title: string;
  content: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
  nodes?: string[];
  mindmaps?: string[];
  cover?: string;
  draft?: boolean;
  slug?: string;
  date?: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
};

type NotesListResponse = {
  notes: Array<{
    id: string;
    path: string;
    sha: string;
    size: number;
    meta?: { title?: string; date?: string; updated?: string; draft?: boolean; excerpt?: string };
  }>;
  paging: { after: string | null; nextAfter: string | null };
};

type NoteGetResponse = {
  note: { id: string; path: string; input: NoteInput; markdown: string };
};

type ViewMode = "edit" | "split" | "preview";

type EditorState = {
  mode: "create" | "edit";
  id: string | null;
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  categories: string[];
  tags: string[];
  nodes: string[];
  mindmaps: string[];
  cover: string;
  draft: boolean;
  content: string;
  baseMarkdown: string;
};

type Notice = { tone: "info" | "success" | "error"; message: string };

type LocalNoteDraftV1 = {
  v: 1;
  savedAt: number; // epoch ms
  noteId: string | null; // when editing an existing note
  baseMarkdown?: string;
  pendingDelete?: boolean;
  editor: {
    title: string;
    date: string;
    slug: string;
    excerpt: string;
    categories: string[];
    tags: string[];
    nodes: string[];
    mindmaps: string[];
    cover: string;
    draft: boolean;
    content: string;
  };
};

type LocalDraftIndexItem = {
  key: string;
  noteId: string | null;
  title: string;
  savedAt: number;
  draft: boolean;
  pendingDelete: boolean;
};

const DRAFT_NOTE_PREFIX = "hyperblog.studio.draft.note:";
const DRAFT_NEW_PREFIX = "hyperblog.studio.draft.new:";

type NotesListCacheV1 = {
  notes: NotesListResponse["notes"];
  paging: NotesListResponse["paging"];
};

const NOTES_LIST_CACHE_KEY = studioDataCacheKey(PUBLISHER_BASE_URL, ["notes", "list"]);
const ADMIN_CATEGORIES_CACHE_KEY = studioDataCacheKey(PUBLISHER_BASE_URL, ["categories", "admin"]);
const NOTE_DETAIL_CACHE_PREFIX = `${studioDataCacheKey(PUBLISHER_BASE_URL, ["notes", "detail"])}:`;
const MAX_NOTE_DETAIL_CACHE = 12;

function noteDetailCacheKey(noteId: string): string {
  return studioDataCacheKey(PUBLISHER_BASE_URL, ["notes", "detail", noteId]);
}

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

function noteDraftKey(noteId: string): string {
  return `${DRAFT_NOTE_PREFIX}${noteId}`;
}

function newDraftKey(): string {
  const anyCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
  const id = anyCrypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${DRAFT_NEW_PREFIX}${id}`;
}

function readLocalDraft(key: string): LocalNoteDraftV1 | null {
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LocalNoteDraftV1;
    if (!v || typeof v !== "object") return null;
    if (v.v !== 1) return null;
    if (typeof v.savedAt !== "number") return null;
    if (v.noteId !== null && typeof v.noteId !== "string") return null;
    if (typeof v.baseMarkdown !== "undefined" && typeof v.baseMarkdown !== "string") return null;
    if (typeof v.pendingDelete !== "undefined" && typeof v.pendingDelete !== "boolean") return null;
    if (!v.editor || typeof v.editor !== "object") return null;
    if (typeof v.editor.title !== "string") return null;
    if (typeof v.editor.content !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

function listLocalDraftIndex(): LocalDraftIndexItem[] {
  const keys = safeLocalStorageKeys();
  const drafts: LocalDraftIndexItem[] = [];
  for (const key of keys) {
    if (!key.startsWith(DRAFT_NOTE_PREFIX) && !key.startsWith(DRAFT_NEW_PREFIX)) continue;
    const d = readLocalDraft(key);
    if (!d) continue;
    const title = d.editor.title.trim() || d.noteId || "Untitled";
    drafts.push({
      key,
      noteId: d.noteId,
      title,
      savedAt: d.savedAt,
      draft: Boolean(d.editor.draft),
      pendingDelete: Boolean(d.pendingDelete),
    });
  }
  drafts.sort((a, b) => b.savedAt - a.savedAt);
  return drafts;
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return "—";
  if (diff < 15_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / 3_600_000)}h`;
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isValidYmd(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s;
}

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[[^\]]*]\([^)]*\)/g, "")
    .replace(/[#>*_-]{1,}\s?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFrontmatter(md: string): { frontmatter: Record<string, unknown>; body: string } {
  const raw = md ?? "";
  if (!raw.startsWith("---\n")) return { frontmatter: {}, body: raw };
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: raw };
  const yaml = raw.slice(4, end + 1);
  const body = raw.slice(end + 5).replace(/^\s*\n/, "");
  const fm = (YAML.parse(yaml) ?? {}) as Record<string, unknown>;
  return { frontmatter: fm && typeof fm === "object" ? fm : {}, body };
}

function emptyEditor(): EditorState {
  return {
    mode: "create",
    id: null,
    title: "",
    date: todayLocal(),
    slug: "",
    excerpt: "",
    categories: [],
    tags: [],
    nodes: [],
    mindmaps: [],
    cover: "",
    draft: false,
    content: "",
    baseMarkdown: "",
  };
}

function insertIntoTextarea(el: HTMLTextAreaElement, insert: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + insert + el.value.slice(end);
  el.value = next;
  const caret = start + insert.length;
  el.selectionStart = caret;
  el.selectionEnd = caret;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}

async function fetchLocalJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

function normalizeIdList(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    const lower = v.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(lower);
  }
  return out;
}

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed."));
    reader.onload = () => {
      const result = reader.result;
      const dataUrl = typeof result === "string" ? result : "";
      const idx = dataUrl.indexOf("base64,");
      if (idx === -1) return reject(new Error("Unexpected file encoding."));
      resolve(dataUrl.slice(idx + "base64,".length));
    };
    reader.readAsDataURL(file);
  });
}

function buildUploadName(file: File): string {
  const name = (file.name ?? "asset").trim();
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";
  const base = name.replace(/\.[^/.]+$/, "");
  const safeBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "asset";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(16).slice(2, 8);
  const safeExt = ext ? ext.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) : "";
  return `${stamp}-${safeBase}-${rand}${safeExt ? `.${safeExt}` : ""}`;
}

function buildNoteId(args: { title: string; date: string; slug: string }): { ok: true; noteId: string; slug: string } | { ok: false; error: string } {
  const date = args.date.trim();
  if (!isValidYmd(date)) return { ok: false, error: "Invalid date (YYYY-MM-DD)." };

  const slugBase = args.slug.trim() || slugify(args.title);
  const slug = slugBase || `note-${shortHash(`${args.title}:${Date.now()}`)}`;
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return { ok: false, error: "Invalid slug (a-z0-9-)." };
  return { ok: true, noteId: `${date}-${slug}`, slug };
}

function renderNoteMarkdownFromEditor(args: { editor: EditorState; updatedYmd: string }): string {
  const title = args.editor.title.trim();
  const body = args.editor.content.trim();
  if (!title) throw new Error("Missing title.");
  if (!body) throw new Error("Missing content.");

  const date = args.editor.date.trim();
  if (!isValidYmd(date)) throw new Error("Invalid date (YYYY-MM-DD).");
  const updated = args.updatedYmd;

  const base = args.editor.baseMarkdown ? parseFrontmatter(args.editor.baseMarkdown) : { frontmatter: {}, body: "" };
  const fm: Record<string, unknown> = { ...(base.frontmatter ?? {}) };

  fm.title = title;
  fm.date = date;

  if (updated !== date) fm.updated = updated;
  else delete fm.updated;

  const excerpt = args.editor.excerpt.trim();
  if (excerpt) fm.excerpt = excerpt;
  else delete fm.excerpt;

  const categories = normalizeIdList(args.editor.categories);
  if (categories.length) fm.categories = categories;
  else delete fm.categories;

  const tags = normalizeIdList(args.editor.tags);
  if (tags.length) fm.tags = tags;
  else delete fm.tags;

  const nodes = normalizeIdList(args.editor.nodes);
  if (nodes.length) fm.nodes = nodes;
  else delete fm.nodes;

  const mindmaps = normalizeIdList(args.editor.mindmaps);
  if (mindmaps.length) fm.mindmaps = mindmaps;
  else delete fm.mindmaps;

  const cover = args.editor.cover.trim();
  if (cover) fm.cover = cover;
  else delete fm.cover;

  if (args.editor.draft) fm.draft = true;
  else delete fm.draft;

  const yaml = YAML.stringify(fm).trimEnd();
  return `---\n${yaml}\n---\n\n${body}\n`;
}

export function StudioNotesPage() {
  const studio = useStudioState();

  const [viewMode, setViewMode] = React.useState<ViewMode>("split");

  const [allCategories, setAllCategories] = React.useState<Category[]>(
    () => readStudioDataCache<Category[]>(ADMIN_CATEGORIES_CACHE_KEY)?.value ?? [],
  );
  const [nodesIndex, setNodesIndex] = React.useState<RoadmapNodeEntry[]>([]);
  const [mindmapsIndex, setMindmapsIndex] = React.useState<MindmapListItem[]>([]);

  const [notes, setNotes] = React.useState<NotesListResponse["notes"]>(
    () => readStudioDataCache<NotesListCacheV1>(NOTES_LIST_CACHE_KEY)?.value.notes ?? [],
  );
  const [paging, setPaging] = React.useState<NotesListResponse["paging"]>(
    () => readStudioDataCache<NotesListCacheV1>(NOTES_LIST_CACHE_KEY)?.value.paging ?? { after: null, nextAfter: null },
  );
  const [filter, setFilter] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [listRefreshing, setListRefreshing] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [editor, setEditor] = React.useState<EditorState>(() => emptyEditor());
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [lastUploadUrl, setLastUploadUrl] = React.useState<string | null>(null);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [draftKey, setDraftKey] = React.useState<string | null>(null);
  const [localSavedAt, setLocalSavedAt] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState(false);
  const [localDrafts, setLocalDrafts] = React.useState<LocalDraftIndexItem[]>(() => listLocalDraftIndex());

  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);
  const retryRef = React.useRef<(() => void) | null>(null);
  const dirtyRef = React.useRef(dirty);
  React.useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const refreshDraftIndex = React.useCallback(() => {
    setLocalDrafts(listLocalDraftIndex());
  }, []);

  React.useEffect(() => {
    refreshDraftIndex();
    const onStorage = (e: StorageEvent) => {
      const k = e.key ?? "";
      if (k.startsWith(DRAFT_NOTE_PREFIX) || k.startsWith(DRAFT_NEW_PREFIX)) refreshDraftIndex();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshDraftIndex]);

  const listLoadSeqRef = React.useRef(0);
  const refreshList = React.useCallback(
    async (opts?: { append?: boolean; background?: boolean }) => {
      if (!studio.token) return;
      const seq = (listLoadSeqRef.current += 1);
      const background = Boolean(opts?.background);
      if (background) setListRefreshing(true);
      else setListBusy(true);
      if (!background) setListError(null);
      try {
        const url = new URL("/api/admin/notes", "http://local");
        url.searchParams.set("include", "meta");
        url.searchParams.set("limit", "50");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const path = url.pathname + url.search;
        const res = await publisherFetchJson<NotesListResponse>({ path, token: studio.token });
        if (seq !== listLoadSeqRef.current) return;
        setNotes((prev) => {
          const next = opts?.append ? [...prev, ...res.notes] : res.notes;
          writeStudioDataCache(NOTES_LIST_CACHE_KEY, { notes: next, paging: res.paging });
          return next;
        });
        setPaging(res.paging);
      } catch (err: unknown) {
        if (seq !== listLoadSeqRef.current) return;
        if (!background) setListError(formatStudioError(err).message);
      } finally {
        if (seq !== listLoadSeqRef.current) return;
        if (background) setListRefreshing(false);
        else setListBusy(false);
      }
    },
    [studio.token, paging.nextAfter],
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const cachedAdmin = readStudioDataCache<Category[]>(ADMIN_CATEGORIES_CACHE_KEY)?.value ?? null;
      if (cachedAdmin && !cancelled) setAllCategories(cachedAdmin);

      const [catsStatic, nodes, mindmaps] = await Promise.all([
        fetchLocalJson<Category[]>("/api/categories.json").catch(() => [] as Category[]),
        fetchLocalJson<RoadmapNodeEntry[]>("/api/nodes.json").catch(() => [] as RoadmapNodeEntry[]),
        fetchLocalJson<MindmapListItem[]>("/api/mindmaps.json").catch(() => [] as MindmapListItem[]),
      ]);

      let cats = cachedAdmin ?? catsStatic;
      if (studio.token) {
        try {
          const res = await publisherFetchJson<{ file: { json: unknown } }>({ path: "/api/admin/categories", token: studio.token });
          if (Array.isArray(res.file.json)) {
            cats = res.file.json as Category[];
            writeStudioDataCache(ADMIN_CATEGORIES_CACHE_KEY, cats);
          }
        } catch {
          // ignore (fallback to static)
        }
      }

      if (cancelled) return;
      setAllCategories(cats);
      setNodesIndex(nodes);
      setMindmapsIndex(mindmaps);
    })();
    return () => {
      cancelled = true;
    };
  }, [studio.token, studio.syncNonce]);

  React.useEffect(() => {
    if (!studio.token) return;
    const cached = readStudioDataCache<NotesListCacheV1>(NOTES_LIST_CACHE_KEY)?.value ?? null;
    if (cached) {
      setNotes(cached.notes ?? []);
      setPaging(cached.paging ?? { after: null, nextAfter: null });
    }
    void refreshList({ background: Boolean(cached) });
  }, [studio.token, studio.syncNonce, refreshList]);

  const newNote = React.useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setEditor(emptyEditor());
    setDirty(false);
    setNotice(null);
    setLastUploadUrl(null);
    setSlugTouched(false);
    setDraftKey(newDraftKey());
    setLocalSavedAt(null);
    setPendingDelete(false);
    retryRef.current = null;
    setTimeout(() => contentRef.current?.focus(), 0);
  }, [dirty]);

  const noteLoadSeqRef = React.useRef(0);
  const openNote = React.useCallback(
    async (id: string, opts?: { restoreLocal?: boolean }) => {
      if (!studio.token) return;
      if (dirty && !window.confirm("Discard unsaved changes?")) return;

      const seq = (noteLoadSeqRef.current += 1);
      const dk = noteDraftKey(id);
      setDraftKey(dk);
      const local = readLocalDraft(dk);
      const restore =
        opts?.restoreLocal === true
          ? Boolean(local)
          : local
            ? window.confirm(`Restore local draft saved ${fmtRelative(local.savedAt)} ago?`)
            : false;

      setPendingDelete(restore && local ? Boolean(local.pendingDelete) : false);
      retryRef.current = () => void openNote(id, opts);
      setNotice(null);

      const cached = readStudioDataCache<NoteGetResponse>(noteDetailCacheKey(id))?.value ?? null;
      const cachedEditor: EditorState | null = (() => {
        if (!cached) return null;
        const input = cached.note.input;
        return {
          mode: "edit",
          id: cached.note.id,
          title: input.title ?? cached.note.id,
          date: input.date ?? todayLocal(),
          slug: "",
          excerpt: input.excerpt ?? "",
          categories: Array.isArray(input.categories) ? input.categories : [],
          tags: Array.isArray(input.tags) ? input.tags : [],
          nodes: Array.isArray(input.nodes) ? input.nodes : [],
          mindmaps: Array.isArray(input.mindmaps) ? input.mindmaps : [],
          cover: input.cover ?? "",
          draft: Boolean(input.draft),
          content: input.content ?? "",
          baseMarkdown: cached.note.markdown ?? "",
        };
      })();

      if (restore && local) {
        const le = local.editor;
        const seed: EditorState =
          cachedEditor ??
          ({
            mode: "edit",
            id,
            title: id,
            date: todayLocal(),
            slug: "",
            excerpt: "",
            categories: [],
            tags: [],
            nodes: [],
            mindmaps: [],
            cover: "",
            draft: false,
            content: "",
            baseMarkdown: "",
          } satisfies EditorState);

        setEditor({
          ...seed,
          title: typeof le.title === "string" ? le.title : seed.title,
          date: typeof le.date === "string" ? le.date : seed.date,
          slug: typeof le.slug === "string" ? le.slug : "",
          excerpt: typeof le.excerpt === "string" ? le.excerpt : "",
          categories: Array.isArray(le.categories) ? le.categories : [],
          tags: Array.isArray(le.tags) ? le.tags : [],
          nodes: Array.isArray(le.nodes) ? le.nodes : [],
          mindmaps: Array.isArray(le.mindmaps) ? le.mindmaps : [],
          cover: typeof le.cover === "string" ? le.cover : "",
          draft: Boolean(le.draft),
          content: typeof le.content === "string" ? le.content : "",
          baseMarkdown: typeof local.baseMarkdown === "string" ? local.baseMarkdown : seed.baseMarkdown,
        });
        setLocalSavedAt(local.savedAt);
        setNotice({ tone: "info", message: `Restored local draft (${fmtRelative(local.savedAt)} ago).` });
        setDirty(false);
        setSlugTouched(true);
      } else if (cachedEditor) {
        setEditor(cachedEditor);
        setLocalSavedAt(null);
        setPendingDelete(false);
        setDirty(false);
        setSlugTouched(true);
      }

      const background = Boolean(cachedEditor) || Boolean(restore && local);
      if (!background) setBusy(true);
      try {
        const res = await publisherFetchJson<NoteGetResponse>({
          path: `/api/admin/notes/${encodeURIComponent(id)}`,
          token: studio.token,
        });
        if (seq !== noteLoadSeqRef.current) return;
        writeStudioDataCache(noteDetailCacheKey(id), res);
        pruneStudioDataCache(NOTE_DETAIL_CACHE_PREFIX, MAX_NOTE_DETAIL_CACHE);

        const input = res.note.input;
        const remoteEditor: EditorState = {
          mode: "edit",
          id: res.note.id,
          title: input.title ?? res.note.id,
          date: input.date ?? todayLocal(),
          slug: "",
          excerpt: input.excerpt ?? "",
          categories: Array.isArray(input.categories) ? input.categories : [],
          tags: Array.isArray(input.tags) ? input.tags : [],
          nodes: Array.isArray(input.nodes) ? input.nodes : [],
          mindmaps: Array.isArray(input.mindmaps) ? input.mindmaps : [],
          cover: input.cover ?? "",
          draft: Boolean(input.draft),
          content: input.content ?? "",
          baseMarkdown: res.note.markdown ?? "",
        };

        if (restore && local) {
          setEditor((prev) => {
            if (prev.mode !== "edit" || prev.id !== id) return prev;
            return { ...prev, baseMarkdown: remoteEditor.baseMarkdown };
          });
        } else if (!dirtyRef.current) {
          setEditor(remoteEditor);
          setLocalSavedAt(null);
          setPendingDelete(false);
          setDirty(false);
          setSlugTouched(true);
        } else {
          setEditor((prev) => {
            if (prev.mode !== "edit" || prev.id !== id) return prev;
            return { ...prev, baseMarkdown: remoteEditor.baseMarkdown };
          });
        }
        retryRef.current = null;
      } catch (err: unknown) {
        if (!background) setNotice({ tone: "error", message: `Open failed: ${formatStudioError(err).message}` });
      } finally {
        if (!background) setBusy(false);
      }
    },
    [studio.token, dirty],
  );

  const deleteLocalDraft = React.useCallback(
    (key: string) => {
      safeLocalStorageRemove(key);
      if (draftKey === key) {
        setLocalSavedAt(null);
      }
      refreshDraftIndex();
      emitWorkspaceChanged();
    },
    [draftKey, refreshDraftIndex],
  );

  const openLocalDraft = React.useCallback(
    async (item: LocalDraftIndexItem) => {
      const d = readLocalDraft(item.key);
      if (!d) {
        refreshDraftIndex();
        return;
      }

      if (d.noteId) {
        await openNote(d.noteId, { restoreLocal: true });
        return;
      }

      if (dirty && !window.confirm("Discard unsaved changes?")) return;

      setDraftKey(item.key);
      setLocalSavedAt(d.savedAt);
      setPendingDelete(Boolean(d.pendingDelete));
      setNotice({ tone: "info", message: `Opened local draft (${fmtRelative(d.savedAt)} ago).` });

      const le = d.editor;
      setEditor({
        ...emptyEditor(),
        mode: "create",
        id: null,
        title: typeof le.title === "string" ? le.title : "",
        date: typeof le.date === "string" ? le.date : todayLocal(),
        slug: typeof le.slug === "string" ? le.slug : "",
        excerpt: typeof le.excerpt === "string" ? le.excerpt : "",
        categories: Array.isArray(le.categories) ? le.categories : [],
        tags: Array.isArray(le.tags) ? le.tags : [],
        nodes: Array.isArray(le.nodes) ? le.nodes : [],
        mindmaps: Array.isArray(le.mindmaps) ? le.mindmaps : [],
        cover: typeof le.cover === "string" ? le.cover : "",
        draft: Boolean(le.draft),
        content: typeof le.content === "string" ? le.content : "",
        baseMarkdown: "",
      });

      setDirty(false);
      setSlugTouched(Boolean(le.slug));
      retryRef.current = null;
      setTimeout(() => contentRef.current?.focus(), 0);
    },
    [dirty, openNote, refreshDraftIndex],
  );

  const saveLocal = React.useCallback(
    (opts?: { quiet?: boolean; pendingDelete?: boolean }) => {
      const key = (() => {
        if (editor.mode === "edit" && editor.id) return noteDraftKey(editor.id);
        return draftKey ?? newDraftKey();
      })();

      if (draftKey !== key) setDraftKey(key);

      const payload: LocalNoteDraftV1 = {
        v: 1,
        savedAt: Date.now(),
        noteId: editor.mode === "edit" ? editor.id : null,
        baseMarkdown: editor.baseMarkdown,
        pendingDelete: typeof opts?.pendingDelete === "boolean" ? opts.pendingDelete : pendingDelete,
        editor: {
          title: editor.title,
          date: editor.date,
          slug: editor.slug,
          excerpt: editor.excerpt,
          categories: editor.categories,
          tags: editor.tags,
          nodes: editor.nodes,
          mindmaps: editor.mindmaps,
          cover: editor.cover,
          draft: editor.draft,
          content: editor.content,
        },
      };

      const ok = safeLocalStorageSet(key, JSON.stringify(payload));
      if (!ok) {
        setNotice({ tone: "error", message: "Local save failed (storage unavailable or full)." });
        return;
      }

      setLocalSavedAt(payload.savedAt);
      setDirty(false);
      refreshDraftIndex();
      emitWorkspaceChanged();
      if (!opts?.quiet) setNotice({ tone: "success", message: `Saved locally (${fmtRelative(payload.savedAt)}).` });
    },
    [editor, draftKey, pendingDelete, refreshDraftIndex],
  );

  React.useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      saveLocal({ quiet: true });
    }, 650);
    return () => window.clearTimeout(t);
  }, [dirty, editor, saveLocal]);

  const setDeleteStaged = React.useCallback(
    (next: boolean) => {
      if (editor.mode !== "edit" || !editor.id) return;
      if (next) {
        const ok = window.confirm(`Stage delete for ${editor.id}? (Will commit on Publish)`);
        if (!ok) return;
        setLastUploadUrl(null);
      }
      setPendingDelete(next);
      saveLocal({ quiet: true, pendingDelete: next });
      setNotice({
        tone: "info",
        message: next ? "Delete staged. Publish (top bar) will move it into content/.trash." : "Delete unstaged.",
      });
    },
    [editor.mode, editor.id, saveLocal],
  );

  const uploadAsset = React.useCallback(
    async (file: File) => {
      if (!studio.token) return;
      retryRef.current = () => void uploadAsset(file);
      setBusy(true);
      setNotice(null);
      try {
        const uploadName = buildUploadName(file);
        const stagedUrl = `/uploads/${uploadName}`;
        const stagedPath = `public/uploads/${uploadName}`;
        const contentBase64 = await fileToBase64(file);
        const contentType = file.type || "application/octet-stream";

        const assetsDraftKey = `hyperblog.studio.draft.assets:v1:${PUBLISHER_BASE_URL}`;
        const existing = (() => {
          const raw = safeLocalStorageGet(assetsDraftKey);
          if (!raw) return null;
          try {
            return JSON.parse(raw) as { uploads?: any[]; deletes?: any[] };
          } catch {
            return null;
          }
        })();
        const prevUploads = Array.isArray(existing?.uploads) ? existing!.uploads : [];
        const prevDeletes = Array.isArray(existing?.deletes) ? (existing!.deletes as any[]).map(String) : [];
        const nextUploads = [
          ...prevUploads.filter((u) => String(u?.path ?? "") !== stagedPath),
          { name: uploadName, path: stagedPath, url: stagedUrl, bytes: file.size, contentType, contentBase64 },
        ];
        const nextDeletes = prevDeletes.filter((p) => p !== stagedPath);
        const payload = { v: 1, savedAt: Date.now(), uploads: nextUploads, deletes: nextDeletes };
        const ok = safeLocalStorageSet(assetsDraftKey, JSON.stringify(payload));
        if (!ok) {
          setNotice({ tone: "error", message: "Local save failed (storage unavailable or full)." });
          return;
        }
        emitWorkspaceChanged();

        setLastUploadUrl(stagedUrl);
        setNotice({ tone: "info", message: `Staged: ${stagedUrl} (will publish on Publish)` });
        setEditor((prev) => ({ ...prev, cover: prev.cover.trim() ? prev.cover : stagedUrl }));

        const isImage = (file.type || "").startsWith("image/");
        const insert = isImage ? `\n\n![](${stagedUrl})\n` : `\n\n[${uploadName}](${stagedUrl})\n`;
        const el = contentRef.current;
        if (el) insertIntoTextarea(el, insert);
        else setEditor((prev) => ({ ...prev, content: prev.content ? prev.content + insert : insert.trimStart() }));
        setDirty(true);
        retryRef.current = null;
      } catch (err: unknown) {
        setNotice({ tone: "error", message: `Upload failed: ${formatStudioError(err).message}` });
      } finally {
        setBusy(false);
      }
    },
    [studio.token],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cmd = e.ctrlKey || e.metaKey;
      if (!cmd) return;

      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        saveLocal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveLocal]);

  React.useEffect(() => {
    if (editor.mode !== "create") return;
    if (slugTouched) return;
    setEditor((prev) => ({ ...prev, slug: slugify(prev.title) }));
  }, [editor.mode, editor.title, slugTouched]);

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const title = (n.meta?.title ?? "").toLowerCase();
      return n.id.toLowerCase().includes(q) || title.includes(q);
    });
  }, [notes, filter]);

  const noteIdPreview = React.useMemo(() => {
    if (editor.mode === "edit" && editor.id) {
      return { ok: true as const, noteId: editor.id, error: null };
    }
    if (!editor.title.trim()) return { ok: false as const, noteId: null, error: "Missing title." };
    const resolved = buildNoteId({ title: editor.title, date: editor.date, slug: editor.slug });
    if (!resolved.ok) return { ok: false as const, noteId: null, error: resolved.error };
    return { ok: true as const, noteId: resolved.noteId, error: null };
  }, [editor.mode, editor.id, editor.title, editor.date, editor.slug]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">LIBRARY</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={newNote}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
              title="New note"
            >
              <Plus className="h-3.5 w-3.5 opacity-85" />
              New
            </button>
            <button
              type="button"
              onClick={() => void refreshList()}
              disabled={listBusy || listRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Refresh list"
            >
              <RefreshCw className="h-3.5 w-3.5 opacity-85" />
              Refresh
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by id or title…"
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
          />
          {listError ? <div className="mt-2 text-xs text-red-600">{listError}</div> : null}
        </div>

        <div className="min-h-0 overflow-auto px-2 pb-4">
          {localDrafts.length ? (
            <div className="pb-3">
              <div className="flex items-center justify-between px-3 pb-1">
                <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">
                  LOCAL DRAFTS <span className="opacity-70">· {localDrafts.length}</span>
                </div>
                <button
                  type="button"
                  className="text-[10px] text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]"
                  onClick={() => {
                    const ok = window.confirm(`Delete all local drafts (${localDrafts.length})?`);
                    if (!ok) return;
                    for (const d of localDrafts) safeLocalStorageRemove(d.key);
                    refreshDraftIndex();
                    if (draftKey && draftKey.startsWith(DRAFT_NEW_PREFIX)) setLocalSavedAt(null);
                    setNotice({ tone: "info", message: "Cleared local drafts." });
                  }}
                  title="Delete all local drafts"
                >
                  Clear
                </button>
              </div>
              <ul className="grid gap-1">
                {localDrafts.slice(0, 8).map((d) => {
                  const active = draftKey === d.key;
                  const sub = [
                    d.noteId ? d.noteId : "new",
                    d.draft ? "draft" : null,
                    `saved ${fmtRelative(d.savedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={d.key} className="group flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => void openLocalDraft(d)}
                        className={[
                          "flex-1 rounded-xl px-3 py-2 text-left transition",
                          active ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                        ].join(" ")}
                        title={d.noteId ? `Local draft for ${d.noteId}` : "Local draft (new note)"}
                      >
                        <div className="truncate text-sm font-medium tracking-tight">{d.title}</div>
                        <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">{sub}</div>
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-[hsl(var(--muted))] opacity-0 transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] group-hover:opacity-100"
                        title="Delete local draft"
                        onClick={() => {
                          const ok = window.confirm(`Delete local draft "${d.title}"?`);
                          if (!ok) return;
                          deleteLocalDraft(d.key);
                          setNotice({ tone: "info", message: "Deleted local draft." });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {localDrafts.length > 8 ? (
                <div className="mt-2 px-3 text-[10px] text-[hsl(var(--muted))]">+ {localDrafts.length - 8} more in storage</div>
              ) : null}
              <div className="mt-3 h-px bg-[hsl(var(--border))]" />
            </div>
          ) : null}
          <ul className="grid gap-1">
            {filtered.map((n) => {
              const active = editor.id === n.id;
              const title = n.meta?.title ?? n.id;
              const sub = [n.meta?.date, n.meta?.draft ? "draft" : null].filter(Boolean).join(" · ");
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openNote(n.id)}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left transition",
                      active ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                    ].join(" ")}
                  >
                    <div className="truncate text-sm font-medium tracking-tight">{title}</div>
                    <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">{sub || n.id}</div>
                  </button>
                </li>
              );
            })}
          </ul>

          {paging.nextAfter ? (
            <button
              type="button"
              onClick={() => void refreshList({ append: true })}
              disabled={listBusy || listRefreshing}
              className="mt-3 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
            >
              Load more
            </button>
          ) : null}
        </div>
      </aside>

      <section className="min-h-0 min-w-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold tracking-tight">{editor.mode === "create" ? "New note" : editor.id}</div>
              {pendingDelete ? (
                <span className="rounded-full bg-[color-mix(in_oklab,red_14%,transparent)] px-2 py-0.5 text-[10px] font-medium text-red-700">
                  delete staged
                </span>
              ) : null}
              {dirty ? (
                <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span>
              ) : localSavedAt ? (
                <span
                  className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium"
                  title={`Saved locally ${fmtRelative(localSavedAt)} ago`}
                >
                  saved local
                </span>
              ) : null}
            </div>
            {studio.me ? (
              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
              </div>
            ) : null}
            <div className="mt-0.5 text-[10px] text-[hsl(var(--muted))]">
              Local drafts auto-save in your browser. Publish (Changes tab) creates a single GitHub commit.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              <IconToggle active={viewMode === "edit"} onClick={() => setViewMode("edit")} title="Edit">
                <PencilLine className="h-4 w-4" />
              </IconToggle>
              <IconToggle active={viewMode === "split"} onClick={() => setViewMode("split")} title="Split">
                <SplitSquareHorizontal className="h-4 w-4" />
              </IconToggle>
              <IconToggle active={viewMode === "preview"} onClick={() => setViewMode("preview")} title="Preview">
                <Eye className="h-4 w-4" />
              </IconToggle>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]">
              <ImagePlus className="h-3.5 w-3.5 opacity-85" />
              Upload
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAsset(f);
                  e.currentTarget.value = "";
                }}
                disabled={!studio.token || busy || pendingDelete}
              />
            </label>

            {editor.mode === "edit" ? (
              <button
                type="button"
                onClick={() => setDeleteStaged(!pendingDelete)}
                disabled={!editor.id || busy}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              >
                {pendingDelete ? <X className="h-3.5 w-3.5 opacity-85" /> : <Trash2 className="h-3.5 w-3.5 opacity-85" />}
                {pendingDelete ? "Unstage delete" : "Stage delete"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => saveLocal()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Save locally (browser only; no GitHub commit) (⌘S / Ctrl+S)"
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              Save local
            </button>
          </div>
        </div>

        {notice ? (
          <div
            className={[
              "border-b border-[hsl(var(--border))] px-4 py-2 text-sm",
              notice.tone === "error"
                ? "bg-[color-mix(in_oklab,white_70%,transparent)] text-red-700"
                : "bg-[hsl(var(--card))] text-[hsl(var(--muted))]",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">{notice.message}</div>
              <div className="flex items-center gap-3">
                {retryRef.current && notice.tone === "error" ? (
                  <button
                    type="button"
                    onClick={() => retryRef.current?.()}
                    className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                  >
                    Retry <RefreshCw className="h-3.5 w-3.5 opacity-80" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {viewMode !== "preview" ? (
            <div className="min-h-0 border-b border-[hsl(var(--border))] lg:border-b-0 lg:border-r">
              <textarea
                ref={contentRef}
                value={editor.content}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, content: e.target.value }));
                }}
                className="h-full w-full resize-none bg-[hsl(var(--bg))] px-4 py-4 font-mono text-sm leading-6 outline-none placeholder:text-[hsl(var(--muted))]"
                placeholder="## Write…"
              />
            </div>
          ) : null}

          {viewMode !== "edit" ? (
            <div className="min-h-0 overflow-auto bg-[hsl(var(--card))] px-4 py-4">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {editor.content || ""}
                </ReactMarkdown>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="min-h-0 overflow-auto bg-[hsl(var(--card))]">
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">METADATA</div>
        </div>

        <div className="grid gap-4 px-4 py-4">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2">
            <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">NOTE ID</div>
            {noteIdPreview.ok ? (
              <div className="mt-1 truncate font-mono text-xs text-[hsl(var(--fg))]" title={noteIdPreview.noteId}>
                {noteIdPreview.noteId}
              </div>
            ) : (
              <div className="mt-1 text-xs text-red-700">{noteIdPreview.error}</div>
            )}
            {editor.mode === "create" && noteIdPreview.ok ? (
              <div className="mt-1 truncate text-[10px] text-[hsl(var(--muted))]" title={`content/notes/${noteIdPreview.noteId}.md`}>
                content/notes/{noteIdPreview.noteId}.md
              </div>
            ) : null}
            <div className="mt-2 text-[10px] text-[hsl(var(--muted))]">
              Local saves stay in your browser. Publish (Changes tab) creates a single GitHub commit.
            </div>
          </div>

          <Field label="Title">
            <input
              value={editor.title}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, title: e.target.value }));
              }}
              className={inputClass}
              placeholder="A sharp title"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input
                value={editor.date}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, date: e.target.value }));
                }}
                className={inputClass}
                placeholder="YYYY-MM-DD"
              />
            </Field>

            <Field label="Slug (create only)">
              <div className="flex items-center gap-2">
                <input
                  value={editor.slug}
                  onChange={(e) => {
                    setDirty(true);
                    setSlugTouched(true);
                    setEditor((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  className={inputClass}
                  placeholder="otel-context"
                  disabled={editor.mode !== "create"}
                />
                <button
                  type="button"
                  className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={editor.mode !== "create"}
                  onClick={() => {
                    setSlugTouched(true);
                    setEditor((prev) => ({ ...prev, slug: slugify(prev.title) }));
                    setDirty(true);
                  }}
                >
                  Auto
                </button>
              </div>
            </Field>
          </div>

          <Field label="Excerpt">
            <div className="grid gap-2">
              <textarea
                value={editor.excerpt}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, excerpt: e.target.value }));
                }}
                className={textareaClass}
                rows={3}
                placeholder="One-line intent, for cards / index."
              />
              <button
                type="button"
                className="w-fit rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                onClick={() => {
                  const auto = stripMarkdown(editor.content).slice(0, 220);
                  setEditor((prev) => ({ ...prev, excerpt: auto }));
                  setDirty(true);
                }}
              >
                Auto from body
              </button>
            </div>
          </Field>

          <Field label="Categories">
            <div className="grid gap-2">
              <ChipInput
                value={editor.categories}
                placeholder="Add category id and press Enter…"
                onChange={(next) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, categories: next }));
                }}
              />

              {allCategories.length ? (
                <div className="flex flex-wrap gap-2">
                  {allCategories.map((c) => {
                    const cid = String(c.id ?? "").toLowerCase();
                    const active = editor.categories.includes(cid);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setDirty(true);
                          setEditor((prev) => {
                            const set = new Set(prev.categories);
                            if (set.has(cid)) set.delete(cid);
                            else set.add(cid);
                            return { ...prev, categories: Array.from(set) };
                          });
                        }}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs transition",
                          active
                            ? "border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))]"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
                        ].join(" ")}
                        title={c.id}
                      >
                        {c.title}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-[hsl(var(--muted))]">No categories loaded.</div>
              )}

              <a href="/studio/config?file=categories" className="text-[10px] text-[hsl(var(--muted))] underline underline-offset-2 hover:text-[hsl(var(--fg))]">
                Manage categories in Config
              </a>
            </div>
          </Field>

          <Field label="Tags">
            <ChipInput
              value={editor.tags}
              placeholder="Add tag and press Enter…"
              onChange={(next) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, tags: next }));
              }}
            />
          </Field>

          <Field label="Roadmap nodes">
            <NodePicker
              nodes={nodesIndex}
              value={editor.nodes}
              onChange={(next) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, nodes: next }));
              }}
            />
          </Field>

          <Field label="Mindmaps">
            <IdPicker
              options={mindmapsIndex.map((m) => ({ id: m.id, label: m.title || m.id }))}
              value={editor.mindmaps}
              placeholder={mindmapsIndex.length ? "Search mindmaps…" : "No mindmaps yet."}
              onChange={(next) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, mindmaps: next }));
              }}
            />
          </Field>

          <Field label="Cover URL">
            <input
              value={editor.cover}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, cover: e.target.value }));
              }}
              className={inputClass}
              placeholder="/uploads/…"
            />
          </Field>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm">Draft (hide on public site)</div>
              <div className="mt-0.5 text-[10px] text-[hsl(var(--muted))]">Still commits to GitHub. Frontend filters draft notes by default.</div>
            </div>
            <input
              type="checkbox"
              checked={editor.draft}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, draft: e.target.checked }));
              }}
            />
          </label>

          {lastUploadUrl ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-xs text-[hsl(var(--muted))]">
              Last upload: <code className="break-all">{lastUploadUrl}</code>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium tracking-tight text-[hsl(var(--muted))]">{props.label}</div>
      {props.children}
    </div>
  );
}

function IconToggle(props: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "inline-flex items-center justify-center rounded-full border px-2.5 py-2 transition",
        props.active
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_45%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_10%,hsl(var(--card)))] text-[hsl(var(--fg))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
      ].join(" ")}
      title={props.title}
    >
      {props.children}
    </button>
  );
}

function ChipInput(props: { value: string[]; placeholder?: string; onChange: (next: string[]) => void }) {
  const [text, setText] = React.useState("");

  const add = React.useCallback(
    (raw: string) => {
      const parts = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.length) return;
      props.onChange(normalizeIdList([...props.value, ...parts]));
      setText("");
    },
    [props],
  );

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
      <div className="flex flex-wrap gap-2">
        {props.value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-2.5 py-1 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={() => props.onChange(props.value.filter((x) => x !== t))}
              className="text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            }
            if (e.key === "," && text.trim()) {
              e.preventDefault();
              add(text);
            }
            if (e.key === "Backspace" && !text && props.value.length) props.onChange(props.value.slice(0, -1));
          }}
          placeholder={props.placeholder}
          className="min-w-[8ch] flex-1 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-[hsl(var(--muted))]"
        />
      </div>
    </div>
  );
}

function IdPicker(props: {
  options: Array<{ id: string; label: string }>;
  value: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = React.useState("");
  const normalizedValue = React.useMemo(() => new Set(props.value.map((x) => x.toLowerCase())), [props.value]);
  const suggestions = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return props.options
      .filter((o) => !normalizedValue.has(o.id.toLowerCase()))
      .filter((o) => o.id.toLowerCase().includes(query) || o.label.toLowerCase().includes(query))
      .slice(0, 8);
  }, [props.options, q, normalizedValue]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {props.value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-2.5 py-1 text-xs"
          >
            {id}
            <button
              type="button"
              onClick={() => props.onChange(props.value.filter((x) => x !== id))}
              className="text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={props.placeholder} className={inputClass} />

      {suggestions.length ? (
        <div className="grid gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] p-1">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="rounded-lg px-2 py-1 text-left text-xs transition hover:bg-[hsl(var(--card))]"
              onClick={() => {
                props.onChange(normalizeIdList([...props.value, s.id]));
                setQ("");
              }}
            >
              <div className="truncate font-medium">{s.label}</div>
              <div className="truncate text-[10px] text-[hsl(var(--muted))]">{s.id}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NodePicker(props: { nodes: RoadmapNodeEntry[]; value: string[]; onChange: (next: string[]) => void }) {
  const [q, setQ] = React.useState("");
  const normalizedValue = React.useMemo(() => new Set(props.value.map((x) => x.toLowerCase())), [props.value]);
  const suggestions = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return props.nodes
      .map((n) => ({
        id: `${n.roadmapId}/${n.nodeId}`,
        label: n.title,
        subtitle: `${n.roadmapTitle} · ${n.crumbs.map((c) => c.title).join(" / ")}`,
      }))
      .filter((o) => !normalizedValue.has(o.id.toLowerCase()))
      .filter((o) => {
        const hay = `${o.id} ${o.label} ${o.subtitle}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 8);
  }, [props.nodes, q, normalizedValue]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {props.value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-2.5 py-1 text-xs"
          >
            {id}
            <button
              type="button"
              onClick={() => props.onChange(props.value.filter((x) => x !== id))}
              className="text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Search nodes…" />

      {suggestions.length ? (
        <div className="grid gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] p-1">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="rounded-lg px-2 py-1 text-left text-xs transition hover:bg-[hsl(var(--card))]"
              onClick={() => {
                props.onChange(normalizeIdList([...props.value, s.id]));
                setQ("");
              }}
            >
              <div className="truncate font-medium">{s.label}</div>
              <div className="truncate text-[10px] text-[hsl(var(--muted))]">{s.subtitle}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60";

const textareaClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60";
