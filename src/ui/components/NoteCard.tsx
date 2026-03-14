import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  noteDetailTransitionState,
  noteTitleTransitionName,
  preparePostTransitionOnClick,
} from "../navigation/transitions";
import type { NoteListItem } from "../types";

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function NoteCard(props: { note: NoteListItem }) {
  const n = props.note;
  const to = `/notes/${n.id}`;
  return (
    <Link
      to={to}
      state={noteDetailTransitionState(n.id, { title: n.title })}
      viewTransition
      onClickCapture={preparePostTransitionOnClick}
      className="group card block p-5 transition-colors hover:bg-[hsl(var(--card2))]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-[hsl(var(--muted))]">
          <span className="tracking-[var(--tracking-wide)] uppercase">Updated</span>
          <span className="ml-2">{fmtDate(n.updated)}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 opacity-35 transition group-hover:opacity-70" />
      </div>
      <h3
        className="mt-3 font-serif text-lg font-semibold tracking-tight"
        style={{ viewTransitionName: noteTitleTransitionName(n.id) }}
      >
        {n.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted))]">{n.excerpt}</p>
    </Link>
  );
}
