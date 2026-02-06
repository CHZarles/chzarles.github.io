import React from "react";
import type { Category, Profile } from "../types";
import { api } from "../api/api";

type Theme = "dark" | "light";

type AppState = {
  profile: Profile | null;
  categories: Category[];
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: string;
  setAccent: (accent: string) => void;
};

const AppStateContext = React.createContext<AppState | null>(null);

function safeStorageGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore: storage may be unavailable (privacy mode / I/O issues / blocked)
  }
}

function readTheme(): Theme {
  const raw = safeStorageGetItem("hyperblog.theme");
  if (raw === "dark" || raw === "light") return raw;
  return "light";
}

function readAccent(): string | null {
  return safeStorageGetItem("hyperblog.accent");
}

export function AppStateProvider(props: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return readTheme();
  });
  const [accent, setAccentState] = React.useState<string>(() => {
    if (typeof window === "undefined") return "270 85% 45%";
    return readAccent() ?? "270 85% 45%";
  });

  React.useEffect(() => {
    const t = readTheme();
    document.documentElement.dataset.theme = t;
    setThemeState(t);
  }, []);

  React.useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
    safeStorageSetItem("hyperblog.accent", accent);
  }, [accent]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([api.profile(), api.categories()])
      .then(([p, c]) => {
        if (cancelled) return;
        setProfile(p);
        setCategories(c);
        if (!readAccent() && p.accent) setAccentState(p.accent);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = React.useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    safeStorageSetItem("hyperblog.theme", t);
    setThemeState(t);
  }, []);

  const setAccent = React.useCallback((a: string) => {
    setAccentState(a);
  }, []);

  return (
    <AppStateContext.Provider value={{ profile, categories, theme, setTheme, accent, setAccent }}>
      {props.children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
