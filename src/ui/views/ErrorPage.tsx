import { ArrowLeft, RefreshCcw } from "lucide-react";
import React from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

function formatUnknown(err: unknown): string {
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

export function ErrorPage() {
  const err = useRouteError();

  const { title, message, stack } = (() => {
    if (isRouteErrorResponse(err)) {
      return {
        title: `${err.status} ${err.statusText || ""}`.trim(),
        message: "路由加载失败或页面运行时异常。",
        stack: null as string | null,
      };
    }
    if (err instanceof Error) {
      return {
        title: err.name || "Error",
        message: err.message || "Unknown error",
        stack: err.stack ?? null,
      };
    }
    return {
      title: "Unknown error",
      message: formatUnknown(err),
      stack: null as string | null,
    };
  })();

  const showStack = Boolean(import.meta.env.DEV && stack);

  return (
    <div className="card p-10">
      <div className="text-sm text-[hsl(var(--muted))]">Error</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{title}</div>
      <p className="mt-3 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_72%,hsl(var(--muted)))]">{message}</p>

      {showStack ? (
        <pre className="mt-6 max-h-[50vh] overflow-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] p-4 text-xs leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))]">
          {stack}
        </pre>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-[color-mix(in_oklab,hsl(var(--accent))_22%,transparent)] px-4 py-2.5 text-sm font-medium transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_28%,transparent)]"
        >
          <ArrowLeft className="h-4 w-4 opacity-85" />
          回到首页
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
        >
          <RefreshCcw className="h-4 w-4 opacity-80" />
          Reload
        </button>
      </div>
    </div>
  );
}

