import { ArrowRight, CalendarDays, Github, Link2, Linkedin, Mail, Rss, Twitter } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { NoteTitleLink } from "../components/NoteTitleLink";
import { useAppState } from "../state/AppState";
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

function iconForLink(link: { label: string; href: string }) {
  const label = link.label.trim().toLowerCase();
  const href = link.href.trim().toLowerCase();
  if (label.includes("github") || href.includes("github.com")) return Github;
  if (label.includes("mail") || href.startsWith("mailto:")) return Mail;
  if (label.includes("twitter") || label === "x" || href.includes("x.com") || href.includes("twitter.com")) return Twitter;
  if (label.includes("linkedin") || href.includes("linkedin.com")) return Linkedin;
  return Link2;
}

export function HomePage() {
  const { profile } = useAppState();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [readMinutes, setReadMinutes] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let cancelled = false;
    void api.notes().then((allNotes) => {
      if (cancelled) return;
      setNotes(allNotes.slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const ids = notes.map((n) => n.id).filter((id) => readMinutes[id] === undefined);
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

  const introHandle = profile?.handle?.trim() || "@charles";
  const introLinks = profile?.links ?? [];
  const avatarUrl = profile?.avatarUrl?.trim() || "";
  const avatarEmoji = profile?.avatarEmoji?.trim() || "";

  return (
    <div className="font-mono">
      <section id="hero" className="pb-4 pt-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {avatarEmoji ? (
            <div
              className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[hsl(var(--card2))] text-[4.25rem] leading-none sm:mx-0"
              style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
              aria-label="Avatar emoji"
              role="img"
            >
              {avatarEmoji}
            </div>
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={introHandle}
              className="mx-auto h-40 w-40 rounded-full object-cover transition-all duration-300 hover:scale-105 hover:shadow-xl sm:mx-0"
              loading="eager"
            />
          ) : (
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[hsl(var(--card2))] text-4xl font-semibold text-[hsl(var(--fg))] sm:mx-0">
              {introHandle.replace(/^@/, "").slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="my-2 inline-block text-2xl font-bold sm:my-4 sm:text-3xl">Hi, I&apos;m {introHandle}.</h1>
              <a
                href="/notes"
                aria-label="Notes archive"
                title="Notes archive"
                className="inline-block text-[hsl(var(--accent))]"
              >
                <Rss className="h-5 w-5 stroke-[2.5]" />
              </a>
            </div>

            <p className="max-w-[34rem] text-[15px] leading-7 text-[hsl(var(--fg))] sm:text-base">
              Notes on software, tools, and things worth keeping.
              <br />
              Projects, drafts, and experiments written in public.
            </p>

            <div className="mt-4 flex flex-row items-center justify-center sm:justify-start">
              <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
                {introLinks.map((link) => (
                  <a
                    key={`${link.label}:${link.href}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-block p-2 text-[hsl(var(--fg))] transition hover:text-[hsl(var(--accent))] sm:p-1"
                    aria-label={link.label}
                    title={link.label}
                  >
                    {React.createElement(iconForLink(link), {
                      className: "h-5 w-5 opacity-90 transition group-hover:rotate-6 sm:scale-110",
                    })}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-[color:var(--border-soft)]" />

      <section id="recent-posts" className="pb-6 pt-12">
        {notes.length ? (
          <ul>
            {notes.map((n) => (
              <li key={n.id} className="my-8">
                <div>
                  <NoteTitleLink
                    to={`/notes/${n.id}`}
                    noteId={n.id}
                    transitionTitle={n.title}
                    onMouseEnter={() => api.prefetchNote(n.id)}
                    onFocus={() => api.prefetchNote(n.id)}
                    className="inline-block text-lg font-medium text-[hsl(var(--accent))] decoration-dashed underline-offset-4 transition hover:underline focus-visible:no-underline focus-visible:underline-offset-0"
                    titleClassName="text-lg font-medium"
                    as="h3"
                  >
                    {n.title}
                  </NoteTitleLink>
                  <div className="mb-3 mt-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 opacity-80">
                      <CalendarDays className="h-4 w-4 min-w-[1rem]" />
                      <span className="text-sm italic">{fmtLongDate(fmtYmd(n.date))}</span>
                    </div>
                    {readMinutes[n.id] ? (
                      <span className="text-sm italic opacity-80">• {readMinutes[n.id]} min read</span>
                    ) : null}
                  </div>
                  {n.excerpt ? <p className="opacity-80">{n.excerpt}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-[hsl(var(--muted))]">暂无 Notes。</div>
        )}
      </section>

      <div className="my-8 text-center">
        <Link to="/notes" className="group inline-flex items-center gap-2 hover:text-[hsl(var(--accent))]">
          <span>All Notes</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
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
