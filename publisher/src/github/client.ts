import { HttpError } from "../http/errors";

type GhOptions = {
  token: string;
  method: string;
  path: string; // starts with "/"
  body?: unknown;
  headers?: Record<string, string>;
};

function ghUrl(path: string) {
  return `https://api.github.com${path}`;
}

function summarizeGithubBody(text: string): string {
  const raw = (text ?? "").trim();
  if (!raw) return "";
  try {
    const j = JSON.parse(raw) as { message?: unknown; errors?: unknown } | null;
    if (j && typeof j === "object") {
      if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
      if (Array.isArray((j as any).errors) && (j as any).errors.length) {
        const first = (j as any).errors[0];
        if (first && typeof first === "object" && typeof (first as any).message === "string") return String((first as any).message).trim();
      }
    }
  } catch {
    // ignore
  }
  const firstLine = raw.split("\n")[0] ?? raw;
  return firstLine.slice(0, 220);
}

function isBadCredentials(summary: string): boolean {
  const s = (summary ?? "").toLowerCase();
  return s.includes("bad credentials") || s.includes("requires authentication") || s.includes("invalid token");
}

function isRateLimited(summary: string, headers: Headers): boolean {
  const s = (summary ?? "").toLowerCase();
  if (s.includes("rate limit exceeded") || s.includes("secondary rate limit")) return true;
  const remaining = headers.get("x-ratelimit-remaining");
  if (remaining === "0") return true;
  return false;
}

function readRetryAfterSeconds(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export async function ghJson<T>(opts: GhOptions): Promise<T> {
  const res = await fetch(ghUrl(opts.path), {
    method: opts.method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${opts.token}`,
      "User-Agent": "hyperblog-publisher",
      "Content-Type": opts.body ? "application/json; charset=utf-8" : "application/json; charset=utf-8",
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const summary = summarizeGithubBody(text);
    const status = res.status;
    const details = {
      githubStatus: res.status,
      githubBody: text.slice(0, 2000),
      path: opts.path,
      summary,
      retryAfterSeconds: readRetryAfterSeconds(res.headers),
    } as const;

    if (status === 401 || (status === 403 && isBadCredentials(summary))) {
      throw new HttpError(401, "UNAUTHENTICATED", "GitHub token invalid. Please login again.", details);
    }
    if (status === 403 && isRateLimited(summary, res.headers)) {
      throw new HttpError(429, "RATE_LIMITED", "GitHub rate limit exceeded. Please wait and retry.", details);
    }

    const msg = `GitHub API error (${status}): ${summary || res.statusText || "Request failed."}`;
    throw new HttpError(502, "GITHUB_UPSTREAM", msg, details);
  }

  return (await res.json()) as T;
}

export async function ghText(opts: GhOptions): Promise<string> {
  const res = await fetch(ghUrl(opts.path), {
    method: opts.method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${opts.token}`,
      "User-Agent": "hyperblog-publisher",
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const summary = summarizeGithubBody(text);
    const status = res.status;
    const details = {
      githubStatus: res.status,
      githubBody: text.slice(0, 2000),
      path: opts.path,
      summary,
      retryAfterSeconds: readRetryAfterSeconds(res.headers),
    } as const;

    if (status === 401 || (status === 403 && isBadCredentials(summary))) {
      throw new HttpError(401, "UNAUTHENTICATED", "GitHub token invalid. Please login again.", details);
    }
    if (status === 403 && isRateLimited(summary, res.headers)) {
      throw new HttpError(429, "RATE_LIMITED", "GitHub rate limit exceeded. Please wait and retry.", details);
    }

    const msg = `GitHub API error (${status}): ${summary || res.statusText || "Request failed."}`;
    throw new HttpError(502, "GITHUB_UPSTREAM", msg, details);
  }

  return await res.text();
}
