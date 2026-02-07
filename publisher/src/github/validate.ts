import { HttpError } from "../http/errors";

const ALLOWED_PREFIXES = [
  "content/notes/",
  "content/mindmaps/",
  "content/.trash/notes/",
  "content/.trash/mindmaps/",
  "content/roadmaps/",
  "content/.trash/roadmaps/",
  "public/uploads/",
];

const ALLOWED_EXACT = ["content/profile.json", "content/categories.yml", "content/categories.yaml", "content/projects.json"];

function hasAllowedExtension(path: string): boolean {
  if (path.startsWith("content/notes/") || path.startsWith("content/.trash/notes/")) return path.toLowerCase().endsWith(".md");
  if (path.startsWith("content/mindmaps/") || path.startsWith("content/.trash/mindmaps/")) return path.toLowerCase().endsWith(".json");
  if (path.startsWith("content/roadmaps/") || path.startsWith("content/.trash/roadmaps/")) {
    const p = path.toLowerCase();
    return p.endsWith(".yml") || p.endsWith(".yaml");
  }
  if (path.startsWith("public/uploads/")) return true;
  return true;
}

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
  if (!ALLOWED_EXACT.includes(path) && !ALLOWED_PREFIXES.some((pre) => path.startsWith(pre))) {
    throw new HttpError(422, "VALIDATION_FAILED", "Path not allowed.", { path });
  }
  if (!hasAllowedExtension(path)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid file extension.", { path });
  return path;
}

export function applyContentRoot(contentRoot: string, p: string): string {
  const root = (contentRoot ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!root) return p;
  return `${root}/${p}`;
}
