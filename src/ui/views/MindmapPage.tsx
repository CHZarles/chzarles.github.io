import { ArrowLeft } from "lucide-react";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { SectionHeader } from "../components/SectionHeader";
import { MindmapViewer } from "../mindmap/MindmapViewer";
import type { Mindmap } from "../types";

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function MindmapPage() {
  const { mindmapId } = useParams();
  const [mindmap, setMindmap] = React.useState<Mindmap | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!mindmapId) return;
    let cancelled = false;
    setMindmap(null);
    setError(null);
    api
      .mindmap(mindmapId)
      .then((m) => {
        if (cancelled) return;
        setMindmap(m);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [mindmapId]);

  if (error) {
    return (
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
        <div className="mt-2 break-words">{error}</div>
        <div className="mt-5">
          <Link
            to="/mindmaps"
            className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]"
          >
            <ArrowLeft className="h-4 w-4 opacity-80" />
            返回 Mindmaps
          </Link>
        </div>
      </div>
    );
  }

  if (!mindmap || !mindmapId) {
    return <div className="card p-8 text-sm text-[hsl(var(--muted))]">加载中…</div>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/mindmaps"
          className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] hover:text-[hsl(var(--fg))]"
        >
          <ArrowLeft className="h-4 w-4 opacity-80" />
          返回 Mindmaps
        </Link>
        <span className="text-xs text-[hsl(var(--muted))]">Updated · {fmtDate(mindmap.updated)}</span>
      </div>

      <SectionHeader
        title={mindmap.title}
        desc={`/${mindmap.id}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Chip label={`${Array.isArray(mindmap.nodes) ? mindmap.nodes.length : 0} nodes`} tone="glass" />
            <Chip label={`${Array.isArray(mindmap.edges) ? mindmap.edges.length : 0} edges`} tone="glass" />
          </div>
        }
      />

      <div className="card overflow-hidden">
        <MindmapViewer mindmap={mindmap} />
      </div>
    </div>
  );
}

