import type { Profile } from "../types";

function readEmbeddedProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __HB_PROFILE__?: unknown };
  if (w.__HB_PROFILE__ && typeof w.__HB_PROFILE__ === "object") return w.__HB_PROFILE__ as Profile;

  const el = document.getElementById("hb-profile");
  if (!el?.textContent) return null;
  try {
    const p = JSON.parse(el.textContent) as Profile;
    w.__HB_PROFILE__ = p;
    return p;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(input: string): string | null {
  const raw = input.trim().replace(/\/+$/g, "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/g, "");
  } catch {
    return null;
  }
}

function resolvePublisherBaseUrl(): string {
  const env = (import.meta.env.VITE_PUBLISHER_BASE_URL as string | undefined) ?? "";
  const fromEnv = normalizeBaseUrl(env);
  if (fromEnv) return fromEnv;

  const fromProfile = normalizeBaseUrl(readEmbeddedProfile()?.publisherBaseUrl ?? "");
  if (fromProfile) return fromProfile;

  return "http://localhost:8788";
}

export const PUBLISHER_BASE_URL = resolvePublisherBaseUrl();
