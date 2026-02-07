import { PUBLISHER_BASE_URL } from "./config";

export type PublisherError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function publisherFetchJson<T>(args: {
  path: string;
  method?: string;
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<T> {
  const url = new URL(args.path, PUBLISHER_BASE_URL).toString();
  const res = await fetch(url, {
    method: args.method ?? (args.body ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      ...(args.body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
      ...(args.headers ?? {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  if (!res.ok) {
    const data = (await readJsonSafe(res)) as { error?: PublisherError } | null;
    const err = data?.error ?? { code: "HTTP_ERROR", message: res.statusText, details: { status: res.status } };
    throw Object.assign(new Error(err.message), { publisher: err, status: res.status });
  }

  return (await res.json()) as T;
}

export async function publisherUploadFile(args: {
  token: string;
  file: File;
}): Promise<{
  asset: { path: string; url: string; bytes: number; contentType: string };
  commit: { sha: string; url: string };
}> {
  const url = new URL("/api/admin/uploads", PUBLISHER_BASE_URL).toString();
  const fd = new FormData();
  fd.append("file", args.file);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}` },
    body: fd,
  });
  if (!res.ok) {
    const data = (await readJsonSafe(res)) as { error?: PublisherError } | null;
    const err = data?.error ?? { code: "HTTP_ERROR", message: res.statusText, details: { status: res.status } };
    throw Object.assign(new Error(err.message), { publisher: err, status: res.status });
  }
  return (await res.json()) as {
    asset: { path: string; url: string; bytes: number; contentType: string };
    commit: { sha: string; url: string };
  };
}

