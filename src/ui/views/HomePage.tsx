import { ArrowUpRight, Compass } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { HeroBackdrop } from "../components/HeroBackdrop";
import { NoteCard } from "../components/NoteCard";
import { SectionHeader } from "../components/SectionHeader";
import { useAppState } from "../state/AppState";
import type { Category, NoteListItem, Project, RoadmapListItem } from "../types";

export function HomePage() {
  const { profile } = useAppState();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [roadmaps, setRoadmaps] = React.useState<RoadmapListItem[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([api.notes(), api.categories(), api.roadmaps(), api.projects()])
      .then(([n, c, r, p]) => {
        if (cancelled) return;
        setNotes(n.slice(0, 6));
        setCategories(c.slice(0, 6));
        setRoadmaps(r.slice(0, 4));
        setProjects(p.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <section className="card relative min-h-[clamp(320px,40vh,520px)]">
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit" }}>
          <HeroBackdrop
            imageUrl={profile?.hero?.imageUrl}
            blurPx={profile?.hero?.blurPx}
            opacity={profile?.hero?.opacity}
            position={profile?.hero?.position}
          />
        </div>
        <div className="relative p-6 md:p-9">
          <div className="max-w-[78ch] min-w-0">
            <div className="text-xs tracking-[0.2em] uppercase text-[hsl(var(--muted))]">
              Editorial notes · Categories + Roadmaps
            </div>
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              {profile?.name ?? "Hyperblog"}
              <span className="text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]"> / </span>
              <span className="text-[hsl(var(--accent))]">{profile?.handle ?? "@you"}</span>
            </h1>
            <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_74%,hsl(var(--muted)))]">
              {profile?.tagline ?? "把 Notes、Categories 与 Roadmaps 三套入口合一：可读、可索引、可证明。"}
            </p>

            {profile?.now?.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {profile.now.map((x) => (
                  <Chip key={x} label={`Now: ${x}`} tone="accent" />
                ))}
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-3">
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
