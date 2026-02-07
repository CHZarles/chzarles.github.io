import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

export type MindNodeData = { label: string };

export function MindNode(props: NodeProps<MindNodeData>) {
  const label = typeof props.data?.label === "string" ? props.data.label : String(props.id);
  const selected = Boolean(props.selected);

  return (
    <div
      className={[
        "relative rounded-2xl border px-3 py-2 shadow-sm backdrop-blur-[2px]",
        selected
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_6%,hsl(var(--card)))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))]",
      ].join(" ")}
    >
      <Handle className="h-2.5 w-2.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card2))]" type="target" position={Position.Left} />
      <Handle className="h-2.5 w-2.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card2))]" type="source" position={Position.Right} />
      <div className="max-w-[220px] whitespace-pre-wrap break-words text-sm font-medium leading-5 tracking-tight text-[hsl(var(--fg))]">
        {label}
      </div>
    </div>
  );
}

