import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="card p-10">
      <div className="text-sm text-[hsl(var(--muted))]">404</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">页面不存在</div>
      <p className="mt-3 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_72%,hsl(var(--muted)))]">
        你可以回到首页，或者按 <span className="kbd">⌘K</span> 搜索。
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-[color-mix(in_oklab,hsl(var(--accent))_22%,transparent)] px-4 py-2.5 text-sm font-medium transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_28%,transparent)]"
        >
          <ArrowLeft className="h-4 w-4 opacity-85" />
          回到首页
        </Link>
      </div>
    </div>
  );
}

