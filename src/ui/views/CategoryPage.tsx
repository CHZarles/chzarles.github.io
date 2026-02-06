import { ArrowLeft } from "lucide-react";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/api";
import { NoteCard } from "../components/NoteCard";
import { SectionHeader } from "../components/SectionHeader";
import type { Category, NoteListItem } from "../types";

export function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = React.useState<Category | null>(null);
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);

  React.useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    api
      .category(slug)
      .then((r) => {
        if (cancelled) return;
        setCategory(r.category);
        setNotes(r.notes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!category) {
    return <div className="card p-8 text-sm text-[hsl(var(--muted))]">加载中…</div>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/categories"
          className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] hover:text-[hsl(var(--fg))]"
        >
          <ArrowLeft className="h-4 w-4 opacity-80" />
          返回 Categories
        </Link>
        <span className="kbd">{notes.length} notes</span>
      </div>

      <SectionHeader title={category.title} desc={category.description ?? `/${category.id}`} />

      <div className="grid gap-3 md:grid-cols-2">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </div>
    </div>
  );
}

