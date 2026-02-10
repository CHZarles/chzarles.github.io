import { ArrowUpRight, FileDiff, RefreshCw, Trash2 } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import YAML from "yaml";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { readStudioDataCache, studioDataCacheKey } from "../util/cache";
import { formatStudioError } from "../util/errors";
import { emitWorkspaceChanged, type WorkspaceChange, useStudioWorkspace } from "../state/StudioWorkspace";

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
    case "roadmap":
      return c.title.trim() || c.roadmapId;
    case "mindmap":
      return c.title.trim() || c.mindmapId;
    case "config":
      return `Config: ${c.fileKey}`;
    case "assets":
      return `Assets: +${c.uploads.length} -${c.deletes.length}`;
  }
}

function subtitleForChange(c: WorkspaceChange): string {
  if (c.kind === "note") return c.noteId ? `content/notes/${c.noteId}.md` : "New note draft";
  if (c.kind === "roadmap") return c.pathHint ?? `content/roadmaps/${c.roadmapId}.yml`;
  if (c.kind === "mindmap") return `content/mindmaps/${c.mindmapId}.json`;
  if (c.kind === "config") {
    if (c.fileKey === "profile") return "content/profile.json";
    if (c.fileKey === "projects") return "content/projects.json";
    return "content/categories.yml";
  }
  return c.uploads.length || c.deletes.length ? "public/uploads/*" : "No staged asset changes";
}

function noteBaselineCacheKey(noteId: string): string {
  return studioDataCacheKey(PUBLISHER_BASE_URL, ["notes", "detail", noteId]);
}

function roadmapBaselineCacheKey(roadmapId: string): string {
  return studioDataCacheKey(PUBLISHER_BASE_URL, ["roadmaps", "detail", roadmapId]);
}

function mindmapBaselineCacheKey(mindmapId: string): string {
  return studioDataCacheKey(PUBLISHER_BASE_URL, ["mindmaps", "detail", mindmapId]);
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

  const excerpt = String(args.editor.excerpt ?? "").trim();
  if (excerpt) fm.excerpt = excerpt;
  else delete fm.excerpt;

  const categories = normalizeIdList(Array.isArray(args.editor.categories) ? args.editor.categories : []);
  if (categories.length) fm.categories = categories;
  else delete fm.categories;

  const tags = normalizeIdList(Array.isArray(args.editor.tags) ? args.editor.tags : []);
  if (tags.length) fm.tags = tags;
  else delete fm.tags;

  const nodes = normalizeIdList(Array.isArray(args.editor.nodes) ? args.editor.nodes : []);
  if (nodes.length) fm.nodes = nodes;
  else delete fm.nodes;

  const mindmaps = normalizeIdList(Array.isArray(args.editor.mindmaps) ? args.editor.mindmaps : []);
  if (mindmaps.length) fm.mindmaps = mindmaps;
  else delete fm.mindmaps;

  const cover = String(args.editor.cover ?? "").trim();
  if (cover) fm.cover = cover;
  else delete fm.cover;

  if (Boolean(args.editor.draft)) fm.draft = true;
  else delete fm.draft;

  const yaml = YAML.stringify(fm).trimEnd();
  return `---\n${yaml}\n---\n\n${body}\n`;
}

function readBaseline(c: WorkspaceChange): { name: string; oldText: string; newText: string } | null {
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

  if (c.kind === "roadmap") {
    const cached = readStudioDataCache<any>(roadmapBaselineCacheKey(c.roadmapId))?.value ?? null;
    const oldText = cached?.roadmap?.yaml ?? "";
    if (c.pendingDelete) return { name: subtitleForChange(c), oldText, newText: "" };
    return { name: subtitleForChange(c), oldText, newText: c.yaml.trimEnd() + "\n" };
  }

  if (c.kind === "mindmap") {
    const cached = readStudioDataCache<any>(mindmapBaselineCacheKey(c.mindmapId))?.value ?? null;
    const oldText = cached?.mindmap?.json ?? "";
    if (c.pendingDelete) return { name: subtitleForChange(c), oldText, newText: "" };
    const newText = JSON.stringify(
      {
        id: c.mindmapId,
        title: c.title || c.mindmapId,
        format: "reactflow",
        nodes: c.nodes,
        edges: c.edges,
        viewport: c.viewport,
      },
      null,
      2,
    ).trimEnd() + "\n";
    return { name: subtitleForChange(c), oldText, newText };
  }

  return null;
}

async function createUnifiedDiff(args: { name: string; oldText: string; newText: string }): Promise<string> {
  const mod = await import("diff");
  const patch = mod.createTwoFilesPatch(`a/${args.name}`, `b/${args.name}`, args.oldText ?? "", args.newText ?? "", "", "", {
    context: 3,
  });
  return patch.trimEnd() + "\n";
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="card p-8">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <FileDiff className="h-4 w-4 opacity-80" />
          No local changes
        </div>
        <div className="mt-2 text-sm text-[hsl(var(--muted))]">
          Edits in Studio auto-save in your browser. When you’re ready, Publish creates a single GitHub commit.
        </div>
      </div>
    </div>
  );
}

export function StudioChangesPage() {
  const ws = useStudioWorkspace();
  const nav = useNavigate();

  const [selectedKey, setSelectedKey] = React.useState<string | null>(ws.changes[0]?.key ?? null);
  React.useEffect(() => {
    if (selectedKey && ws.changes.some((c) => c.key === selectedKey)) return;
    setSelectedKey(ws.changes[0]?.key ?? null);
  }, [ws.changes, selectedKey]);

  const selected = ws.changes.find((c) => c.key === selectedKey) ?? null;
  const baseline = React.useMemo(() => (selected ? readBaseline(selected) : null), [selected]);

  const [diffText, setDiffText] = React.useState<string>("");
  const [diffError, setDiffError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!baseline) {
        setDiffText("");
        setDiffError(null);
        return;
      }
      try {
        const patch = await createUnifiedDiff(baseline);
        if (cancelled) return;
        setDiffText(patch);
        setDiffError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setDiffText("");
        setDiffError(formatStudioError(err).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseline?.name, baseline?.oldText, baseline?.newText]);

  const discardSelected = React.useCallback(() => {
    if (!selected) return;
    const ok = window.confirm(`Discard local draft?\n\n${subtitleForChange(selected)}`);
    if (!ok) return;
    safeLocalStorageRemove(selected.key);
    emitWorkspaceChanged();
  }, [selected]);

  if (!ws.changes.length) return <EmptyState />;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">CHANGES</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">{ws.stats.total} local draft(s)</div>
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

        <div className="min-h-0 overflow-auto px-2 pb-3">
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
                    <div className="truncate text-sm font-medium tracking-tight">{labelForChange(c)}</div>
                    <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">{subtitleForChange(c)}</div>
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
          <div className="mx-auto max-w-3xl px-4 py-6">
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-tight">{labelForChange(selected)}</div>
                  <div className="mt-1 truncate text-xs text-[hsl(var(--muted))]">{subtitleForChange(selected)}</div>
                </div>
                <div className="flex items-center gap-2">
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
              </div>

              {baseline ? (
                <div className="mt-5">
                  <div className="text-[10px] font-semibold tracking-[0.22em] text-[hsl(var(--muted))]">DIFF</div>
                  {diffError ? (
                    <div className="mt-2 text-xs text-red-700">{diffError}</div>
                  ) : (
                    <pre className="mt-2 max-h-[60vh] overflow-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-xs leading-relaxed text-[hsl(var(--fg))]">
                      {diffText}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="mt-5 text-sm text-[hsl(var(--muted))]">Binary or non-diffable change.</div>
              )}

              <div className="mt-6 border-t border-[hsl(var(--border))] pt-5">
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
                  Publish is global: it commits all local changes to GitHub in one commit.
                </div>

                <div className="mt-4">
                  <div className="text-[10px] font-semibold tracking-[0.22em] text-[hsl(var(--muted))]">COMMIT MESSAGE</div>
                  <textarea
                    value={ws.commitMessage}
                    onChange={(e) => ws.setCommitMessage(e.target.value)}
                    rows={2}
                    className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none focus:border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))]"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  {ws.publishError ? <div className="mt-3 text-xs text-red-700">Publish failed: {ws.publishError}</div> : null}
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
