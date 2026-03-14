import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Facebook,
  Hash,
  Linkedin,
  Link2,
  Mail,
  MessageCircle,
  Pin,
  Send,
  X,
} from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import { Link, useLocation, useParams } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { api } from "../api/api";
import {
  getPostTransitionTitle,
  getPostTitleTransitionName,
  isPostTransitionState,
  noteDetailTransitionState,
  noteTitleTransitionName,
  preparePostTransitionOnClick,
} from "../navigation/transitions";
import { normalizeMathDelimiters } from "../markdown/normalizeMathDelimiters";
import type { Note, NoteListItem } from "../types";

type HeadingRef = { depth: number; text: string; id: string };

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

function fmtMdDots(iso: string) {
  const s = fmtYmdDots(iso);
  const parts = s.split(".");
  if (parts.length === 3) return `${parts[1]}.${parts[2]}`;
  return s;
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

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}

function slugifyHeading(input: string): string {
  const base = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || `h-${shortHash(String(input ?? ""))}`;
}

function extractHeadings(md: string): Array<{ depth: number; text: string }> {
  const raw = String(md ?? "");
  const lines = raw.split(/\r?\n/);
  const out: Array<{ depth: number; text: string }> = [];
  let fence: "```" | "~~~" | null = null;

  for (const line of lines) {
    const s = line.trimEnd();
    const fenceMatch = s.match(/^(```+|~~~+)\s*/);
    if (fenceMatch) {
      const kind = fenceMatch[1].startsWith("~") ? "~~~" : "```";
      fence = fence ? null : kind;
      continue;
    }
    if (fence) continue;

    const m = s.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;

    let text = m[2].trim();
    text = text.replace(/\s+#+\s*$/, "").trim();
    if (!text) continue;

    out.push({ depth: m[1].length, text });
  }

  return out;
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (!children) return "";
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (React.isValidElement(children)) return extractText(children.props.children);
  return "";
}

async function tryCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard?.writeText?.(text);
    return true;
  } catch {
    // ignore
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function BrandXIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

function BlueskyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 11.5c-.87-1.69-3.24-4.84-5.44-6.4-2.1-1.48-2.89-1.24-3.42-1.01-.62.27-.72 1.17-.72 1.72 0 .55.3 4.52.5 5.18.65 2.19 2.97 2.93 5.1 2.69.11-.02.22-.03.33-.04-.11.01-.22.03-.33.04-3.13.47-5.91 1.61-2.26 5.67 4.01 4.15 5.5-.89 6.26-3.45.76 2.56 1.64 7.42 6.19 3.45 3.41-3.45.94-5.2-2.19-5.67-.11-.01-.22-.03-.33-.04.11.01.22.02.33.04 2.14.24 4.45-.5 5.1-2.69.2-.66.5-4.63.5-5.18 0-.55-.11-1.49-.72-1.77-.53-.24-1.33-.5-3.44.99-2.2 1.56-4.57 3.71-5.44 6.4Z" strokeWidth="1.815" />
    </svg>
  );
}

function CodeBlockCard(props: {
  code: string;
  lang?: string | null;
  codeClassName?: string;
  children?: React.ReactNode;
}) {
  const code = props.code.replace(/\n$/, "");
  const lang = (props.lang ?? "").trim();
  const codeClassName = String(props.codeClassName ?? "").trim();
  const [copied, setCopied] = React.useState(false);

  const onCopy = React.useCallback(() => {
    void (async () => {
      const ok = await tryCopy(code);
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    })();
  }, [code]);

  return (
    <div className="group not-prose my-7 overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-muted-weak)] shadow-[inset_0_0_0_1px_var(--border-soft)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] px-3 py-1.5">
        <div className="min-w-0 truncate">
          {lang ? (
            <span className="inline-flex items-center rounded-full border border-[color:var(--border-soft)] bg-[color-mix(in_oklab,hsl(var(--bg))_32%,transparent)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[hsl(var(--muted))]">
              {lang}
            </span>
          ) : (
            <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[hsl(var(--muted))]">CODE</span>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--muted))] opacity-0 transition hover:bg-[color-mix(in_oklab,hsl(var(--card2))_65%,transparent)] hover:text-[hsl(var(--fg))] focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Copy code"
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? <Check className="h-3.5 w-3.5 opacity-85" /> : <Copy className="h-3.5 w-3.5 opacity-70" />}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto px-4 py-3.5 text-[13px] leading-[1.75] md:text-[13.5px]">
        <code className={["font-mono tabular-nums hljs [font-variant-ligatures:none]", codeClassName].filter(Boolean).join(" ")}>
          {props.children ?? code}
        </code>
      </pre>
    </div>
  );
}

function NoteLoadingSkeleton(props: { transitionTitle?: string | null; titleTransitionName?: string | null }) {
  const transitionTitle = props.transitionTitle?.trim() || "";
  const titleTransitionName = props.titleTransitionName?.trim() || "none";

  return (
    <div className="grid gap-10">
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[2px] hb-skel hb-skel-sheen" />
      <div className="min-w-0">
        <header className="pt-8">
          {transitionTitle ? (
            <>
              <h1
                className="inline-block text-2xl font-bold text-[hsl(var(--accent))] sm:text-3xl"
                style={{ viewTransitionName: titleTransitionName }}
              >
                {transitionTitle}
              </h1>
              <div className="mb-6 mt-2 flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2 opacity-80">
                  <CalendarDays className="h-4 w-4 min-w-[1rem] opacity-40" />
                  <div className="hb-skel h-4 w-24 rounded-full" />
                </div>
                <span className="text-[hsl(var(--muted))]">•</span>
                <div className="hb-skel h-4 w-20 rounded-full" />
              </div>
              <div className="grid gap-2">
                <div className="hb-skel h-4 w-[min(46rem,92%)] rounded-xl" />
                <div className="hb-skel h-4 w-[min(40rem,84%)] rounded-xl" />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3">
                <div className="hb-skel hb-skel-sheen h-10 w-[min(32rem,92%)] rounded-2xl" />
                <div className="hb-skel h-10 w-[min(24rem,78%)] rounded-2xl" />
              </div>
              <div className="mt-6 grid gap-2">
                <div className="hb-skel h-4 w-[min(46rem,92%)] rounded-xl" />
                <div className="hb-skel h-4 w-[min(40rem,84%)] rounded-xl" />
              </div>
            </>
          )}

          <div className="mt-6">
            <details className="pointer-events-none opacity-65">
              <summary className="cursor-default text-xs font-medium tracking-wide text-[hsl(var(--muted))]">On this page</summary>
            </details>
          </div>
        </header>

        <div className="mt-8">
          <div className="grid gap-4">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                className={[
                  "hb-skel h-4 rounded-xl",
                  idx % 4 === 0 ? "w-[92%]" : idx % 4 === 1 ? "w-[86%]" : idx % 4 === 2 ? "w-[95%]" : "w-[78%]",
                ].join(" ")}
              />
            ))}
            <div className="hb-skel hb-skel-sheen mt-2 h-28 rounded-[var(--radius-card)]" />
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`p2-${idx}`}
                className={[
                  "hb-skel h-4 rounded-xl",
                  idx % 3 === 0 ? "w-[90%]" : idx % 3 === 1 ? "w-[96%]" : "w-[84%]",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Lightbox(props: { src: string; alt?: string; onClose: () => void }) {
  const { src, alt, onClose } = props;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[color-mix(in_oklab,black_65%,transparent)] p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-[1100px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[var(--surface-glass)] text-[hsl(var(--fg))] shadow-[0_18px_50px_rgba(0,0,0,.16)] transition hover:bg-[hsl(var(--card))]"
          aria-label="Close"
        >
          <X className="h-5 w-5 opacity-85" />
        </button>

        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[hsl(var(--bg))] shadow-[var(--shadow-float)]">
          <img src={src} alt={alt ?? ""} className="max-h-[84vh] w-full object-contain" decoding="async" />
        </div>

        {alt ? (
          <div className="mt-3 text-center text-xs text-[color-mix(in_oklab,hsl(var(--fg))_60%,hsl(var(--muted)))]">{alt}</div>
        ) : null}
      </div>
    </div>
  );
}

export function NotePage() {
  const { noteId } = useParams();
  const location = useLocation();
  const [note, setNote] = React.useState<Note | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState<NoteListItem[] | null>(null);
  const [lightbox, setLightbox] = React.useState<{ src: string; alt?: string } | null>(null);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [copiedAnchorId, setCopiedAnchorId] = React.useState<string | null>(null);
  const [bodyVisible, setBodyVisible] = React.useState(true);
  const isPostTransition = isPostTransitionState(location.state);

  React.useLayoutEffect(() => {
    setBodyVisible(!isPostTransition);
  }, [isPostTransition, location.key, noteId]);

  React.useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    setNote(api.peekNote(noteId));
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

  React.useEffect(() => {
    if (!isPostTransition) {
      setBodyVisible(true);
      return;
    }
    if (!note) return;

    const timeoutId = window.setTimeout(() => {
      setBodyVisible(true);
    }, 118);

    return () => window.clearTimeout(timeoutId);
  }, [isPostTransition, location.key, note]);

  React.useEffect(() => {
    if (!noteId) return;
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

  const headings = React.useMemo<HeadingRef[]>(() => {
    if (!note?.content) return [];
    const base = extractHeadings(note.content);
    const seen = new Map<string, number>();
    return base.map((h) => {
      const slug = slugifyHeading(h.text);
      const n = (seen.get(slug) ?? 0) + 1;
      seen.set(slug, n);
      return { ...h, id: n === 1 ? slug : `${slug}-${n}` };
    });
  }, [note?.content]);

  const toc = React.useMemo(() => {
    if (!headings.length) return { baseDepth: 2, items: [] as HeadingRef[] };
    const minDepth = headings.reduce((m, h) => Math.min(m, h.depth), Infinity);
    const baseDepth = Number.isFinite(minDepth) ? minDepth : 2;
    const maxDepth = baseDepth + 2;
    const items = headings.filter((h) => h.depth >= baseDepth && h.depth <= maxDepth);
    return { baseDepth, items };
  }, [headings]);

  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(null);
  const tocKey = React.useMemo(() => toc.items.map((t) => t.id).join("|"), [toc.items]);
  React.useEffect(() => {
    if (!toc.items.length) return;
    const els = toc.items.map((t) => document.getElementById(t.id)).filter((x): x is HTMLElement => Boolean(x));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).getBoundingClientRect().top - (b.target as HTMLElement).getBoundingClientRect().top);
        const first = visible[0]?.target as HTMLElement | undefined;
        if (first?.id) setActiveHeadingId(first.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: [0, 1] },
    );
    for (const el of els) obs.observe(el);
    return () => obs.disconnect();
  }, [tocKey]);

  const headingCursorRef = React.useRef(0);
  React.useEffect(() => {
    headingCursorRef.current = 0;
  }, [noteId, tocKey]);
  const tocDetailsRef = React.useRef<HTMLDetailsElement | null>(null);

  const scrollToId = React.useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      // ignore
    }
    try {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      el.scrollIntoView();
    }
  }, []);

  const copiedAnchorTimerRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    return () => {
      if (copiedAnchorTimerRef.current) window.clearTimeout(copiedAnchorTimerRef.current);
    };
  }, []);

  const onCopyAnchor = React.useCallback((id: string) => {
    void (async () => {
      try {
        const url = new URL(window.location.href);
        url.hash = `#${id}`;
        const ok = await tryCopy(url.toString());
        if (!ok) return;
        setCopiedAnchorId(id);
        if (copiedAnchorTimerRef.current) window.clearTimeout(copiedAnchorTimerRef.current);
        copiedAnchorTimerRef.current = window.setTimeout(() => setCopiedAnchorId(null), 900);
      } catch {
        // ignore
      }
    })();
  }, []);

  const onScrollTop = React.useCallback(() => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, []);

  const markdownComponents = React.useMemo(() => {
    const renderHeading = (level: number) => {
      return function HeadingRenderer(props: { children?: React.ReactNode; className?: string }) {
        const text = extractText(props.children).trim();

        let id = "";
        for (let i = headingCursorRef.current; i < headings.length; i++) {
          const h = headings[i];
          if (h.depth === level && h.text.trim() === text) {
            id = h.id;
            headingCursorRef.current = i + 1;
            break;
          }
        }
        if (!id) id = slugifyHeading(text);

        const className = [props.className, "scroll-mt-16 group"].filter(Boolean).join(" ");
        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
        return (
          <Tag id={id} className={className}>
            <span className="inline-flex items-baseline gap-2">
              <span className="min-w-0">{props.children}</span>
              <button
                type="button"
                onClick={() => {
                  onCopyAnchor(id);
                  scrollToId(id);
                }}
                aria-label="Copy link to this section"
                title={copiedAnchorId === id ? "Copied" : "Copy link"}
                className="hb-heading-anchor not-prose inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[hsl(var(--muted))] opacity-0 transition hover:border-[color:var(--border-soft)] hover:bg-[var(--surface-muted-weak)] hover:text-[hsl(var(--fg))] group-hover:opacity-80"
              >
                {copiedAnchorId === id ? <Check className="h-3.5 w-3.5 opacity-85" /> : <Link2 className="h-3.5 w-3.5" />}
              </button>
            </span>
          </Tag>
        );
      };
    };

    return {
      h1: renderHeading(1),
      h2: renderHeading(2),
      h3: renderHeading(3),
      h4: renderHeading(4),
      h5: renderHeading(5),
      h6: renderHeading(6),
      pre: function PreRenderer(props: { children?: React.ReactNode }) {
        const children = props.children;
        const nodes = Array.isArray(children) ? children : [children];
        const codeEl = nodes.find((n) => React.isValidElement(n)) as React.ReactElement | undefined;
        const className = (codeEl?.props as { className?: string } | undefined)?.className ?? "";
        const codeChildren = codeEl ? (codeEl.props as { children?: React.ReactNode }).children : children;
        const raw = extractText(codeChildren);
        const lang = String(className).match(/language-([a-z0-9_-]+)/i)?.[1]?.toUpperCase() ?? null;
        return (
          <CodeBlockCard code={raw} lang={lang} codeClassName={className}>
            {codeChildren}
          </CodeBlockCard>
        );
      },
      code: function CodeRenderer(props: { inline?: boolean; className?: string; children?: React.ReactNode }) {
        if (props.inline) {
          return (
            <code className="hb-inline-code rounded-md border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.92em]">
              {props.children}
            </code>
          );
        }
        return <code className={props.className}>{props.children}</code>;
      },
      img: function ImgRenderer(props: { src?: string; alt?: string }) {
        const src = String(props.src ?? "").trim();
        if (!src) return null;
        const alt = props.alt ?? "";
        return (
          <figure className="not-prose my-7">
            <button
              type="button"
              onClick={() => setLightbox({ src, alt })}
              className="group block w-full overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)] p-0 text-left transition hover:border-[color:var(--border-hover)] hover:bg-[var(--surface-muted-strong)]"
            >
              <img src={src} alt={alt} className="block h-auto w-full" loading="lazy" decoding="async" />
            </button>
            {alt ? (
              <figcaption className="mt-3 text-center text-xs text-[color-mix(in_oklab,hsl(var(--fg))_58%,hsl(var(--muted)))]">
                {alt}
              </figcaption>
            ) : null}
          </figure>
        );
      },
    };
  }, [copiedAnchorId, headings, onCopyAnchor, scrollToId]);

  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const nav = React.useMemo(() => {
    if (!note || !index) return null;
    const i = index.findIndex((n) => n.id === note.id);
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
      <NoteLoadingSkeleton
        transitionTitle={getPostTransitionTitle(location.state)}
        titleTransitionName={getPostTitleTransitionName(location.state) ?? (noteId ? noteTitleTransitionName(noteId) : null)}
      />
    );
  }

  const markdown = normalizeMathDelimiters(note.content);
  const titleTransitionName = getPostTitleTransitionName(location.state) ?? noteTitleTransitionName(note.id);
  const publishedKey = fmtYmdDots(note.date);
  const updatedKey = fmtYmdDots(note.updated);
  const published = fmtLongDate(note.date);
  const updated = fmtLongDate(note.updated);
  const readMinutes = estimateReadMinutes(note.content);
  const metaSecondary = updatedKey !== publishedKey ? `Updated ${updated}` : null;
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
    <div className="grid gap-10">
      <style>{`
        ::view-transition-group(${titleTransitionName}) {
          animation-duration: var(--motion-enter-duration);
          animation-timing-function: var(--motion-standard-ease);
        }
        ::view-transition-old(${titleTransitionName}),
        ::view-transition-new(${titleTransitionName}) {
          animation-duration: var(--motion-enter-duration);
          animation-timing-function: var(--motion-standard-ease);
          animation-fill-mode: both;
        }
        ::view-transition-old(${titleTransitionName}) {
          animation-name: hb-view-fade-out;
        }
        ::view-transition-new(${titleTransitionName}) {
          animation-name: hb-view-fade-in;
        }
      `}</style>
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[2px] bg-[color-mix(in_oklab,hsl(var(--border))_40%,transparent)]">
        <div
          className="h-full bg-[color-mix(in_oklab,hsl(var(--accent))_70%,transparent)]"
          style={{ width: `${(scrollProgress * 100).toFixed(3)}%` }}
        />
      </div>
      {lightbox ? <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} /> : null}
      <div className="min-w-0">
        <header className="pt-8">
          <h1 className="inline-block text-2xl font-bold text-[hsl(var(--accent))] sm:text-3xl" style={{ viewTransitionName: titleTransitionName }}>
            {note.title}
          </h1>

          <div className="mb-6 mt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 opacity-80">
                <CalendarDays className="h-4 w-4 min-w-[1rem]" />
                <span className="text-sm italic sm:text-base">{published}</span>
              </div>
              <span className="text-[hsl(var(--muted))]">•</span>
              <span className="text-sm text-[color-mix(in_oklab,hsl(var(--fg))_60%,hsl(var(--muted)))]">{readMinutes} min read</span>
              {metaSecondary ? (
                <span className="text-sm text-[color-mix(in_oklab,hsl(var(--fg))_52%,hsl(var(--muted)))]">{metaSecondary}</span>
              ) : null}
            </div>
            <Link to="/notes" className="text-sm text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]">
              Notes
            </Link>
          </div>

          {note.excerpt ? (
            <p className="text-base leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_76%,hsl(var(--muted)))] md:text-lg">
              {note.excerpt}
            </p>
          ) : null}

          {toc.items.length ? (
            <details ref={tocDetailsRef} className="mt-6">
              <summary className="cursor-pointer text-xs font-medium tracking-wide text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]">
                On this page
              </summary>
              <nav className="mt-3 border-l border-[color:var(--border-soft)] pl-3">
                {toc.items.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToId(t.id);
                      if (tocDetailsRef.current) tocDetailsRef.current.open = false;
                    }}
                    className={[
                      "block rounded-lg px-2 py-1.5 text-sm transition",
                      activeHeadingId === t.id
                        ? "bg-[color-mix(in_oklab,hsl(var(--accent))_10%,transparent)] text-[hsl(var(--fg))]"
                        : "text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]",
                    ].join(" ")}
                    style={{ marginLeft: `${Math.max(0, t.depth - toc.baseDepth) * 10}px` }}
                  >
                    {t.text}
                  </a>
                ))}
              </nav>
            </details>
          ) : null}
        </header>

        <div
          ref={contentRef}
          className="mt-8"
          style={
            isPostTransition
              ? {
                  opacity: bodyVisible ? 1 : 0,
                  transform: bodyVisible ? "translateY(0)" : "translateY(6px)",
                  transition:
                    "opacity var(--motion-enter-duration) var(--motion-standard-ease), transform var(--motion-enter-duration) var(--motion-standard-ease)",
                }
              : undefined
          }
        >
          <div className="prose max-w-none text-[16px] leading-[1.85] md:text-[17px] prose-headings:font-display prose-headings:font-semibold prose-headings:text-balance prose-headings:tracking-[var(--tracking-tight)] prose-headings:leading-[1.15] prose-h1:text-2xl md:prose-h1:text-3xl prose-h2:text-xl md:prose-h2:text-2xl prose-h2:mt-14 prose-h3:text-lg md:prose-h3:text-xl prose-h3:mt-10 prose-p:leading-[1.85]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false }]]}
              components={markdownComponents}
            >
              {markdown}
            </ReactMarkdown>
          </div>

          <footer className="mt-14">
            {categoryLinks.length ? (
              <ul className="mt-4 mb-8 sm:my-8">
                {categoryLinks.map((category) => (
                  <li key={category} className="group inline-block group-hover:cursor-pointer my-1 underline-offset-4">
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

            {nav?.newer || nav?.older ? (
              <>
                <hr className="my-6 border-dashed border-[color:var(--border-soft)]" />
                <section className="flex flex-col justify-between gap-6 sm:flex-row">
                  {nav.newer ? (
                    <Link
                      to={`/notes/${nav.newer.id}`}
                      state={noteDetailTransitionState(nav.newer.id, { title: nav.newer.title })}
                      viewTransition
                      onClickCapture={preparePostTransitionOnClick}
                      onMouseEnter={() => api.prefetchNote(nav.newer!.id)}
                      onFocus={() => api.prefetchNote(nav.newer!.id)}
                      className="flex items-start gap-2 transition hover:opacity-75"
                    >
                      <ChevronLeft className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-sm text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">Previous Post</span>
                        <div className="text-[color-mix(in_oklab,hsl(var(--accent))_85%,hsl(var(--fg)))]">
                          <span style={{ viewTransitionName: `note-title-${nav.newer.id}` }}>{nav.newer.title}</span>
                        </div>
                      </div>
                    </Link>
                  ) : null}
                  {nav.older ? (
                    <Link
                      to={`/notes/${nav.older.id}`}
                      state={noteDetailTransitionState(nav.older.id, { title: nav.older.title })}
                      viewTransition
                      onClickCapture={preparePostTransitionOnClick}
                      onMouseEnter={() => api.prefetchNote(nav.older!.id)}
                      onFocus={() => api.prefetchNote(nav.older!.id)}
                      className="ml-auto flex items-start justify-end gap-2 text-right transition hover:opacity-75"
                    >
                      <div className="min-w-0">
                        <span className="block text-sm text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">Next Post</span>
                        <div className="text-[color-mix(in_oklab,hsl(var(--accent))_85%,hsl(var(--fg)))]">
                          <span style={{ viewTransitionName: `note-title-${nav.older.id}` }}>{nav.older.title}</span>
                        </div>
                      </div>
                      <ChevronRight className="mt-0.5 shrink-0" />
                    </Link>
                  ) : null}
                </section>
              </>
            ) : (
              <hr className="my-6 border-dashed border-[color:var(--border-soft)]" />
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
