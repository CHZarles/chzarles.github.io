import { ArrowLeft, Link2 } from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { useAppState } from "../state/AppState";
import type { Note } from "../types";

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
    };
  }, [headings]);

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
    <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/notes"
            className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_55%,transparent)] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] hover:text-[hsl(var(--fg))]"
          >
            <ArrowLeft className="h-4 w-4 opacity-80" />
            返回 Notes
          </Link>
          <span className="text-xs text-[hsl(var(--muted))]">Updated · {fmtDate(note.updated)}</span>
        </div>

        <header className="mx-auto mt-8 max-w-[78ch]">
          <div className="text-xs uppercase tracking-[0.22em] text-[hsl(var(--muted))]">Note</div>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.07] tracking-tight md:text-5xl">
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
              <nav className="mt-3 border-l border-[hsl(var(--border))] pl-3">
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

        <div className="mx-auto mt-10 max-w-[78ch] border-t border-[hsl(var(--border))] pt-8">
          <div className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-h1:text-2xl md:prose-h1:text-3xl prose-h2:text-xl md:prose-h2:text-2xl prose-h3:text-lg md:prose-h3:text-xl prose-p:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {note.content}
            </ReactMarkdown>
          </div>

          {note.mindmaps.length ? (
            <section className="mt-12 border-t border-[hsl(var(--border))] pt-8">
              <div className="text-xs font-semibold tracking-[0.22em] text-[hsl(var(--muted))]">MINDMAPS</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {note.mindmaps.map((m) => (
                  <Link
                    key={m.id}
                    to={`/mindmaps/${m.id}`}
                    className="group rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_55%,transparent)] p-5 transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_22%,hsl(var(--border)))] hover:bg-[color-mix(in_oklab,hsl(var(--card2))_75%,transparent)]"
                  >
                    <div className="text-xs text-[hsl(var(--muted))]">Mindmap</div>
                    <div className="mt-1 text-base font-semibold tracking-tight text-[hsl(var(--fg))]">{m.title}</div>
                    <div className="mt-2 text-xs text-[hsl(var(--muted))]">/{m.id}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-7">
            <div className="text-xs font-medium tracking-wide text-[hsl(var(--muted))]">Permalink</div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText?.(window.location.href)}
              className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_55%,transparent)] px-4 py-2 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]"
            >
              <Link2 className="h-4 w-4 opacity-80" />
              Copy link
            </button>
          </div>
        </div>
      </div>

      {toc.items.length ? (
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_55%,transparent)] p-5">
              <div className="text-xs font-semibold tracking-[0.22em] text-[hsl(var(--muted))]">ON THIS PAGE</div>
              <nav className="mt-3 border-l border-[hsl(var(--border))] pl-3">
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
