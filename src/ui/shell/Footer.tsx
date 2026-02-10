import React from "react";

export function Footer() {
  const year = new Date().getFullYear();
  const label = `COLOPHON · © ${year}`;

  return (
    <footer className="container pb-16 pt-10">
      <div className="relative flex items-center justify-center">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,hsl(var(--border))_75%,transparent),transparent)]" />
        <div className="relative bg-[color-mix(in_oklab,hsl(var(--bg))_90%,transparent)] px-4 text-[11px] font-serif font-semibold tracking-[0.22em] uppercase text-[color-mix(in_oklab,hsl(var(--fg))_58%,hsl(var(--muted)))]">
          {label}
        </div>
      </div>
    </footer>
  );
}
