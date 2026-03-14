import { CalendarDays } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { NoteTitleLink } from "../components/NoteTitleLink";
import { noteDetailTransitionState, preparePostTransitionOnClick } from "../navigation/transitions";
import type { NoteListItem } from "../types";

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

function monthName(month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1)));
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

type MonthGroup = {
  month: number;
  monthLabel: string;
  notes: NoteListItem[];
};

type YearGroup = {
  year: number;
  notes: NoteListItem[];
  months: MonthGroup[];
};

function groupNotesByYearAndMonth(notes: NoteListItem[]): YearGroup[] {
  const sorted = [...notes].sort((a, b) => dateMs(b.date) - dateMs(a.date) || dateMs(b.updated) - dateMs(a.updated));
  const years = new Map<number, Map<number, NoteListItem[]>>();

  for (const note of sorted) {
    const iso = fmtYmd(note.date);
    const dt = new Date(`${iso}T00:00:00Z`);
    const year = dt.getUTCFullYear();
    const month = dt.getUTCMonth();
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(note);
  }

  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => {
      const groupedMonths = [...months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, monthNotes]) => ({
          month,
          monthLabel: monthName(month),
          notes: monthNotes,
        }));

      return {
        year,
        notes: groupedMonths.flatMap((group) => group.notes),
        months: groupedMonths,
      };
    });
}

export function NotesPage() {
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [readMinutes, setReadMinutes] = React.useState<Record<string, number>>({});

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

  React.useEffect(() => {
    const ids = notes.map((note) => note.id).filter((id) => readMinutes[id] === undefined);
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
  }, [notes, readMinutes]);

  const archive = React.useMemo(() => groupNotesByYearAndMonth(notes), [notes]);

  return (
    <section className="w-full max-w-[48rem] pb-4 pt-6 font-mono">
      <h1 className="mt-8 text-2xl font-semibold sm:text-3xl">All Notes</h1>
      <p className="mb-6 mt-2 italic">Browse all notes by year and month</p>

      {archive.length ? (
        archive.map((yearGroup) => (
          <div key={yearGroup.year} className="mb-8">
            <h2 className="mb-6 border-b border-[hsl(var(--accent))] pb-2 text-2xl font-bold">
              <span>{yearGroup.year}</span>
              <sup className="ml-1 text-sm">{yearGroup.notes.length}</sup>
            </h2>

            {yearGroup.months.map((monthGroup) => (
              <div key={`${yearGroup.year}-${monthGroup.month}`} className="mt-8">
                <h3 className="mb-4 text-xl font-bold">
                  <span>{monthGroup.monthLabel}</span>
                  <sup className="ml-1 text-sm">{monthGroup.notes.length}</sup>
                </h3>

                <ul>
                  {monthGroup.notes.map((note) => (
                    <li key={note.id} className="my-8">
                      <div>
                        <NoteTitleLink
                          to={`/notes/${note.id}`}
                          noteId={note.id}
                          transitionTitle={note.title}
                          onMouseEnter={() => api.prefetchNote(note.id)}
                          onFocus={() => api.prefetchNote(note.id)}
                          className="inline-block text-lg font-medium text-[hsl(var(--accent))] decoration-dashed underline-offset-4 transition hover:underline focus-visible:no-underline focus-visible:underline-offset-0"
                          titleClassName="text-lg font-medium"
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

                        <div className="flex items-start gap-4">
                          {note.cover ? (
                            <Link
                              to={`/notes/${note.id}`}
                              state={noteDetailTransitionState(note.id, { title: note.title })}
                              viewTransition
                              onClickCapture={preparePostTransitionOnClick}
                              onMouseEnter={() => api.prefetchNote(note.id)}
                              onFocus={() => api.prefetchNote(note.id)}
                              className="group hidden shrink-0 sm:block"
                            >
                              <img
                                src={note.cover}
                                alt={note.title}
                                loading="lazy"
                                className="h-[79px] w-[140px] rounded object-cover shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:shadow-md"
                              />
                            </Link>
                          ) : null}
                          {note.excerpt ? <p className="flex-1 opacity-80">{note.excerpt}</p> : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="text-sm text-[hsl(var(--muted))]">No notes yet.</div>
      )}
    </section>
  );
}
