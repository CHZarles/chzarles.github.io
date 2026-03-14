import React from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { CommandPaletteProvider } from "../widgets/CommandPalette";
import { AppStateProvider } from "../state/AppState";
import { isPostTransitionState } from "../navigation/transitions";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";

export function AppShell() {
  const location = useLocation();
  const skipRouteStage = isPostTransitionState(location.state);

  return (
    <AppStateProvider>
      <CommandPaletteProvider>
        <div className="min-h-screen">
          <TopNav />
          <main className="container pb-16">
            <div className="mx-auto max-w-[48rem]">
              <div key={location.pathname} className={skipRouteStage ? "" : "hb-route-stage"}>
                <Outlet />
              </div>
            </div>
          </main>
          <Footer />
          <ScrollRestoration />
        </div>
      </CommandPaletteProvider>
    </AppStateProvider>
  );
}
