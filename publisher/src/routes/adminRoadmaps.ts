import { Hono } from "hono";
import YAML from "yaml";
import { HttpError } from "../http/errors";
import { commitAtomic } from "../github/gitData";
import { ghJson } from "../github/client";
import { applyContentRoot, validateRepoPath } from "../github/validate";
import { base64Decode } from "../util/base64";

type GhContentsFile = { content?: string; encoding?: string };
type GhContentsDirItem = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule";
};

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

async function listRepoDir(args: { token: string; repo: string; path: string; ref: string }): Promise<GhContentsDirItem[]> {
  const data = await ghJson<unknown>({
    token: args.token,
    method: "GET",
    path: `/repos/${args.repo}/contents/${args.path}?ref=${encodeURIComponent(args.ref)}`,
  });
  if (!Array.isArray(data)) throw new HttpError(502, "GITHUB_UPSTREAM", "Unexpected contents API response.");
  return data as GhContentsDirItem[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function validateRoadmapId(id: string): string {
  const v = String(id ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,80}$/.test(v)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid roadmap id.", { id });
  return v;
}

function isRoadmapFilename(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith(".yml") || n.endsWith(".yaml");
}

function roadmapIdFromFilename(name: string): string | null {
  if (!isRoadmapFilename(name)) return null;
  const lower = name.toLowerCase();
  const id = lower.endsWith(".yaml") ? name.slice(0, -5) : name.slice(0, -4);
  try {
    return validateRoadmapId(id);
  } catch {
    return null;
  }
}

function parseRoadmapYaml(raw: string, id: string): Record<string, unknown> {
  try {
    const v = YAML.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(422, "VALIDATION_FAILED", "Invalid roadmap yaml.", { id });
  }
}

async function resolveRoadmapRelPath(args: {
  token: string;
  repo: string;
  ref: string;
  contentRoot: string;
  id: string;
}): Promise<{ relPath: string; filename: string; exists: boolean }> {
  const dir = applyContentRoot(args.contentRoot, "content/roadmaps");
  const items = await listRepoDir({ token: args.token, repo: args.repo, path: dir, ref: args.ref });
  const yml = items.find((it) => it.type === "file" && it.name === `${args.id}.yml`);
  const yaml = items.find((it) => it.type === "file" && it.name === `${args.id}.yaml`);
  if (yml) return { relPath: validateRepoPath(`content/roadmaps/${args.id}.yml`), filename: `${args.id}.yml`, exists: true };
  if (yaml) return { relPath: validateRepoPath(`content/roadmaps/${args.id}.yaml`), filename: `${args.id}.yaml`, exists: true };
  return { relPath: validateRepoPath(`content/roadmaps/${args.id}.yml`), filename: `${args.id}.yml`, exists: false };
}

export const adminRoadmapsRoutes = new Hono();

adminRoadmapsRoutes.get("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  const include = (c.req.query("include") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const includeMeta = include.includes("meta");

  const limitRaw = Number(c.req.query("limit") ?? "");
  const limit = clamp(Number.isFinite(limitRaw) ? limitRaw : 50, 1, 200);
  if (includeMeta && limit > 50) throw new HttpError(422, "VALIDATION_FAILED", "limit too large for include=meta.");

  const after = (c.req.query("after") ?? "").trim() || null;

  const dirPath = applyContentRoot(cfg.contentRoot, "content/roadmaps");
  const items = await listRepoDir({ token: user.ghToken, repo: cfg.contentRepo, path: dirPath, ref: cfg.contentBranch });

  const all = items
    .filter((it) => it.type === "file")
    .filter((it) => isRoadmapFilename(it.name))
    .map((it) => {
      const id = roadmapIdFromFilename(it.name);
      if (!id) return null;
      const rel = validateRepoPath(`content/roadmaps/${it.name}`);
      return { id, path: rel, sha: it.sha, size: it.size, filename: it.name };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  let start = 0;
  if (after) {
    const idx = all.findIndex((n) => n.id === after);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = all.slice(start, start + limit);

  let metaById: Record<string, { title?: string; description?: string; theme?: string; layout?: string }> = {};
  if (includeMeta) {
    const metaPairs = await Promise.all(
      slice.map(async (r) => {
        const rawPath = applyContentRoot(cfg.contentRoot, r.path);
        const raw = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path: rawPath, ref: cfg.contentBranch });
        const parsed = parseRoadmapYaml(raw, r.id);
        return [
          r.id,
          {
            title: typeof parsed.title === "string" ? parsed.title : undefined,
            description: typeof parsed.description === "string" ? parsed.description : undefined,
            theme: typeof parsed.theme === "string" ? parsed.theme : undefined,
            layout: typeof parsed.layout === "string" ? parsed.layout : undefined,
          },
        ] as const;
      }),
    );
    metaById = Object.fromEntries(metaPairs);
  }

  const nextAfter = start + limit < all.length ? slice.at(-1)?.id ?? null : null;

  return c.json({
    roadmaps: slice.map((r) => ({ id: r.id, path: r.path, sha: r.sha, size: r.size, meta: metaById[r.id] })),
    paging: { after, nextAfter },
  });
});

adminRoadmapsRoutes.get("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const id = validateRoadmapId(c.req.param("id"));

  const resolved = await resolveRoadmapRelPath({
    token: user.ghToken,
    repo: cfg.contentRepo,
    ref: cfg.contentBranch,
    contentRoot: cfg.contentRoot,
    id,
  });
  const path = applyContentRoot(cfg.contentRoot, resolved.relPath);
  const raw = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });
  const parsed = parseRoadmapYaml(raw, id);

  return c.json({ roadmap: { id, path: resolved.relPath, exists: resolved.exists, yaml: raw, json: parsed } });
});

adminRoadmapsRoutes.put("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const id = validateRoadmapId(c.req.param("id"));

  let body: { yaml?: string; roadmap?: unknown; message?: string };
  try {
    body = (await c.req.json()) as { yaml?: string; roadmap?: unknown; message?: string };
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const inputYaml = typeof body.yaml === "string" ? body.yaml : null;
  const roadmapObj = body.roadmap ?? null;

  let yamlOut: string;
  let parsed: Record<string, unknown>;
  if (inputYaml !== null) {
    parsed = parseRoadmapYaml(inputYaml, id);
    yamlOut = inputYaml.trimEnd() + "\n";
  } else {
    if (!roadmapObj || typeof roadmapObj !== "object") throw new HttpError(422, "VALIDATION_FAILED", "Invalid roadmap object.");
    yamlOut = YAML.stringify(roadmapObj).trimEnd() + "\n";
    parsed = parseRoadmapYaml(yamlOut, id);
  }

  const parsedId = typeof parsed.id === "string" ? String(parsed.id).trim().toLowerCase() : null;
  if (parsedId && parsedId !== id) {
    throw new HttpError(422, "VALIDATION_FAILED", "Roadmap id mismatch.", { expected: id, got: parsedId });
  }

  if (!parsedId) {
    // enforce id on write
    const withId = { ...parsed, id };
    yamlOut = YAML.stringify(withId).trimEnd() + "\n";
    parsed = parseRoadmapYaml(yamlOut, id);
  }

  if (!Array.isArray(parsed.nodes)) throw new HttpError(422, "VALIDATION_FAILED", "Missing nodes array.", { id });

  const resolved = await resolveRoadmapRelPath({
    token: user.ghToken,
    repo: cfg.contentRepo,
    ref: cfg.contentBranch,
    contentRoot: cfg.contentRoot,
    id,
  });
  const path = applyContentRoot(cfg.contentRoot, resolved.relPath);

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: String(body.message ?? "").trim() || `roadmap: ${id}`,
    writes: [{ path, encoding: "utf8", content: yamlOut }],
  });

  return c.json({ ok: true, roadmap: { id, path: resolved.relPath }, commit: { sha: commit.sha, url: commit.url } });
});

adminRoadmapsRoutes.delete("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const id = validateRoadmapId(c.req.param("id"));

  const resolved = await resolveRoadmapRelPath({
    token: user.ghToken,
    repo: cfg.contentRepo,
    ref: cfg.contentBranch,
    contentRoot: cfg.contentRoot,
    id,
  });
  const srcRel = resolved.relPath;
  const srcPath = applyContentRoot(cfg.contentRoot, srcRel);
  const existing = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path: srcPath, ref: cfg.contentBranch });

  const trashRel = validateRepoPath(`content/.trash/roadmaps/${resolved.filename}`);
  const trashPath = applyContentRoot(cfg.contentRoot, trashRel);

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `roadmap(trash): ${id}`,
    writes: [{ path: trashPath, encoding: "utf8", content: existing }],
    deletes: [srcPath],
  });

  return c.json({ ok: true, commit: { sha: commit.sha, url: commit.url } });
});

