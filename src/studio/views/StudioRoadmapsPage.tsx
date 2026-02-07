import { ArrowDownUp, ArrowLeftRight, Check, ExternalLink, LayoutList, Plus, RefreshCw, Trash2 } from "lucide-react";
import React from "react";
import YAML from "yaml";
import { publisherFetchJson } from "../../ui/publisher/client";
import { RoadmapMap } from "../../ui/roadmap/RoadmapMap";
import { RoadmapOutline } from "../../ui/roadmap/RoadmapOutline";
import type { Roadmap } from "../../ui/types";
import { useStudioState } from "../state/StudioState";

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

export function StudioRoadmapsPage() {
  const studio = useStudioState();

  const [roadmaps, setRoadmaps] = React.useState<RoadmapsListResponse["roadmaps"]>([]);
  const [paging, setPaging] = React.useState<RoadmapsListResponse["paging"]>({ after: null, nextAfter: null });
  const [filter, setFilter] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [yamlText, setYamlText] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [layout, setLayout] = React.useState<"horizontal" | "vertical">("horizontal");
  const [outlineOpen, setOutlineOpen] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);

  const refreshList = React.useCallback(
    async (opts?: { append?: boolean }) => {
      if (!studio.token) return;
      setListBusy(true);
      setListError(null);
      try {
        const url = new URL("/api/admin/roadmaps", "http://local");
        url.searchParams.set("include", "meta");
        url.searchParams.set("limit", "50");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const res = await publisherFetchJson<RoadmapsListResponse>({ path: url.pathname + url.search, token: studio.token });
        setRoadmaps((prev) => (opts?.append ? [...prev, ...res.roadmaps] : res.roadmaps));
        setPaging(res.paging);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setListError(msg);
      } finally {
        setListBusy(false);
      }
    },
    [studio.token, paging.nextAfter],
  );

  React.useEffect(() => {
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.token]);

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

  const openRoadmap = React.useCallback(
    async (id: string) => {
      if (!studio.token) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherFetchJson<RoadmapGetResponse>({
          path: `/api/admin/roadmaps/${encodeURIComponent(id)}`,
          token: studio.token,
        });
        setActiveId(res.roadmap.id);
        setYamlText(res.roadmap.yaml ?? "");
        setDirty(false);

        const parsed = safeRoadmapFromYaml(res.roadmap.yaml ?? "");
        setSelectedNodeId(parsed.ok ? (parsed.roadmap.nodes?.[0]?.id ?? null) : null);
        setOutlineOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Open failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [studio.token],
  );

  const newRoadmap = React.useCallback(() => {
    const id = window.prompt("Roadmap id (a-z0-9-)", "");
    const rid = String(id ?? "").trim().toLowerCase();
    if (!rid) return;
    setActiveId(rid);
    setYamlText(emptyRoadmapYaml(rid));
    setDirty(true);
    setNotice(null);
    setCommitUrl(null);
    setSelectedNodeId("foundations");
    setOutlineOpen(false);
  }, []);

  const save = React.useCallback(async () => {
    if (!studio.token) return;
    if (!activeId) {
      setNotice("Missing roadmap id.");
      return;
    }
    if (!yamlText.trim()) {
      setNotice("Empty YAML.");
      return;
    }

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{ ok: true; roadmap: { id: string; path: string }; commit: { sha: string; url: string } }>({
        path: `/api/admin/roadmaps/${encodeURIComponent(activeId)}`,
        method: "PUT",
        token: studio.token,
        body: { yaml: yamlText },
      });
      setNotice(`Saved: ${res.roadmap.id}`);
      setCommitUrl(res.commit.url);
      setDirty(false);
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Save failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, activeId, yamlText, refreshList]);

  const del = React.useCallback(async () => {
    if (!studio.token || !activeId) return;
    const ok = window.confirm(`Trash roadmap ${activeId}?`);
    if (!ok) return;
    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{ ok: true; commit: { sha: string; url: string } }>({
        path: `/api/admin/roadmaps/${encodeURIComponent(activeId)}`,
        method: "DELETE",
        token: studio.token,
      });
      setNotice("Trashed.");
      setCommitUrl(res.commit.url);
      setDirty(false);
      setActiveId(null);
      setYamlText("");
      setSelectedNodeId(null);
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Delete failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, activeId, refreshList]);

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
              disabled={listBusy}
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
              <div className="truncate text-sm font-semibold tracking-tight">{activeId ?? "Select a roadmap"}</div>
              {dirty ? <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span> : null}
            </div>
            {studio.me ? (
              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeId ? (
              <button
                type="button"
                onClick={() => void del()}
                disabled={!activeId || busy}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5 opacity-85" />
                Trash
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={!studio.token || busy || !activeId}
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition",
                !studio.token || busy || !activeId
                  ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                  : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
              ].join(" ")}
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              Save
            </button>
          </div>
        </div>

        {notice ? (
          <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-[hsl(var(--muted))]">{notice}</div>
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
