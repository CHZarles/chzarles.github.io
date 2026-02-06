import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import type { NoteListItem } from "../types";
import { useAppState } from "../state/AppState";
import { Chip } from "./Chip";

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function NoteCard(props: { note: NoteListItem }) {
  const n = props.note;
  const { categories } = useAppState();
  const titleById = React.useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.title] as const));
    return (id: string) => m.get(id) ?? id;
  }, [categories]);
  return (
    <Link
      to={`/notes/${n.id}`}
      className="group block rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-colors hover:bg-[hsl(var(--card2))]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-[hsl(var(--muted))]">
          <span className="tracking-[0.18em] uppercase">Updated</span>
          <span className="ml-2">{fmtDate(n.updated)}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 opacity-35 transition group-hover:opacity-70" />
      </div>
      <h3 className="mt-3 font-serif text-lg font-semibold tracking-tight">{n.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">{n.excerpt}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {n.categories.slice(0, 2).map((c) => (
          <Chip key={c} label={titleById(c)} to={`/categories/${c}`} tone="glass" />
        ))}
        {n.nodes.slice(0, 2).map((r) => (
          <Chip
            key={r.ref}
            label={`${r.roadmapTitle} / ${r.title}`}
            to={`/roadmaps/${r.roadmapId}/node/${r.nodeId}`}
            tone="accent"
          />
        ))}
      </div>
    </Link>
  );
}
