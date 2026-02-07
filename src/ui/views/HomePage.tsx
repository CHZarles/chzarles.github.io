import { ArrowUpRight, Compass } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { HeroBackdrop } from "../components/HeroBackdrop";
import { NoteCard } from "../components/NoteCard";
import { SectionHeader } from "../components/SectionHeader";
import { useAppState } from "../state/AppState";
import type { Category, NoteListItem } from "../types";

function fmtIssue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "—";
  try {
    const s = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
    return s.toUpperCase();
  } catch {
    return d.toISOString().slice(0, 7);
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function cssColor(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  if (
    s.startsWith("hsl(") ||
    s.startsWith("rgb(") ||
    s.startsWith("rgba(") ||
    s.startsWith("#") ||
    s.startsWith("color-mix(")
  ) {
    return s;
  }
  return `hsl(${s})`;
}

export function HomePage() {
  const { profile, theme } = useAppState();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([api.notes(), api.categories()])
      .then(([n, c]) => {
        if (cancelled) return;
        setNotes(n.slice(0, 6));
        setCategories(c.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const heroFg = (() => {
    const cfg = profile?.hero?.textColor;
    const raw = theme === "dark" ? cfg?.dark : cfg?.light;
    return raw ? cssColor(raw) : "hsl(var(--hero-fg))";
  })();

  const heroScale = clamp(profile?.hero?.textScale ?? 1, 0.85, 1.25);
  const heroTitleSize = `clamp(${(2.25 * heroScale).toFixed(3)}rem, ${(4.4 * heroScale).toFixed(3)}vw, ${(
    3.25 * heroScale
  ).toFixed(3)}rem)`;
  const heroTaglineSize = `clamp(${(0.95 * heroScale).toFixed(3)}rem, ${(1.15 * heroScale).toFixed(3)}vw, ${(
    1.06 * heroScale
  ).toFixed(3)}rem)`;

  return (
    <div className="grid gap-8">
      <section className="relative left-1/2 flex min-h-[440px] w-[calc(100vw-var(--sbw,0px))] -translate-x-1/2 overflow-hidden border-y border-[hsl(var(--border))] bg-[hsl(var(--card))] md:min-h-[clamp(600px,68vh,960px)]">
        <div aria-hidden="true" className="absolute inset-0">
          <HeroBackdrop
            imageUrl={profile?.hero?.imageUrl}
            blurPx={profile?.hero?.blurPx}
            opacity={profile?.hero?.opacity}
            position={profile?.hero?.position}
            tintOpacity={profile?.hero?.tintOpacity}
            washOpacity={profile?.hero?.washOpacity}
            saturate={profile?.hero?.saturate}
            contrast={profile?.hero?.contrast}
          />
        </div>
        <div className="container relative flex flex-1 flex-col py-10 md:py-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="text-[10px] font-semibold tracking-[0.26em] uppercase"
              style={{ color: heroFg, opacity: 0.86 }}
            >
              Editorial Notes
            </div>
            <div className="text-[10px] tracking-[0.26em] uppercase" style={{ color: heroFg, opacity: 0.78 }}>
              ISSUE · {fmtIssue(notes[0]?.updated)}
            </div>
          </div>

          <div className="mt-10 min-w-0 max-w-[78ch]">
            <h1
              className="hero-ink font-serif font-semibold leading-[1.02] tracking-tight"
              style={{ color: heroFg, fontSize: heroTitleSize }}
            >
              {profile?.name ?? "Hyperblog"}
              <span
                aria-hidden="true"
                className="mx-3 inline-block h-[0.9em] w-px bg-[color-mix(in_oklab,hsl(var(--accent))_70%,transparent)] align-[-0.12em]"
              />
              <span className="font-mono text-[0.9em] font-medium tracking-[-0.02em] text-[hsl(var(--accent))]">
                {profile?.handle ?? "@you"}
              </span>
            </h1>
            <p
              className="mt-4 max-w-[60ch] leading-relaxed tracking-[-0.01em]"
              style={{ color: heroFg, opacity: 0.82, fontSize: heroTaglineSize }}
            >
              {profile?.tagline ?? "把 Notes、Categories 与 Roadmaps 三套入口合一：可读、可索引、可证明。"}
            </p>
          </div>

          <div className="mt-auto pt-10">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/roadmaps"
                className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--fg))] transition hover:bg-[hsl(var(--card2))]"
              >
                <Compass className="h-4 w-4 opacity-80" />
                Explore Roadmaps
                <ArrowUpRight className="h-4 w-4 opacity-80" />
              </Link>
              <Link
                to="/notes"
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
              >
                Browse Notes
                <ArrowUpRight className="h-4 w-4 opacity-70" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <SectionHeader
          title="Latest Notes"
          desc="不区分长短文：同一个 Note，既能挂到 Category，也能挂到 Roadmap 节点。"
          right={
            <Link to="/notes" className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]">
              浏览全部 →
            </Link>
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <SectionHeader
          title="Categories"
          desc="传统目录入口：适合对外叙述与长期沉淀。"
          right={
            <Link to="/categories" className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]">
              查看全部 →
            </Link>
          }
        />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link key={c.id} to={`/categories/${c.id}`} className="group card p-5 transition-colors hover:bg-[hsl(var(--card2))]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold tracking-tight">{c.title}</div>
                  <div className="mt-2 text-sm text-[hsl(var(--muted))]">{c.description ?? "作为传统目录入口"}</div>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 opacity-50 transition group-hover:opacity-80" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Chip label={`${c.noteCount ?? 0} notes`} tone="glass" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
