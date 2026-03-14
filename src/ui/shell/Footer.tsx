import { Github, Link2 } from "lucide-react";
import React from "react";
import { useAppState } from "../state/AppState";

export function Footer() {
  const { profile } = useAppState();
  const year = new Date().getFullYear();
  const links = profile?.links ?? [];

  function iconForLink(link: { label: string; href: string }) {
    const label = link.label.trim().toLowerCase();
    const href = link.href.trim().toLowerCase();
    if (label.includes("github") || href.includes("github.com")) return Github;
    return Link2;
  }

  return (
    <footer className="container mt-auto font-mono pb-16 pt-12">
      <div className="mx-auto max-w-[48rem]">
        <div className="border-t border-[color:var(--border-soft)]" />
        <div className="flex flex-col items-center justify-between py-6 text-sm text-[hsl(var(--muted))] sm:flex-row-reverse sm:py-4">
          <div className="flex flex-wrap items-center justify-center gap-1">
            {links.map((link) => {
              const Icon = iconForLink(link);
              return (
                <a
                  key={`${link.label}:${link.href}`}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className="group inline-block p-2 transition hover:text-[hsl(var(--accent))] sm:p-1"
                >
                  <Icon className="h-5 w-5 opacity-90 transition group-hover:rotate-6 sm:scale-110" />
                </a>
              );
            })}
          </div>
          <div className="my-2 flex flex-col items-center whitespace-nowrap text-center text-[13px] sm:flex-row">
            <span>Built with Hyperblog</span>
            <span className="mx-2 hidden text-[hsl(var(--border))] sm:inline">·</span>
            <span>© {year}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
