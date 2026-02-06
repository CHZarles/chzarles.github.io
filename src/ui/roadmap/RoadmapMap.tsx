import React from "react";
import type { Roadmap, RoadmapNode } from "../types";

type Layout = "vertical" | "horizontal";

type Pos = { x: number; y: number; w: number; h: number };

type Ext = { min: number; max: number; center: number };

type Edge = { from: string; to: string; kind: "tree" | "dep" | "trunk" };

type Line = { x1: number; y1: number; x2: number; y2: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hasChildren(n: RoadmapNode) {
  return Boolean(n.children?.length);
}

export function RoadmapMap(props: {
  roadmap: Roadmap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  layout?: Layout;
}) {
  const layout: Layout = props.layout ?? props.roadmap.layout ?? "vertical";

  const { nodes, positions, edges, canvasSize, trunkLine } = React.useMemo(() => {
    const map = new Map<string, Pos>();
    const outEdges: Edge[] = [];
    const nodes: Array<{ node: RoadmapNode; depth: number; parentId: string | null }> = [];

    const NODE_W = 240;
    const NODE_H = 54;
    const TOP_PAD = 84;
    const H_ROOT_X = 140;

    if (layout === "vertical") {
      const GAP_X = 320;
      const LEVEL_GAP = 148;
      const LEFT_X = 120;
      const TOP_Y = TOP_PAD;
      const SIBLING_GAP = 0.42;

      function place(node: RoadmapNode, depth: number, leftCol: number, parentId: string | null): Ext {
        const children = node.children ?? [];

        let ext: Ext;
        if (children.length === 0) {
          ext = { min: leftCol, max: leftCol, center: leftCol };
        } else {
          let cursor = leftCol;
          let first: Ext | null = null;
          let last: Ext | null = null;
          for (const child of children) {
            const childExt = place(child, depth + 1, cursor, node.id);
            if (!first) first = childExt;
            last = childExt;
            cursor = childExt.max + 1 + SIBLING_GAP;
            outEdges.push({ from: node.id, to: child.id, kind: "tree" });
          }
          const min = first!.min;
          const max = last!.max;
          ext = { min, max, center: (min + max) / 2 };
        }

        const x = LEFT_X + ext.center * GAP_X;
        const y = TOP_Y + depth * LEVEL_GAP;
        map.set(node.id, { x, y, w: NODE_W, h: NODE_H });
        nodes.push({ node, depth, parentId });

        for (const dep of node.edges ?? []) outEdges.push({ from: dep, to: node.id, kind: "dep" });
        return ext;
      }

      let cursor = 0;
      for (const root of props.roadmap.nodes ?? []) {
        const ext = place(root, 0, cursor, null);
        outEdges.push({ from: "__trunk__", to: root.id, kind: "trunk" });
        cursor = ext.max + 1.15;
      }
    } else {
      const GAP_X = 320;
      const GAP_Y = 86;
      const ROOT_X = H_ROOT_X;
      const TOP_Y = TOP_PAD;
      const SIBLING_GAP = 0.32;

      function place(node: RoadmapNode, depth: number, topRow: number, parentId: string | null): Ext {
        const children = node.children ?? [];

        let ext: Ext;
        if (children.length === 0) {
          ext = { min: topRow, max: topRow, center: topRow };
        } else {
          let cursor = topRow;
          let first: Ext | null = null;
          let last: Ext | null = null;
          for (const child of children) {
            const childExt = place(child, depth + 1, cursor, node.id);
            if (!first) first = childExt;
            last = childExt;
            cursor = childExt.max + 1 + SIBLING_GAP;
            outEdges.push({ from: node.id, to: child.id, kind: "tree" });
          }
          const min = first!.min;
          const max = last!.max;
          ext = { min, max, center: (min + max) / 2 };
        }

        const x = ROOT_X + depth * GAP_X;
        const y = TOP_Y + ext.center * GAP_Y;
        map.set(node.id, { x, y, w: NODE_W, h: NODE_H });
        nodes.push({ node, depth, parentId });

        for (const dep of node.edges ?? []) outEdges.push({ from: dep, to: node.id, kind: "dep" });
        return ext;
      }

      let cursor = 0;
      for (const root of props.roadmap.nodes ?? []) {
        const ext = place(root, 0, cursor, null);
        outEdges.push({ from: "__trunk__", to: root.id, kind: "trunk" });
        cursor = ext.max + 1.15;
      }
    }

    const rootPositions = (props.roadmap.nodes ?? [])
      .map((n) => map.get(n.id))
      .filter(Boolean) as Pos[];

    const trunkLine: Line = (() => {
      if (!rootPositions.length) return { x1: 0, y1: 0, x2: 0, y2: 0 };
      if (layout === "vertical") {
        const trunkY = TOP_PAD - 56;
        const minRootX = Math.min(...rootPositions.map((p) => p.x + p.w / 2)) - 56;
        const maxRootX = Math.max(...rootPositions.map((p) => p.x + p.w / 2)) + 56;
        return { x1: minRootX, y1: trunkY, x2: maxRootX, y2: trunkY };
      }
      const trunkX = H_ROOT_X - 72;
      const minRootY = Math.min(...rootPositions.map((p) => p.y + p.h / 2));
      const maxRootY = Math.max(...rootPositions.map((p) => p.y + p.h / 2));
      return { x1: trunkX, y1: minRootY, x2: trunkX, y2: maxRootY };
    })();

    // Filter dep edges to existing nodes
    const filteredEdges = outEdges.filter((e) => e.kind !== "dep" || (map.has(e.from) && map.has(e.to)));

    const maxX = Math.max(0, ...[...map.values()].map((p) => p.x + p.w));
    const maxY = Math.max(0, ...[...map.values()].map((p) => p.y + p.h));
    const canvasSize = { w: maxX + 120, h: maxY + 120 };

    return { nodes, positions: map, edges: filteredEdges, canvasSize, trunkLine };
  }, [props.roadmap, layout]);

  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!props.selectedId) return;
    const scroller = scrollerRef.current;
    const pos = positions.get(props.selectedId);
    if (!scroller || !pos) return;
    const targetLeft = pos.x + pos.w / 2 - scroller.clientWidth / 2;
    const targetTop = pos.y + pos.h / 2 - scroller.clientHeight / 2;
    const maxLeft = Math.max(0, canvasSize.w - scroller.clientWidth);
    const maxTop = Math.max(0, canvasSize.h - scroller.clientHeight);
    scroller.scrollTo({
      left: clamp(targetLeft, 0, maxLeft),
      top: clamp(targetTop, 0, maxTop),
      behavior: "smooth",
    });
  }, [props.selectedId, positions, canvasSize]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm font-semibold tracking-tight">Graph</div>
        <div className="text-xs text-[hsl(var(--muted))]">Scroll · Click</div>
      </div>
      <div className="hairline" />
      <div ref={scrollerRef} className="h-[70vh] overflow-auto">
        <div
          className="relative"
          style={{
            width: canvasSize.w,
            height: canvasSize.h,
            background:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, hsl(var(--border)) 55%, transparent) 1px, transparent 0) 0 0 / 22px 22px",
          }}
        >
          <svg className="absolute inset-0" width={canvasSize.w} height={canvasSize.h}>
            {/* trunk */}
            {trunkLine.x1 || trunkLine.x2 || trunkLine.y1 || trunkLine.y2 ? (
              <path
                d={`M ${trunkLine.x1} ${trunkLine.y1} L ${trunkLine.x2} ${trunkLine.y2}`}
                stroke="rgb(37 99 235)"
                strokeWidth={3}
                opacity={0.85}
              />
            ) : null}

            {edges.map((e, idx) => {
              if (e.kind === "trunk") {
                const b = positions.get(e.to);
                if (!b) return null;
                const x2 = b.x + b.w / 2;
                const y2 = b.y + b.h / 2;
                const { x1, y1 } =
                  layout === "vertical" ? { x1: x2, y1: trunkLine.y1 } : { x1: trunkLine.x1, y1: y2 };
                const { x3, y3 } =
                  layout === "vertical" ? { x3: x2, y3: b.y } : { x3: b.x, y3: y2 };
                const mid = layout === "vertical" ? (y1 + y3) / 2 : (x1 + x3) / 2;
                const d =
                  layout === "vertical"
                    ? `M ${x1} ${y1} C ${x1} ${mid}, ${x3} ${mid}, ${x3} ${y3}`
                    : `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y3}, ${x3} ${y3}`;
                const active = props.selectedId === e.to;
                return (
                  <path
                    key={`${e.kind}:${idx}`}
                    d={d}
                    fill="none"
                    stroke="rgb(37 99 235)"
                    strokeWidth={active ? 3.5 : 3}
                    opacity={active ? 0.95 : 0.75}
                  />
                );
              }

              const a = positions.get(e.from);
              const b = positions.get(e.to);
              if (!a || !b) return null;
              const centerAX = a.x + a.w / 2;
              const centerAY = a.y + a.h / 2;
              const centerBX = b.x + b.w / 2;
              const centerBY = b.y + b.h / 2;

              const { x1, y1, x2, y2, mid, d } = (() => {
                if (layout === "vertical") {
                  const fromAbove = a.y <= b.y;
                  const x1 = centerAX;
                  const y1 = e.kind === "dep" && !fromAbove ? a.y : a.y + a.h;
                  const x2 = centerBX;
                  const y2 = e.kind === "dep" && !fromAbove ? b.y + b.h : b.y;
                  const mid = (y1 + y2) / 2;
                  const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
                  return { x1, y1, x2, y2, mid, d };
                }
                const fromLeft = a.x <= b.x;
                const x1 = e.kind === "dep" && !fromLeft ? a.x : a.x + a.w;
                const y1 = centerAY;
                const x2 = e.kind === "dep" && !fromLeft ? b.x + b.w : b.x;
                const y2 = centerBY;
                const mid = (x1 + x2) / 2;
                const d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
                return { x1, y1, x2, y2, mid, d };
              })();
              const active = props.selectedId === e.from || props.selectedId === e.to;
              return (
                <path
                  key={`${e.kind}:${idx}`}
                  d={d}
                  fill="none"
                  stroke="rgb(37 99 235)"
                  strokeWidth={active ? 3.2 : 2.6}
                  strokeDasharray={e.kind === "dep" ? "3 8" : undefined}
                  opacity={e.kind === "dep" ? (active ? 0.75 : 0.45) : active ? 0.92 : 0.78}
                />
              );
            })}
          </svg>

          {nodes.map((item) => {
            const pos = positions.get(item.node.id)!;
            const selected = props.selectedId === item.node.id;
            const section = item.depth === 0 || hasChildren(item.node);
            return (
              <button
                key={item.node.id}
                type="button"
                onClick={() => props.onSelect(item.node.id)}
                className={[
                  "absolute grid place-items-center rounded-lg border-2 px-4 text-center transition-colors",
                  "border-[color-mix(in_oklab,hsl(var(--fg))_18%,hsl(var(--border)))]",
                  section
                    ? "bg-[color-mix(in_oklab,hsl(52_97%_80%)_88%,hsl(var(--card)))]"
                    : "bg-[color-mix(in_oklab,hsl(52_97%_92%)_55%,hsl(var(--card)))]",
                  selected
                    ? "ring-2 ring-[color-mix(in_oklab,hsl(var(--accent))_38%,transparent)] border-[hsl(var(--accent))]"
                    : "hover:bg-[hsl(var(--card2))]",
                ].join(" ")}
                style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
              >
                <span className={["text-sm", section ? "font-semibold" : "font-medium"].join(" ")}>
                  {item.node.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
