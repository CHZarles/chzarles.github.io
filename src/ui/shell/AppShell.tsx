import React from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { CommandPaletteProvider } from "../widgets/CommandPalette";
import { AppStateProvider } from "../state/AppState";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";

export function AppShell() {
  React.useEffect(() => {
    function updateScrollbarWidth() {
      const doc = document.documentElement;
      const sbw = Math.max(0, window.innerWidth - doc.clientWidth);
      doc.style.setProperty("--sbw", `${sbw}px`);
    }

    updateScrollbarWidth();
    window.addEventListener("resize", updateScrollbarWidth, { passive: true });
    return () => window.removeEventListener("resize", updateScrollbarWidth);
  }, []);

  return (
    <AppStateProvider>
      <CommandPaletteProvider>
        <div className="min-h-screen">
          <TopNav />
          <main className="container pt-24 pb-16">
            <Outlet />
          </main>
          <Footer />
          <ScrollRestoration />
        </div>
      </CommandPaletteProvider>
    </AppStateProvider>
  );
}
