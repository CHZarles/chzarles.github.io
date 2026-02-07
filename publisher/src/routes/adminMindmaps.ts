import { Hono } from "hono";
import { HttpError } from "../http/errors";
import { renderMindmapJson, validateMindmapId, type MindmapInput } from "../content/mindmaps";
import { commitAtomic } from "../github/gitData";
import { applyContentRoot, validateRepoPath } from "../github/validate";
import { base64Decode } from "../util/base64";
import { ghJson } from "../github/client";

type GhContentsFile = { content?: string; encoding?: string; sha?: string; path?: string; size?: number; type?: string };
type GhContentsDirItem = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule";
};

async function readRepoFileUtf8(args: { token: string; repo: string; path: string; ref: string }): Promise<string> {
  let data: GhContentsFile;
  try {
    data = await ghJson<GhContentsFile>({
      token: args.token,
      method: "GET",
      path: `/repos/${args.repo}/contents/${args.path}?ref=${encodeURIComponent(args.ref)}`,
    });
  } catch (err) {
    if (err instanceof HttpError && err.code === "GITHUB_UPSTREAM" && (err.details as any)?.githubStatus === 404) {
      throw new HttpError(404, "NOT_FOUND", "Not found.", { path: args.path });
    }
    throw err;
  }
  if (!data.content || data.encoding !== "base64") throw new HttpError(502, "GITHUB_UPSTREAM", "Unexpected contents API response.");
  const bytes = base64Decode(data.content);
  return new TextDecoder().decode(bytes);
}

async function listRepoDir(args: { token: string; repo: string; path: string; ref: string }): Promise<GhContentsDirItem[]> {
  try {
    const data = await ghJson<unknown>({
      token: args.token,
      method: "GET",
      path: `/repos/${args.repo}/contents/${args.path}?ref=${encodeURIComponent(args.ref)}`,
    });
    if (!Array.isArray(data)) throw new HttpError(502, "GITHUB_UPSTREAM", "Unexpected contents API response.");
    return data as GhContentsDirItem[];
  } catch (err) {
    if (err instanceof HttpError && err.code === "GITHUB_UPSTREAM" && (err.details as any)?.githubStatus === 404) {
      return [];
    }
    throw err;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function mindmapIdFromFilename(name: string): string | null {
  if (!name.toLowerCase().endsWith(".json")) return null;
  const id = name.slice(0, -5);
  try {
    return validateMindmapId(id);
  } catch {
    return null;
  }
}

function parseMindmapJson(raw: string, id: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(422, "VALIDATION_FAILED", "Invalid mindmap json.", { id });
  }
}

export const adminMindmapsRoutes = new Hono();

adminMindmapsRoutes.get("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  const include = (c.req.query("include") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const includeMeta = include.includes("meta");

  const limitRaw = Number(c.req.query("limit") ?? "");
  const limit = clamp(Number.isFinite(limitRaw) ? limitRaw : 100, 1, 200);
  if (includeMeta && limit > 50) throw new HttpError(422, "VALIDATION_FAILED", "limit too large for include=meta.");

  const after = (c.req.query("after") ?? "").trim() || null;

  const dirPath = applyContentRoot(cfg.contentRoot, "content/mindmaps");
  const items = await listRepoDir({ token: user.ghToken, repo: cfg.contentRepo, path: dirPath, ref: cfg.contentBranch });

  const all = items
    .filter((it) => it.type === "file")
    .map((it) => {
      const id = mindmapIdFromFilename(it.name);
      if (!id) return null;
      return { id, path: validateRepoPath(`content/mindmaps/${id}.json`), sha: it.sha, size: it.size };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  let start = 0;
  if (after) {
    const idx = all.findIndex((n) => n.id === after);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = all.slice(start, start + limit);

  let metaById: Record<string, { title?: string; updated?: string; format?: string; nodeCount?: number; edgeCount?: number }> = {};
  if (includeMeta) {
    const metaPairs = await Promise.all(
      slice.map(async (m) => {
        const rawPath = applyContentRoot(cfg.contentRoot, m.path);
        const raw = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path: rawPath, ref: cfg.contentBranch });
        const parsed = parseMindmapJson(raw, m.id);
        return [
          m.id,
          {
            title: typeof parsed.title === "string" ? parsed.title : undefined,
            updated: typeof parsed.updated === "string" ? parsed.updated : undefined,
            format: typeof parsed.format === "string" ? parsed.format : undefined,
            nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : undefined,
            edgeCount: Array.isArray(parsed.edges) ? parsed.edges.length : undefined,
          },
        ] as const;
      }),
    );
    metaById = Object.fromEntries(metaPairs);
  }

  const nextAfter = start + limit < all.length ? slice.at(-1)?.id ?? null : null;

  return c.json({
    mindmaps: slice.map((m) => ({ ...m, meta: metaById[m.id] })),
    paging: { after, nextAfter },
  });
});

adminMindmapsRoutes.get("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const id = validateMindmapId(c.req.param("id"));

  const relPath = validateRepoPath(`content/mindmaps/${id}.json`);
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const raw = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });
  const parsed = parseMindmapJson(raw, id);

  const mindmap: MindmapInput = {
    id,
    title: typeof parsed.title === "string" ? parsed.title : undefined,
    format: typeof parsed.format === "string" ? parsed.format : undefined,
    nodes: Array.isArray(parsed.nodes) ? (parsed.nodes as unknown[]) : undefined,
    edges: Array.isArray(parsed.edges) ? (parsed.edges as unknown[]) : undefined,
    viewport: parsed.viewport,
    updated: typeof parsed.updated === "string" ? parsed.updated : undefined,
  };

  return c.json({ mindmap: { id, path: relPath, input: mindmap, json: raw } });
});

adminMindmapsRoutes.post("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  let input: MindmapInput;
  try {
    input = (await c.req.json()) as MindmapInput;
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const id = validateMindmapId(input.id);
  const relPath = validateRepoPath(`content/mindmaps/${id}.json`);
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const json = renderMindmapJson({ ...input, id });

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `mindmap: ${id}`,
    writes: [{ path, encoding: "utf8", content: json + "\n" }],
  });

  return c.json({ mindmap: { id, path: relPath }, commit: { sha: commit.sha, url: commit.url } }, 201);
});

adminMindmapsRoutes.patch("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const id = validateMindmapId(c.req.param("id"));

  let patch: Partial<MindmapInput>;
  try {
    patch = (await c.req.json()) as Partial<MindmapInput>;
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const relPath = validateRepoPath(`content/mindmaps/${id}.json`);
  const path = applyContentRoot(cfg.contentRoot, relPath);
  const existingRaw = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });
  const existing = (JSON.parse(existingRaw) ?? {}) as Record<string, unknown>;

  const merged: MindmapInput = {
    id,
    title: typeof patch.title === "string" ? patch.title : (existing.title as string | undefined),
    format: typeof patch.format === "string" ? patch.format : (existing.format as string | undefined),
    nodes: Array.isArray(patch.nodes) ? patch.nodes : (existing.nodes as unknown[] | undefined),
    edges: Array.isArray(patch.edges) ? patch.edges : (existing.edges as unknown[] | undefined),
    viewport: patch.viewport ?? existing.viewport,
    updated: new Date().toISOString(),
  };

  const json = renderMindmapJson(merged);

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `mindmap(update): ${id}`,
    writes: [{ path, encoding: "utf8", content: json + "\n" }],
  });

  return c.json({ mindmap: { id, path: relPath }, commit: { sha: commit.sha, url: commit.url } });
});

adminMindmapsRoutes.delete("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const id = validateMindmapId(c.req.param("id"));

  const relPath = validateRepoPath(`content/mindmaps/${id}.json`);
  const srcPath = applyContentRoot(cfg.contentRoot, relPath);
  const existing = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path: srcPath, ref: cfg.contentBranch });

  const trashRel = validateRepoPath(`content/.trash/mindmaps/${id}.json`);
  const trashPath = applyContentRoot(cfg.contentRoot, trashRel);

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `mindmap(trash): ${id}`,
    writes: [{ path: trashPath, encoding: "utf8", content: existing }],
    deletes: [srcPath],
  });

  return c.json({ ok: true, commit: { sha: commit.sha, url: commit.url } });
});
