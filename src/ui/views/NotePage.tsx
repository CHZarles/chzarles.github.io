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
  const [error, setError] = React.useState<string | null>(null);
  const { categories } = useAppState();
  const titleById = React.useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.title] as const));
    return (id: string) => m.get(id) ?? id;
  }, [categories]);

  React.useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    setNote(null);
    setError(null);
    api
      .note(noteId)
      .then((n) => {
        if (cancelled) return;
        setNote(n);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (error) {
    return (
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
        <div className="mt-2 break-words">{error}</div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            to="/notes"
            className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]"
          >
            <ArrowLeft className="h-4 w-4 opacity-80" />
            返回 Notes
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm transition hover:bg-[hsl(var(--card2))]"
          >
            刷新
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        加载中…
      </div>
    );
  }

  return (
    <article className="grid gap-7 md:gap-8">
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
        <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted))]">Note</div>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
          {note.title}
        </h1>
        {note.excerpt ? <p className="mt-4 text-base leading-relaxed text-[hsl(var(--muted))] md:text-lg">{note.excerpt}</p> : null}
        <div className="mt-6 flex flex-wrap items-center gap-2">
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
          {note.mindmaps.slice(0, 3).map((m) => (
            <Chip key={m.id} label={`Mindmap · ${m.title}`} to={`/mindmaps/${m.id}`} tone="glass" />
          ))}
          {note.tags.slice(0, 6).map((t) => (
            <Chip key={t} label={t} tone="muted" />
          ))}
        </div>
      </header>

      <div className="card p-7 md:p-10">
        <div className="prose max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-h1:text-2xl md:prose-h1:text-3xl prose-h2:text-xl md:prose-h2:text-2xl prose-h3:text-lg md:prose-h3:text-xl prose-p:leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
        </div>
      </div>

      {note.mindmaps.length ? (
        <div className="card p-7 md:p-10">
          <div className="text-sm font-semibold tracking-tight">Mindmaps</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {note.mindmaps.map((m) => (
              <Link
                key={m.id}
                to={`/mindmaps/${m.id}`}
                className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-colors hover:bg-[hsl(var(--card2))]"
              >
                <div className="text-xs text-[hsl(var(--muted))]">Mindmap</div>
                <div className="mt-1 text-base font-semibold tracking-tight">{m.title}</div>
                <div className="mt-2 text-xs text-[hsl(var(--muted))]">/{m.id}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

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
