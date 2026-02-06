import { HttpError } from "../http/errors";

const ALLOWED_PREFIXES = [
  "content/notes/",
  "content/mindmaps/",
  "content/.trash/notes/",
  "content/.trash/mindmaps/",
  "public/uploads/",
];

export function isSafeRepoPath(p: string): boolean {
  if (!p) return false;
  if (p.startsWith("/")) return false;
  if (p.includes("\\")) return false;
  if (p.includes("\0")) return false;
  if (p.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return false;
  return true;
}

export function validateRepoPath(p: string): string {
  const path = String(p).trim();
  if (!isSafeRepoPath(path)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid path.", { path });
  if (!ALLOWED_PREFIXES.some((pre) => path.startsWith(pre))) {
    throw new HttpError(422, "VALIDATION_FAILED", "Path not allowed.", { path });
  }
  return path;
}

export function applyContentRoot(contentRoot: string, p: string): string {
  const root = (contentRoot ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!root) return p;
  return `${root}/${p}`;
}

