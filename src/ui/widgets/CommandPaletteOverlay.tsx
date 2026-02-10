import { BookOpen, Compass, GitBranch, LayoutGrid, Network, Search, Waypoints, X } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import type { SearchHit } from "../types";

function iconFor(hit: SearchHit) {
  switch (hit.type) {
    case "note":
      return <BookOpen className="h-4 w-4 opacity-85" />;
    case "category":
      return <LayoutGrid className="h-4 w-4 opacity-85" />;
    case "roadmap":
      return <Compass className="h-4 w-4 opacity-85" />;
    case "node":
      return <Waypoints className="h-4 w-4 opacity-85" />;
    case "project":
      return <GitBranch className="h-4 w-4 opacity-85" />;
    case "mindmap":
      return <Network className="h-4 w-4 opacity-85" />;
    default:
      return <Search className="h-4 w-4 opacity-85" />;
  }
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function CommandPalette(props: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const openHit = React.useCallback(
    (href: string) => {
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
      api
        .search(query)
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setActive(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

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
        props.onClose();
        openHit(hit.href);
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
            placeholder="搜索 Notes / Categories / Roadmaps / Nodes / Mindmaps / Projects"
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))]"
          />
          <span className="kbd hidden sm:inline-flex">Esc</span>
        </div>
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
                    props.onClose();
                    openHit(hit.href);
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

