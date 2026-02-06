import { ArrowUpRight, Compass } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { SectionHeader } from "../components/SectionHeader";
import type { RoadmapListItem } from "../types";

export function RoadmapsPage() {
  const [roadmaps, setRoadmaps] = React.useState<RoadmapListItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .roadmaps()
      .then((r) => {
        if (cancelled) return;
        setRoadmaps(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <SectionHeader
        title="Roadmaps"
        desc="你写 Roadmap 文件；UI 负责渲染与聚合 Notes。每个节点都是入口。"
        right={<Chip label="Outline + Map" tone="accent" />}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {roadmaps.map((r) => (
          <Link key={r.id} to={`/roadmaps/${r.id}`} className="group card p-6 transition-colors hover:bg-[hsl(var(--card2))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)]">
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
                <div className="mt-2 h-2 overflow-hidden rounded-full border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_65%,transparent)]">
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

        {roadmaps.length === 0 ? (
          <div className="card p-7 text-sm text-[hsl(var(--muted))]">
            暂无 Roadmap。创建 `content/roadmaps/*.yml` 即可看到渲染效果。
          </div>
        ) : null}
      </div>
    </div>
  );
}
