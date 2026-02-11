import React from "react";
import { publisherFetchJson } from "../../ui/publisher/client";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { publisherToken } from "../../ui/publisher/storage";
import { clearStudioCaches } from "../util/cache";
import { formatStudioError } from "../util/errors";

export type StudioMe = {
  user: { id: number; login: string; avatarUrl: string | null };
  repo: { fullName: string; branch: string; headSha: string };
};

type StudioState = {
  token: string | null;
  me: StudioMe | null;
  meError: string | null;
  syncNonce: number;
  login: (nextPath?: string) => void;
  logout: () => void;
  refreshMe: () => Promise<StudioMe | null>;
  forceSync: () => void;
};

const StudioStateContext = React.createContext<StudioState | null>(null);

function safeNextPath(input: string | null): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  return v;
}

function buildAuthRedirectUrl(nextPath: string | null): string {
  const callback = new URL("/auth/callback", window.location.origin);
  if (nextPath) callback.searchParams.set("next", nextPath);
  return callback.toString();
}

export function StudioStateProvider(props: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(() => publisherToken.get());
  const [me, setMe] = React.useState<StudioMe | null>(null);
  const [meError, setMeError] = React.useState<string | null>(null);
  const [syncNonce, setSyncNonce] = React.useState(0);

  const refreshMe = React.useCallback(async () => {
    if (!token) {
      setMe(null);
      return null;
    }
    try {
      const r = await publisherFetchJson<StudioMe>({ path: "/api/auth/me", token });
      setMe(r);
      setMeError(null);
      return r;
    } catch (err: unknown) {
      const e = formatStudioError(err);
      if (e.code === "UNAUTHENTICATED") {
        publisherToken.clear();
        setToken(null);
        setMe(null);
        setMeError("Session expired. Please login again.");
        return null;
      }
      setMe(null);
      setMeError(e.message);
      return null;
    }
  }, [token]);

  React.useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = React.useCallback((nextPath?: string) => {
    const safeNext = safeNextPath(nextPath ?? null) ?? "/studio/notes";
    const redirect = buildAuthRedirectUrl(safeNext);
    const url = new URL("/api/auth/github/start", PUBLISHER_BASE_URL);
    url.searchParams.set("redirect", redirect);
    window.location.assign(url.toString());
  }, []);

  const logout = React.useCallback(() => {
    publisherToken.clear();
    setToken(null);
    setMe(null);
    setMeError(null);
  }, []);

  const forceSync = React.useCallback(() => {
    clearStudioCaches({ publisherBaseUrl: PUBLISHER_BASE_URL });
    setSyncNonce((n) => n + 1);
    void refreshMe();
  }, [refreshMe]);

  React.useEffect(() => {
    const onStorage = () => setToken(publisherToken.get());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <StudioStateContext.Provider value={{ token, me, meError, syncNonce, login, logout, refreshMe, forceSync }}>
      {props.children}
    </StudioStateContext.Provider>
  );
}

export function useStudioState(): StudioState {
  const ctx = React.useContext(StudioStateContext);
  if (!ctx) throw new Error("useStudioState must be used within StudioStateProvider");
  return ctx;
}
