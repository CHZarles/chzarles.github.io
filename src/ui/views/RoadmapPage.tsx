import { ArrowDownUp, ArrowLeft, ArrowLeftRight, LayoutList, X } from "lucide-react";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { NoteCard } from "../components/NoteCard";
import { SectionHeader } from "../components/SectionHeader";
import { RoadmapMap } from "../roadmap/RoadmapMap";
import { RoadmapOutline } from "../roadmap/RoadmapOutline";
import type { NoteListItem, Roadmap, RoadmapNodeDetail } from "../types";

function orderNotes(notes: NoteListItem[], pinned?: string[]) {
  if (!pinned?.length) return notes;
  const pinSet = new Set(pinned);
  const pinnedNotes = notes.filter((n) => pinSet.has(n.id));
  const rest = notes.filter((n) => !pinSet.has(n.id));
  return [...pinnedNotes, ...rest];
}

function findNodePath(
  nodes: Roadmap["nodes"],
  targetId: string,
  path: Array<{ id: string; title: string }> = [],
): Array<{ id: string; title: string }> | null {
  for (const n of nodes ?? []) {
    const next = [...path, { id: n.id, title: n.title }];
    if (n.id === targetId) return next;
    if (n.children?.length) {
      const found = findNodePath(n.children, targetId, next);
      if (found) return found;
    }
  }
  return null;
}

export function RoadmapPage() {
  const { roadmapId } = useParams();
  const [roadmap, setRoadmap] = React.useState<Roadmap | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = React.useState<RoadmapNodeDetail | null>(null);
  const [nodeLoading, setNodeLoading] = React.useState(false);
  const [nodeError, setNodeError] = React.useState<string | null>(null);
  const [nodeReq, setNodeReq] = React.useState(0);
  const [latest, setLatest] = React.useState<NoteListItem[]>([]);
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const [layout, setLayout] = React.useState<"vertical" | "horizontal">("horizontal");

  React.useEffect(() => {
    if (!roadmapId) return;
    let cancelled = false;
    setError(null);
    setRoadmap(null);
    api
      .roadmap(roadmapId)
      .then((r) => {
        if (cancelled) return;
        setRoadmap(r);
        setSelected(r.nodes?.[0]?.id ?? null);
        setLayout("horizontal");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      });
    api
      .notes({ roadmap: roadmapId })
      .then((n) => {
        if (cancelled) return;
        setLatest(n.slice(0, 4));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [roadmapId]);

  React.useEffect(() => {
    if (!roadmapId || !selected) return;
    let cancelled = false;
    setNodeLoading(true);
    setNodeDetail(null);
    setNodeError(null);
    api
      .node(roadmapId, selected)
      .then((d) => {
        if (cancelled) return;
        setNodeDetail(d);
        setNodeLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setNodeDetail(null);
        const message = err instanceof Error ? err.message : "Unknown error";
        setNodeError(message);
        setNodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roadmapId, selected, nodeReq]);

  const selectedNode = nodeDetail?.node;
  const selectedPathFromFile = React.useMemo(() => {
    if (!roadmap || !selected) return null;
    return findNodePath(roadmap.nodes ?? [], selected);
  }, [roadmap, selected]);

  const selectedFromFile = selectedPathFromFile ? selectedPathFromFile[selectedPathFromFile.length - 1] : null;
  const selectedTitle = selectedNode?.title ?? selectedFromFile?.title ?? "—";
  const selectedCrumbsFromApi = selectedNode?.crumbs?.map((c) => c.title)?.join(" / ");
  const selectedCrumbsFromFile = selectedPathFromFile?.map((c) => c.title)?.join(" / ");
  const selectedCrumbs = selectedCrumbsFromApi ?? selectedCrumbsFromFile;
  const selectedNotes = React.useMemo(() => {
    const notes = nodeDetail?.notes;
    if (!Array.isArray(notes)) return [];
    const pinned = Array.isArray(nodeDetail?.node?.pinned) ? nodeDetail?.node?.pinned : undefined;
    return orderNotes(notes, pinned);
  }, [nodeDetail]);

  if (error) {
    return (
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
        <div className="mt-2 break-words">{error}</div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            to="/roadmaps"
            className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]"
          >
            <ArrowLeft className="h-4 w-4 opacity-80" />
            返回 Roadmaps
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm transition hover:bg-[hsl(var(--card2))]"
          >
            刷新
          </button>
        </div>
      </div>
    );
  }

  if (!roadmap || !roadmapId) {
    return <div className="card p-8 text-sm text-[hsl(var(--muted))]">加载中…</div>;
  }

  const outlinePanel = (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-3">
        <div className="text-sm font-semibold tracking-tight">Outline</div>
        <button
          type="button"
          onClick={() => setOutlineOpen(false)}
          className="lg:hidden inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 transition hover:bg-[hsl(var(--card2))]"
          aria-label="Close outline"
        >
          <X className="h-4 w-4 opacity-75" />
        </button>
      </div>
      <div className="hairline mb-3" />
      <RoadmapOutline
        nodes={roadmap.nodes ?? []}
        selectedId={selected}
        onSelect={(id) => {
          setSelected(id);
          if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
            setOutlineOpen(false);
          }
        }}
      />
    </div>
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/roadmaps"
          className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] hover:text-[hsl(var(--fg))]"
        >
          <ArrowLeft className="h-4 w-4 opacity-80" />
          返回 Roadmaps
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOutlineOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm text-[hsl(var(--fg))] transition hover:bg-[hsl(var(--card2))]"
          >
            <LayoutList className="h-4 w-4 opacity-80" />
            {outlineOpen ? "Hide outline" : "Show outline"}
          </button>
          <button
            type="button"
            onClick={() => setLayout((v) => (v === "vertical" ? "horizontal" : "vertical"))}
            className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm text-[hsl(var(--fg))] transition hover:bg-[hsl(var(--card2))]"
            aria-label="Toggle layout"
            title="Toggle layout"
          >
            {layout === "vertical" ? (
              <>
                <ArrowDownUp className="h-4 w-4 opacity-80" />
                Vertical
              </>
            ) : (
              <>
                <ArrowLeftRight className="h-4 w-4 opacity-80" />
                Horizontal
              </>
            )}
          </button>
        </div>
      </div>

      <SectionHeader
        title={roadmap.title}
        desc={roadmap.description ?? "Roadmap-as-File：用文件写目录，用 UI 变成可探索入口。"}
        right={<Chip label={`/${roadmap.id}`} tone="glass" />}
      />

      {outlineOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOutlineOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[360px] max-w-[92vw] overflow-auto bg-[hsl(var(--bg))] p-4">
            {outlinePanel}
          </div>
        </div>
      ) : null}

      <div className={outlineOpen ? "grid gap-3 lg:grid-cols-[360px_1fr] lg:items-start" : "grid gap-3"}>
        {outlineOpen ? <div className="hidden lg:block">{outlinePanel}</div> : null}

        <div className="grid gap-3">
          <RoadmapMap roadmap={roadmap} layout={layout} selectedId={selected} onSelect={setSelected} />

          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[hsl(var(--muted))]">Selected Node</div>
                <div className="mt-1 text-lg font-semibold tracking-tight">{selectedTitle}</div>
                {selectedCrumbs ? <div className="mt-2 text-sm text-[hsl(var(--muted))]">{selectedCrumbs}</div> : null}
              </div>
              <div className="flex items-center gap-2">
                {nodeLoading ? (
                  <Chip label="Loading…" tone="glass" />
                ) : nodeError ? (
                  <Chip label="Error" tone="glass" />
                ) : nodeDetail ? (
                  <Chip label={`${selectedNotes.length} notes`} tone="glass" />
                ) : null}
              </div>
            </div>
            {selectedNode?.description ? (
              <p className="mt-4 text-sm leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_72%,hsl(var(--muted)))]">
                {selectedNode.description}
              </p>
            ) : null}
            <div className="mt-5 hairline" />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-[hsl(var(--muted))]">Dependencies</div>
                <div className="mt-2 grid gap-2">
                  {nodeLoading ? (
                    <div className="text-sm text-[hsl(var(--muted))]">加载中…</div>
                  ) : nodeError ? (
                    <div className="text-sm text-[color-mix(in_oklab,hsl(var(--accent))_62%,hsl(var(--muted)))] break-words">
                      {nodeError}
                    </div>
                  ) : selectedNode?.dependencies?.length ? (
                    selectedNode.dependencies.slice(0, 6).map((d) => (
                      <button
                        key={d.nodeId}
                        type="button"
                        onClick={() => setSelected(d.nodeId)}
                        className="text-left rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_65%,transparent)] px-3 py-2 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))]"
                      >
                        {d.title}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[hsl(var(--muted))]">—</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--muted))]">Children</div>
                <div className="mt-2 grid gap-2">
                  {nodeLoading ? (
                    <div className="text-sm text-[hsl(var(--muted))]">加载中…</div>
                  ) : nodeError ? (
                    <div className="text-sm text-[color-mix(in_oklab,hsl(var(--accent))_62%,hsl(var(--muted)))] break-words">
                      {nodeError}
                    </div>
                  ) : selectedNode?.children?.length ? (
                    selectedNode.children.slice(0, 6).map((c) => (
                      <button
                        key={c.nodeId}
                        type="button"
                        onClick={() => setSelected(c.nodeId)}
                        className="text-left rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_65%,transparent)] px-3 py-2 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))]"
                      >
                        {c.title}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[hsl(var(--muted))]">—</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[hsl(var(--muted))]">Notes in this node</div>
                <div className="mt-1 text-lg font-semibold tracking-tight">{selectedTitle}</div>
                {selectedCrumbs ? <div className="mt-2 text-sm text-[hsl(var(--muted))]">{selectedCrumbs}</div> : null}
              </div>
              {roadmapId && selected ? (
                <div className="flex items-center gap-2">
                  <Chip label={nodeLoading ? "Loading…" : nodeError ? "Error" : `${selectedNotes.length} notes`} tone="glass" />
                  <Chip label="Node page" to={`/roadmaps/${roadmapId}/node/${selected}`} tone="glass" />
                </div>
              ) : null}
            </div>
            <div className="mt-5 hairline" />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {nodeLoading ? (
                <div className="card p-6 text-sm text-[hsl(var(--muted))]">加载该节点的 Notes…</div>
              ) : nodeError ? (
                <div className="card p-6 text-sm text-[hsl(var(--muted))]">
                  <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
                  <div className="mt-2 break-words">{nodeError}</div>
                  <button
                    type="button"
                    onClick={() => setNodeReq((v) => v + 1)}
                    className="mt-4 inline-flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm transition hover:bg-[hsl(var(--card2))]"
                  >
                    重试
                  </button>
                </div>
              ) : selectedNotes.length ? (
                selectedNotes.map((n) => <NoteCard key={n.id} note={n} />)
              ) : (
                <div className="card p-6 text-sm text-[hsl(var(--muted))]">这个节点还没有挂载 Notes。</div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <SectionHeader title="Latest Notes in this Roadmap" desc="聚合在此 Roadmap 下的最近更新内容。" />
            <div className="grid gap-3 md:grid-cols-2">
              {latest.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
              {latest.length === 0 ? (
                <div className="card p-6 text-sm text-[hsl(var(--muted))]">还没有挂载到该 Roadmap 的 Notes。</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
