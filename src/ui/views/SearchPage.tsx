import { CalendarDays, ExternalLink, Github, Link2, Search, X } from "lucide-react";
import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import { NoteLink, NoteTitleLink } from "../components/NoteTitleLink";
import { preloadNotePage } from "../navigation/preloaders";
import { useAppState } from "../state/AppState";
import type { NoteListItem, Project } from "../types";

function fmtYmd(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function fmtLongDate(iso: string): string {
  try {
    const dt = new Date(`${iso}T00:00:00Z`);
    const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(dt);
    const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(dt);
    const year = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "UTC" }).format(dt);
    return `${day} ${month}, ${year}`;
  } catch {
    return iso;
  }
}

function dateMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function estimateReadMinutes(content: string): number {
  const stripped = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/<[^>]+>/g, " ");
  const wordCount = (stripped.match(/[A-Za-z0-9_]+/g) ?? []).length;
  const cjkCount = (stripped.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? []).length;
  const units = wordCount + cjkCount * 0.6;
  return Math.max(1, Math.round(units / 220));
}

function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
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

function scoreNote(note: NoteListItem, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  const title = note.title.toLowerCase();
  const excerpt = note.excerpt.toLowerCase();
  const tags = note.tags.join(" ").toLowerCase();
  const categories = note.categories.join(" ").toLowerCase();

  if (title === q) score += 200;
  if (title.startsWith(q)) score += 120;
  if (title.includes(q)) score += 80;
  if (excerpt.includes(q)) score += 28;
  if (tags.includes(q)) score += 22;
  if (categories.includes(q)) score += 16;
  return score;
}

function scoreProject(project: Project, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  const name = project.name.toLowerCase();
  const description = project.description.toLowerCase();
  const stack = (project.stack ?? []).join(" ").toLowerCase();

  if (name === q) score += 180;
  if (name.startsWith(q)) score += 100;
  if (name.includes(q)) score += 72;
  if (description.includes(q)) score += 24;
  if (stack.includes(q)) score += 18;
  return score;
}

export function SearchPage() {
  const { categories } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const activeCategory = searchParams.get("category") ?? "";
  const [queryDraft, setQueryDraft] = React.useState(urlQuery);
  const [noteResults, setNoteResults] = React.useState<NoteListItem[]>([]);
  const [projectResults, setProjectResults] = React.useState<Project[]>([]);
  const [readMinutes, setReadMinutes] = React.useState<Record<string, number>>({});
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const deferredQuery = React.useDeferredValue(queryDraft.trim());

  React.useEffect(() => {
    preloadNotePage();
  }, []);

  const updateSearchParams = React.useCallback(
    (nextQuery: string, nextCategory: string) => {
      const normalizedQuery = nextQuery.trim();
      const next = new URLSearchParams();
      if (normalizedQuery) next.set("q", normalizedQuery);
      if (nextCategory) next.set("category", nextCategory);
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true, preventScrollReset: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const sortedCategories = React.useMemo(() => {
    const list = [...categories];
    list.sort((a, b) => {
      const countDiff = (b.noteCount ?? 0) - (a.noteCount ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.title.localeCompare(b.title, "zh-CN");
    });
    return list;
  }, [categories]);

  const activeCategoryTitle = React.useMemo(
    () => sortedCategories.find((category) => category.id === activeCategory)?.title ?? "",
    [activeCategory, sortedCategories],
  );

  const hasActiveFilters = Boolean(deferredQuery || activeCategory);
  const totalResults = noteResults.length + projectResults.length;

  React.useEffect(() => {
    setQueryDraft(urlQuery);
  }, [urlQuery]);

  React.useEffect(() => {
    if (deferredQuery === urlQuery.trim()) return;
    const timeoutId = window.setTimeout(() => {
      updateSearchParams(deferredQuery, activeCategory);
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [activeCategory, deferredQuery, updateSearchParams, urlQuery]);

  React.useEffect(() => {
    document.title = "Search | Charles";
    return () => {
      document.title = "Charles";
    };
  }, []);

  React.useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    window.addEventListener("hb:focus-search", focusInput);
    return () => window.removeEventListener("hb:focus-search", focusInput);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    void Promise.all([
      api.notes({ q: deferredQuery || undefined, category: activeCategory || undefined }),
      deferredQuery ? api.projects() : Promise.resolve([] as Project[]),
    ])
      .then(([notes, projects]) => {
        if (cancelled) return;

        const rankedNotes = [...notes].sort((a, b) => {
          const scoreDiff = scoreNote(b, deferredQuery) - scoreNote(a, deferredQuery);
          if (scoreDiff !== 0) return scoreDiff;
          return dateMs(b.updated) - dateMs(a.updated);
        });

        const rankedProjects = deferredQuery
          ? [...projects]
              .filter((project) => scoreProject(project, deferredQuery) > 0)
              .sort((a, b) => scoreProject(b, deferredQuery) - scoreProject(a, deferredQuery))
          : [];

        setNoteResults(rankedNotes);
        setProjectResults(rankedProjects);
      })
      .catch(() => {
        if (cancelled) return;
        setNoteResults([]);
        setProjectResults([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCategory, deferredQuery]);

  React.useEffect(() => {
    const ids = noteResults.map((note) => note.id).filter((id) => readMinutes[id] === undefined);
    if (!ids.length) return;

    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        const note = await api.note(id);
        return [id, estimateReadMinutes(note.content)] as const;
      }),
    )
      .then((pairs) => {
        if (cancelled) return;
        setReadMinutes((prev) => {
          const next = { ...prev };
          for (const [id, mins] of pairs) next[id] = mins;
          return next;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [noteResults, readMinutes]);

  return (
    <main className="mx-auto w-full max-w-[48rem] px-0 pb-4 font-mono">
      <h1 className="mt-8 text-2xl font-semibold sm:text-3xl">Search</h1>
      <p className="mb-6 mt-2 italic">Search notes and projects, or narrow notes by category.</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 opacity-70" />
        <input
          ref={inputRef}
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          placeholder='Search notes and projects, e.g. "OpenTelemetry"'
          className="h-[52px] w-full rounded-md border border-[color:var(--border-soft)] bg-[hsl(var(--card))] px-14 pr-16 text-[17px] font-medium outline-none transition focus:border-[hsl(var(--accent))]"
        />
        {queryDraft ? (
          <button
            type="button"
            onClick={() => {
              setQueryDraft("");
              updateSearchParams("", activeCategory);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 inline-flex h-10 items-center gap-1 rounded-md px-3 text-xs text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]"
            style={{ transform: "translateY(-50%)" }}
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-8 lg:flex-row">
        <aside className="min-w-0 lg:w-[15rem] lg:shrink-0">
          <div className="border-b border-[color:var(--border-soft)] py-4">
            <h2 className="text-base font-bold">Categories</h2>
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <button
              type="button"
              onClick={() => updateSearchParams(queryDraft, "")}
              className={[
                "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition",
                activeCategory
                  ? "text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                  : "bg-[color-mix(in_oklab,hsl(var(--accent))_8%,transparent)] text-[hsl(var(--fg))]",
              ].join(" ")}
            >
              <span>All categories</span>
            </button>
            {sortedCategories.map((category) => {
              const selected = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => updateSearchParams(queryDraft, category.id)}
                  className={[
                    "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition",
                    selected
                      ? "bg-[color-mix(in_oklab,hsl(var(--accent))_8%,transparent)] text-[hsl(var(--fg))]"
                      : "text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
                  ].join(" ")}
                >
                  <span className="truncate">{category.title}</span>
                  <span className="tabular-nums text-[12px] opacity-70">{category.noteCount ?? 0}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="py-4 text-sm font-bold">
            {hasActiveFilters ? (
              <span>
                {totalResults} result{totalResults === 1 ? "" : "s"}
                {deferredQuery ? ` for "${deferredQuery}"` : ""}
                {activeCategoryTitle ? ` in ${activeCategoryTitle}` : ""}
              </span>
            ) : (
              <span>{noteResults.length} note{noteResults.length === 1 ? "" : "s"}</span>
            )}
          </div>

          {totalResults === 0 ? (
            <div className="border-t border-[color:var(--border-soft)] py-8 text-sm text-[hsl(var(--muted))]">
              No results. Try a different keyword or another category.
            </div>
          ) : null}

          {noteResults.length ? (
            <ul>
              {noteResults.map((note, index) => (
                <li
                  key={note.id}
                  className={[
                    "flex items-start gap-4 border-t border-[color:var(--border-soft)] py-8",
                    index === noteResults.length - 1 && projectResults.length === 0 ? "border-b" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <NoteTitleLink
                      to={`/notes/${note.id}`}
                      noteId={note.id}
                      transitionTitle={note.title}
                      className="inline-block text-lg font-medium text-[hsl(var(--accent))] decoration-dashed underline-offset-4 transition hover:underline focus-visible:no-underline focus-visible:underline-offset-0"
                      titleClassName="hb-post-face inline-block text-lg font-medium"
                      as="h2"
                    >
                      {note.title}
                    </NoteTitleLink>

                    <div className="mb-3 mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-2 opacity-80">
                        <CalendarDays className="h-4 w-4 min-w-[1rem]" />
                        <span className="text-sm italic">{fmtLongDate(fmtYmd(note.date))}</span>
                      </div>
                      {readMinutes[note.id] ? (
                        <span className="text-sm italic opacity-80">• {readMinutes[note.id]} min read</span>
                      ) : null}
                    </div>

                    {note.cover ? (
                      <div className="mt-2">
                        <NoteLink
                          to={`/notes/${note.id}`}
                          noteId={note.id}
                          transitionTitle={note.title}
                          className="group hidden shrink-0 sm:block"
                        >
                          <img
                            src={note.cover}
                            alt={note.title}
                            loading="lazy"
                            className="h-[79px] w-[140px] rounded object-cover shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:shadow-md"
                          />
                        </NoteLink>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {projectResults.length ? (
            <div className={noteResults.length ? "mt-2" : ""}>
              {!noteResults.length ? <div className="border-t border-[color:var(--border-soft)]" /> : null}
              <h2 className="pb-3 pt-6 text-lg font-semibold">Projects</h2>
              <ul>
                {projectResults.map((project, index) => {
                  const repoHref = normalizeUrl(project.repoUrl);
                  const liveHref = normalizeUrl(project.homepage);
                  const primaryHref = liveHref ?? repoHref;
                  const repoSlug = repoHref ? repoSlugFromUrl(repoHref) : null;
                  const host = liveHref ? hostFromUrl(liveHref) : primaryHref ? hostFromUrl(primaryHref) : null;

                  return (
                    <li
                      key={project.id}
                      className={[
                        "border-t border-[color:var(--border-soft)] py-8",
                        index === projectResults.length - 1 ? "border-b" : "",
                      ].join(" ")}
                    >
                      <div>
                        {primaryHref ? (
                          <a
                            href={primaryHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block text-lg font-medium text-[hsl(var(--accent))] decoration-dashed underline-offset-4 transition hover:underline focus-visible:no-underline focus-visible:underline-offset-0"
                          >
                            <h2 className="text-lg font-medium">{project.name}</h2>
                          </a>
                        ) : (
                          <h2 className="text-lg font-medium text-[hsl(var(--accent))]">{project.name}</h2>
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
                          <span>Project</span>
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
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
