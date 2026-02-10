import { Hono } from "hono";
import YAML from "yaml";
import { HttpError } from "../http/errors";
import { commitAtomic } from "../github/gitData";
import { ghJson } from "../github/client";
import { applyContentRoot, validateRepoPath } from "../github/validate";
import { base64Decode } from "../util/base64";

type GhContentsFile = { content?: string; encoding?: string };

async function readRepoFileUtf8(args: { token: string; repo: string; path: string; ref: string }): Promise<string> {
  const data = await ghJson<GhContentsFile>({
    token: args.token,
    method: "GET",
    path: `/repos/${args.repo}/contents/${args.path}?ref=${encodeURIComponent(args.ref)}`,
  });
  if (!data.content || data.encoding !== "base64") throw new HttpError(502, "GITHUB_UPSTREAM", "Unexpected contents API response.");
  const bytes = base64Decode(data.content);
  return new TextDecoder().decode(bytes);
}

async function readRepoFileUtf8OrNull(args: { token: string; repo: string; path: string; ref: string }): Promise<string | null> {
  try {
    return await readRepoFileUtf8(args);
  } catch (err) {
    if (err instanceof HttpError && err.code === "GITHUB_UPSTREAM" && (err.details as any)?.githubStatus === 404) return null;
    throw err;
  }
}

function jsonPretty(raw: unknown): string {
  return JSON.stringify(raw, null, 2) + "\n";
}

const DEFAULT_PROFILE = {
  name: "Your Name",
  handle: "@you",
  tagline: "",
  accent: "270 95% 65%",
  links: [{ label: "GitHub", href: "https://github.com/" }],
  hero: { imageUrl: "/mountain.avif", blurPx: 0, opacity: 0.28, position: "center", tintOpacity: 0, washOpacity: 0 },
};

const DEFAULT_CATEGORIES = [
  { id: "engineering", title: "Engineering", tone: "cyan" },
  { id: "ai", title: "AI / LLM", tone: "violet" },
  { id: "product", title: "Product", tone: "amber" },
];

export const adminConfigRoutes = new Hono();

adminConfigRoutes.get("/profile", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const relPath = validateRepoPath("content/profile.json");
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const raw = await readRepoFileUtf8OrNull({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });

  if (raw === null) {
    return c.json({ file: { path: relPath, raw: jsonPretty(DEFAULT_PROFILE), json: DEFAULT_PROFILE, missing: true } });
  }

  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // keep raw for repair
  }

  return c.json({ file: { path: relPath, raw, json } });
});

adminConfigRoutes.put("/profile", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  let body: { raw?: string; profile?: unknown };
  try {
    body = (await c.req.json()) as { raw?: string; profile?: unknown };
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const inputRaw = typeof body.raw === "string" ? body.raw : null;
  const profile = body.profile ?? null;

  let obj: unknown;
  if (inputRaw !== null) {
    try {
      obj = JSON.parse(inputRaw);
    } catch {
      throw new HttpError(422, "VALIDATION_FAILED", "Invalid JSON.", { file: "content/profile.json" });
    }
  } else {
    obj = profile;
  }

  if (!obj || typeof obj !== "object") throw new HttpError(422, "VALIDATION_FAILED", "Invalid profile object.");

  const relPath = validateRepoPath("content/profile.json");
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: "config: profile",
    writes: [{ path, encoding: "utf8", content: jsonPretty(obj) }],
  });

  return c.json({ ok: true, file: { path: relPath }, commit: { sha: commit.sha, url: commit.url } });
});

adminConfigRoutes.get("/categories", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const relPath = validateRepoPath("content/categories.yml");
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const raw = await readRepoFileUtf8OrNull({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });

  if (raw === null) {
    const yaml = YAML.stringify(DEFAULT_CATEGORIES).trimEnd() + "\n";
    return c.json({ file: { path: relPath, raw: yaml, json: DEFAULT_CATEGORIES, missing: true } });
  }

  let data: unknown = null;
  try {
    data = YAML.parse(raw);
  } catch {
    // keep raw for repair
  }

  return c.json({ file: { path: relPath, raw, json: data } });
});

adminConfigRoutes.put("/categories", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  let body: { yaml?: string; categories?: unknown };
  try {
    body = (await c.req.json()) as { yaml?: string; categories?: unknown };
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const yaml = typeof body.yaml === "string" ? body.yaml : null;
  const categories = body.categories ?? null;

  let out: string;
  if (yaml !== null) {
    try {
      YAML.parse(yaml);
    } catch {
      throw new HttpError(422, "VALIDATION_FAILED", "Invalid YAML.", { file: "content/categories.yml" });
    }
    out = yaml.trimEnd() + "\n";
  } else {
    if (!Array.isArray(categories)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid categories array.");
    out = YAML.stringify(categories).trimEnd() + "\n";
  }

  const relPath = validateRepoPath("content/categories.yml");
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: "config: categories",
    writes: [{ path, encoding: "utf8", content: out }],
  });

  return c.json({ ok: true, file: { path: relPath }, commit: { sha: commit.sha, url: commit.url } });
});

adminConfigRoutes.get("/projects", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const relPath = validateRepoPath("content/projects.json");
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const raw = await readRepoFileUtf8OrNull({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });

  if (raw === null) {
    return c.json({ file: { path: relPath, raw: "[]\n", json: [], missing: true } });
  }

  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // keep raw for repair
  }

  return c.json({ file: { path: relPath, raw, json } });
});

adminConfigRoutes.put("/projects", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  let body: { raw?: string; projects?: unknown };
  try {
    body = (await c.req.json()) as { raw?: string; projects?: unknown };
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const inputRaw = typeof body.raw === "string" ? body.raw : null;
  const projects = body.projects ?? null;

  let obj: unknown;
  if (inputRaw !== null) {
    try {
      obj = JSON.parse(inputRaw);
    } catch {
      throw new HttpError(422, "VALIDATION_FAILED", "Invalid JSON.", { file: "content/projects.json" });
    }
  } else {
    obj = projects;
  }

  if (!Array.isArray(obj)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid projects array.");

  const relPath = validateRepoPath("content/projects.json");
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: "config: projects",
    writes: [{ path, encoding: "utf8", content: jsonPretty(obj) }],
  });

  return c.json({ ok: true, file: { path: relPath }, commit: { sha: commit.sha, url: commit.url } });
});
