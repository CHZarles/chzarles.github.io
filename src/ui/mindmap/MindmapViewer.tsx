import React from "react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node, type ReactFlowInstance, type Viewport } from "reactflow";
import "reactflow/dist/style.css";
import { MindNode, type MindNodeData } from "../../studio/mindmap/MindNode";
import type { Mindmap } from "../types";

type MindNodeT = Node<MindNodeData>;
type MindEdgeT = Edge;

const NODE_TYPE = "mind";

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
    const id = typeof r.id === "string" && r.id.trim() ? r.id : null;
    if (!id) continue;
    const pos = asRecord(r.position) ?? {};
    const data = asRecord(r.data) ?? {};
    const label = typeof data.label === "string" && data.label.trim() ? String(data.label) : id;

    out.push({
      ...(r as any),
      id,
      type: typeof r.type === "string" ? (r.type as any) : NODE_TYPE,
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
    const id = typeof r.id === "string" && r.id.trim() ? r.id : null;
    const source = typeof r.source === "string" && r.source.trim() ? r.source : null;
    const target = typeof r.target === "string" && r.target.trim() ? r.target : null;
    if (!id || !source || !target) continue;
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

export function MindmapViewer(props: { mindmap: Mindmap }) {
  const nodes = React.useMemo(() => normalizeNodes(props.mindmap.nodes), [props.mindmap.nodes]);
  const edges = React.useMemo(() => normalizeEdges(props.mindmap.edges), [props.mindmap.edges]);
  const viewport = React.useMemo(() => normalizeViewport(props.mindmap.viewport), [props.mindmap.viewport]);

  const rfRef = React.useRef<ReactFlowInstance<MindNodeData> | null>(null);

  React.useEffect(() => {
    const rf = rfRef.current;
    if (!rf) return;
    rf.setViewport(viewport, { duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mindmap.id]);

  return (
    <div className="h-[70vh] min-h-[520px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ [NODE_TYPE]: MindNode }}
        onInit={(rf) => {
          rfRef.current = rf;
          rf.setViewport(viewport, { duration: 0 });
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        fitView
        defaultViewport={viewport}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-[hsl(var(--bg))]"
      >
        <Background variant="dots" gap={22} size={1} color="hsl(var(--border))" style={{ opacity: 0.35 }} />
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
  );
}

