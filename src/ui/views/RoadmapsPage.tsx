import { ArrowUpRight, Compass } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { EmptyStatePanel } from "../components/EmptyStatePanel";
import { SectionHeader } from "../components/SectionHeader";
import type { RoadmapListItem } from "../types";

export function RoadmapsPage() {
  const [roadmaps, setRoadmaps] = React.useState<RoadmapListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .roadmaps()
      .then((r) => {
        if (cancelled) return;
        setRoadmaps(r);
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
        title="Roadmaps"
        desc="文件驱动的技术路线图：图谱渲染，节点自动聚合文章。"
        right={<Chip label="Outline + Map" tone="accent" />}
      />

      {error ? (
        <div className="card p-8 text-sm text-[hsl(var(--muted))]">
          <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
          <div className="mt-2 break-words">{error}</div>
        </div>
      ) : loading ? (
        <div className="card p-7 text-sm text-[hsl(var(--muted))]">加载中…</div>
      ) : roadmaps.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {roadmaps.map((r) => (
            <Link key={r.id} to={`/roadmaps/${r.id}`} className="group card p-6 transition-colors hover:bg-[hsl(var(--card2))]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted)]">
                      <Compass className="h-4 w-4 opacity-80" />
                    </span>
                    <div>
                      <div className="text-base font-semibold tracking-tight">{r.title}</div>
                      <div className="mt-1 text-sm text-[hsl(var(--muted))]">{r.description ?? `/${r.id}`}</div>
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 opacity-50 transition group-hover:opacity-80" />
              </div>
              {r.progress ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-[hsl(var(--muted))]">
                    <span>Progress</span>
                    <span>
                      {r.progress.done}/{r.progress.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)]">
                    <div
                      className="h-full bg-[color-mix(in_oklab,hsl(var(--accent))_65%,transparent)]"
                      style={{
                        width:
                          r.progress.total > 0 ? `${Math.round((r.progress.done / r.progress.total) * 100)}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyStatePanel
          icon={<Compass className="h-5 w-5 opacity-85" />}
          title="Roadmaps 还空着"
          desc="用一份文件定义路线；站点把它渲染成图，并让每个节点成为文章入口。"
          hint="敬请期待。"
        />
      )}
    </div>
  );
}
