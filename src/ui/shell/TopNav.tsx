import { Search } from "lucide-react";
import React from "react";
import { Link, NavLink } from "react-router-dom";
import { api } from "../api/api";
import { useAppState } from "../state/AppState";
import { ThemeToggle } from "../widgets/ThemeToggle";

function formatSiteLabel(handle: string | undefined, name: string | undefined): string {
  const cleanedHandle = handle?.replace(/^@/, "").trim();
  if (cleanedHandle) return cleanedHandle.slice(0, 1).toUpperCase() + cleanedHandle.slice(1);
  return name?.trim() || "Home";
}

function NavItem(props: {
  to: string;
  label: string;
  prefetch?: () => void;
}) {
  return (
    <NavLink
      to={props.to}
      onMouseEnter={props.prefetch}
      onFocus={props.prefetch}
      className={({ isActive }) =>
        [
          "inline-flex items-center px-2 py-1 text-sm font-medium transition",
          isActive
            ? "text-[hsl(var(--accent))] underline decoration-wavy underline-offset-4"
            : "text-[hsl(var(--fg))] hover:text-[hsl(var(--accent))]",
        ].join(" ")
      }
    >
      <span>{props.label}</span>
    </NavLink>
  );
}

export function TopNav() {
  const { profile } = useAppState();
  const siteLabel = formatSiteLabel(profile?.handle, profile?.name);

  const prefetch = React.useMemo(
    () => ({
      notes: () => void api.notes(),
      projects: () => void api.projects(),
    }),
    [],
  );

  return (
    <header className="container font-mono">
      <div className="mx-auto max-w-[48rem]">
        <div className="flex items-baseline justify-between gap-4">
          <Link to="/" className="whitespace-nowrap py-4 text-2xl font-semibold leading-7 tracking-tight text-[hsl(var(--fg))] sm:py-6">
            {siteLabel}
          </Link>

          <div className="flex items-center gap-1 py-4 sm:gap-2 sm:py-6">
            <nav className="hidden items-center gap-5 md:flex">
              <NavItem to="/notes" label="Notes" prefetch={prefetch.notes} />
              <NavItem to="/projects" label="Projects" prefetch={prefetch.projects} />
            </nav>

            <NavLink
              to="/search"
              className={({ isActive }) =>
                [
                  "hidden size-8 items-center justify-center transition md:inline-flex",
                  isActive ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--fg))] hover:text-[hsl(var(--accent))]",
                ].join(" ")
              }
              aria-label="Search"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </NavLink>

            <NavLink
              to="/search"
              className={({ isActive }) =>
                [
                  "inline-flex size-8 items-center justify-center transition md:hidden",
                  isActive ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--fg))] hover:text-[hsl(var(--accent))]",
                ].join(" ")
              }
              aria-label="Search"
              title="Search"
            >
              <Search className="h-4 w-4 opacity-85" />
            </NavLink>

            <ThemeToggle />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center md:hidden">
          <nav className="flex items-center gap-5 overflow-x-auto pb-1 text-sm [-webkit-overflow-scrolling:touch]">
            <NavItem to="/notes" label="Notes" prefetch={prefetch.notes} />
            <NavItem to="/projects" label="Projects" prefetch={prefetch.projects} />
          </nav>
        </div>

        <div className="mt-4 border-b border-[color:var(--border-soft)]" />
      </div>
    </header>
  );
}
