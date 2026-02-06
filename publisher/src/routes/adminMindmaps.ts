import { Hono } from "hono";
import { HttpError } from "../http/errors";
import { renderMindmapJson, validateMindmapId, type MindmapInput } from "../content/mindmaps";
import { commitAtomic } from "../github/gitData";
import { applyContentRoot, validateRepoPath } from "../github/validate";
import { base64Decode } from "../util/base64";
import { ghJson } from "../github/client";

type GhContents = { content?: string; encoding?: string };

async function readRepoFileUtf8(args: { token: string; repo: string; path: string; ref: string }): Promise<string> {
  const data = await ghJson<GhContents>({
    token: args.token,
    method: "GET",
    path: `/repos/${args.repo}/contents/${args.path}?ref=${encodeURIComponent(args.ref)}`,
  });
  if (!data.content || data.encoding !== "base64") throw new HttpError(502, "GITHUB_UPSTREAM", "Unexpected contents API response.");
  const bytes = base64Decode(data.content);
  return new TextDecoder().decode(bytes);
}

export const adminMindmapsRoutes = new Hono();

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

