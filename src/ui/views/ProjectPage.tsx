import { ArrowLeft, ExternalLink, Github } from "lucide-react";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { SectionHeader } from "../components/SectionHeader";
import type { Project } from "../types";

export function ProjectPage() {
  const { projectId } = useParams();
  const [project, setProject] = React.useState<Project | null>(null);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api
      .project(projectId)
      .then((p) => {
        if (cancelled) return;
        setProject(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!project) {
    return <div className="card p-8 text-sm text-[hsl(var(--muted))]">加载中…</div>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] hover:text-[hsl(var(--fg))]"
        >
          <ArrowLeft className="h-4 w-4 opacity-80" />
          返回 Projects
        </Link>
        <div className="flex items-center gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]"
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Github className="h-4 w-4 opacity-85" />
            Repo
            <ExternalLink className="h-4 w-4 opacity-70" />
          </a>
          {project.homepage ? (
            <a
              className="inline-flex items-center gap-2 rounded-2xl bg-[color-mix(in_oklab,hsl(var(--accent))_22%,transparent)] px-4 py-2.5 text-sm font-medium transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_28%,transparent)]"
              href={project.homepage}
              target="_blank"
              rel="noreferrer"
            >
              Live
              <ExternalLink className="h-4 w-4 opacity-80" />
            </a>
          ) : null}
        </div>
      </div>

      <SectionHeader title={project.name} desc={project.description} />

      <div className="grid gap-3 lg:grid-cols-[1.2fr_.8fr] lg:items-start">
        <div className="card p-7">
          <div className="text-sm font-medium">Highlights</div>
          <ul className="mt-3 grid gap-2 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_74%,hsl(var(--muted)))]">
            {(project.highlights?.length ? project.highlights : ["—"]).map((h, idx) => (
              <li key={idx} className="rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_60%,transparent)] px-4 py-3">
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-7">
          <div className="text-sm font-medium">Stack</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(project.stack ?? []).length ? (
              project.stack!.map((s) => <Chip key={s} label={s} tone="glass" />)
            ) : (
              <span className="text-sm text-[hsl(var(--muted))]">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
