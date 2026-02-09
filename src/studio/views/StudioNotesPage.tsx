import {
  Check,
  ExternalLink,
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
import remarkGfm from "remark-gfm";
import YAML from "yaml";
import { publisherFetchJson, publisherUploadFile, type PublisherError } from "../../ui/publisher/client";
import type { Category, MindmapListItem, RoadmapNodeEntry } from "../../ui/types";
import { useStudioState } from "../state/StudioState";

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

type CommitResponse = {
  commit: { sha: string; url: string; headSha?: string };
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

type StagedUpload = {
  path: string; // "public/uploads/..."
  url: string; // "/uploads/..."
  bytes: number;
  contentType: string;
  contentBase64: string;
  previewUrl: string | null;
};

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

function readLocalFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeLocalFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
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

function formatStudioError(err: unknown): { message: string; code?: string } {
  const pub = (err as any)?.publisher as PublisherError | undefined;
  if (pub && typeof pub.code === "string" && typeof pub.message === "string") return { message: `${pub.code}: ${pub.message}`, code: pub.code };
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
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
  const [atomicCommit, setAtomicCommit] = React.useState<boolean>(() => readLocalFlag("hyperblog.studio.atomicCommit", true));

  const [allCategories, setAllCategories] = React.useState<Category[]>([]);
  const [nodesIndex, setNodesIndex] = React.useState<RoadmapNodeEntry[]>([]);
  const [mindmapsIndex, setMindmapsIndex] = React.useState<MindmapListItem[]>([]);

  const [stagedUploads, setStagedUploads] = React.useState<StagedUpload[]>([]);

  const [notes, setNotes] = React.useState<NotesListResponse["notes"]>([]);
  const [paging, setPaging] = React.useState<NotesListResponse["paging"]>({ after: null, nextAfter: null });
  const [filter, setFilter] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [editor, setEditor] = React.useState<EditorState>(() => emptyEditor());
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);
  const [lastUploadUrl, setLastUploadUrl] = React.useState<string | null>(null);
  const [slugTouched, setSlugTouched] = React.useState(false);

  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);
  const retryRef = React.useRef<(() => void) | null>(null);

  const refreshList = React.useCallback(
    async (opts?: { append?: boolean }) => {
      if (!studio.token) return;
      setListBusy(true);
      setListError(null);
      try {
        const url = new URL("/api/admin/notes", "http://local");
        url.searchParams.set("include", "meta");
        url.searchParams.set("limit", "50");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const path = url.pathname + url.search;
        const res = await publisherFetchJson<NotesListResponse>({ path, token: studio.token });
        setNotes((prev) => (opts?.append ? [...prev, ...res.notes] : res.notes));
        setPaging(res.paging);
      } catch (err: unknown) {
        setListError(formatStudioError(err).message);
      } finally {
        setListBusy(false);
      }
    },
    [studio.token, paging.nextAfter],
  );

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLocalJson<Category[]>("/api/categories.json").catch(() => [] as Category[]),
      fetchLocalJson<RoadmapNodeEntry[]>("/api/nodes.json").catch(() => [] as RoadmapNodeEntry[]),
      fetchLocalJson<MindmapListItem[]>("/api/mindmaps.json").catch(() => [] as MindmapListItem[]),
    ]).then(([cats, nodes, mindmaps]) => {
      if (cancelled) return;
      setAllCategories(cats);
      setNodesIndex(nodes);
      setMindmapsIndex(mindmaps);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.token]);

  const clearStagedUploads = React.useCallback(() => {
    setStagedUploads((prev) => {
      for (const s of prev) if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return [];
    });
  }, []);

  const newNote = React.useCallback(() => {
    clearStagedUploads();
    setEditor(emptyEditor());
    setDirty(false);
    setNotice(null);
    setCommitUrl(null);
    setLastUploadUrl(null);
    setSlugTouched(false);
    retryRef.current = null;
    setTimeout(() => contentRef.current?.focus(), 0);
  }, [clearStagedUploads]);

  const openNote = React.useCallback(
    async (id: string) => {
      if (!studio.token) return;
      retryRef.current = () => void openNote(id);
      clearStagedUploads();
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherFetchJson<NoteGetResponse>({
          path: `/api/admin/notes/${encodeURIComponent(id)}`,
          token: studio.token,
        });
        const input = res.note.input;
        setEditor({
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
        });
        setDirty(false);
        setSlugTouched(true);
        retryRef.current = null;
      } catch (err: unknown) {
        setNotice({ tone: "error", message: `Open failed: ${formatStudioError(err).message}` });
      } finally {
        setBusy(false);
      }
    },
    [studio.token, clearStagedUploads],
  );

  const save = React.useCallback(async () => {
    if (!studio.token) return;
    if (!editor.title.trim()) {
      setNotice({ tone: "error", message: "Missing title." });
      return;
    }
    if (!editor.content.trim()) {
      setNotice({ tone: "error", message: "Missing content." });
      return;
    }

    retryRef.current = () => void save();
    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      if (!atomicCommit) {
        if (editor.mode === "create") {
          const res = await publisherFetchJson<{ note: { id: string; path: string }; commit: { sha: string; url: string } }>({
            path: "/api/admin/notes",
            method: "POST",
            token: studio.token,
            body: {
              title: editor.title.trim(),
              slug: editor.slug.trim() || undefined,
              date: editor.date.trim() || undefined,
              excerpt: editor.excerpt.trim() || undefined,
              categories: editor.categories,
              tags: editor.tags,
              nodes: editor.nodes,
              mindmaps: editor.mindmaps,
              cover: editor.cover.trim() || undefined,
              draft: editor.draft,
              content: editor.content,
            } satisfies NoteInput,
          });
          setEditor((prev) => ({ ...prev, mode: "edit", id: res.note.id, baseMarkdown: "" }));
          setNotice({ tone: "success", message: editor.draft ? `Draft saved: ${res.note.id}` : `Published: ${res.note.id}` });
          setCommitUrl(res.commit.url);
          setDirty(false);
          retryRef.current = null;
          void refreshList();
          return;
        }

        if (!editor.id) {
          setNotice({ tone: "error", message: "Missing note id." });
          return;
        }

        const res = await publisherFetchJson<{ note: { id: string; path: string }; commit: { sha: string; url: string } }>({
          path: `/api/admin/notes/${encodeURIComponent(editor.id)}`,
          method: "PATCH",
          token: studio.token,
          body: {
            title: editor.title.trim(),
            date: editor.date.trim() || undefined,
            excerpt: editor.excerpt.trim() || undefined,
            categories: editor.categories,
            tags: editor.tags,
            nodes: editor.nodes,
            mindmaps: editor.mindmaps,
            cover: editor.cover.trim() || undefined,
            draft: editor.draft,
            content: editor.content,
          } satisfies Partial<NoteInput>,
        });
        setNotice({ tone: "success", message: editor.draft ? `Draft saved: ${res.note.id}` : `Saved: ${res.note.id}` });
        setCommitUrl(res.commit.url);
        setDirty(false);
        retryRef.current = null;
        void refreshList();
        return;
      }

      const resolved =
        editor.mode === "edit" && editor.id
          ? { ok: true as const, noteId: editor.id, slug: "" }
          : buildNoteId({ title: editor.title, date: editor.date, slug: editor.slug });

      if (!resolved.ok) {
        setNotice({ tone: "error", message: resolved.error });
        return;
      }

      if (editor.mode === "create" && !editor.slug.trim() && resolved.slug) {
        setEditor((prev) => ({ ...prev, slug: resolved.slug }));
      }

      const noteId = resolved.noteId;
      const notePath = `content/notes/${noteId}.md`;
      const updatedYmd = todayLocal();
      const md = renderNoteMarkdownFromEditor({ editor, updatedYmd });

      const files: Array<
        | { path: string; encoding: "utf8"; content: string }
        | { path: string; encoding: "base64"; contentBase64: string }
      > = [
        { path: notePath, encoding: "utf8", content: md },
        ...stagedUploads.map((u) => ({ path: u.path, encoding: "base64" as const, contentBase64: u.contentBase64 })),
      ];

      const commitMessage = editor.mode === "create" ? `publish: ${noteId}` : `update: ${noteId}`;
      const res = await publisherFetchJson<CommitResponse>({
        path: "/api/admin/commit",
        method: "POST",
        token: studio.token,
        body: {
          message: commitMessage,
          expectedHeadSha: studio.me?.repo.headSha ?? undefined,
          files,
        },
      });

      setNotice({
        tone: "success",
        message: editor.draft ? `Draft saved: ${noteId}` : editor.mode === "create" ? `Published: ${noteId}` : `Saved: ${noteId}`,
      });
      setCommitUrl(res.commit.url);
      setEditor((prev) => ({ ...prev, mode: "edit", id: noteId, baseMarkdown: md }));
      setDirty(false);
      setLastUploadUrl(stagedUploads.at(-1)?.url ?? null);
      clearStagedUploads();
      retryRef.current = null;
      void studio.refreshMe();
      void refreshList();
    } catch (err: unknown) {
      const e = formatStudioError(err);
      setNotice(
        e.code === "HEAD_MOVED"
          ? { tone: "error", message: "Conflict: main moved. Refresh and retry." }
          : { tone: "error", message: `Save failed: ${e.message}` },
      );
    } finally {
      setBusy(false);
    }
  }, [
    studio.token,
    studio.me?.repo.headSha,
    studio.refreshMe,
    refreshList,
    editor,
    atomicCommit,
    stagedUploads,
    clearStagedUploads,
  ]);

  const del = React.useCallback(async () => {
    if (!studio.token || !editor.id) return;
    const ok = window.confirm(`Trash note ${editor.id}?`);
    if (!ok) return;
    retryRef.current = () => void del();
    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{ ok: true; commit: { sha: string; url: string } }>({
        path: `/api/admin/notes/${encodeURIComponent(editor.id)}`,
        method: "DELETE",
        token: studio.token,
      });
      setNotice({ tone: "success", message: "Trashed." });
      setCommitUrl(res.commit.url);
      setDirty(false);
      retryRef.current = null;
      newNote();
      void refreshList();
    } catch (err: unknown) {
      setNotice({ tone: "error", message: `Delete failed: ${formatStudioError(err).message}` });
    } finally {
      setBusy(false);
    }
  }, [studio.token, editor.id, newNote, refreshList]);

  const uploadAsset = React.useCallback(
    async (file: File) => {
      if (!studio.token) return;
      retryRef.current = () => void uploadAsset(file);
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        if (!atomicCommit) {
          const res = await publisherUploadFile({ token: studio.token, file });
          setCommitUrl(res.commit.url);
          setLastUploadUrl(res.asset.url);
          setNotice({ tone: "success", message: `Uploaded: ${res.asset.url}` });
          setEditor((prev) => ({ ...prev, cover: prev.cover.trim() ? prev.cover : res.asset.url }));

          const insert = `\n\n![](${res.asset.url})\n`;
          const el = contentRef.current;
          if (el) insertIntoTextarea(el, insert);
          else setEditor((prev) => ({ ...prev, content: prev.content ? prev.content + insert : insert.trimStart() }));
          setDirty(true);
          retryRef.current = null;
          return;
        }

        const uploadName = buildUploadName(file);
        const stagedUrl = `/uploads/${uploadName}`;
        const stagedPath = `public/uploads/${uploadName}`;
        const contentBase64 = await fileToBase64(file);
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;

        setStagedUploads((prev) => [
          ...prev,
          {
            path: stagedPath,
            url: stagedUrl,
            bytes: file.size,
            contentType: file.type || "application/octet-stream",
            contentBase64,
            previewUrl,
          },
        ]);

        setLastUploadUrl(stagedUrl);
        setNotice({ tone: "info", message: `Staged: ${stagedUrl} (will commit with note)` });
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
    [studio.token, atomicCommit],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      void save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

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
              disabled={listBusy}
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
              disabled={listBusy}
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
              {dirty ? <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span> : null}
            </div>
            {studio.me ? (
              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
              </div>
            ) : null}
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
                disabled={!studio.token || busy}
              />
            </label>

            {editor.mode === "edit" ? (
              <button
                type="button"
                onClick={() => void del()}
                disabled={!editor.id || busy}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5 opacity-85" />
                Trash
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void save()}
              disabled={!studio.token || busy}
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition",
                !studio.token || busy
                  ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                  : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
              ].join(" ")}
              title="Save (⌘S / Ctrl+S)"
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              {editor.draft ? "Save draft" : editor.mode === "create" ? "Publish" : "Save"}
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
                {commitUrl ? (
                  <a
                    href={commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                  >
                    View commit <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                  </a>
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{editor.content || ""}</ReactMarkdown>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-auto bg-[hsl(var(--card))] lg:block">
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">METADATA</div>
        </div>

        <div className="grid gap-4 px-4 py-4">
          <label className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm">
            <span className="text-sm">Atomic commit (stage uploads)</span>
            <input
              type="checkbox"
              checked={atomicCommit}
              onChange={(e) => {
                const next = e.target.checked;
                setAtomicCommit(next);
                writeLocalFlag("hyperblog.studio.atomicCommit", next);
                if (!next) clearStagedUploads();
              }}
            />
          </label>

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
            {allCategories.length ? (
              <div className="flex flex-wrap gap-2">
                {allCategories.map((c) => {
                  const active = editor.categories.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setDirty(true);
                        setEditor((prev) => {
                          const set = new Set(prev.categories);
                          if (set.has(c.id)) set.delete(c.id);
                          else set.add(c.id);
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
              <div className="text-xs text-[hsl(var(--muted))]">No categories loaded.</div>
            )}
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

          <label className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm">
            <span className="text-sm">Draft</span>
            <input
              type="checkbox"
              checked={editor.draft}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, draft: e.target.checked }));
              }}
            />
          </label>

          {atomicCommit && stagedUploads.length ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium tracking-tight text-[hsl(var(--muted))]">Staged uploads · {stagedUploads.length}</div>
                <button
                  type="button"
                  className="text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                  onClick={() => {
                    clearStagedUploads();
                    setNotice({ tone: "info", message: "Cleared staged uploads." });
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                {stagedUploads.map((u) => (
                  <div
                    key={u.path}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{u.url}</div>
                      <div className="mt-0.5 truncate text-[10px] text-[hsl(var(--muted))]">
                        {Math.max(1, Math.round(u.bytes / 1024))} KB · {u.contentType}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDirty(true);
                        setStagedUploads((prev) => {
                          const next = prev.filter((x) => x.path !== u.path);
                          if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
                          return next;
                        });
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card2))] p-1.5 text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                      title="Remove staged upload"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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
    <label className="grid gap-2">
      <span className="text-xs font-medium tracking-tight text-[hsl(var(--muted))]">{props.label}</span>
      {props.children}
    </label>
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

