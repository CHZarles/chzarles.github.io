import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Hash,
  Linkedin,
  Mail,
  MessageCircle,
  Pin,
  Send,
} from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import { Link, useLocation, useParams } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { api } from "../api/api";
import { NoteLink } from "../components/NoteTitleLink";
import { getPostTransitionTitle, getPostTitleTransitionName, noteTitleTransitionName } from "../navigation/transitions";
import { normalizeMathDelimiters } from "../markdown/normalizeMathDelimiters";
import type { Note, NoteListItem } from "../types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmtYmdDots(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  } catch {
    return iso;
  }
}

function fmtLongDate(iso: string): string {
  try {
    const dt = new Date(`${fmtYmdDots(iso).replace(/\./g, "-")}T00:00:00Z`);
    const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(dt);
    const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(dt);
    const year = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "UTC" }).format(dt);
    return `${day} ${month}, ${year}`;
  } catch {
    return iso;
  }
}

function estimateReadMinutes(md: string): number {
  const raw = String(md ?? "");
  const latinWords = raw.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const cjkChars = raw.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const minutes = Math.ceil(latinWords / 220 + cjkChars / 500);
  return Math.max(1, Math.min(99, minutes));
}

function normalizeCodeFenceLanguages(md: string): string {
  return String(md ?? "").replace(/^([`~]{3,})([^\s`~]+)(.*)$/gm, (_match, fence: string, lang: string, rest: string) => {
    return `${fence}${lang.toLowerCase()}${rest}`;
  });
}

function BrandXIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

function BlueskyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 11.5c-.87-1.69-3.24-4.84-5.44-6.4-2.1-1.48-2.89-1.24-3.42-1.01-.62.27-.72 1.17-.72 1.72 0 .55.3 4.52.5 5.18.65 2.19 2.97 2.93 5.1 2.69.11-.02.22-.03.33-.04-.11.01-.22.03-.33.04-3.13.47-5.91 1.61-2.26 5.67 4.01 4.15 5.5-.89 6.26-3.45.76 2.56 1.64 7.42 6.19 3.45 3.41-3.45.94-5.2-2.19-5.67-.11-.01-.22-.03-.33-.04.11.01.22.02.33.04 2.14.24 4.45-.5 5.1-2.69.2-.66.5-4.63.5-5.18 0-.55-.11-1.49-.72-1.77-.53-.24-1.33-.5-3.44.99-2.2 1.56-4.57 3.71-5.44 6.4Z" strokeWidth="1.815" />
    </svg>
  );
}

export function NotePage() {
  const { noteId } = useParams();
  const location = useLocation();
  const cachedNote = React.useMemo(() => (noteId ? api.peekNote(noteId) : null), [noteId]);
  const [note, setNote] = React.useState<Note | null>(() => cachedNote);
  const [error, setError] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState<NoteListItem[] | null>(null);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  React.useLayoutEffect(() => {
    setNote(cachedNote);
    setError(null);
    setScrollProgress(0);
  }, [cachedNote, noteId]);

  React.useEffect(() => {
    if (!noteId) return;
    let cancelled = false;

    api
      .note(noteId)
      .then((nextNote) => {
        if (cancelled) return;
        setNote(nextNote);
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

  React.useEffect(() => {
    let cancelled = false;

    api
      .notes()
      .then((all) => {
        if (cancelled) return;
        setIndex(all);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!noteId || !note) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const p = total > 0 ? doc.scrollTop / total : 0;
      setScrollProgress(clamp(p, 0, 1));
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [note, noteId]);

  const onScrollTop = React.useCallback(() => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, []);

  const transitionTitle = getPostTransitionTitle(location.state);
  const displayTitle = note?.title ?? transitionTitle ?? "";
  const titleTransitionName = getPostTitleTransitionName(location.state) ?? (noteId ? noteTitleTransitionName(noteId) : null);

  const nav = React.useMemo(() => {
    if (!note || !index) return null;
    const i = index.findIndex((item) => item.id === note.id);
    if (i < 0) return null;
    const newer = i > 0 ? index[i - 1] : null;
    const older = i + 1 < index.length ? index[i + 1] : null;
    return { newer, older };
  }, [index, note]);

  if (error) {
    return (
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
        <div className="mt-2 break-words">{error}</div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
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
      <div className="hb-post-face min-w-0">
        <header className="pt-8">
          <h1
            className="inline-block text-2xl font-bold text-[hsl(var(--accent))] sm:text-3xl"
            style={{ viewTransitionName: titleTransitionName ?? "none" }}
          >
            {displayTitle || "Loading post..."}
          </h1>
        </header>
      </div>
    );
  }

  const markdown = normalizeCodeFenceLanguages(normalizeMathDelimiters(note.content));
  const publishedKey = fmtYmdDots(note.date);
  const updatedKey = fmtYmdDots(note.updated);
  const isUpdated = updatedKey !== publishedKey;
  const displayDate = fmtLongDate(isUpdated ? note.updated : note.date);
  const readMinutes = estimateReadMinutes(note.content);
  const canonicalUrl = typeof window !== "undefined" ? `${window.location.origin}${location.pathname}` : location.pathname;
  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedTitle = encodeURIComponent(note.title);
  const categoryLinks = note.categories.slice(0, 12);
  const shareLinks = [
    {
      label: "X",
      href: `https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      title: "Share this post on X",
      icon: <BrandXIcon className="size-full fill-transparent stroke-current" />,
    },
    {
      label: "BlueSky",
      href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${note.title} ${canonicalUrl}`)}`,
      title: "Share this post on BlueSky",
      icon: <BlueskyIcon className="size-full fill-transparent stroke-current" />,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      title: "Share this post on LinkedIn",
      icon: <Linkedin className="size-full stroke-[2px]" />,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${note.title} ${canonicalUrl}`)}`,
      title: "Share this post via WhatsApp",
      icon: <MessageCircle className="size-full stroke-[2px]" />,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      title: "Share this post on Facebook",
      icon: <Facebook className="size-full stroke-[2px]" />,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      title: "Share this post via Telegram",
      icon: <Send className="size-full stroke-[2px]" />,
    },
    {
      label: "Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
      title: "Share this post on Pinterest",
      icon: <Pin className="size-full stroke-[2px]" />,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${note.title}\n\n${canonicalUrl}`)}`,
      title: "Share this post via email",
      icon: <Mail className="size-full stroke-[2px]" />,
    },
  ];

  return (
    <div className="hb-post-face min-w-0">
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[2px] bg-[color-mix(in_oklab,hsl(var(--border))_40%,transparent)]">
        <div
          className="h-full bg-[color-mix(in_oklab,hsl(var(--accent))_70%,transparent)]"
          style={{ width: `${(scrollProgress * 100).toFixed(3)}%` }}
        />
      </div>

      <header className="pt-8">
        <h1
          className="inline-block text-2xl font-bold text-[hsl(var(--accent))] sm:text-3xl"
          style={{ viewTransitionName: titleTransitionName ?? "none" }}
        >
          {displayTitle}
        </h1>

        <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 opacity-80">
            <CalendarDays className="h-4 w-4 min-w-[1rem]" />
            {isUpdated ? <span className="text-sm italic sm:text-base">Updated:</span> : <span className="sr-only">Published:</span>}
            <time dateTime={isUpdated ? note.updated : note.date} className="text-sm italic sm:text-base">
              {displayDate}
            </time>
          </div>
          <span className="text-[hsl(var(--muted))]">•</span>
          <span className="text-sm italic opacity-80">{readMinutes} min read</span>
        </div>
      </header>

      <article className="mx-auto prose mt-6 max-w-none text-[16px] leading-[1.8] prose-headings:font-inherit prose-headings:text-balance prose-headings:tracking-[var(--tracking-tight)] prose-headings:leading-[1.15] prose-h2:mt-10 prose-h3:mt-8 prose-h3:italic prose-p:leading-[1.8] prose-li:leading-[1.8]">
        {note.cover ? (
          <img
            src={note.cover}
            alt=""
            className="mb-8 aspect-video w-full rounded-md object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false }]]}>
          {markdown}
        </ReactMarkdown>
      </article>

      {categoryLinks.length ? (
        <ul className="mt-4 mb-8 sm:my-8">
          {categoryLinks.map((category) => (
            <li key={category} className="group my-1 inline-block underline-offset-4">
              <Link
                to={`/search?category=${encodeURIComponent(category)}`}
                className="relative inline-flex items-center gap-1 pr-2 text-lg underline decoration-dashed transition group-hover:-top-0.5 group-hover:text-[hsl(var(--accent))] focus-visible:p-1"
              >
                <Hash className="size-4 shrink-0 opacity-80" />
                <span>{category}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={[categoryLinks.length ? "" : "mt-4 ", "flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end sm:gap-4"].join("")}>
        <div className="flex flex-col flex-wrap items-center justify-center gap-2 sm:gap-1 sm:items-start">
          <span className="italic">Share this post on:</span>
          <div className="flex flex-wrap gap-1 text-center">
            {shareLinks.map((share) => (
              <a
                key={share.label}
                href={share.href}
                target={share.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={share.href.startsWith("mailto:") ? undefined : "noreferrer"}
                className="group inline-block p-3 transition hover:rotate-6 hover:text-[hsl(var(--accent))] sm:p-2"
                title={share.title}
              >
                <span className="inline-flex size-8 items-center justify-center opacity-90 sm:size-6">{share.icon}</span>
                <span className="sr-only">{share.title}</span>
              </a>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onScrollTop}
          className="inline-flex items-center gap-1 whitespace-nowrap py-1 transition hover:opacity-75"
        >
          <ChevronLeft className="inline-block rotate-90" />
          <span>Back to Top</span>
        </button>
      </div>

      <hr className="my-6 border-dashed border-[color:var(--border-soft)]" />

      {nav?.newer || nav?.older ? (
        <section className="flex flex-col justify-between gap-6 sm:flex-row">
          {nav?.newer ? (
            <NoteLink
              to={`/notes/${nav.newer.id}`}
              noteId={nav.newer.id}
              transitionTitle={nav.newer.title}
              className="flex items-start gap-2 transition hover:opacity-75"
            >
              <ChevronLeft className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="block text-sm text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">Previous Post</span>
                <div className="text-[color-mix(in_oklab,hsl(var(--accent))_85%,hsl(var(--fg)))]">
                  <span style={{ viewTransitionName: noteTitleTransitionName(nav.newer.id) }}>{nav.newer.title}</span>
                </div>
              </div>
            </NoteLink>
          ) : null}
          {nav?.older ? (
            <NoteLink
              to={`/notes/${nav.older.id}`}
              noteId={nav.older.id}
              transitionTitle={nav.older.title}
              className="ml-auto flex items-start justify-end gap-2 text-right transition hover:opacity-75"
            >
              <div className="min-w-0">
                <span className="block text-sm text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">Next Post</span>
                <div className="text-[color-mix(in_oklab,hsl(var(--accent))_85%,hsl(var(--fg)))]">
                  <span style={{ viewTransitionName: noteTitleTransitionName(nav.older.id) }}>{nav.older.title}</span>
                </div>
              </div>
              <ChevronRight className="mt-0.5 shrink-0" />
            </NoteLink>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
