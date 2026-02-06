import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import { NoteCard } from "../components/NoteCard";
import { SectionHeader } from "../components/SectionHeader";
import type { NoteListItem } from "../types";

export function NotesPage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const category = sp.get("category") ?? "";
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .notes({ q: q || undefined, category: category || undefined })
      .then((n) => {
        if (cancelled) return;
        setNotes(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [q, category]);

  return (
    <div className="grid gap-6">
      <SectionHeader
        title="Notes"
        desc="全站唯一内容类型：不区分长短。你只管写，索引交给 Categories 与 Roadmaps。"
        right={
          <Link to="/roadmaps" className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]">
            去 Roadmaps →
          </Link>
        }
      />

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => {
              const next = new URLSearchParams(sp);
              if (e.target.value) next.set("q", e.target.value);
              else next.delete("q");
              setSp(next, { replace: true });
            }}
            placeholder="搜索标题/摘要/标签…（或按 ⌘K）"
            className="w-full min-w-[220px] flex-1 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-3 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[color-mix(in_oklab,hsl(var(--accent))_40%,hsl(var(--border)))]"
          />
          {category ? (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(sp);
                next.delete("category");
                setSp(next, { replace: true });
              }}
              className="rounded-2xl border border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,transparent)] px-4 py-3 text-sm transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,transparent)]"
            >
              分类：{category} ×
            </button>
          ) : null}
          <span className="kbd">{notes.length} results</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </div>
    </div>
  );
}

