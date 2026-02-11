import { ArrowUpRight, CloudDownload, LogIn, LogOut } from "lucide-react";
import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { AppStateProvider } from "../../ui/state/AppState";
import { StudioStateProvider, useStudioState } from "../state/StudioState";
import { StudioWorkspaceProvider, useStudioWorkspace } from "../state/StudioWorkspace";

export function StudioShell() {
  return (
    <AppStateProvider>
      <StudioStateProvider>
        <StudioWorkspaceProvider>
          <StudioLayout />
        </StudioWorkspaceProvider>
      </StudioStateProvider>
    </AppStateProvider>
  );
}

function StudioLayout() {
  const studio = useStudioState();
  const location = useLocation();
  const ws = useStudioWorkspace();
  const repo = studio.me?.repo ?? null;

  const headShort = repo?.headSha ? repo.headSha.slice(0, 7) : "—";
  const draftsCount = ws.stats.total;
  const opsCount =
    ws.stats.notes + ws.stats.roadmaps + ws.stats.mindmaps + ws.stats.config + ws.stats.assetsUploads + ws.stats.assetsDeletes;

  return (
    <div className="flex h-dvh flex-col bg-[hsl(var(--bg))] text-[hsl(var(--fg))]">
      <header className="flex h-14 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">Hyperblog Studio</div>
            <div className="truncate text-xs text-[hsl(var(--muted))]">
              {repo ? (
                <>
                  <span className="font-medium text-[hsl(var(--fg))]">{repo.fullName}</span> · {repo.branch} · HEAD{" "}
                  <span className="font-mono">{headShort}</span> · Drafts{" "}
                  <span className={draftsCount ? "font-semibold text-[hsl(var(--fg))]" : ""}>{draftsCount}</span> · Ops{" "}
                  <span className={opsCount ? "font-semibold text-[hsl(var(--fg))]" : ""}>{opsCount}</span>
                </>
              ) : (
                <>
                  Publisher <span className="font-mono">{PUBLISHER_BASE_URL}</span> · Drafts{" "}
                  <span className={draftsCount ? "font-semibold text-[hsl(var(--fg))]" : ""}>{draftsCount}</span> · Ops{" "}
                  <span className={opsCount ? "font-semibold text-[hsl(var(--fg))]" : ""}>{opsCount}</span>
                </>
              )}
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <StudioTab to="/studio/changes" badge={ws.stats.total ? ws.stats.total : null}>
              Changes
            </StudioTab>
            <StudioTab to="/studio/notes">Notes</StudioTab>
            <StudioTab to="/studio/mindmaps">Mindmaps</StudioTab>
            <StudioTab to="/studio/assets">Assets</StudioTab>
            <StudioTab to="/studio/roadmaps">Roadmaps</StudioTab>
            <StudioTab to="/studio/config">Config</StudioTab>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {studio.token ? (
            <>
              {studio.meError ? (
                <div
                  className="hidden max-w-[420px] truncate rounded-full border border-[color-mix(in_oklab,red_40%,hsl(var(--border)))] bg-[color-mix(in_oklab,red_6%,hsl(var(--card)))] px-3 py-2 text-xs text-red-700 md:block"
                  title={studio.meError}
                >
                  {studio.meError}
                </div>
              ) : null}
              {ws.publishError ? (
                <NavLink
                  to={ws.publishError.code === "HEAD_MOVED" ? "/studio/changes?compare=remote" : "/studio/changes"}
                  className="hidden max-w-[520px] truncate rounded-full border border-[color-mix(in_oklab,red_40%,hsl(var(--border)))] bg-[color-mix(in_oklab,red_6%,hsl(var(--card)))] px-3 py-2 text-xs text-red-700 transition hover:bg-[color-mix(in_oklab,red_10%,hsl(var(--card)))] md:block"
                  title={ws.publishError.message}
                >
                  {ws.publishError.code === "HEAD_MOVED" ? "Remote moved · Review diff" : "Publish failed · View details"}
                </NavLink>
              ) : ws.lastCommitUrl ? (
                <a
                  href={ws.lastCommitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden max-w-[520px] truncate rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] md:block"
                  title="Last publish commit"
                >
                  Last publish · View commit
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void ws.publishAll({ confirm: true })}
                disabled={!ws.stats.total || ws.publishing}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition",
                  !ws.stats.total || ws.publishing
                    ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                    : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
                ].join(" ")}
                title="Publish all local changes (single GitHub commit)"
              >
                <ArrowUpRight className="h-4 w-4 opacity-85" />
                {ws.publishing ? "Publishing…" : ws.stats.total ? `Publish ${ws.stats.total}` : "Publish"}
              </button>
              <button
                type="button"
                onClick={studio.forceSync}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                title="Force sync: clear local caches (keeps drafts) and re-fetch from GitHub"
              >
                <CloudDownload className="h-4 w-4 opacity-85" />
                Sync
              </button>
              <button
                type="button"
                onClick={studio.logout}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
              >
                <LogOut className="h-4 w-4 opacity-85" />
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => studio.login(location.pathname + location.search + location.hash)}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
            >
              <LogIn className="h-4 w-4 opacity-85" />
              Login with GitHub
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {studio.token ? (
          <Outlet />
        ) : (
          <div className="mx-auto flex h-full max-w-xl flex-col justify-center px-4">
            <div className="card p-6">
              <div className="text-sm font-semibold tracking-tight">Sign in</div>
              <div className="mt-1 text-sm text-[hsl(var(--muted))]">GitHub OAuth → Bearer Token. Token is stored in sessionStorage.</div>
              {studio.meError ? <div className="mt-3 text-xs text-red-600">{studio.meError}</div> : null}
              <button
                type="button"
                onClick={() => studio.login("/studio/notes")}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] px-4 py-2 text-sm font-medium text-[hsl(var(--fg))] transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]"
              >
                <LogIn className="h-4 w-4 opacity-85" />
                Login with GitHub
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudioTab(props: { to: string; children: React.ReactNode; badge?: number | null }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        [
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition",
          isActive
            ? "bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))]"
            : "text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
        ].join(" ")
      }
    >
      {props.children}
      {props.badge ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-0.5 text-[10px] font-semibold tracking-tight text-[hsl(var(--muted))]">
          {props.badge}
        </span>
      ) : null}
    </NavLink>
  );
}
