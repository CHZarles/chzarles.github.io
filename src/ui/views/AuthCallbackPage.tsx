import React from "react";
import { useNavigate } from "react-router-dom";
import { publisherToken } from "../publisher/storage";

function readTokenFromUrl(): string | null {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hs = new URLSearchParams(hash);
  const token = hs.get("token");
  if (token) return token;

  const qs = new URLSearchParams(window.location.search);
  return qs.get("token");
}

function safeNextPath(input: string | null): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  return v;
}

export function AuthCallbackPage() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const token = readTokenFromUrl();
    const qs = new URLSearchParams(window.location.search);
    const nextPath = safeNextPath(qs.get("next")) ?? "/studio/notes";
    if (!token) {
      const u = new URL(nextPath, window.location.origin);
      u.searchParams.set("error", "missing_token");
      navigate(u.pathname + u.search + u.hash, { replace: true });
      return;
    }

    publisherToken.set(token);

    // scrub token from URL
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = "";
    nextUrl.searchParams.delete("token");
    window.history.replaceState(null, "", nextUrl.toString());

    navigate(nextPath, { replace: true });
  }, [navigate]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-6">
        <div className="text-sm font-medium tracking-tight">Signing you in…</div>
        <div className="mt-2 text-sm text-[hsl(var(--muted))]">Redirecting to Studio.</div>
      </div>
    </div>
  );
}
