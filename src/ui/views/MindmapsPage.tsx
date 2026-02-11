import { ArrowUpRight, Network } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { EmptyStatePanel } from "../components/EmptyStatePanel";
import { SectionHeader } from "../components/SectionHeader";
import type { MindmapListItem } from "../types";

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function MindmapsPage() {
  const [mindmaps, setMindmaps] = React.useState<MindmapListItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    api
      .mindmaps()
      .then((m) => {
        if (cancelled) return;
        setMindmaps(m);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <SectionHeader
        title="Mindmaps"
        desc="自由结构的知识图谱：表达结构、因果、架构与决策链路。"
        right={<Chip label="ReactFlow JSON" tone="glass" />}
      />

      {error ? (
        <div className="card p-8 text-sm text-[hsl(var(--muted))]">
          <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
          <div className="mt-2 break-words">{error}</div>
        </div>
      ) : null}

      {error ? null : loading ? (
        <div className="card p-7 text-sm text-[hsl(var(--muted))]">加载中…</div>
      ) : mindmaps.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {mindmaps.map((m) => (
            <Link
              key={m.id}
              to={`/mindmaps/${m.id}`}
              className="group card p-6 transition-colors hover:bg-[hsl(var(--card2))]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted)]">
                      <Network className="h-4 w-4 opacity-80" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold tracking-tight">{m.title}</div>
                      <div className="mt-1 truncate text-sm text-[hsl(var(--muted))]">Updated · {fmtDate(m.updated)}</div>
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 opacity-50 transition group-hover:opacity-80" />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Chip label={`/${m.id}`} tone="muted" />
                <Chip label={`${m.nodeCount ?? 0} nodes`} tone="glass" />
                <Chip label={`${m.edgeCount ?? 0} edges`} tone="glass" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyStatePanel
          icon={<Network className="h-5 w-5 opacity-85" />}
          title="Mindmaps 还空着"
          desc="当你需要表达结构与依赖关系时，用 Mindmap 来写：节点 + 连线，比段落更直观。"
          hint="敬请期待。"
        />
      )}
    </div>
  );
}
