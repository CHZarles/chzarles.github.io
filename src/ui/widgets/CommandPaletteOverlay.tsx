import { BookOpen, GitBranch, LayoutGrid, Search, X } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { useAppState } from "../state/AppState";
import type { SearchHit } from "../types";

function iconFor(hit: SearchHit) {
  switch (hit.type) {
    case "note":
      return <BookOpen className="h-4 w-4 opacity-85" />;
    case "category":
      return <LayoutGrid className="h-4 w-4 opacity-85" />;
    case "project":
      return <GitBranch className="h-4 w-4 opacity-85" />;
    default:
      return <Search className="h-4 w-4 opacity-85" />;
  }
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function noteHitsFromNotes(notes: Array<{ id: string; title: string; excerpt: string }>): SearchHit[] {
  return notes.slice(0, 18).map((note) => ({
    type: "note",
    title: note.title,
    subtitle: note.excerpt || "Note",
    href: `/notes/${note.id}`,
  }));
}

function CommandPalette(props: { onClose: () => void }) {
  const navigate = useNavigate();
  const { categories } = useAppState();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [active, setActive] = React.useState(0);
  const [activeCategory, setActiveCategory] = React.useState<{ id: string; title: string } | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const sortedCategories = React.useMemo(() => {
    const list = [...categories];
    list.sort((a, b) => {
      const countDiff = (b.noteCount ?? 0) - (a.noteCount ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.title.localeCompare(b.title, "zh-CN");
    });
    return list.slice(0, 10);
  }, [categories]);

  const openHit = React.useCallback(
    (hit: SearchHit) => {
      if (hit.type === "category") {
        const categoryId = hit.categoryId?.trim();
        if (!categoryId) return;
        setActiveCategory({ id: categoryId, title: hit.title });
        setActive(0);
        return;
      }
      const href = hit.href;
      if (isExternalHref(href)) {
        window.open(href, "_blank", "noreferrer");
        return;
      }
      navigate(href);
    },
    [navigate],
  );

  React.useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      const run = activeCategory
        ? api.notes({ q: query || undefined, category: activeCategory.id }).then((notes) => noteHitsFromNotes(notes))
        : api.search(query);

      run
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setActive(0);
        })
        .catch(() => {});
    }, activeCategory ? 60 : 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, activeCategory]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((x) => Math.min(x + 1, Math.max(results.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((x) => Math.max(x - 1, 0));
      }
      if (e.key === "Enter") {
        const hit = results[active];
        if (!hit) return;
        e.preventDefault();
        if (hit.type === "category") {
          openHit(hit);
          return;
        }
        props.onClose();
        openHit(hit);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, active, openHit, props]);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-start overflow-y-auto px-4 py-16 md:py-24"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/35" onClick={props.onClose} />

      <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_24px_80px_rgba(0,0,0,.18)]">
        <div className="flex items-center gap-2 px-4 py-3">
          <Search className="h-4 w-4 opacity-75" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 Notes / Projects，或先选一个 Category"
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))]"
          />
          <span className="kbd hidden sm:inline-flex">Esc</span>
        </div>
        {sortedCategories.length ? (
          <>
            <div className="hairline" />
            <div className="px-4 py-3">
              <div className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-[hsl(var(--muted))]">CATEGORIES</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                    activeCategory
                      ? "border-[color:var(--border-soft)] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                      : "border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_7%,transparent)] text-[hsl(var(--fg))]",
                  ].join(" ")}
                >
                  All
                </button>
                {sortedCategories.map((category) => {
                  const selected = activeCategory?.id === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory({ id: category.id, title: category.title });
                        setActive(0);
                      }}
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                        selected
                          ? "border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_7%,transparent)] text-[hsl(var(--fg))]"
                          : "border-[color:var(--border-soft)] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]",
                      ].join(" ")}
                    >
                      <span className="font-serif font-semibold tracking-tight">{category.title}</span>
                      <span className="font-mono text-[10px] tabular-nums text-[hsl(var(--muted))]">
                        {(category.noteCount ?? 0).toString().padStart(2, "0")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
        <div className="hairline" />
        <div className="max-h-[60vh] overflow-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-sm text-[hsl(var(--muted))]">没有结果</div>
          ) : (
            <div className="grid gap-1">
              {results.map((hit, idx) => (
                <button
                  key={`${hit.type}:${hit.href}`}
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => {
                    if (hit.type === "category") {
                      openHit(hit);
                      return;
                    }
                    props.onClose();
                    openHit(hit);
                  }}
                  className={[
                    "flex items-center justify-between gap-4 rounded-2xl px-3 py-2.5 text-left transition",
                    idx === active
                      ? "bg-[color-mix(in_oklab,hsl(var(--accent))_10%,hsl(var(--card2)))]"
                      : "hover:bg-[hsl(var(--card2))]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))]">
                      {iconFor(hit)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{hit.title}</span>
                      <span className="block truncate text-xs text-[hsl(var(--muted))]">{hit.subtitle ?? hit.type}</span>
                    </span>
                  </span>
                  <span className="hidden text-xs text-[hsl(var(--muted))] md:inline">↵</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="hairline" />
        <div className="flex items-center justify-between px-4 py-3 text-xs text-[hsl(var(--muted))]">
          <span>↑ ↓ 选择 · ↵ 打开 · Esc 关闭</span>
          <span className="kbd">⌘K</span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteOverlay(props: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100]">
      <CommandPalette onClose={props.onClose} />
      <button
        type="button"
        onClick={props.onClose}
        className="fixed right-6 top-6 z-[101] hidden md:inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] shadow-[0_18px_50px_rgba(0,0,0,.10)] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
        aria-label="Close search"
      >
        <X className="h-4 w-4 opacity-85" />
        Close
      </button>
    </div>
  );
}
