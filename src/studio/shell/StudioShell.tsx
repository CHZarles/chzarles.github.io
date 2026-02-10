import { LogIn, LogOut, RefreshCw } from "lucide-react";
import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { AppStateProvider } from "../../ui/state/AppState";
import { StudioStateProvider, useStudioState } from "../state/StudioState";

export function StudioShell() {
  return (
    <AppStateProvider>
      <StudioStateProvider>
        <StudioLayout />
      </StudioStateProvider>
    </AppStateProvider>
  );
}

function StudioLayout() {
  const studio = useStudioState();
  const location = useLocation();

  return (
    <div className="flex h-dvh flex-col bg-[hsl(var(--bg))] text-[hsl(var(--fg))]">
      <header className="flex h-14 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">Hyperblog Studio</div>
            <div className="truncate text-xs text-[hsl(var(--muted))]">{PUBLISHER_BASE_URL}</div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
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
              <button
                type="button"
                onClick={() => void studio.refreshMe()}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                title="Refresh session"
              >
                <RefreshCw className="h-4 w-4 opacity-85" />
                Refresh
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

function StudioTab(props: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        [
          "rounded-full px-3 py-1.5 text-sm transition",
          isActive
            ? "bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))]"
            : "text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
        ].join(" ")
      }
    >
      {props.children}
    </NavLink>
  );
}
