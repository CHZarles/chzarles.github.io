import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { SectionHeader } from "../components/SectionHeader";
import type { Category } from "../types";

export function CategoriesPage() {
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .categories()
      .then((c) => {
        if (cancelled) return;
        setCategories(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <SectionHeader title="Categories" desc="传统目录入口：你可以像写书一样维护栏目结构与叙事。" />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link key={c.id} to={`/categories/${c.id}`} className="group card p-5 transition-colors hover:bg-[hsl(var(--card2))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold tracking-tight">{c.title}</div>
                <div className="mt-2 text-sm text-[hsl(var(--muted))]">{c.description ?? `/${c.id}`}</div>
              </div>
              <ArrowUpRight className="mt-1 h-4 w-4 opacity-50 transition group-hover:opacity-80" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Chip label={`${c.noteCount ?? 0} notes`} tone="glass" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
