import { ArrowUpRight, GitBranch } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { SectionHeader } from "../components/SectionHeader";
import type { Project } from "../types";

export function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .projects()
      .then((p) => {
        if (cancelled) return;
        setProjects(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <SectionHeader title="Projects" desc="GitHub 作品集入口：可被 Roadmap 节点引用，成为能力证据。" />

      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="group card p-6 transition-colors hover:bg-[hsl(var(--card2))]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)]">
                    <GitBranch className="h-4 w-4 opacity-80" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold tracking-tight">{p.name}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-[hsl(var(--muted))]">{p.description}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(p.stack ?? []).slice(0, 4).map((s) => (
                    <Chip key={s} label={s} tone="glass" />
                  ))}
                </div>
              </div>
              <ArrowUpRight className="mt-1 h-4 w-4 opacity-50 transition group-hover:opacity-80" />
            </div>
          </Link>
        ))}
        {projects.length === 0 ? (
          <div className="card p-7 text-sm text-[hsl(var(--muted))]">暂无项目（在 `content/projects.json` 填充即可）</div>
        ) : null}
      </div>
    </div>
  );
}
