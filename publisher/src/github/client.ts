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
    throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub API error.", {
      githubStatus: res.status,
      githubBody: text.slice(0, 2000),
      path: opts.path,
    });
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
    throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub API error.", {
      githubStatus: res.status,
      githubBody: text.slice(0, 2000),
      path: opts.path,
    });
  }

  return await res.text();
}
