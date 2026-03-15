function trimTrailingSlashes(input: string): string {
  return input.replace(/\/+$/g, "");
}

export function normalizeOrigin(origin: string): string {
  return trimTrailingSlashes(origin.trim());
}

function tryParseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "::1" || host === "[::1]") return true;
  return /^127(?:\.\d{1,3}){3}$/.test(host);
}

export function isLoopbackOrigin(origin: string): boolean {
  const url = tryParseUrl(origin);
  if (!url) return false;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return isLoopbackHostname(url.hostname);
}

export function hasLoopbackOrigin(allowedOrigins: string[]): boolean {
  return allowedOrigins.some((origin) => isLoopbackOrigin(origin));
}

export function isAllowedCorsOrigin(origin: string, allowedOrigins: string[]): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const allowed = allowedOrigins.map(normalizeOrigin);
  if (allowed.includes(normalizedOrigin)) return true;

  return isLoopbackOrigin(normalizedOrigin) && hasLoopbackOrigin(allowed);
}

export function resolveRequestOrigin(originHeader: string | null | undefined, refererHeader: string | null | undefined): string | null {
  const candidates = [originHeader, refererHeader];
  for (const raw of candidates) {
    const val = (raw ?? "").trim();
    if (!val) continue;
    const url = tryParseUrl(val);
    if (!url) continue;
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    return normalizeOrigin(url.origin);
  }
  return null;
}

export function isTrustedLoopbackRedirectOrigin(
  redirectOrigin: string,
  allowedOrigins: string[],
  requestOrigin: string | null,
): boolean {
  const normalizedRedirectOrigin = normalizeOrigin(redirectOrigin);
  const normalizedRequestOrigin = requestOrigin ? normalizeOrigin(requestOrigin) : null;
  if (!normalizedRequestOrigin) return false;
  if (normalizedRedirectOrigin !== normalizedRequestOrigin) return false;
  if (!isLoopbackOrigin(normalizedRedirectOrigin)) return false;
  return hasLoopbackOrigin(allowedOrigins);
}
