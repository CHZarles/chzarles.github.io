import { ArrowUpRight, LayoutList } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { EmptyStatePanel } from "../components/EmptyStatePanel";
import { SectionHeader } from "../components/SectionHeader";
import type { Category } from "../types";

export function CategoriesPage() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .categories()
      .then((c) => {
        if (cancelled) return;
        setCategories(c);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <SectionHeader title="Categories" desc="传统目录入口：像写书一样编排栏目，让叙事更有序。" />

      {error ? (
        <div className="card p-8 text-sm text-[hsl(var(--muted))]">
          <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
          <div className="mt-2 break-words">{error}</div>
        </div>
      ) : loading ? (
        <div className="card p-7 text-sm text-[hsl(var(--muted))]">加载中…</div>
      ) : categories.length ? (
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
      ) : (
        <EmptyStatePanel
          icon={<LayoutList className="h-5 w-5 opacity-85" />}
          title="Categories 还没开始"
          desc="把栏目当作章节来维护：长期沉淀、对外叙事与检索都会更清晰。"
          hint="正在编排中。"
        />
      )}
    </div>
  );
}
