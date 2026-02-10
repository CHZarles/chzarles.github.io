import React from "react";

type CommandPaletteState = {
  open: () => void;
};

const CommandPaletteContext = React.createContext<CommandPaletteState | null>(null);

export function useCommandPalette(): CommandPaletteState {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPalette");
  return ctx;
}

const CommandPaletteOverlayLazy = React.lazy(() =>
  import("./CommandPaletteOverlay").then((m) => ({ default: m.CommandPaletteOverlay })),
);

export function CommandPaletteProvider(props: { children: React.ReactNode }) {
  const [openKey, setOpenKey] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => {
    setOpenKey((k) => k + 1);
    setIsOpen(true);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open }}>
      {props.children}
      {isOpen ? (
        <React.Suspense fallback={null}>
          <CommandPaletteOverlayLazy key={openKey} onClose={() => setIsOpen(false)} />
        </React.Suspense>
      ) : null}
      <KeyBridge onOpen={open} onClose={() => setIsOpen(false)} />
    </CommandPaletteContext.Provider>
  );
}

function KeyBridge(props: { onOpen: () => void; onClose: () => void }) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        props.onOpen();
      }
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  return null;
}
