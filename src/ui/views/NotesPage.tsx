import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Reveal } from "../components/Reveal";
import type { NoteListItem } from "../types";

function fmtYmd(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export function NotesPage() {
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .notes()
      .then((items) => {
        if (cancelled) return;
        setNotes(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <section className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 border-y border-[color-mix(in_oklab,hsl(var(--fg))_18%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--bg))_72%,transparent)]"
        />
        <Reveal className="relative z-10 py-10" yPx={12}>
          <div className="min-w-0">
            {notes.length ? (
              <div className="divide-y divide-[color:var(--border-soft)]">
                {notes.map((note) => {
                  const ymd = fmtYmd(note.updated);
                  const date = ymd.length === 10 ? ymd.replaceAll("-", ".") : ymd;

                  return (
                    <Link
                      key={note.id}
                      to={`/notes/${note.id}`}
                      onMouseEnter={() => api.prefetchNote(note.id)}
                      onFocus={() => api.prefetchNote(note.id)}
                      className="group relative -mx-1 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 rounded-xl px-1 py-4 transition hover:bg-[color-mix(in_oklab,hsl(var(--card2))_45%,transparent)]"
                    >
                      <div className="pt-0.5 font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                        {date}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0 truncate font-serif text-base font-semibold tracking-tight md:text-lg">
                            {note.title}
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-px opacity-0 transition group-hover:opacity-60" />
                        </div>
                        <div className="mt-1 line-clamp-1 text-[13px] leading-relaxed text-[hsl(var(--muted))]">
                          {note.excerpt}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 text-sm text-[hsl(var(--muted))]">没有匹配的内容。</div>
            )}
          </div>
        </Reveal>
      </section>
    </div>
  );
}
