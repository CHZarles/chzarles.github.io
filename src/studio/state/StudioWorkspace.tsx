import React from "react";
import { publisherFetchJson, type PublisherError } from "../../ui/publisher/client";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { clearStudioCaches } from "../util/cache";
import { formatStudioError } from "../util/errors";
import { useStudioState } from "./StudioState";

export type WorkspaceStats = {
  total: number;
  notes: number;
  config: number;
  assetsUploads: number;
  assetsDeletes: number;
};

export type NoteDraftEditor = {
  title: string;
  date: string;
  slug: string;
  categories: string[];
  tags: string[];
  cover: string;
  draft: boolean;
  content: string;
};

export type WorkspaceChange =
  | {
      kind: "note";
      key: string;
      savedAt: number;
      noteId: string | null;
      pendingDelete: boolean;
      baseMarkdown: string | null;
      editor: NoteDraftEditor;
    }
  | {
      kind: "config";
      key: string;
      savedAt: number;
      fileKey: "profile" | "categories";
      raw: string;
    }
  | {
      kind: "assets";
      key: string;
      savedAt: number;
      uploads: Array<{ path: string; url: string; bytes: number; contentType: string; contentBase64: string }>;
      deletes: string[];
    };

export type WorkspacePublishResult = { commitUrl: string; headSha?: string };

export type WorkspacePublishError = { code?: string; message: string; details?: Record<string, unknown> };

type StudioWorkspaceState = {
  changes: WorkspaceChange[];
  stats: WorkspaceStats;
  publishing: boolean;
  lastCommitUrl: string | null;
  publishError: WorkspacePublishError | null;
  refresh: () => void;
  publishAll: (opts?: { message?: string; confirm?: boolean; expectedHeadSha?: string }) => Promise<WorkspacePublishResult | null>;
  commitMessage: string;
  setCommitMessage: (next: string) => void;
  clearCommitMessage: () => void;
};

const StudioWorkspaceContext = React.createContext<StudioWorkspaceState | null>(null);

const WORKSPACE_EVENT = "hyperblog.studio.workspace.changed";
const COMMIT_MESSAGE_KEY_PREFIX = "hyperblog.studio.draft.commitmsg:v1:";

export function emitWorkspaceChanged() {
  try {
    window.dispatchEvent(new Event(WORKSPACE_EVENT));
  } catch {
    // ignore
  }
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

type NoteDraftV1 = {
  v: 1;
  savedAt: number;
  noteId: string | null;
  baseMarkdown?: string;
  pendingDelete?: boolean;
  editor: NoteDraftEditor;
};

type ConfigDraftV1 = { v: 1; savedAt: number; raw: string };

type AssetsDraftV1 = {
  v: 1;
  savedAt: number;
  uploads: Array<{ path: string; url: string; bytes: number; contentType: string; contentBase64: string }>;
  deletes: string[];
};

const DRAFT_NOTE_PREFIX = "hyperblog.studio.draft.note:";
const DRAFT_NEW_PREFIX = "hyperblog.studio.draft.new:";
const CONFIG_DRAFT_PREFIX = "hyperblog.studio.draft.config:v1:";
const ASSETS_DRAFT_PREFIX = "hyperblog.studio.draft.assets:v1:";

function parseJsonSafe(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readNoteDraft(key: string): NoteDraftV1 | null {
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  const v = parseJsonSafe(raw) as NoteDraftV1 | null;
  if (!v || typeof v !== "object") return null;
    if (v.v !== 1) return null;
    if (typeof v.savedAt !== "number") return null;
    if (v.noteId !== null && typeof v.noteId !== "string") return null;
    if (typeof (v as any).baseMarkdown !== "undefined" && typeof (v as any).baseMarkdown !== "string") return null;
    if (typeof (v as any).editor !== "object" || !(v as any).editor) return null;
  const e = (v as any).editor as NoteDraftEditor;
  if (typeof e.title !== "string") return null;
  if (typeof e.content !== "string") return null;
  return v;
}

function readConfigDraft(key: string): ConfigDraftV1 | null {
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  const v = parseJsonSafe(raw) as ConfigDraftV1 | null;
  if (!v || typeof v !== "object") return null;
  if (v.v !== 1) return null;
  if (typeof v.savedAt !== "number") return null;
  if (typeof v.raw !== "string") return null;
  return v;
}

function readAssetsDraft(key: string): AssetsDraftV1 | null {
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  const v = parseJsonSafe(raw) as AssetsDraftV1 | null;
  if (!v || typeof v !== "object") return null;
  if (v.v !== 1) return null;
  if (typeof v.savedAt !== "number") return null;
  if (!Array.isArray(v.uploads)) return null;
  if (!Array.isArray(v.deletes)) return null;
  return v;
}

function listWorkspaceChanges(baseUrl: string): WorkspaceChange[] {
  const keys = safeLocalStorageKeys();
  const out: WorkspaceChange[] = [];

  for (const key of keys) {
    if (key.startsWith(DRAFT_NOTE_PREFIX) || key.startsWith(DRAFT_NEW_PREFIX)) {
      const d = readNoteDraft(key);
      if (!d) continue;
      out.push({
        kind: "note",
        key,
        savedAt: d.savedAt,
        noteId: d.noteId,
        pendingDelete: Boolean(d.pendingDelete),
        baseMarkdown: typeof d.baseMarkdown === "string" ? d.baseMarkdown : null,
        editor: d.editor,
      });
      continue;
    }

    if (key.startsWith(CONFIG_DRAFT_PREFIX)) {
      if (!key.includes(baseUrl)) continue;
      const fileKey = key.split(":").at(-1) as "profile" | "categories" | undefined;
      if (fileKey !== "profile" && fileKey !== "categories") continue;
      const d = readConfigDraft(key);
      if (!d) continue;
      out.push({ kind: "config", key, savedAt: d.savedAt, fileKey, raw: d.raw });
      continue;
    }

    if (key === `${ASSETS_DRAFT_PREFIX}${baseUrl}`) {
      const d = readAssetsDraft(key);
      if (!d) continue;
      out.push({ kind: "assets", key, savedAt: d.savedAt, uploads: d.uploads, deletes: d.deletes });
      continue;
    }
  }

  out.sort((a, b) => b.savedAt - a.savedAt);
  return out;
}

function calcStats(changes: WorkspaceChange[]): WorkspaceStats {
  let notes = 0;
  let config = 0;
  let assetsUploads = 0;
  let assetsDeletes = 0;
  for (const c of changes) {
    if (c.kind === "note") notes += 1;
    else if (c.kind === "config") config += 1;
    else if (c.kind === "assets") {
      assetsUploads += c.uploads.length;
      assetsDeletes += c.deletes.length;
    }
  }
  return {
    total: changes.length,
    notes,
    config,
    assetsUploads,
    assetsDeletes,
  };
}

function commitMessageKey(baseUrl: string): string {
  return `${COMMIT_MESSAGE_KEY_PREFIX}${baseUrl}`;
}

function readCommitMessage(baseUrl: string): string {
  return safeLocalStorageGet(commitMessageKey(baseUrl)) ?? "";
}

function writeCommitMessage(baseUrl: string, next: string): void {
  safeLocalStorageSet(commitMessageKey(baseUrl), next);
}

function clearCommitMessage(baseUrl: string): void {
  safeLocalStorageRemove(commitMessageKey(baseUrl));
}

function defaultCommitMessage(stats: WorkspaceStats): string {
  const pieces: string[] = [];
  if (stats.notes) pieces.push(`notes: ${stats.notes}`);
  if (stats.config) pieces.push(`config: ${stats.config}`);
  if (stats.assetsUploads || stats.assetsDeletes) pieces.push(`assets: +${stats.assetsUploads} -${stats.assetsDeletes}`);
  const subject = pieces.length ? `studio: publish (${pieces.join(", ")})` : "studio: publish";
  return subject;
}

export function StudioWorkspaceProvider(props: { children: React.ReactNode }) {
  const studio = useStudioState();
  const [nonce, setNonce] = React.useState(0);
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<WorkspacePublishError | null>(null);
  const [lastCommitUrl, setLastCommitUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onEvent = () => setNonce((n) => n + 1);
    const onStorage = (e: StorageEvent) => {
      const k = e.key ?? "";
      if (k.startsWith("hyperblog.studio.draft.") || k.startsWith("hyperblog.studio.cache")) onEvent();
    };
    window.addEventListener(WORKSPACE_EVENT, onEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WORKSPACE_EVENT, onEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const changes = React.useMemo(() => listWorkspaceChanges(PUBLISHER_BASE_URL), [nonce]);
  const stats = React.useMemo(() => calcStats(changes), [changes]);

  const [commitMessage, setCommitMessageState] = React.useState(() => readCommitMessage(PUBLISHER_BASE_URL));
  React.useEffect(() => {
    setCommitMessageState(readCommitMessage(PUBLISHER_BASE_URL));
  }, [nonce]);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  const setCommitMessage = React.useCallback((next: string) => {
    setCommitMessageState(next);
    writeCommitMessage(PUBLISHER_BASE_URL, next);
    emitWorkspaceChanged();
  }, []);

  const clearCommitMessageFn = React.useCallback(() => {
    clearCommitMessage(PUBLISHER_BASE_URL);
    setCommitMessageState("");
    emitWorkspaceChanged();
  }, []);

  const publishAll = React.useCallback(
    async (opts?: { message?: string; confirm?: boolean; expectedHeadSha?: string }) => {
      if (!studio.token) return null;

      const currentChanges = listWorkspaceChanges(PUBLISHER_BASE_URL);
      const currentStats = calcStats(currentChanges);
      if (!currentStats.total) return null;

      const message = String(opts?.message ?? commitMessage).trim() || defaultCommitMessage(currentStats);

      if (opts?.confirm !== false) {
        const ok = window.confirm(`Publish ${currentStats.total} change(s) to GitHub?`);
        if (!ok) return null;
      }

      setPublishing(true);
      setPublishError(null);
      setLastCommitUrl(null);
      try {
        const YAML = (await import("yaml")).default;

        type CommitFile =
          | { path: string; encoding: "utf8"; content: string }
          | { path: string; encoding: "base64"; contentBase64: string };

        const filesByPath = new Map<string, CommitFile>();
        const deletes = new Set<string>();
        const clearKeys: string[] = [];
        const errors: string[] = [];

        const addFile = (f: CommitFile) => {
          const path = String((f as any).path ?? "").trim();
          if (!path) return;
          if (filesByPath.has(path)) {
            errors.push(`Duplicate write: ${path}`);
            return;
          }
          filesByPath.set(path, f);
        };
        const addDelete = (path: string) => {
          const p = String(path ?? "").trim();
          if (!p) return;
          deletes.add(p);
        };

        const todayLocalYmd = () => {
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };

        const isValidYmd = (input: string) => /^\d{4}-\d{2}-\d{2}$/.test(input);

        const slugify = (input: string) =>
          input
            .trim()
            .toLowerCase()
            .replace(/['"]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        const shortHash = (input: string) => {
          let h = 2166136261;
          for (let i = 0; i < input.length; i++) {
            h ^= input.charCodeAt(i);
            h = Math.imul(h, 16777619);
          }
          return (h >>> 0).toString(16).slice(0, 8);
        };

        const buildNoteId = (args: { title: string; date: string; slug: string }) => {
          const date = args.date.trim();
          if (!isValidYmd(date)) return { ok: false as const, error: "Invalid date (YYYY-MM-DD)." };
          const slugBase = args.slug.trim() || slugify(args.title);
          const slug = slugBase || `note-${shortHash(`${args.title}:${Date.now()}`)}`;
          if (!/^[a-z0-9-]{3,80}$/.test(slug)) return { ok: false as const, error: "Invalid slug (a-z0-9-)." };
          return { ok: true as const, noteId: `${date}-${slug}`, slug };
        };

        const normalizeIdList = (list: string[]) => {
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
        };

        const parseFrontmatter = (md: string) => {
          const raw = md ?? "";
          if (!raw.startsWith("---\n")) return { frontmatter: {} as Record<string, unknown>, body: raw };
          const end = raw.indexOf("\n---", 4);
          if (end === -1) return { frontmatter: {} as Record<string, unknown>, body: raw };
          const yaml = raw.slice(4, end + 1);
          const body = raw.slice(end + 5).replace(/^\s*\n/, "");
          try {
            const fm = (YAML.parse(yaml) ?? {}) as Record<string, unknown>;
            return { frontmatter: fm && typeof fm === "object" ? fm : {}, body };
          } catch {
            return { frontmatter: {}, body };
          }
        };

        const renderNoteMarkdown = (args: {
          baseMarkdown: string | null;
          editor: NoteDraftEditor;
          updatedYmd: string;
        }): string => {
          const title = args.editor.title.trim();
          const body = args.editor.content.trim();
          if (!title) throw new Error("Missing title.");
          if (!body) throw new Error("Missing content.");
          const date = args.editor.date.trim();
          if (!isValidYmd(date)) throw new Error("Invalid date (YYYY-MM-DD).");

          const base = args.baseMarkdown ? parseFrontmatter(args.baseMarkdown) : { frontmatter: {}, body: "" };
          const fm: Record<string, unknown> = { ...(base.frontmatter ?? {}) };

          fm.title = title;
          fm.date = date;

          if (args.updatedYmd !== date) fm.updated = args.updatedYmd;
          else delete fm.updated;

          delete fm.excerpt;

          const categories = normalizeIdList(args.editor.categories);
          if (categories.length) fm.categories = categories;
          else delete fm.categories;

          const tags = normalizeIdList(args.editor.tags);
          if (tags.length) fm.tags = tags;
          else delete fm.tags;

          const cover = args.editor.cover.trim();
          if (cover) fm.cover = cover;
          else delete fm.cover;

          if (args.editor.draft) fm.draft = true;
          else delete fm.draft;

          const yaml = YAML.stringify(fm).trimEnd();
          return `---\n${yaml}\n---\n\n${body}\n`;
        };

        for (const c of currentChanges) {
          clearKeys.push(c.key);

          if (c.kind === "assets") {
            const uploadPaths = new Set(c.uploads.map((u) => String(u.path ?? "").trim()).filter(Boolean));
            for (const u of c.uploads) {
              const path = String(u.path ?? "").trim();
              const contentBase64 = String(u.contentBase64 ?? "").trim();
              if (!path || !contentBase64) {
                errors.push(`assets: invalid upload entry (${path || "missing path"})`);
                continue;
              }
              addFile({ path, encoding: "base64", contentBase64 });
            }
            for (const p of c.deletes) {
              const path = String(p ?? "").trim();
              if (!path) continue;
              if (uploadPaths.has(path)) continue;
              addDelete(path);
            }
            continue;
          }

          if (c.kind === "config") {
            const path = c.fileKey === "profile" ? "content/profile.json" : "content/categories.yml";

            if (c.fileKey === "categories") {
              const trimmed = c.raw.trim();
              if (trimmed) {
                let parsed: unknown;
                try {
                  parsed = YAML.parse(trimmed);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  errors.push(`config: categories.yml YAML error: ${msg}`);
                  continue;
                }
                if (!Array.isArray(parsed)) {
                  errors.push("config: categories.yml must be a YAML list.");
                  continue;
                }
              }
              addFile({ path, encoding: "utf8", content: c.raw.trimEnd() + "\n" });
              continue;
            }

            let parsed: unknown;
            try {
              parsed = JSON.parse(c.raw);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`config: ${c.fileKey} JSON error: ${msg}`);
              continue;
            }
            if (c.fileKey === "profile" && (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) {
              errors.push("config: profile must be a JSON object.");
              continue;
            }
            addFile({ path, encoding: "utf8", content: JSON.stringify(parsed, null, 2) + "\n" });
            continue;
          }

          if (c.kind === "note") {
            if (c.pendingDelete) {
              if (!c.noteId) {
                errors.push("note: missing id for staged delete.");
                continue;
              }
              const noteId = c.noteId;
              const notePath = `content/notes/${noteId}.md`;
              const trashPath = `content/.trash/notes/${noteId}.md`;
              const content =
                c.baseMarkdown && c.baseMarkdown.trim()
                  ? c.baseMarkdown.trimEnd() + "\n"
                  : `---\nid: ${noteId}\ntitle: ${c.editor.title.trim() || noteId}\n---\n\n(trashed)\n`;
              addFile({ path: trashPath, encoding: "utf8", content });
              addDelete(notePath);
              continue;
            }

            const resolved = c.noteId
              ? { ok: true as const, noteId: c.noteId, slug: "" }
              : buildNoteId({ title: c.editor.title, date: c.editor.date, slug: c.editor.slug });
            if (!resolved.ok) {
              errors.push(`note: ${resolved.error}`);
              continue;
            }

            const noteId = resolved.noteId;
            const notePath = `content/notes/${noteId}.md`;
            let md: string;
            try {
              md = renderNoteMarkdown({ baseMarkdown: c.baseMarkdown, editor: c.editor, updatedYmd: todayLocalYmd() });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`note: ${noteId}: ${msg}`);
              continue;
            }
            addFile({ path: notePath, encoding: "utf8", content: md });
            continue;
          }
        }

        for (const p of filesByPath.keys()) deletes.delete(p);

        if (errors.length) {
          setPublishError({ code: "VALIDATION_FAILED", message: errors.slice(0, 6).join("\n") });
          return null;
        }

        const files = Array.from(filesByPath.values());
        const deletesArr = Array.from(deletes);
        if (!files.length && !deletesArr.length) return null;

        const expectedHeadSha = String(opts?.expectedHeadSha ?? studio.me?.repo.headSha ?? "").trim() || undefined;

        const res = await publisherFetchJson<{ commit: { url: string; headSha?: string } }>({
          path: "/api/admin/commit",
          method: "POST",
          token: studio.token,
          body: {
            message,
            expectedHeadSha,
            files,
            deletes: deletesArr,
          },
        });

        for (const k of clearKeys) safeLocalStorageRemove(k);
        emitWorkspaceChanged();

        setLastCommitUrl(res.commit.url);
        studio.forceSync();
        return { commitUrl: res.commit.url, headSha: (res.commit as any).headSha };
      } catch (err: unknown) {
        const pub = (err as any)?.publisher as PublisherError | undefined;
        const e = formatStudioError(err);
        setPublishError({
          code: pub && typeof pub.code === "string" ? pub.code : undefined,
          message: e.message,
          details: pub && pub.details && typeof pub.details === "object" ? pub.details : undefined,
        });
        return null;
      } finally {
        setPublishing(false);
      }
    },
    [studio.token, studio.me?.repo.headSha, commitMessage],
  );

  const value = React.useMemo<StudioWorkspaceState>(
    () => ({
      changes,
      stats,
      publishing,
      lastCommitUrl,
      publishError,
      refresh,
      publishAll,
      commitMessage: commitMessage.trim() || defaultCommitMessage(stats),
      setCommitMessage,
      clearCommitMessage: clearCommitMessageFn,
    }),
    [
      changes,
      stats,
      publishing,
      lastCommitUrl,
      publishError,
      refresh,
      publishAll,
      commitMessage,
      setCommitMessage,
      clearCommitMessageFn,
    ],
  );

  return <StudioWorkspaceContext.Provider value={value}>{props.children}</StudioWorkspaceContext.Provider>;
}

export function useStudioWorkspace(): StudioWorkspaceState {
  const ctx = React.useContext(StudioWorkspaceContext);
  if (!ctx) throw new Error("useStudioWorkspace must be used within StudioWorkspaceProvider");
  return ctx;
}
