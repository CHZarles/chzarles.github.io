import React from "react";

export function Footer() {
  return (
    <footer className="container pb-14">
      <div className="hairline pt-8 grid gap-4 text-sm text-[hsl(var(--muted))] md:flex md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-4">
          <span>Hyperblog · Roadmap-as-File UI Prototype</span>
          <span className="flex items-center gap-2 md:hidden">
            <span className="kbd">⌘K</span>
            <span>Search</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <span className="kbd">⌘K</span>
          <span>Search</span>
        </div>
      </div>
    </footer>
  );
}
