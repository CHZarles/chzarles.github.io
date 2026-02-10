import { ArrowDownUp, ArrowLeftRight, Check, LayoutList, Plus, RefreshCw, Trash2, X } from "lucide-react";
import React from "react";
import YAML from "yaml";
import { publisherFetchJson } from "../../ui/publisher/client";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { RoadmapMap } from "../../ui/roadmap/RoadmapMap";
import { RoadmapOutline } from "../../ui/roadmap/RoadmapOutline";
import type { Roadmap } from "../../ui/types";
import { useStudioState } from "../state/StudioState";
import { emitWorkspaceChanged } from "../state/StudioWorkspace";
import { pruneStudioDataCache, readStudioDataCache, studioDataCacheKey, writeStudioDataCache } from "../util/cache";
import { formatStudioError } from "../util/errors";

type RoadmapsListResponse = {
  roadmaps: Array<{
    id: string;
    path: string;
    sha: string;
    size: number;
    meta?: { title?: string; description?: string; theme?: string; layout?: string };
  }>;
  paging: { after: string | null; nextAfter: string | null };
};

type RoadmapGetResponse = {
  roadmap: { id: string; path: string; exists: boolean; yaml: string; json: Record<string, unknown> };
};

type RoadmapsListCacheV1 = {
  roadmaps: RoadmapsListResponse["roadmaps"];
  paging: RoadmapsListResponse["paging"];
};

const ROADMAPS_LIST_CACHE_KEY = studioDataCacheKey(PUBLISHER_BASE_URL, ["roadmaps", "list"]);
const ROADMAP_DETAIL_CACHE_PREFIX = `${studioDataCacheKey(PUBLISHER_BASE_URL, ["roadmaps", "detail"])}:`;
const MAX_ROADMAP_DETAIL_CACHE = 10;

function roadmapDetailCacheKey(roadmapId: string): string {
  return studioDataCacheKey(PUBLISHER_BASE_URL, ["roadmaps", "detail", roadmapId]);
}

function emptyRoadmapYaml(id: string) {
  return `id: ${id}\n` + `title: ${id}\n` + `description: \n` + `theme: violet\n` + `layout: horizontal\n` + `nodes:\n` + `  - id: foundations\n` + `    title: Foundations\n` + `    description: \n` + `    children: []\n`;
}

type PreviewState =
  | { ok: true; roadmap: Roadmap }
  | { ok: false; error: string; roadmap: Roadmap | null };

function safeRoadmapFromYaml(raw: string): PreviewState {
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, roadmap: null };
  }

  if (!parsed || typeof parsed !== "object") return { ok: false, error: "YAML must be a map/object.", roadmap: null };
  const obj = parsed as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : null;
  const title = typeof obj.title === "string" ? obj.title : null;
  const nodes = obj.nodes;
  if (!id) return { ok: false, error: "Missing `id`.", roadmap: null };
  if (!title) return { ok: false, error: "Missing `title`.", roadmap: null };
  if (!Array.isArray(nodes)) return { ok: false, error: "Missing `nodes` array.", roadmap: null };
  return { ok: true, roadmap: obj as Roadmap };
}

type LocalRoadmapDraftV1 = {
  v: 1;
  savedAt: number; // epoch ms
  roadmapId: string;
  title: string;
  yaml: string;
  pathHint?: string;
  pendingDelete?: boolean;
};

type LocalDraftIndexItem = {
  key: string;
  roadmapId: string;
  title: string;
  savedAt: number;
  pendingDelete: boolean;
};

const DRAFT_ROADMAP_PREFIX = "hyperblog.studio.draft.roadmap:";

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

function roadmapDraftKey(roadmapId: string): string {
  return `${DRAFT_ROADMAP_PREFIX}${roadmapId}`;
}

function readLocalDraft(key: string): LocalRoadmapDraftV1 | null {
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LocalRoadmapDraftV1;
    if (!v || typeof v !== "object") return null;
    if (v.v !== 1) return null;
    if (typeof v.savedAt !== "number") return null;
    if (typeof v.roadmapId !== "string") return null;
    if (typeof v.title !== "string") return null;
    if (typeof v.yaml !== "string") return null;
    if (typeof v.pathHint !== "undefined" && typeof v.pathHint !== "string") return null;
    if (typeof v.pendingDelete !== "undefined" && typeof v.pendingDelete !== "boolean") return null;
    return v;
  } catch {
    return null;
  }
}

function listLocalDraftIndex(): LocalDraftIndexItem[] {
  const keys = safeLocalStorageKeys();
  const drafts: LocalDraftIndexItem[] = [];
  for (const key of keys) {
    if (!key.startsWith(DRAFT_ROADMAP_PREFIX)) continue;
    const d = readLocalDraft(key);
    if (!d) continue;
    drafts.push({
      key,
      roadmapId: d.roadmapId,
      title: d.title.trim() || d.roadmapId,
      savedAt: d.savedAt,
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

export function StudioRoadmapsPage() {
  const studio = useStudioState();

  const [roadmaps, setRoadmaps] = React.useState<RoadmapsListResponse["roadmaps"]>(
    () => readStudioDataCache<RoadmapsListCacheV1>(ROADMAPS_LIST_CACHE_KEY)?.value.roadmaps ?? [],
  );
  const [paging, setPaging] = React.useState<RoadmapsListResponse["paging"]>(
    () => readStudioDataCache<RoadmapsListCacheV1>(ROADMAPS_LIST_CACHE_KEY)?.value.paging ?? { after: null, nextAfter: null },
  );
  const [filter, setFilter] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [listRefreshing, setListRefreshing] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [yamlText, setYamlText] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [draftKey, setDraftKey] = React.useState<string | null>(null);
  const [localSavedAt, setLocalSavedAt] = React.useState<number | null>(null);
  const [localDrafts, setLocalDrafts] = React.useState<LocalDraftIndexItem[]>(() => listLocalDraftIndex());
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [layout, setLayout] = React.useState<"horizontal" | "vertical">("horizontal");
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

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
      if (k.startsWith(DRAFT_ROADMAP_PREFIX)) refreshDraftIndex();
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
        const url = new URL("/api/admin/roadmaps", "http://local");
        url.searchParams.set("include", "meta");
        url.searchParams.set("limit", "50");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const res = await publisherFetchJson<RoadmapsListResponse>({ path: url.pathname + url.search, token: studio.token });
        if (seq !== listLoadSeqRef.current) return;
        setRoadmaps((prev) => {
          const next = opts?.append ? [...prev, ...res.roadmaps] : res.roadmaps;
          if (!opts?.append) writeStudioDataCache(ROADMAPS_LIST_CACHE_KEY, { roadmaps: next, paging: res.paging });
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
    if (!studio.token) return;
    const cached = readStudioDataCache<RoadmapsListCacheV1>(ROADMAPS_LIST_CACHE_KEY)?.value ?? null;
    if (cached) {
      setRoadmaps(cached.roadmaps ?? []);
      setPaging(cached.paging ?? { after: null, nextAfter: null });
    }
    void refreshList({ background: Boolean(cached) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.token, studio.syncNonce]);

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return roadmaps;
    return roadmaps.filter((r) => r.id.toLowerCase().includes(q) || (r.meta?.title ?? "").toLowerCase().includes(q));
  }, [roadmaps, filter]);

  const preview = React.useMemo(() => safeRoadmapFromYaml(yamlText), [yamlText]);

  React.useEffect(() => {
    if (!preview.ok) return;
    const fromFile = preview.roadmap.layout;
    if (fromFile === "horizontal" || fromFile === "vertical") setLayout(fromFile);
  }, [preview]);

  const roadmapLoadSeqRef = React.useRef(0);
  const openRoadmap = React.useCallback(
    async (id: string) => {
      if (!studio.token) return;
      if (dirty && !window.confirm("Discard unsaved changes?")) return;

      const seq = (roadmapLoadSeqRef.current += 1);
      const dk = roadmapDraftKey(id);
      setDraftKey(dk);
      const local = readLocalDraft(dk);
      const restore = local ? window.confirm(`Restore local draft saved ${fmtRelative(local.savedAt)} ago?`) : false;

      setNotice(null);
      setPendingDelete(restore && local ? Boolean(local.pendingDelete) : false);

      const cached = readStudioDataCache<RoadmapGetResponse>(roadmapDetailCacheKey(id))?.value ?? null;
      const cachedYaml = cached?.roadmap?.yaml ?? "";

      if (restore && local) {
        const nextYaml = local.yaml ?? "";
        setActiveId(id);
        setYamlText(nextYaml);
        setDirty(false);
        setLocalSavedAt(local.savedAt);
        setNotice(`Restored local draft (${fmtRelative(local.savedAt)} ago).`);

        const parsed = safeRoadmapFromYaml(nextYaml);
        setSelectedNodeId(parsed.ok ? (parsed.roadmap.nodes?.[0]?.id ?? null) : null);
        setOutlineOpen(false);
        return;
      }

      if (cachedYaml) {
        setActiveId(cached?.roadmap?.id ?? id);
        setYamlText(cachedYaml);
        setDirty(false);
        setLocalSavedAt(null);
        setPendingDelete(false);
        const parsed = safeRoadmapFromYaml(cachedYaml);
        setSelectedNodeId(parsed.ok ? (parsed.roadmap.nodes?.[0]?.id ?? null) : null);
        setOutlineOpen(false);
      }

      const background = Boolean(cachedYaml);
      if (!background) setBusy(true);
      try {
        const res = await publisherFetchJson<RoadmapGetResponse>({
          path: `/api/admin/roadmaps/${encodeURIComponent(id)}`,
          token: studio.token,
        });
        if (seq !== roadmapLoadSeqRef.current) return;
        writeStudioDataCache(roadmapDetailCacheKey(id), res);
        pruneStudioDataCache(ROADMAP_DETAIL_CACHE_PREFIX, MAX_ROADMAP_DETAIL_CACHE);

        const nextYaml = res.roadmap.yaml ?? "";
        if (!dirtyRef.current) {
          setActiveId(res.roadmap.id);
          setYamlText(nextYaml);
          setDirty(false);
          setLocalSavedAt(null);
          setPendingDelete(false);
          const parsed = safeRoadmapFromYaml(nextYaml);
          setSelectedNodeId(parsed.ok ? (parsed.roadmap.nodes?.[0]?.id ?? null) : null);
          setOutlineOpen(false);
        }
      } catch (err: unknown) {
        if (!background) setNotice(`Open failed: ${formatStudioError(err).message}`);
      } finally {
        if (!background) setBusy(false);
      }
    },
    [studio.token, dirty],
  );

  const newRoadmap = React.useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const id = window.prompt("Roadmap id (a-z0-9-)", "");
    const rid = String(id ?? "").trim().toLowerCase();
    if (!rid) return;
    setDraftKey(roadmapDraftKey(rid));
    setActiveId(rid);
    setYamlText(emptyRoadmapYaml(rid));
    setDirty(true);
    setLocalSavedAt(null);
    setNotice(null);
    setSelectedNodeId("foundations");
    setOutlineOpen(false);
    setPendingDelete(false);
  }, [dirty]);

  const openLocalDraft = React.useCallback(
    (item: LocalDraftIndexItem) => {
      const d = readLocalDraft(item.key);
      if (!d) {
        refreshDraftIndex();
        return;
      }
      if (dirty && !window.confirm("Discard unsaved changes?")) return;

      setDraftKey(item.key);
      setActiveId(d.roadmapId);
      setYamlText(d.yaml ?? "");
      setDirty(false);
      setLocalSavedAt(d.savedAt);
      setNotice(`Opened local draft (${fmtRelative(d.savedAt)} ago).`);
      setPendingDelete(Boolean(d.pendingDelete));

      const parsed = safeRoadmapFromYaml(d.yaml ?? "");
      setSelectedNodeId(parsed.ok ? (parsed.roadmap.nodes?.[0]?.id ?? null) : null);
      setOutlineOpen(false);
    },
    [dirty, refreshDraftIndex],
  );

  const deleteLocalDraft = React.useCallback(
    (key: string) => {
      safeLocalStorageRemove(key);
      if (draftKey === key) setLocalSavedAt(null);
      refreshDraftIndex();
      emitWorkspaceChanged();
    },
    [draftKey, refreshDraftIndex],
  );

  const saveLocal = React.useCallback(
    (opts?: { quiet?: boolean; pendingDelete?: boolean }) => {
      if (!activeId) {
        setNotice("Select a roadmap first.");
        return;
      }

      const key = roadmapDraftKey(activeId);
      if (draftKey !== key) setDraftKey(key);

      const title = preview.ok ? String(preview.roadmap.title ?? "").trim() || activeId : activeId;
      const pathHint =
        roadmaps.find((r) => r.id === activeId)?.path ??
        readStudioDataCache<RoadmapGetResponse>(roadmapDetailCacheKey(activeId))?.value?.roadmap?.path ??
        null;
      const payload: LocalRoadmapDraftV1 = {
        v: 1,
        savedAt: Date.now(),
        roadmapId: activeId,
        title,
        yaml: yamlText,
        pathHint: pathHint ?? undefined,
        pendingDelete: typeof opts?.pendingDelete === "boolean" ? opts.pendingDelete : pendingDelete,
      };
      const ok = safeLocalStorageSet(key, JSON.stringify(payload));
      if (!ok) {
        setNotice("Local save failed (storage unavailable or full).");
        return;
      }

      setLocalSavedAt(payload.savedAt);
      setDirty(false);
      refreshDraftIndex();
      emitWorkspaceChanged();
      if (!opts?.quiet) setNotice(`Saved locally (${fmtRelative(payload.savedAt)}).`);
    },
    [activeId, draftKey, pendingDelete, preview, refreshDraftIndex, yamlText, roadmaps],
  );

  React.useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      saveLocal({ quiet: true });
    }, 650);
    return () => window.clearTimeout(t);
  }, [dirty, saveLocal, yamlText]);

  const setDeleteStaged = React.useCallback(
    (next: boolean) => {
      if (!activeId) return;
      if (next) {
        const ok = window.confirm(`Stage delete for ${activeId}? (Will commit on Publish)`);
        if (!ok) return;
      }
      setPendingDelete(next);
      saveLocal({ quiet: true, pendingDelete: next });
      setNotice(next ? "Delete staged. Publish (top bar) will move it into content/.trash." : "Delete unstaged.");
    },
    [activeId, saveLocal],
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

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_520px]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">ROADMAPS</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={newRoadmap}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
            >
              <Plus className="h-3.5 w-3.5 opacity-85" />
              New
            </button>
            <button
              type="button"
              onClick={() => void refreshList()}
              disabled={listBusy || listRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
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
            placeholder="Search…"
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
                    setNotice("Cleared local drafts.");
                    setLocalSavedAt(null);
                    emitWorkspaceChanged();
                  }}
                  title="Delete all local drafts"
                >
                  Clear
                </button>
              </div>
              <ul className="grid gap-1">
                {localDrafts.slice(0, 8).map((d) => {
                  const active = draftKey === d.key;
                  const sub = `${d.roadmapId} · saved ${fmtRelative(d.savedAt)}`;
                  return (
                    <li key={d.key} className="group flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => openLocalDraft(d)}
                        className={[
                          "flex-1 rounded-xl px-3 py-2 text-left transition",
                          active ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                        ].join(" ")}
                        title={`Local draft for ${d.roadmapId}`}
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
                          setNotice("Deleted local draft.");
                          emitWorkspaceChanged();
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
            {filtered.map((r) => {
              const active = activeId === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => void openRoadmap(r.id)}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left transition",
                      active ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                    ].join(" ")}
                  >
                    <div className="truncate text-sm font-medium tracking-tight">{r.meta?.title ?? r.id}</div>
                    <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">{r.id}</div>
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
              <div className="truncate text-sm font-semibold tracking-tight">{activeId ?? "Select a roadmap"}</div>
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
            {activeId ? (
              <button
                type="button"
                onClick={() => setDeleteStaged(!pendingDelete)}
                disabled={!activeId || busy}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              >
                {pendingDelete ? <X className="h-3.5 w-3.5 opacity-85" /> : <Trash2 className="h-3.5 w-3.5 opacity-85" />}
                {pendingDelete ? "Unstage delete" : "Stage delete"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => saveLocal()}
              disabled={busy || !activeId}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Save locally (⌘S / Ctrl+S)"
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              Save local
            </button>
          </div>
        </div>

        {notice ? (
          <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-[hsl(var(--muted))]">{notice}</div>
            </div>
          </div>
        ) : null}

        {!activeId ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-[hsl(var(--muted))]">Pick a roadmap.</div>
        ) : (
          <textarea
            value={yamlText}
            onChange={(e) => {
              setDirty(true);
              setYamlText(e.target.value);
            }}
            className="h-full w-full resize-none bg-[hsl(var(--bg))] px-4 py-4 font-mono text-sm leading-6 outline-none placeholder:text-[hsl(var(--muted))]"
            placeholder="id: ...\ntitle: ...\nnodes: ..."
          />
        )}
      </section>

      <aside className="hidden min-h-0 overflow-auto bg-[hsl(var(--bg))] lg:block">
        <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">PREVIEW</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOutlineOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
            >
              <LayoutList className="h-3.5 w-3.5 opacity-85" />
              {outlineOpen ? "Hide outline" : "Show outline"}
            </button>
            <button
              type="button"
              onClick={() => setLayout((v) => (v === "vertical" ? "horizontal" : "vertical"))}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
              title="Toggle layout (preview only)"
            >
              {layout === "vertical" ? <ArrowDownUp className="h-3.5 w-3.5 opacity-85" /> : <ArrowLeftRight className="h-3.5 w-3.5 opacity-85" />}
              {layout === "vertical" ? "Vertical" : "Horizontal"}
            </button>
          </div>
        </div>

        <div className="p-4">
          {!activeId ? (
            <div className="card p-6 text-sm text-[hsl(var(--muted))]">No roadmap selected.</div>
          ) : preview.ok ? (
            <div className="grid gap-4">
              <RoadmapMap roadmap={preview.roadmap} layout={layout} selectedId={selectedNodeId} onSelect={setSelectedNodeId} />
              {outlineOpen ? (
                <div className="card p-4">
                  <div className="text-sm font-semibold tracking-tight">Outline</div>
                  <div className="hairline my-3" />
                  <RoadmapOutline nodes={preview.roadmap.nodes ?? []} selectedId={selectedNodeId} onSelect={setSelectedNodeId} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card p-6">
              <div className="text-sm font-semibold tracking-tight">YAML error</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-red-600">{preview.error}</div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
