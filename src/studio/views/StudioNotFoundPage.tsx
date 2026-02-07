import { Link } from "react-router-dom";

export function StudioNotFoundPage() {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center px-4">
      <div className="card p-6">
        <div className="text-sm font-semibold tracking-tight">Not found</div>
        <div className="mt-2 text-sm text-[hsl(var(--muted))]">This Studio page does not exist.</div>
        <Link
          to="/studio/notes"
          className="mt-4 inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
        >
          Go to Notes
        </Link>
      </div>
    </div>
  );
}

