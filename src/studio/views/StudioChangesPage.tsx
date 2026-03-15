import { AlertTriangle, ArrowUpRight, FileDiff, RefreshCw, Trash2 } from "lucide-react";
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import YAML from "yaml";
import { publisherFetchJson } from "../../ui/publisher/client";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { readStudioDataCache, studioDataCacheKey } from "../util/cache";
import { formatStudioError } from "../util/errors";
import { emitWorkspaceChanged, type WorkspaceChange, useStudioWorkspace } from "../state/StudioWorkspace";
import { useStudioState } from "../state/StudioState";

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function fmtTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
      new Date(ts),
    );
  } catch {
    return new Date(ts).toISOString();
  }
}

function labelForChange(c: WorkspaceChange): string {
  switch (c.kind) {
    case "note":
      return c.editor.title.trim() || c.noteId || "Untitled note";
    case "config":
      return `Config: ${c.fileKey}`;
    case "assets":
      return `Assets: +${c.uploads.length} -${c.deletes.length}`;
  }
}

function subtitleForChange(c: WorkspaceChange): string {
  if (c.kind === "note") return c.noteId ? `content/notes/${c.noteId}.md` : "New note draft";
  if (c.kind === "config") {
    if (c.fileKey === "profile") return "content/profile.json";
    return "content/categories.yml";
  }
  return c.uploads.length || c.deletes.length ? "public/uploads/*" : "No staged asset changes";
}

function kindLabel(c: WorkspaceChange): string {
  if (c.kind === "note") return c.pendingDelete ? "DELETE" : "NOTE";
  if (c.kind === "config") return "CONFIG";
  return "ASSETS";
}

function changeStats(c: WorkspaceChange): string[] {
  if (c.kind === "note") {
    return [c.noteId ? "existing" : "new", c.pendingDelete ? "pending delete" : "local draft"];
  }
  if (c.kind === "config") {
    return [c.fileKey];
  }
  const out: string[] = [];
  if (c.uploads.length) out.push(`${c.uploads.length} upload${c.uploads.length > 1 ? "s" : ""}`);
  if (c.deletes.length) out.push(`${c.deletes.length} delete${c.deletes.length > 1 ? "s" : ""}`);
  return out.length ? out : ["no file ops"];
}

function noteBaselineCacheKey(noteId: string): string {
  return studioDataCacheKey(PUBLISHER_BASE_URL, ["notes", "detail", noteId]);
}

function isValidYmd(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}

function buildNoteId(args: { title: string; date: string; slug: string }): { ok: true; noteId: string } | { ok: false; error: string } {
  const date = args.date.trim();
  if (!isValidYmd(date)) return { ok: false, error: "Invalid date (YYYY-MM-DD)." };
  const slugBase = args.slug.trim() || slugify(args.title);
  const slug = slugBase || `note-${shortHash(`${args.title}:${Date.now()}`)}`;
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return { ok: false, error: "Invalid slug (a-z0-9-)." };
  return { ok: true, noteId: `${date}-${slug}` };
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

function renderNoteMarkdown(args: { baseMarkdown: string | null; editor: any; updatedYmd: string }): string {
  const title = String(args.editor.title ?? "").trim();
  const body = String(args.editor.content ?? "").trim();
  if (!title) throw new Error("Missing title.");
  if (!body) throw new Error("Missing content.");

  const date = String(args.editor.date ?? "").trim();
  if (!isValidYmd(date)) throw new Error("Invalid date (YYYY-MM-DD).");

  const base = args.baseMarkdown ? parseFrontmatter(args.baseMarkdown) : { frontmatter: {}, body: "" };
  const fm: Record<string, unknown> = { ...(base.frontmatter ?? {}) };

  fm.title = title;
  fm.date = date;
  if (args.updatedYmd !== date) fm.updated = args.updatedYmd;
  else delete fm.updated;

  delete fm.excerpt;

  const categories = normalizeIdList(Array.isArray(args.editor.categories) ? args.editor.categories : []);
  if (categories.length) fm.categories = categories;
  else delete fm.categories;

  const tags = normalizeIdList(Array.isArray(args.editor.tags) ? args.editor.tags : []);
  if (tags.length) fm.tags = tags;
  else delete fm.tags;

  const cover = String(args.editor.cover ?? "").trim();
  if (cover) fm.cover = cover;
  else delete fm.cover;

  if (Boolean(args.editor.draft)) fm.draft = true;
  else delete fm.draft;

  const yaml = YAML.stringify(fm).trimEnd();
  return `---\n${yaml}\n---\n\n${body}\n`;
}

type Baseline = { name: string; oldText: string; newText: string };

function readBaseline(c: WorkspaceChange): Baseline | null {
  if (c.kind === "assets") return null;

  if (c.kind === "config") {
    const cacheKey = `hyperblog.studio.cache.config:v1:${PUBLISHER_BASE_URL}:${c.fileKey}`;
    const cached = (() => {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        const v = JSON.parse(raw) as { raw?: string };
        return typeof v.raw === "string" ? v.raw : null;
      } catch {
        return null;
      }
    })();
    const normalize = () => {
      if (c.fileKey === "categories") return c.raw.trimEnd() + "\n";
      const parsed = JSON.parse(c.raw);
      return JSON.stringify(parsed, null, 2) + "\n";
    };
    let newText = c.raw;
    try {
      newText = normalize();
    } catch {
      // keep raw
    }
    return { name: subtitleForChange(c), oldText: cached ?? "", newText };
  }

  if (c.kind === "note") {
    const resolved = c.noteId ? { ok: true as const, noteId: c.noteId } : buildNoteId({ title: c.editor.title, date: c.editor.date, slug: c.editor.slug });
    const noteId = resolved.ok ? resolved.noteId : null;
    const cached = noteId ? readStudioDataCache<any>(noteBaselineCacheKey(noteId))?.value ?? null : null;
    const oldText = cached?.note?.markdown ?? "";
    if (c.pendingDelete) {
      return { name: subtitleForChange(c), oldText, newText: "" };
    }
    const base = c.baseMarkdown ?? oldText;
    let newText = "";
    try {
      newText = renderNoteMarkdown({ baseMarkdown: base, editor: c.editor, updatedYmd: todayLocalYmd() });
    } catch {
      newText = c.editor.content || "";
    }
    return { name: noteId ? `content/notes/${noteId}.md` : subtitleForChange(c), oldText, newText };
  }

  return null;
}

function buildBaselineWithOldText(c: WorkspaceChange, oldText: string): Baseline | null {
  if (c.kind === "assets") return null;

  if (c.kind === "config") {
    const normalize = () => {
      if (c.fileKey === "categories") return c.raw.trimEnd() + "\n";
      const parsed = JSON.parse(c.raw);
      return JSON.stringify(parsed, null, 2) + "\n";
    };
    let newText = c.raw;
    try {
      newText = normalize();
    } catch {
      // keep raw
    }
    return { name: subtitleForChange(c), oldText, newText };
  }

  if (c.kind === "note") {
    const resolved = c.noteId
      ? { ok: true as const, noteId: c.noteId }
      : buildNoteId({ title: c.editor.title, date: c.editor.date, slug: c.editor.slug });
    const noteId = resolved.ok ? resolved.noteId : null;
    if (c.pendingDelete) return { name: subtitleForChange(c), oldText, newText: "" };
    const base = c.baseMarkdown ?? oldText;
    let newText = "";
    try {
      newText = renderNoteMarkdown({ baseMarkdown: base, editor: c.editor, updatedYmd: todayLocalYmd() });
    } catch {
      newText = c.editor.content || "";
    }
    return { name: noteId ? `content/notes/${noteId}.md` : subtitleForChange(c), oldText, newText };
  }

  return null;
}

async function readRemoteOldText(args: { change: WorkspaceChange; token: string }): Promise<string | null> {
  const c = args.change;
  if (c.kind === "assets") return null;

  if (c.kind === "config") {
    const res = await publisherFetchJson<{ file: { raw: string } }>({
      path: c.fileKey === "profile" ? "/api/admin/config/profile" : "/api/admin/config/categories",
      token: args.token,
    });
    return typeof res.file?.raw === "string" ? res.file.raw : "";
  }

  if (c.kind === "note") {
    const resolved = c.noteId
      ? { ok: true as const, noteId: c.noteId }
      : buildNoteId({ title: c.editor.title, date: c.editor.date, slug: c.editor.slug });
    const noteId = resolved.ok ? resolved.noteId : null;
    if (!noteId) return "";
    try {
      const res = await publisherFetchJson<{ note: { markdown: string } }>({ path: `/api/admin/notes/${noteId}`, token: args.token });
      return typeof res.note?.markdown === "string" ? res.note.markdown : "";
    } catch (err: unknown) {
      const pub = (err as any)?.publisher as { code?: string } | undefined;
      if (pub?.code === "NOT_FOUND") return "";
      throw err;
    }
  }

  return "";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSigned(value: number, unit: string): string {
  if (!Number.isFinite(value) || value === 0) return `0 ${unit}`;
  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

function summarizeText(text: string): { lines: number; nonEmptyLines: number; chars: number; bytes: number } {
  const normalized = text ?? "";
  if (!normalized) return { lines: 0, nonEmptyLines: 0, chars: 0, bytes: 0 };
  const lines = normalized.split(/\r?\n/);
  let bytes = normalized.length;
  try {
    bytes = new TextEncoder().encode(normalized).length;
  } catch {
    // fall back to string length
  }
  return {
    lines: lines.length,
    nonEmptyLines: lines.filter((line) => line.trim()).length,
    chars: normalized.length,
    bytes,
  };
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8">
        <div className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <FileDiff className="h-4 w-4 opacity-80" />
          No local changes
        </div>
        <div className="mt-3 text-sm leading-7 text-[hsl(var(--muted))]">
          Notes, assets, and config drafts appear here before you publish.
        </div>
      </div>
    </div>
  );
}

export function StudioChangesPage() {
  const ws = useStudioWorkspace();
  const studio = useStudioState();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedKey, setSelectedKey] = React.useState<string | null>(ws.changes[0]?.key ?? null);
  React.useEffect(() => {
    if (selectedKey && ws.changes.some((c) => c.key === selectedKey)) return;
    setSelectedKey(ws.changes[0]?.key ?? null);
  }, [ws.changes, selectedKey]);

  const selected = ws.changes.find((c) => c.key === selectedKey) ?? null;

  const compareParam = (searchParams.get("compare") ?? "").toLowerCase();
  const compareMode: "cached" | "remote" =
    compareParam === "remote"
      ? "remote"
      : compareParam === "cached"
        ? "cached"
        : ws.publishError?.code === "HEAD_MOVED"
          ? "remote"
          : "cached";

  const setCompareMode = React.useCallback(
    (next: "cached" | "remote") => {
      const sp = new URLSearchParams(searchParams);
      sp.set("compare", next);
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const cachedBaseline = React.useMemo(() => (selected ? readBaseline(selected) : null), [selected]);

  const [remoteOldText, setRemoteOldText] = React.useState<string>("");
  const [remoteLoaded, setRemoteLoaded] = React.useState(false);
  const [remoteBaselineError, setRemoteBaselineError] = React.useState<string | null>(null);
  const [remoteBusy, setRemoteBusy] = React.useState(false);
  const [remoteNonce, setRemoteNonce] = React.useState(0);

  const refreshRemote = React.useCallback(async () => {
    await studio.refreshMe();
    setRemoteNonce((n) => n + 1);
  }, [studio.refreshMe]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (compareMode !== "remote" || !selected) {
        setRemoteLoaded(false);
        setRemoteOldText("");
        setRemoteBaselineError(null);
        setRemoteBusy(false);
        return;
      }
      if (!studio.token) {
        setRemoteLoaded(false);
        setRemoteOldText("");
        setRemoteBaselineError("Not authenticated.");
        setRemoteBusy(false);
        return;
      }
      setRemoteBusy(true);
      setRemoteLoaded(false);
      try {
        const oldText = await readRemoteOldText({ change: selected, token: studio.token });
        if (cancelled) return;
        setRemoteOldText(oldText ?? "");
        setRemoteLoaded(true);
        setRemoteBaselineError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setRemoteOldText("");
        setRemoteLoaded(false);
        setRemoteBaselineError(formatStudioError(err).message);
      } finally {
        if (!cancelled) setRemoteBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compareMode, selected?.key, studio.token, remoteNonce]);

  const remoteBaseline = React.useMemo(() => {
    if (compareMode !== "remote" || !selected || !remoteLoaded) return null;
    return buildBaselineWithOldText(selected, remoteOldText);
  }, [compareMode, selected, remoteLoaded, remoteOldText]);

  const baseline = compareMode === "remote" ? remoteBaseline : cachedBaseline;
  const comparisonSummary = React.useMemo(() => {
    if (!baseline) return null;
    const previous = summarizeText(baseline.oldText);
    const current = summarizeText(baseline.newText);
    return {
      previous,
      current,
      deltaLines: current.lines - previous.lines,
      deltaNonEmptyLines: current.nonEmptyLines - previous.nonEmptyLines,
      deltaChars: current.chars - previous.chars,
      deltaBytes: current.bytes - previous.bytes,
    };
  }, [baseline?.name, baseline?.oldText, baseline?.newText]);

  const selectedDraftSummary = React.useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "note") {
      const body = summarizeText(selected.editor.content);
      return {
        rows: [
          { label: "Action", value: selected.pendingDelete ? "Delete" : selected.noteId ? "Update" : "Create" },
          { label: "Draft", value: selected.editor.draft ? "Hidden on site" : "Visible on site" },
          { label: "Body", value: `${body.nonEmptyLines} non-empty lines` },
          { label: "Categories", value: selected.editor.categories.length ? selected.editor.categories.join(", ") : "None" },
          { label: "Tags", value: selected.editor.tags.length ? selected.editor.tags.join(", ") : "None" },
          { label: "Cover", value: selected.editor.cover.trim() || "None" },
        ],
      };
    }

    if (selected.kind === "config") {
      return {
        rows: [
          { label: "File", value: selected.fileKey === "profile" ? "Profile JSON" : "Categories YAML" },
          { label: "Action", value: "Update config" },
        ],
      };
    }

    return null;
  }, [selected]);

  const discardSelected = React.useCallback(() => {
    if (!selected) return;
    const ok = window.confirm(`Discard local draft?\n\n${subtitleForChange(selected)}`);
    if (!ok) return;
    safeLocalStorageRemove(selected.key);
    emitWorkspaceChanged();
  }, [selected]);

  const publishHeadMoved = ws.publishError?.code === "HEAD_MOVED";
  const expectedHeadSha =
    publishHeadMoved && typeof (ws.publishError as any)?.details?.expectedHeadSha === "string"
      ? String((ws.publishError as any).details.expectedHeadSha)
      : null;
  const actualHeadSha =
    publishHeadMoved && typeof (ws.publishError as any)?.details?.actualHeadSha === "string"
      ? String((ws.publishError as any).details.actualHeadSha)
      : null;
  const [retrying, setRetrying] = React.useState(false);
  const retryPublishOnLatest = React.useCallback(async () => {
    if (!studio.token) return;
    setRetrying(true);
    try {
      const me = await studio.refreshMe();
      const headSha = me?.repo.headSha ?? studio.me?.repo.headSha ?? null;
      if (!headSha) return;
      await ws.publishAll({ confirm: true, expectedHeadSha: headSha });
    } finally {
      setRetrying(false);
    }
  }, [studio.token, studio.refreshMe, studio.me?.repo.headSha, ws.publishAll]);

  if (!ws.changes.length) return <EmptyState />;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-4 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">Staged locally</div>
            <div className="mt-1 text-xs text-[hsl(var(--muted))]">{ws.stats.total} item(s)</div>
          </div>
          <button
            type="button"
            onClick={ws.refresh}
            className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
            title="Refresh (re-scan local drafts)"
          >
            <RefreshCw className="h-3.5 w-3.5 opacity-85" />
            Refresh
          </button>
        </div>

        <div className="min-h-0 overflow-auto px-3 py-4">
          {ws.changes.map((c) => {
            const active = c.key === selectedKey;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedKey(c.key)}
                className={[
                  "w-full rounded-xl px-3 py-2 text-left transition",
                  active ? "bg-[hsl(var(--card2))]" : "hover:bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-medium tracking-tight">{labelForChange(c)}</div>
                      <TinyPill active={active}>{kindLabel(c)}</TinyPill>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">{subtitleForChange(c)}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {changeStats(c).map((stat) => (
                        <TinyPill key={`${c.key}:${stat}`}>{stat}</TinyPill>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] font-semibold tracking-[0.18em] text-[hsl(var(--muted))]">
                    {fmtTime(c.savedAt)}
                  </div>
                </div>
                {"pendingDelete" in c && c.pendingDelete ? (
                  <div className="mt-2 inline-flex rounded-full border border-[color-mix(in_oklab,red_32%,hsl(var(--border)))] bg-[color-mix(in_oklab,red_8%,hsl(var(--card)))] px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-red-700">
                    DELETE STAGED
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <main className="min-h-0 overflow-auto">
        {selected ? (
          <div className="mx-auto max-w-5xl px-5 py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-xl font-semibold tracking-tight">{labelForChange(selected)}</div>
                <div className="mt-2 truncate text-sm text-[hsl(var(--muted))]">{subtitleForChange(selected)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TinyPill active>{kindLabel(selected)}</TinyPill>
                  {changeStats(selected).map((stat) => (
                    <TinyPill key={`selected:${stat}`}>{stat}</TinyPill>
                  ))}
                  <TinyPill>{fmtTime(selected.savedAt)}</TinyPill>
                </div>
              </div>
              <button
                type="button"
                onClick={discardSelected}
                className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,red_35%,hsl(var(--border)))] bg-[color-mix(in_oklab,red_8%,hsl(var(--card)))] px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-[color-mix(in_oklab,red_12%,hsl(var(--card)))]"
                title="Discard this local draft"
              >
                <Trash2 className="h-3.5 w-3.5 opacity-85" />
                Discard
              </button>
            </div>

            {selected.kind === "assets" ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                  <div className="text-sm font-semibold tracking-tight">Uploads</div>
                  {selected.uploads.length ? (
                    <ul className="mt-4 grid gap-2.5">
                      {selected.uploads.map((upload) => (
                        <li key={upload.path} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-3">
                          <div className="truncate text-sm font-medium tracking-tight">{upload.url}</div>
                          <div className="mt-1 truncate text-xs text-[hsl(var(--muted))]">{upload.path}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4 text-sm text-[hsl(var(--muted))]">No staged uploads.</div>
                  )}
                </div>

                <div className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                  <div className="text-sm font-semibold tracking-tight">Deletes</div>
                  {selected.deletes.length ? (
                    <ul className="mt-4 grid gap-2.5">
                      {selected.deletes.map((filePath) => (
                        <li key={filePath} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-3">
                          <div className="truncate text-sm font-medium tracking-tight">{filePath.replace(/^public\//, "/")}</div>
                          <div className="mt-1 truncate text-xs text-[hsl(var(--muted))]">{filePath}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4 text-sm text-[hsl(var(--muted))]">No staged deletes.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                  <div className="text-sm font-semibold tracking-tight">Details</div>
                  {selectedDraftSummary ? (
                    <div className="mt-4 divide-y divide-[hsl(var(--border))]">
                      {selectedDraftSummary.rows.map((row) => (
                        <div key={`${selected.key}:${row.label}`} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="text-xs font-medium text-[hsl(var(--muted))]">{row.label}</div>
                          <div className="max-w-full break-all text-right text-sm text-[hsl(var(--fg))]">{row.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-[hsl(var(--muted))]">No local summary available.</div>
                  )}
                </div>

                <div className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Compare</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCompareMode("cached")}
                        className={[
                          "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                          compareMode === "cached"
                            ? "border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))]"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
                        ].join(" ")}
                        title="Compare with last synced baseline (cached)"
                      >
                        Cached
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareMode("remote")}
                        className={[
                          "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                          compareMode === "remote"
                            ? "border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))]"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
                        ].join(" ")}
                        title="Compare with current GitHub main (live)"
                      >
                        Remote
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-[hsl(var(--muted))]">
                    {compareMode === "remote" ? (
                      <>
                        Remote HEAD <span className="font-mono">{studio.me?.repo.headSha ? studio.me.repo.headSha.slice(0, 7) : "—"}</span>
                        {remoteBusy ? " · Loading…" : null}
                      </>
                    ) : (
                      "Cached baseline from the last sync."
                    )}
                  </div>

                  {compareMode === "remote" ? (
                    <button
                      type="button"
                      onClick={refreshRemote}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-[11px] font-medium text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                      title="Refresh remote baseline"
                    >
                      <RefreshCw className="h-3.5 w-3.5 opacity-85" />
                      Refresh remote
                    </button>
                  ) : null}

                  {remoteBaselineError ? <div className="mt-3 text-xs text-red-700">{remoteBaselineError}</div> : null}

                  {!baseline || !comparisonSummary ? (
                    <div className="mt-4 text-sm text-[hsl(var(--muted))]">
                      {compareMode === "remote" && remoteBusy ? "Loading remote summary…" : "No comparison summary available."}
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricCard
                          label="Previous"
                          value={`${comparisonSummary.previous.nonEmptyLines} lines`}
                          detail={`${formatBytes(comparisonSummary.previous.bytes)} · ${comparisonSummary.previous.chars} chars`}
                        />
                        <MetricCard
                          label="Current"
                          value={`${comparisonSummary.current.nonEmptyLines} lines`}
                          detail={`${formatBytes(comparisonSummary.current.bytes)} · ${comparisonSummary.current.chars} chars`}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricCard
                          label="Delta"
                          value={formatSigned(comparisonSummary.deltaNonEmptyLines, "lines")}
                          detail={formatSigned(comparisonSummary.deltaChars, "chars")}
                        />
                        <MetricCard
                          label="File size"
                          value={formatSigned(comparisonSummary.deltaBytes, "bytes")}
                          detail={`${formatBytes(comparisonSummary.current.bytes)} current`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold tracking-tight">Publish</div>
                <button
                  type="button"
                  onClick={() => nav("/studio/notes")}
                  className="text-xs text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]"
                >
                  Back to editor
                </button>
              </div>
              <div className="mt-2 text-sm text-[hsl(var(--muted))]">
                Publish commits every staged change in one GitHub commit.
              </div>

              {publishHeadMoved ? (
                <div className="mt-5 rounded-2xl border border-[color-mix(in_oklab,red_25%,hsl(var(--border)))] bg-[color-mix(in_oklab,red_6%,hsl(var(--card)))] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold tracking-tight text-red-700">Remote moved (main advanced)</div>
                      <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                        {expectedHeadSha ? (
                          <>
                            Expected <span className="font-mono">{expectedHeadSha.slice(0, 7)}</span>
                          </>
                        ) : (
                          "Expected HEAD unknown"
                        )}
                        {actualHeadSha ? (
                          <>
                            {" "}
                            · Now <span className="font-mono">{actualHeadSha.slice(0, 7)}</span>
                          </>
                        ) : null}
                        {" "}
                        · Switch compare to <span className="font-semibold">Remote</span> before retrying.
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCompareMode("remote")}
                          className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] px-3 py-2 text-xs font-medium text-[hsl(var(--fg))] transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]"
                        >
                          <FileDiff className="h-3.5 w-3.5 opacity-85" />
                          Review summary
                        </button>
                        <button
                          type="button"
                          onClick={retryPublishOnLatest}
                          disabled={retrying || ws.publishing}
                          className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-medium text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed disabled:opacity-60"
                          title="Refresh remote HEAD and retry publish"
                        >
                          <RefreshCw className="h-3.5 w-3.5 opacity-85" />
                          {retrying ? "Retrying…" : "Retry publish"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium tracking-tight text-[hsl(var(--muted))]">Commit message</div>
                </div>
                <div className="mt-2">
                  <textarea
                    value={ws.commitMessage}
                    onChange={(e) => ws.setCommitMessage(e.target.value)}
                    rows={2}
                    className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none focus:border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))]"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void ws.publishAll({ confirm: true })}
                      disabled={ws.publishing || ws.stats.total === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] px-4 py-2 text-sm font-medium text-[hsl(var(--fg))] transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))] disabled:cursor-not-allowed disabled:opacity-60"
                      title="Publish all changes to GitHub"
                    >
                      <ArrowUpRight className="h-4 w-4 opacity-85" />
                      {ws.publishing ? "Publishing…" : `Publish ${ws.stats.total}`}
                    </button>
                    <button
                      type="button"
                      onClick={ws.clearCommitMessage}
                      className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                      title="Reset commit message to default"
                    >
                      Reset
                    </button>
                  </div>
                  {ws.publishError ? <div className="mt-3 text-xs text-red-700">Publish failed: {ws.publishError.message}</div> : null}
                  {ws.lastCommitUrl ? (
                    <a
                      className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[hsl(var(--accent))] hover:underline"
                      href={ws.lastCommitUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View commit
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-85" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function TinyPill(props: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px]",
        props.active
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_10%,hsl(var(--card)))] text-[hsl(var(--fg))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted))]",
      ].join(" ")}
    >
      {props.children}
    </span>
  );
}

function MetricCard(props: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-3">
      <div className="text-[10px] font-semibold tracking-[0.18em] text-[hsl(var(--muted))]">{props.label}</div>
      <div className="mt-2 text-lg font-semibold tracking-tight">{props.value}</div>
      {props.detail ? <div className="mt-1 text-xs text-[hsl(var(--muted))]">{props.detail}</div> : null}
    </div>
  );
}
