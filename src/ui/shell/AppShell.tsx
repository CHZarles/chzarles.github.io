import React from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { CommandPaletteProvider } from "../widgets/CommandPalette";
import { AppStateProvider } from "../state/AppState";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";

export function AppShell() {
  const location = useLocation();
  const hideTopNav = location.pathname.startsWith("/notes/");

  return (
    <AppStateProvider>
      <CommandPaletteProvider>
        <div className="min-h-screen">
          {hideTopNav ? null : <TopNav />}
          <main className={["container pb-16", hideTopNav ? "pt-0" : "pt-24"].join(" ")}>
            <Outlet />
          </main>
          <Footer />
          <ScrollRestoration />
        </div>
      </CommandPaletteProvider>
    </AppStateProvider>
  );
}
