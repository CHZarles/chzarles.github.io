import { Check, Copy, Link2, X } from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { api } from "../api/api";
import { Reveal } from "../components/Reveal";
import { normalizeMathDelimiters } from "../markdown/normalizeMathDelimiters";
import { useAppState } from "../state/AppState";
import type { Note, NoteListItem } from "../types";

type HeadingRef = { depth: number; text: string; id: string };

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
    <div className="not-prose my-7 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] bg-[var(--surface-glass)] px-3 py-1.5">
        <div className="min-w-0 truncate font-mono text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] uppercase text-[hsl(var(--muted))]">
          {lang ? lang : "CODE"}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--muted))] transition hover:bg-[var(--surface-muted-weak)] hover:text-[hsl(var(--fg))]"
          aria-label="Copy code"
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? <Check className="h-3.5 w-3.5 opacity-85" /> : <Copy className="h-3.5 w-3.5 opacity-70" />}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3.5 text-[var(--text-sm)] leading-relaxed">
        <code className={["font-mono hljs", codeClassName].filter(Boolean).join(" ")}>
          {props.children ?? code}
        </code>
      </pre>
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
      <div
        className="relative w-full max-w-[1100px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[var(--surface-glass)] text-[hsl(var(--fg))] shadow-[0_18px_50px_rgba(0,0,0,.16)] transition hover:bg-[hsl(var(--card))]"
          aria-label="Close"
        >
          <X className="h-5 w-5 opacity-85" />
        </button>

        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[hsl(var(--bg))] shadow-[var(--shadow-float)]">
          <img
            src={src}
            alt={alt ?? ""}
            className="max-h-[84vh] w-full object-contain"
            decoding="async"
          />
        </div>

        {alt ? (
          <div className="mt-3 text-center text-xs text-[color-mix(in_oklab,hsl(var(--fg))_60%,hsl(var(--muted)))]">
            {alt}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NotePage() {
  const { noteId } = useParams();
  const [note, setNote] = React.useState<Note | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState<NoteListItem[] | null>(null);
  const [lightbox, setLightbox] = React.useState<{ src: string; alt?: string } | null>(null);
  const { categories } = useAppState();
  const titleById = React.useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.title] as const));
    return (id: string) => m.get(id) ?? null;
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
              <a
                href={`#${id}`}
                aria-label="Link to this section"
                className="hb-heading-anchor not-prose inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[hsl(var(--muted))] opacity-0 transition hover:border-[color:var(--border-soft)] hover:bg-[var(--surface-muted-weak)] hover:text-[hsl(var(--fg))] group-hover:opacity-80"
              >
                <Link2 className="h-3.5 w-3.5" />
              </a>
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
              <img
                src={src}
                alt={alt}
                className="block h-auto w-full"
                loading="lazy"
                decoding="async"
              />
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
  }, [headings]);

  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const nav = React.useMemo(() => {
    if (!note || !index) return null;
    const i = index.findIndex((n) => n.id === note.id);
    if (i < 0) return null;
    const newer = i > 0 ? index[i - 1] : null;
    const older = i + 1 < index.length ? index[i + 1] : null;
    return { newer, older };
  }, [index, note]);

  const related = React.useMemo(() => {
    if (!note || !index) return [] as NoteListItem[];
    const baseCats = new Set(note.categories);
    const baseNodes = new Set(note.nodes.map((r) => r.ref));
    const baseTags = new Set(note.tags);

    const scored: Array<{ score: number; note: NoteListItem }> = [];
    for (const n of index) {
      if (n.id === note.id) continue;
      let score = 0;
      for (const c of n.categories) if (baseCats.has(c)) score += 2;
      for (const r of n.nodes) if (baseNodes.has(r.ref)) score += 3;
      for (const t of n.tags) if (baseTags.has(t)) score += 1;
      if (score > 0) scored.push({ score, note: n });
    }

    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.note.updated.localeCompare(a.note.updated)));
    const out = scored.slice(0, 4).map((s) => s.note);
    if (out.length < 4) {
      for (const n of index) {
        if (out.length >= 4) break;
        if (n.id === note.id) continue;
        if (out.some((x) => x.id === n.id)) continue;
        out.push(n);
      }
    }
    return out;
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
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        加载中…
      </div>
    );
  }

  const markdown = normalizeMathDelimiters(note.content);
  const published = fmtYmdDots(note.date);
  const updated = fmtYmdDots(note.updated);
  const readMinutes = estimateReadMinutes(note.content);
  const metaLine = [published, updated !== published ? `Updated ${updated}` : null, `${readMinutes} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid gap-10">
      {lightbox ? <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} /> : null}
      <Reveal key={note.id} yPx={8} className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-12">
        <div className="min-w-0">
          <header className="mx-auto max-w-[85ch] pt-10">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]"
            >
              <span aria-hidden="true">↩</span>
              <span>Index</span>
            </Link>
            <div className="font-mono text-[11px] tabular-nums tracking-[var(--tracking-wide)] text-[hsl(var(--muted))]">
              {metaLine}
            </div>
            <h1 className="mt-4 font-display text-[clamp(2.05rem,3.6vw,2.85rem)] font-semibold leading-[1.06] tracking-[var(--tracking-tight)]">
              {note.title}
            </h1>
            {note.excerpt ? (
              <p className="mt-4 text-base leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_76%,hsl(var(--muted)))] md:text-lg">
                {note.excerpt}
              </p>
            ) : null}

            {(note.categories.length || note.nodes.length || note.tags.length || note.mindmaps.length) ? (
              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[hsl(var(--muted))]">
                {note.categories.slice(0, 3).map((c) => {
                  const title = titleById(c);
                  if (!title) return null;
                  return (
                    <Link
                      key={c}
                      to={`/categories/${c}`}
                      className="hover:text-[hsl(var(--fg))]"
                    >
                      #{title}
                    </Link>
                  );
                })}
                {note.nodes.slice(0, 2).map((r) => (
                  <Link
                    key={r.ref}
                    to={`/roadmaps/${r.roadmapId}/node/${r.nodeId}`}
                    className="hover:text-[hsl(var(--fg))]"
                  >
                    {r.roadmapTitle} / {r.title}
                  </Link>
                ))}
                {note.tags.slice(0, 6).map((t) => (
                  <span key={t} className="text-[color-mix(in_oklab,hsl(var(--fg))_58%,hsl(var(--muted)))]">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            {toc.items.length ? (
              <details className="mt-8 xl:hidden">
                <summary className="cursor-pointer text-xs font-medium tracking-wide text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]">
                  On this page
                </summary>
                <nav className="mt-3 border-l border-[color:var(--border-soft)] pl-3">
                  {toc.items.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
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

            <div className="mt-10 flex justify-center" aria-hidden="true">
              <div className="h-px w-64 bg-[var(--border-soft)]" />
            </div>
          </header>

          <div ref={contentRef} className="mx-auto mt-10 max-w-[85ch]">
            <div className="prose max-w-none text-[15px] leading-[1.75] md:text-[16px] prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-[var(--tracking-tight)] prose-headings:leading-[1.15] prose-h1:text-2xl md:prose-h1:text-3xl prose-h2:text-xl md:prose-h2:text-2xl prose-h2:mt-14 prose-h3:text-lg md:prose-h3:text-xl prose-h3:mt-10 prose-p:leading-[1.75]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false }]]}
                components={markdownComponents}
              >
                {markdown}
              </ReactMarkdown>
            </div>

            {note.mindmaps.length ? (
              <section className="mt-14">
                <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">
                  MINDMAPS
                </div>
                <div className="mt-4 divide-y divide-[color:var(--border-soft)]">
                  {note.mindmaps.map((m) => (
                    <Link
                      key={m.id}
                      to={`/mindmaps/${m.id}`}
                      className="group -mx-1 flex items-baseline justify-between gap-4 rounded-xl px-1 py-3 transition hover:bg-[var(--surface-muted-weak)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-serif text-sm font-semibold tracking-tight text-[hsl(var(--fg))]">
                          {m.title}
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-[11px] tracking-[0.18em] text-[hsl(var(--muted))]">
                        OPEN
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-soft)] pt-7">
              <div className="text-xs font-medium tracking-wide text-[hsl(var(--muted))]">Permalink</div>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText?.(window.location.href)}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-transparent px-4 py-2 text-sm text-[hsl(var(--fg))] transition hover:bg-[var(--surface-muted-weak)]"
              >
                <Link2 className="h-4 w-4 opacity-75" />
                Copy link
              </button>
            </div>

            {nav?.newer || nav?.older ? (
              <section className="mt-10 grid gap-6 md:grid-cols-2">
                {nav.newer ? (
                  <Link
                    to={`/notes/${nav.newer.id}`}
                    className="group -mx-2 rounded-xl px-2 py-3 transition hover:bg-[var(--surface-muted-weak)]"
                  >
                    <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">
                      NEWER
                    </div>
                    <div className="mt-2 font-serif text-lg font-semibold tracking-tight text-[hsl(var(--fg))]">
                      {nav.newer.title}
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">
                      {nav.newer.excerpt}
                    </div>
                  </Link>
                ) : (
                  <div />
                )}
                {nav.older ? (
                  <Link
                    to={`/notes/${nav.older.id}`}
                    className="group -mx-2 rounded-xl px-2 py-3 transition hover:bg-[var(--surface-muted-weak)]"
                  >
                    <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">
                      OLDER
                    </div>
                    <div className="mt-2 font-serif text-lg font-semibold tracking-tight text-[hsl(var(--fg))]">
                      {nav.older.title}
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">
                      {nav.older.excerpt}
                    </div>
                  </Link>
                ) : (
                  <div />
                )}
              </section>
            ) : null}

            {related.length ? (
              <section className="mt-12">
                <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">
                  CONTINUE
                </div>
                <div className="mt-4 divide-y divide-[color:var(--border-soft)]">
                  {related.map((n) => (
                    <Link
                      key={n.id}
                      to={`/notes/${n.id}`}
                      className="group -mx-1 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 rounded-xl px-1 py-3.5 transition hover:bg-[var(--surface-muted-weak)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-serif text-sm font-semibold tracking-tight text-[hsl(var(--fg))] md:text-base">
                          {n.title}
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-[hsl(var(--muted))]">{n.excerpt}</div>
                      </div>
                      <div className="shrink-0 font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                        {fmtMdDots(n.updated)}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        {toc.items.length ? (
          <aside className="hidden xl:block">
            <div className="sticky top-12">
              <div className="border-l border-[color:var(--border-soft)] pl-4">
                <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">
                  ON THIS PAGE
                </div>
                <nav className="mt-4 max-h-[calc(100vh-170px)] overflow-auto pr-2 [-webkit-overflow-scrolling:touch]">
                  {toc.items.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
                      className={[
                        "relative block rounded-lg py-1.5 pl-3 pr-2 text-[13px] leading-snug transition",
                        "before:absolute before:left-[0.5px] before:top-[0.85em] before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:border before:border-[color:var(--border-soft)] before:bg-[hsl(var(--bg))]",
                        activeHeadingId === t.id
                          ? "text-[hsl(var(--fg))] before:border-[hsl(var(--accent))] before:bg-[hsl(var(--accent))]"
                          : "text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))] hover:before:border-[color:var(--border-hover)]",
                      ].join(" ")}
                      style={{ marginLeft: `${Math.max(0, t.depth - toc.baseDepth) * 8}px` }}
                    >
                      {t.text}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </aside>
        ) : null}
      </Reveal>
    </div>
  );
}
