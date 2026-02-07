import { ArrowLeft } from "lucide-react";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { NoteCard } from "../components/NoteCard";
import { SectionHeader } from "../components/SectionHeader";
import type { NoteListItem, RoadmapNodeDetail } from "../types";

function orderNotes(notes: NoteListItem[], pinned?: string[]) {
  if (!pinned?.length) return notes;
  const pinSet = new Set(pinned);
  const pinnedNotes = notes.filter((n) => pinSet.has(n.id));
  const rest = notes.filter((n) => !pinSet.has(n.id));
  return [...pinnedNotes, ...rest];
}

export function RoadmapNodePage() {
  const { roadmapId, nodeId } = useParams();
  const [detail, setDetail] = React.useState<RoadmapNodeDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!roadmapId || !nodeId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    api
      .node(roadmapId, nodeId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [roadmapId, nodeId]);

  if (error) {
    return (
      <div className="card p-8 text-sm text-[hsl(var(--muted))]">
        <div className="text-base font-semibold tracking-tight text-[hsl(var(--fg))]">加载失败</div>
        <div className="mt-2 break-words">{error}</div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {roadmapId ? (
            <Link
              to={`/roadmaps/${roadmapId}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]"
            >
              <ArrowLeft className="h-4 w-4 opacity-80" />
              返回 Roadmap
            </Link>
          ) : null}
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

  if (!detail || !roadmapId || !nodeId) {
    return <div className="card p-8 text-sm text-[hsl(var(--muted))]">加载中…</div>;
  }

  const notes = orderNotes(detail.notes, detail.node.pinned);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/roadmaps/${roadmapId}`}
          className="inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_70%,transparent)] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))] hover:text-[hsl(var(--fg))]"
        >
          <ArrowLeft className="h-4 w-4 opacity-80" />
          返回 Roadmap
        </Link>
        <div className="flex items-center gap-2">
          <Chip label={`${notes.length} notes`} tone="glass" />
        </div>
      </div>

      <SectionHeader
        title={detail.node.title}
        desc={detail.node.crumbs.map((c) => c.title).join(" / ")}
        right={<Chip label={detail.node.roadmapTitle} tone="accent" />}
      />

      {detail.node.description ? (
        <div className="card p-6 text-sm leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_74%,hsl(var(--muted)))]">
          {detail.node.description}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </div>
    </div>
  );
}
