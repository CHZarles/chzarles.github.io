import { ArrowLeft, Link2 } from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { useAppState } from "../state/AppState";
import type { Note } from "../types";

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function NotePage() {
  const { noteId } = useParams();
  const [note, setNote] = React.useState<Note | null>(null);
  const { categories } = useAppState();
  const titleById = React.useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.title] as const));
    return (id: string) => m.get(id) ?? id;
  }, [categories]);

  React.useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    api
      .note(noteId)
      .then((n) => {
        if (cancelled) return;
        setNote(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (!note) {
    return (
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        加载中…（请确认 mock server 已启动）
      </div>
    );
  }

  return (
    <article className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/notes"
          className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] hover:text-[hsl(var(--fg))]"
        >
          <ArrowLeft className="h-4 w-4 opacity-80" />
          返回 Notes
        </Link>
        <span className="text-xs text-[hsl(var(--muted))]">Updated · {fmtDate(note.updated)}</span>
      </div>

      <header className="card p-7 md:p-10">
        <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">{note.title}</h1>
        <p className="mt-3 text-sm text-[hsl(var(--muted))]">{note.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {note.categories.map((c) => (
            <Chip key={c} label={`#${titleById(c)}`} to={`/categories/${c}`} tone="glass" />
          ))}
          {note.nodes.map((r) => (
            <Chip
              key={r.ref}
              label={`${r.roadmapTitle} / ${r.title}`}
              to={`/roadmaps/${r.roadmapId}/node/${r.nodeId}`}
              tone="accent"
            />
          ))}
          {note.tags.slice(0, 6).map((t) => (
            <Chip key={t} label={t} tone="muted" />
          ))}
        </div>
      </header>

      <div className="card p-7 md:p-10">
        <div className="prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Permalink</div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText?.(window.location.href)}
            className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]"
          >
            <Link2 className="h-4 w-4 opacity-80" />
            Copy link
          </button>
        </div>
      </div>
    </article>
  );
}
