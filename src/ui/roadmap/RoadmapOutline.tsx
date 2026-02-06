import React from "react";
import type { RoadmapNode } from "../types";

function NodeItem(props: {
  node: RoadmapNode;
  level: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(props.level < 1);
  const hasChildren = Boolean(props.node.children?.length);
  const selected = props.selectedId === props.node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => props.onSelect(props.node.id)}
        className={[
          "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition",
          selected
            ? "bg-[color-mix(in_oklab,hsl(var(--accent))_14%,transparent)]"
            : "hover:bg-[color-mix(in_oklab,hsl(var(--card2))_75%,transparent)]",
        ].join(" ")}
        style={{ paddingLeft: 12 + props.level * 12 }}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{props.node.title}</span>
        </span>
        <span className="flex items-center gap-2">
          {hasChildren ? (
            <span
              className="kbd"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen((v) => !v);
              }}
            >
              {open ? "−" : "+"}
            </span>
          ) : null}
        </span>
      </button>
      {hasChildren && open ? (
        <div className="mt-1 grid gap-1">
          {props.node.children!.map((c) => (
            <NodeItem
              key={c.id}
              node={c}
              level={props.level + 1}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RoadmapOutline(props: {
  nodes: RoadmapNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-1">
      {props.nodes.map((n) => (
        <NodeItem
          key={n.id}
          node={n}
          level={0}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
        />
      ))}
    </div>
  );
}
