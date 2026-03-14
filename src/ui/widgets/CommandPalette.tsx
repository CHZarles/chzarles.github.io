import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

type CommandPaletteState = {
  open: () => void;
};

const CommandPaletteContext = React.createContext<CommandPaletteState | null>(null);

export function useCommandPalette(): CommandPaletteState {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPalette");
  return ctx;
}

export function CommandPaletteProvider(props: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const open = React.useCallback(() => {
    if (location.pathname === "/search") {
      window.dispatchEvent(new CustomEvent("hb:focus-search"));
      return;
    }
    navigate("/search");
  }, [location.pathname, navigate]);

  return (
    <CommandPaletteContext.Provider value={{ open }}>
      {props.children}
      <KeyBridge onOpen={open} />
    </CommandPaletteContext.Provider>
  );
}

function KeyBridge(props: { onOpen: () => void }) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        props.onOpen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  return null;
}
