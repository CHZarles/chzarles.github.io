import { Crosshair, Github, Link2, Search, X } from "lucide-react";
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAppState } from "../state/AppState";
import { AccentPicker } from "../widgets/AccentPicker";
import { ThemeToggle } from "../widgets/ThemeToggle";
import { useCommandPalette } from "../widgets/CommandPalette";

function NavItem(props: {
  to: string;
  label: string;
}) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        [
          "group relative inline-flex items-center px-1 py-2 text-sm font-medium tracking-tight transition",
          isActive
            ? "text-[hsl(var(--fg))] after:opacity-100"
            : "text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))] after:opacity-0 hover:after:opacity-60",
          "after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:bg-[hsl(var(--accent))] after:transition after:duration-200",
        ].join(" ")
      }
    >
      <span>{props.label}</span>
    </NavLink>
  );
}

export function TopNav() {
  const { profile } = useAppState();
  const navigate = useNavigate();
  const { open } = useCommandPalette();
  const links = profile?.links ?? [];
  const navTitle = profile?.nav?.title ?? profile?.name ?? "Hyperblog";
  const navTagline = profile?.nav?.tagline ?? profile?.tagline ?? "可探索的个人技术空间";

  function iconForLink(link: { label: string; href: string }) {
    const label = link.label.trim().toLowerCase();
    const href = link.href.trim().toLowerCase();
    if (label.includes("github") || href.includes("github.com")) return Github;
    if (label === "x" || label.includes("twitter") || href.includes("x.com") || href.includes("twitter.com")) return X;
    return Link2;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
      <div className="container">
        <div className="flex items-center justify-between gap-4 py-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="group inline-flex items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-[hsl(var(--card2))]"
          >
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,hsl(var(--card2))_72%,transparent),color-mix(in_oklab,hsl(var(--card))_82%,transparent))] shadow-[0_1px_0_rgba(255,255,255,.35)_inset] transition duration-200 group-hover:border-[color-mix(in_oklab,hsl(var(--fg))_18%,hsl(var(--border)))]">
              <Crosshair
                aria-hidden
                strokeWidth={1.4}
                className="h-[18px] w-[18px] text-[color-mix(in_oklab,hsl(var(--muted))_62%,hsl(var(--fg)))] opacity-75 transition duration-200 group-hover:text-[hsl(var(--fg))] group-hover:opacity-100"
              />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-sans font-bold leading-none tracking-[0.02em]">{navTitle}</span>
              <span className="block text-xs text-[hsl(var(--muted))]">{navTagline}</span>
            </span>
          </button>

          <nav className="hidden items-center gap-6 md:flex">
            <NavItem to="/notes" label="Notes" />
            <NavItem to="/categories" label="Categories" />
            <NavItem to="/roadmaps" label="Roadmaps" />
            <NavItem to="/mindmaps" label="Mindmaps" />
            <NavItem to="/projects" label="Projects" />
          </nav>

          <div className="flex items-center gap-2">
            {links.length ? (
              <div className="hidden lg:flex items-center gap-2 pr-1">
                {links.slice(0, 3).map((l) => (
                  <a
                    key={`${l.label}:${l.href}`}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={l.label}
                    title={l.label}
                    className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                  >
                    {React.createElement(iconForLink(l), { className: "h-4 w-4 opacity-85" })}
                  </a>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={open}
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]"
            >
              <Search className="h-4 w-4 opacity-80" />
              <span className="hidden lg:inline">Search</span>
              <span className="kbd ml-2 hidden lg:inline">⌘K</span>
            </button>
            <button
              type="button"
              onClick={open}
              className="inline-flex md:hidden items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 transition hover:text-[hsl(var(--fg))]"
              aria-label="Search"
            >
              <Search className="h-4 w-4 opacity-85" />
            </button>
            <AccentPicker />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pb-3 md:hidden">
          <nav className="flex items-center gap-5 overflow-x-auto pb-1 text-sm [-webkit-overflow-scrolling:touch]">
            <NavItem to="/notes" label="Notes" />
            <NavItem to="/categories" label="Categories" />
            <NavItem to="/roadmaps" label="Roadmaps" />
            <NavItem to="/mindmaps" label="Mindmaps" />
            <NavItem to="/projects" label="Projects" />
          </nav>
          <span className="hidden sm:inline text-xs text-[hsl(var(--muted))]">索引即叙事</span>
        </div>
      </div>
    </header>
  );
}
