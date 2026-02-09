import { Check, ExternalLink, Maximize2, Plus, RefreshCw, Trash2 } from "lucide-react";
import React from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type Viewport,
  type EdgeChange,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { publisherFetchJson } from "../../ui/publisher/client";
import { useStudioState } from "../state/StudioState";
import { MindNode, type MindNodeData } from "../mindmap/MindNode";

type MindmapInput = {
  id: string;
  title?: string;
  format?: string;
  nodes?: unknown[];
  edges?: unknown[];
  viewport?: unknown;
  updated?: string;
};

type MindmapsListResponse = {
  mindmaps: Array<{
    id: string;
    path: string;
    sha: string;
    size: number;
    meta?: { title?: string; updated?: string; format?: string; nodeCount?: number; edgeCount?: number };
  }>;
  paging: { after: string | null; nextAfter: string | null };
};

type MindmapGetResponse = {
  mindmap: { id: string; path: string; input: MindmapInput; json: string };
};

type Mode = "create" | "edit";

type MindNodeT = Node<MindNodeData>;
type MindEdgeT = Edge;

const NODE_TYPE = "mind";

function uid(prefix: string): string {
  const anyCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
  const uuid = anyCrypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeViewport(v: unknown): Viewport {
  const r = asRecord(v);
  if (!r) return { x: 0, y: 0, zoom: 1 };
  return { x: asNumber(r.x, 0), y: asNumber(r.y, 0), zoom: asNumber(r.zoom, 1) };
}

function normalizeNodes(raw: unknown[] | undefined): MindNodeT[] {
  if (!Array.isArray(raw)) return [];
  const out: MindNodeT[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    if (!r) continue;
    const id = typeof r.id === "string" && r.id.trim() ? r.id : uid("n");
    const pos = asRecord(r.position) ?? {};
    const data = asRecord(r.data) ?? {};
    const label =
      typeof data.label === "string" && data.label.trim()
        ? String(data.label)
        : typeof (r as any).label === "string"
          ? String((r as any).label)
          : id;

    out.push({
      ...(r as any),
      id,
      type: NODE_TYPE,
      position: { x: asNumber(pos.x, 0), y: asNumber(pos.y, 0) },
      data: { ...(data as any), label },
    } as MindNodeT);
  }
  return out;
}

function normalizeEdges(raw: unknown[] | undefined): MindEdgeT[] {
  if (!Array.isArray(raw)) return [];
  const out: MindEdgeT[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    if (!r) continue;
    const source = typeof r.source === "string" ? r.source : null;
    const target = typeof r.target === "string" ? r.target : null;
    if (!source || !target) continue;
    const id = typeof r.id === "string" && r.id.trim() ? r.id : uid("e");
    out.push({
      ...(r as any),
      id,
      source,
      target,
      type: typeof r.type === "string" ? (r.type as any) : "smoothstep",
    } as MindEdgeT);
  }
  return out;
}

function persistNodes(nodes: MindNodeT[]): unknown[] {
  return nodes.map((n) => {
    const any = n as any;
    const { selected: _selected, dragging: _dragging, width: _width, height: _height, positionAbsolute: _pa, ...rest } = any;
    return rest;
  });
}

function persistEdges(edges: MindEdgeT[]): unknown[] {
  return edges.map((e) => {
    const any = e as any;
    const { selected: _selected, ...rest } = any;
    return rest;
  });
}

function fitToMindmapId(input: string): string | null {
  const v = String(input ?? "").trim().toLowerCase();
  if (!v) return null;
  if (!/^[a-z0-9-]{2,80}$/.test(v)) return null;
  return v;
}

function buildNewMindmap(id: string): { nodes: MindNodeT[]; edges: MindEdgeT[]; viewport: Viewport } {
  const rootId = uid("n");
  return {
    nodes: [
      {
        id: rootId,
        type: NODE_TYPE,
        position: { x: 0, y: 0 },
        data: { label: "Root" },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function StudioMindmapsPage() {
  const studio = useStudioState();

  // list
  const [mindmaps, setMindmaps] = React.useState<MindmapsListResponse["mindmaps"]>([]);
  const [paging, setPaging] = React.useState<MindmapsListResponse["paging"]>({ after: null, nextAfter: null });
  const [filter, setFilter] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  // editor
  const [mode, setMode] = React.useState<Mode>("create");
  const [mindmapId, setMindmapId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<MindNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const rfRef = React.useRef<ReactFlowInstance<MindNodeData> | null>(null);

  const refreshList = React.useCallback(
    async (opts?: { append?: boolean }) => {
      if (!studio.token) return;
      setListBusy(true);
      setListError(null);
      try {
        const url = new URL("/api/admin/mindmaps", "http://local");
        url.searchParams.set("include", "meta");
        url.searchParams.set("limit", "50");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const res = await publisherFetchJson<MindmapsListResponse>({ path: url.pathname + url.search, token: studio.token });
        setMindmaps((prev) => (opts?.append ? [...prev, ...res.mindmaps] : res.mindmaps));
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
    if (!q) return mindmaps;
    return mindmaps.filter((m) => m.id.toLowerCase().includes(q) || (m.meta?.title ?? "").toLowerCase().includes(q));
  }, [mindmaps, filter]);

  const setViewport = React.useCallback((v: Viewport) => {
    const rf = rfRef.current;
    if (!rf) return;
    rf.setViewport(v, { duration: 0 });
  }, []);

  const centerPosition = React.useCallback((): { x: number; y: number } => {
    const rf = rfRef.current;
    const el = wrapperRef.current;
    if (!rf || !el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, []);

  const addNode = React.useCallback(
    (args?: { at?: { x: number; y: number }; connectFrom?: string | null }) => {
      const nid = uid("n");
      const pos = args?.at ?? centerPosition();
      const node: MindNodeT = { id: nid, type: NODE_TYPE, position: pos, data: { label: "New node" } };
      setNodes((prev) => [...prev, node]);
      const source = args?.connectFrom ?? null;
      if (source) {
        setEdges((prev) => [
          ...prev,
          { id: uid("e"), source, target: nid, type: "smoothstep" },
        ]);
      }
      setSelectedNodeId(nid);
      setDirty(true);
    },
    [centerPosition, setEdges, setNodes],
  );

  const newMindmap = React.useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const raw = window.prompt("Mindmap id (a-z0-9-)", "");
    const id = fitToMindmapId(raw ?? "");
    if (!id) return;
    setMode("create");
    setMindmapId(id);
    setTitle("");
    const fresh = buildNewMindmap(id);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelectedNodeId(fresh.nodes[0]?.id ?? null);
    setDirty(true);
    setNotice(null);
    setCommitUrl(null);
    requestAnimationFrame(() => setViewport(fresh.viewport));
  }, [dirty, setEdges, setNodes, setViewport]);

  const openMindmap = React.useCallback(
    async (id: string) => {
      if (!studio.token) return;
      if (dirty && !window.confirm("Discard unsaved changes?")) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherFetchJson<MindmapGetResponse>({
          path: `/api/admin/mindmaps/${encodeURIComponent(id)}`,
          token: studio.token,
        });
        const input = res.mindmap.input;
        setMode("edit");
        setMindmapId(res.mindmap.id);
        setTitle(input.title ?? "");

        const nextNodes = normalizeNodes(input.nodes);
        const nextEdges = normalizeEdges(input.edges);
        const nextViewport = normalizeViewport(input.viewport);

        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNodeId(nextNodes[0]?.id ?? null);
        setDirty(false);
        requestAnimationFrame(() => setViewport(nextViewport));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Open failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [studio.token, dirty, setEdges, setNodes, setViewport],
  );

  const save = React.useCallback(async () => {
    if (!studio.token) return;
    const id = fitToMindmapId(mindmapId);
    if (!id) {
      setNotice("Missing or invalid mindmap id.");
      return;
    }

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const viewport = rfRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
      const payload: MindmapInput = {
        id,
        title: title.trim() || undefined,
        format: "reactflow",
        nodes: persistNodes(nodes as MindNodeT[]),
        edges: persistEdges(edges as MindEdgeT[]),
        viewport,
      };

      if (mode === "create") {
        const res = await publisherFetchJson<{
          mindmap: { id: string; path: string };
          commit: { sha: string; url: string };
        }>({ path: "/api/admin/mindmaps", method: "POST", token: studio.token, body: payload });
        setMode("edit");
        setNotice(`Published: ${res.mindmap.id}`);
        setCommitUrl(res.commit.url);
      } else {
        const res = await publisherFetchJson<{
          mindmap: { id: string; path: string };
          commit: { sha: string; url: string };
        }>({ path: `/api/admin/mindmaps/${encodeURIComponent(id)}`, method: "PATCH", token: studio.token, body: payload });
        setNotice(`Saved: ${res.mindmap.id}`);
        setCommitUrl(res.commit.url);
      }

      setDirty(false);
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Save failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, mode, mindmapId, title, nodes, edges, refreshList]);

  const del = React.useCallback(async () => {
    if (!studio.token) return;
    const id = fitToMindmapId(mindmapId);
    if (!id) return;
    const ok = window.confirm(`Trash mindmap ${id}?`);
    if (!ok) return;

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{ ok: true; commit: { sha: string; url: string } }>({
        path: `/api/admin/mindmaps/${encodeURIComponent(id)}`,
        method: "DELETE",
        token: studio.token,
      });
      setNotice("Trashed.");
      setCommitUrl(res.commit.url);
      setMode("create");
      setMindmapId("");
      setTitle("");
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setDirty(false);
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Delete failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, mindmapId, setEdges, setNodes, refreshList]);

  const onNodesChangeDirty = React.useCallback(
    (changes: NodeChange[]) => {
      const isPersisted = (c: NodeChange) => c.type !== "select" && c.type !== "dimensions";
      if (changes.some(isPersisted)) setDirty(true);
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  const onEdgesChangeDirty = React.useCallback(
    (changes: EdgeChange[]) => {
      const isPersisted = (c: EdgeChange) => c.type !== "select";
      if (changes.some(isPersisted)) setDirty(true);
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const onConnect = React.useCallback(
    (conn: Connection) => {
      setDirty(true);
      setEdges((eds) => addEdge({ ...conn, type: "smoothstep" }, eds));
    },
    [setEdges],
  );

  const deleteSelectedNode = React.useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) => prev.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    setDirty(true);
  }, [selectedNodeId, setEdges, setNodes]);

  const selectedNode = React.useMemo(() => {
    if (!selectedNodeId) return null;
    return (nodes as MindNodeT[]).find((n) => n.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

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

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">MINDMAPS</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={newMindmap}
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
            {filtered.map((m) => {
              const active = mode === "edit" && mindmapId === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => void openMindmap(m.id)}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left transition",
                      active ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                    ].join(" ")}
                  >
                    <div className="truncate text-sm font-medium tracking-tight">{m.meta?.title ?? m.id}</div>
                    <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                      {m.id}
                      {m.meta?.updated ? ` · ${m.meta.updated}` : ""}
                    </div>
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
              <div className="truncate text-sm font-semibold tracking-tight">{mindmapId || "Mindmap"}</div>
              {dirty ? <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span> : null}
            </div>
            {studio.me ? (
              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => addNode({ connectFrom: selectedNodeId })}
              disabled={busy || !mindmapId}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Add node (double click background also works)"
            >
              <Plus className="h-3.5 w-3.5 opacity-85" />
              Node
            </button>
            <button
              type="button"
              onClick={() => rfRef.current?.fitView({ padding: 0.22, duration: 160 })}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Fit view"
            >
              <Maximize2 className="h-3.5 w-3.5 opacity-85" />
              Fit
            </button>

            {mode === "edit" ? (
              <button
                type="button"
                onClick={() => void del()}
                disabled={!mindmapId || busy}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5 opacity-85" />
                Trash
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void save()}
              disabled={!studio.token || busy || !mindmapId}
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition",
                !studio.token || busy || !mindmapId
                  ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                  : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
              ].join(" ")}
              title="Save (⌘S / Ctrl+S)"
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              {mode === "create" ? "Publish" : "Save"}
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

        <div ref={wrapperRef} className="h-full min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={{ [NODE_TYPE]: MindNode }}
            onInit={(rf) => {
              rfRef.current = rf;
            }}
            onNodesChange={onNodesChangeDirty}
            onEdgesChange={onEdgesChangeDirty}
            onConnect={onConnect}
            onSelectionChange={({ nodes }) => {
              setSelectedNodeId(nodes?.[0]?.id ?? null);
            }}
            onPaneClick={(e: React.MouseEvent) => {
              if (e.detail !== 2) return;
              const rf = rfRef.current;
              if (!rf) return;
              addNode({
                at: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
                connectFrom: selectedNodeId,
              });
            }}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.1}
            maxZoom={2}
            snapToGrid
            snapGrid={[14, 14]}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
            className="bg-[hsl(var(--bg))]"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1}
              color="hsl(var(--border))"
              style={{ opacity: 0.35 }}
            />
            <MiniMap
              pannable
              zoomable
              className="!m-3 !rounded-2xl !border !border-[hsl(var(--border))] !bg-[hsl(var(--card))]"
              nodeColor={() => "hsl(var(--card2))"}
              maskColor="rgba(0,0,0,0.08)"
            />
            <Controls className="!m-3 !rounded-2xl !border !border-[hsl(var(--border))] !bg-[hsl(var(--card))]" />
          </ReactFlow>
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-auto bg-[hsl(var(--card))] lg:block">
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">PROPERTIES</div>
        </div>

        <div className="grid gap-4 px-4 py-4">
          <Field label="Mindmap id">
            <input value={mindmapId} onChange={(e) => setMindmapId(e.target.value)} className={inputClass} disabled={mode !== "create"} />
          </Field>
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              className={inputClass}
              placeholder="Optional"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2">
              <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">NODES</div>
              <div className="mt-1 text-sm font-medium">{nodes.length}</div>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2">
              <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">EDGES</div>
              <div className="mt-1 text-sm font-medium">{edges.length}</div>
            </div>
          </div>

          {selectedNode ? (
            <div className="card p-4">
              <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">SELECTED NODE</div>
              <div className="mt-2 grid gap-3">
                <Field label="Label">
                  <textarea
                    value={String((selectedNode.data as any)?.label ?? "")}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDirty(true);
                      setNodes((prev) =>
                        prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...(n.data as any), label: next } } : n)),
                      );
                    }}
                    rows={3}
                    className={textareaClass}
                    placeholder="Node label"
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addNode({ connectFrom: selectedNode.id })}
                    className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                  >
                    <Plus className="h-3.5 w-3.5 opacity-85" />
                    Add child
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedNode}
                    className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                  >
                    <Trash2 className="h-3.5 w-3.5 opacity-85" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-xs text-[hsl(var(--muted))]">
              Select a node to edit its label. Tip: double-click canvas to add nodes.
            </div>
          )}
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

const inputClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60";

const textareaClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]";
