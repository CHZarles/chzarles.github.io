import { ArrowUpRight, Code2, ExternalLink, Github } from "lucide-react";
import React from "react";
import { api } from "../api/api";
import { EmptyStatePanel } from "../components/EmptyStatePanel";
import { SectionHeader } from "../components/SectionHeader";
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
      .then((p) => {
        if (cancelled) return;
        setProjects(p);
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
      <SectionHeader title="Projects" desc="作品集入口：像产品页一样看项目——Repo / Demo / Stack 一眼可读。" />

      {error ? (
        <div className="card p-8 text-sm text-[hsl(var(--muted))]">
          <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
          <div className="mt-2 break-words">{error}</div>
        </div>
      ) : loading ? (
        <div className="card p-7 text-sm text-[hsl(var(--muted))]">加载中…</div>
      ) : projects.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => {
          const href = primaryProjectUrl(p);
          const repoSlug = href ? repoSlugFromUrl(href) : null;
          const isGithub = Boolean(href && href.toLowerCase().includes("github.com"));
          return (
            <a
              key={p.id}
              href={href ?? undefined}
                target={href ? "_blank" : undefined}
                rel={href ? "noreferrer" : undefined}
                className={[
                  "group block overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition",
                  href ? "hover:bg-[hsl(var(--card2))]" : "cursor-not-allowed opacity-60",
                ].join(" ")}
                aria-disabled={!href}
                onClick={(e) => {
                  if (href) return;
                  e.preventDefault();
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_oklab,red_55%,transparent)]" aria-hidden="true" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_oklab,orange_55%,transparent)]" aria-hidden="true" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_oklab,green_55%,transparent)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-[hsl(var(--muted))]">{repoSlug ?? p.id}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-[hsl(var(--muted))]">
                      {isGithub ? (
                        <Github className="h-3.5 w-3.5 opacity-85" />
                      ) : (
                        <Code2 className="h-3.5 w-3.5 opacity-85" />
                      )}
                      {p.homepage ? (
                        <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 font-mono tracking-normal">
                          live
                        </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] text-[hsl(var(--muted))]">
                    Open <ExternalLink className="h-3.5 w-3.5 opacity-75" />
                  </span>
                </div>

                <div className="px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold tracking-tight">{p.name}</div>
                      <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">{p.description}</div>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 opacity-35 transition group-hover:opacity-70" />
                  </div>

                  {(p.stack ?? []).length ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {(p.stack ?? []).slice(0, 6).map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] font-mono text-[color-mix(in_oklab,hsl(var(--fg))_78%,hsl(var(--muted)))]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <EmptyStatePanel
          icon={<Code2 className="h-5 w-5 opacity-85" />}
          title="Projects 还空着"
          desc="把项目当作品展示：Repo、Demo、技术栈与亮点应该一眼可读。"
          hint="正在整理中。"
        />
      )}
    </div>
  );
}
