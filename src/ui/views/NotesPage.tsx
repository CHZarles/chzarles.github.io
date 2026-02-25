import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import { Reveal } from "../components/Reveal";
import { useAppState } from "../state/AppState";
import type { NoteListItem } from "../types";

function fmtYmd(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export function NotesPage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const category = sp.get("category") ?? "";
  const { categories } = useAppState();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);

  const categoryTitleById = React.useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.title] as const));
    return (id: string) => m.get(id) ?? null;
  }, [categories]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .notes({ q: q || undefined, category: category || undefined })
      .then((n) => {
        if (cancelled) return;
        setNotes(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [q, category]);

  const sortedCategories = React.useMemo(() => {
    const list = [...categories];
    list.sort((a, b) => (b.noteCount ?? 0) - (a.noteCount ?? 0));
    return list;
  }, [categories]);

  return (
    <div className="grid gap-8">
      <section className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 border-y border-[color-mix(in_oklab,hsl(var(--fg))_18%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--bg))_72%,transparent)]"
        />
        <Reveal className="relative z-10 py-10" yPx={12}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-0 lg:divide-x lg:divide-[color:var(--border-soft)]">
            <div className="min-w-0 lg:pr-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))]">
                    ARCHIVE
                  </div>
                  <div className="mt-1 font-serif text-xl font-semibold tracking-tight md:text-2xl">Notes</div>
                  <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">
                    不区分长短：同一篇 Note 可以同时挂到 Category 与 Roadmap 节点。
                  </p>
                </div>
                <div className="font-mono text-xs tabular-nums text-[hsl(var(--muted))]">{notes.length} results</div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <input
                  value={q}
                  onChange={(e) => {
                    const next = new URLSearchParams(sp);
                    if (e.target.value) next.set("q", e.target.value);
                    else next.delete("q");
                    setSp(next, { replace: true });
                  }}
                  placeholder="搜索标题/摘要/标签…（或按 ⌘K）"
                  className="w-full min-w-[220px] flex-1 rounded-full border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card))_62%,transparent)] px-4 py-3 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[color-mix(in_oklab,hsl(var(--accent))_40%,hsl(var(--border)))]"
                />
                {category ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(sp);
                      next.delete("category");
                      setSp(next, { replace: true });
                    }}
                    className="rounded-full border border-[color-mix(in_oklab,hsl(var(--accent))_32%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_10%,transparent)] px-4 py-3 text-sm text-[hsl(var(--fg))] transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_14%,transparent)]"
                  >
                    Category{categoryTitleById(category) ? ` · ${categoryTitleById(category)}` : ""} ×
                  </button>
                ) : null}
              </div>

              <div className="mt-6 hairline" />

              {notes.length ? (
                <div className="divide-y divide-[color:var(--border-soft)]">
                  {notes.map((n) => {
                    const ymd = fmtYmd(n.updated);
                    const date = ymd.length === 10 ? ymd.replaceAll("-", ".") : ymd;
                    const catTitle = n.categories[0] ? categoryTitleById(n.categories[0]) : null;
                    const cat = catTitle ? `#${catTitle}` : null;
                    const node = n.nodes[0] ? `${n.nodes[0].roadmapTitle} / ${n.nodes[0].title}` : null;
                    const meta = [cat, node].filter(Boolean).join(" · ");

                    return (
                      <Link
                        key={n.id}
                        to={`/notes/${n.id}`}
                        className="group relative -mx-1 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 rounded-xl px-1 py-4 transition hover:bg-[color-mix(in_oklab,hsl(var(--card2))_45%,transparent)]"
                      >
                        <div className="pt-0.5 font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                          {date}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="min-w-0 truncate font-serif text-base font-semibold tracking-tight md:text-lg">
                              {n.title}
                            </div>
                            <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-px opacity-0 transition group-hover:opacity-60" />
                          </div>
                          <div className="mt-1 line-clamp-1 text-[13px] leading-relaxed text-[hsl(var(--muted))]">
                            {n.excerpt}
                          </div>
                          {meta ? (
                            <div className="mt-1 hidden line-clamp-1 text-[11px] text-[color-mix(in_oklab,hsl(var(--fg))_60%,hsl(var(--muted)))] md:block">
                              {meta}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 text-sm text-[hsl(var(--muted))]">没有匹配的内容。</div>
              )}
            </div>

            <aside className="min-w-0 lg:pl-10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))]">
                    FILTER
                  </div>
                  <div className="mt-1 font-serif text-xl font-semibold tracking-tight">Categories</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(sp);
                    next.delete("category");
                    setSp(next, { replace: true });
                  }}
                  className="font-mono text-xs font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                >
                  ALL
                </button>
              </div>

              <div className="mt-5">
                <div className="hairline" />
                <div className="divide-y divide-[color:var(--border-soft)]">
                  {sortedCategories.slice(0, 12).map((c) => {
                    const active = c.id === category;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const next = new URLSearchParams(sp);
                          next.set("category", c.id);
                          setSp(next, { replace: true });
                        }}
                        className={[
                          "group relative -mx-1 grid w-[calc(100%+0.5rem)] grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 rounded-xl px-1 py-3.5 text-left transition",
                          active
                            ? "bg-[color-mix(in_oklab,hsl(var(--accent))_10%,transparent)]"
                            : "hover:bg-[color-mix(in_oklab,hsl(var(--card2))_45%,transparent)]",
                        ].join(" ")}
                      >
                        <div className="pointer-events-none absolute inset-y-3 left-0 w-px bg-[hsl(var(--accent))] opacity-0 transition group-hover:opacity-35" />
                        <div className="truncate font-serif text-sm font-semibold tracking-tight text-[hsl(var(--fg))]">
                          {c.title}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                          {(c.noteCount ?? 0).toString().padStart(2, "0")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
