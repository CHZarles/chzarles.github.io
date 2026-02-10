import React from "react";
import { useAppState } from "../state/AppState";

export function Footer() {
  const { profile } = useAppState();
  const year = new Date().getFullYear();
  const name = profile?.name?.trim() || "Hyperblog";

  return (
    <footer className="container pb-16">
      <div className="hairline pt-10">
        <div className="text-center text-[11px] font-medium text-[color-mix(in_oklab,hsl(var(--fg))_55%,hsl(var(--muted)))]">
          © {year} {name}
        </div>
      </div>
    </footer>
  );
}
