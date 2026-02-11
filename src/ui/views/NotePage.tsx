import { Check, Copy, Link2, X } from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { useAppState } from "../state/AppState";
import type { Note, NoteListItem } from "../types";

type HeadingRef = { depth: number; text: string; id: string };

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
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
    .replace(/[^a-z0-9]+/g, "-")
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

        const className = [props.className, "scroll-mt-24"].filter(Boolean).join(" ");
        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
        return (
          <Tag id={id} className={className}>
            {props.children}
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

  return (
    <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
      {lightbox ? <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} /> : null}
      <div className="min-w-0">
        <header className="mx-auto mt-6 max-w-[92ch]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">Note</div>
            <div className="text-xs text-[hsl(var(--muted))]">Updated · {fmtDate(note.updated)}</div>
          </div>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.07] tracking-[var(--tracking-tight)] md:text-5xl">
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

          {toc.items.length ? (
            <details className="mt-7 lg:hidden">
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
        </header>

        <div ref={contentRef} className="mx-auto mt-10 max-w-[92ch]">
          <div className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-h1:text-2xl md:prose-h1:text-3xl prose-h2:text-xl md:prose-h2:text-2xl prose-h3:text-lg md:prose-h3:text-xl prose-p:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={markdownComponents}>
              {note.content}
            </ReactMarkdown>
          </div>

          {note.mindmaps.length ? (
            <section className="mt-12 hairline pt-8">
              <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">MINDMAPS</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {note.mindmaps.map((m) => (
                  <Link
                    key={m.id}
                    to={`/mindmaps/${m.id}`}
                    className="group rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)] p-5 transition hover:border-[color:var(--border-hover)] hover:bg-[var(--surface-muted-strong)]"
                  >
                    <div className="text-xs text-[hsl(var(--muted))]">Mindmap</div>
                    <div className="mt-1 text-base font-semibold tracking-tight text-[hsl(var(--fg))]">{m.title}</div>
                    <div className="mt-2 text-xs text-[hsl(var(--muted))]">/{m.id}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 hairline pt-7">
            <div className="text-xs font-medium tracking-wide text-[hsl(var(--muted))]">Permalink</div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText?.(window.location.href)}
              className="inline-flex items-center gap-2 rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)] px-4 py-2 text-sm transition hover:border-[color:var(--border-hover)]"
            >
              <Link2 className="h-4 w-4 opacity-80" />
              Copy link
            </button>
          </div>

          {nav?.newer || nav?.older ? (
            <section className="mt-8 grid gap-3 md:grid-cols-2">
              {nav.newer ? (
                <Link
                  to={`/notes/${nav.newer.id}`}
                  className="group rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)] p-5 transition hover:border-[color:var(--border-hover)] hover:bg-[var(--surface-muted-strong)]"
                >
                  <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">NEWER</div>
                  <div className="mt-2 font-serif text-lg font-semibold tracking-tight text-[hsl(var(--fg))]">
                    {nav.newer.title}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">{nav.newer.excerpt}</div>
                </Link>
              ) : (
                <div />
              )}
              {nav.older ? (
                <Link
                  to={`/notes/${nav.older.id}`}
                  className="group rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)] p-5 transition hover:border-[color:var(--border-hover)] hover:bg-[var(--surface-muted-strong)]"
                >
                  <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">OLDER</div>
                  <div className="mt-2 font-serif text-lg font-semibold tracking-tight text-[hsl(var(--fg))]">
                    {nav.older.title}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">{nav.older.excerpt}</div>
                </Link>
              ) : (
                <div />
              )}
            </section>
          ) : null}

          {related.length ? (
            <section className="mt-10 hairline pt-8">
              <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">CONTINUE</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {related.map((n) => (
                  <Link
                    key={n.id}
                    to={`/notes/${n.id}`}
                    className="group rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-glass)] p-5 transition hover:bg-[var(--surface-muted)]"
                  >
                    <div className="text-xs text-[hsl(var(--muted))]">Updated · {fmtDate(n.updated)}</div>
                    <div className="mt-2 font-serif text-lg font-semibold tracking-tight text-[hsl(var(--fg))]">{n.title}</div>
                    <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">{n.excerpt}</div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {n.categories.slice(0, 2).map((c) => (
                        <Chip key={c} label={`#${titleById(c)}`} tone="glass" />
                      ))}
                      {n.nodes.slice(0, 1).map((r) => (
                        <Chip
                          key={r.ref}
                          label={`${r.roadmapTitle} / ${r.title}`}
                          tone="accent"
                        />
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {toc.items.length ? (
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)] p-5">
              <div className="text-[var(--text-kicker)] font-semibold tracking-[var(--tracking-kicker)] text-[hsl(var(--muted))]">ON THIS PAGE</div>
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
            </div>
          </div>
        </aside>
      ) : null}
    </article>
  );
}
