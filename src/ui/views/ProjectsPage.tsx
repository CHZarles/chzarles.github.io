import { ExternalLink, Github, Link2 } from "lucide-react";
import React from "react";
import { api } from "../api/api";
import type { Project } from "../types";

function normalizeUrl(input: string | undefined): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function repoSlugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);
    if ((host === "github.com" || host.endsWith(".github.com")) && parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return null;
  } catch {
    return null;
  }
}

function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function primaryProjectUrl(p: Project): string | null {
  return normalizeUrl(p.repoUrl) ?? normalizeUrl(p.homepage);
}

export function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .projects()
      .then((items) => {
        if (cancelled) return;
        setProjects(items);
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
    <section className="pb-6 pt-6 font-mono">
      {error ? (
        <div className="text-sm text-[hsl(var(--muted))]">
          <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
          <div className="mt-2 break-words">{error}</div>
        </div>
      ) : loading ? (
        <div className="text-sm text-[hsl(var(--muted))]">加载中…</div>
      ) : projects.length ? (
        <ul>
          {projects.map((project) => {
            const repoHref = normalizeUrl(project.repoUrl);
            const liveHref = normalizeUrl(project.homepage);
            const href = primaryProjectUrl(project);
            const repoSlug = repoHref ? repoSlugFromUrl(repoHref) : null;
            const host = liveHref ? hostFromUrl(liveHref) : href ? hostFromUrl(href) : null;
            const stackLabel = (project.stack ?? []).slice(0, 4).join(" • ");

            return (
              <li key={project.id} className="my-8">
                <div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-lg font-medium text-[hsl(var(--accent))] decoration-dashed underline-offset-4 transition hover:underline focus-visible:no-underline focus-visible:underline-offset-0"
                    >
                      <h3 className="text-lg font-medium">{project.name}</h3>
                    </a>
                  ) : (
                    <h3 className="text-lg font-medium text-[hsl(var(--accent))]">{project.name}</h3>
                  )}

                  <div className="mb-3 mt-3 flex flex-wrap items-center gap-3 text-sm italic opacity-80">
                    {repoSlug ? (
                      <span className="inline-flex items-center gap-2">
                        <Github className="h-4 w-4 min-w-[1rem]" />
                        <span>{repoSlug}</span>
                      </span>
                    ) : host ? (
                      <span className="inline-flex items-center gap-2">
                        <Link2 className="h-4 w-4 min-w-[1rem]" />
                        <span>{host}</span>
                      </span>
                    ) : null}
                    {stackLabel ? <span>{stackLabel}</span> : null}
                  </div>

                  <p className="opacity-80">{project.description}</p>

                  {repoHref || liveHref ? (
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                      {repoHref ? (
                        <a
                          href={repoHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[hsl(var(--accent))]"
                        >
                          <span>Repo</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      {liveHref ? (
                        <a
                          href={liveHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[hsl(var(--accent))]"
                        >
                          <span>Live</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-sm text-[hsl(var(--muted))]">暂无 Projects。</div>
      )}
    </section>
  );
}
