import { Hono } from "hono";
import { HttpError } from "../http/errors";
import { buildUploadPath, enforceUploadLimit, inferExtension } from "../content/uploads";
import { commitAtomic } from "../github/gitData";
import { ghJson } from "../github/client";
import { applyContentRoot, validateRepoPath } from "../github/validate";

export const adminUploadsRoutes = new Hono();

type RefResponse = { object: { sha: string } };
type CommitResponse = { tree: { sha: string } };
type TreeItem = { path: string; type: "blob" | "tree"; sha: string; size?: number };
type TreeResponse = { truncated?: boolean; tree: TreeItem[] };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function stripContentRoot(contentRoot: string, repoPath: string): string {
  const root = (contentRoot ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!root) return repoPath;
  if (repoPath === root) return "";
  if (repoPath.startsWith(`${root}/`)) return repoPath.slice(root.length + 1);
  return repoPath;
}

function rawGithubUrl(args: { repo: string; branch: string; path: string }): string {
  const encBranch = encodeURIComponent(args.branch);
  const encPath = args.path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://raw.githubusercontent.com/${args.repo}/${encBranch}/${encPath}`;
}

function guessContentTypeFromPath(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".avif")) return "image/avif";
  if (p.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

adminUploadsRoutes.post("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  const ct = c.req.header("Content-Type") ?? "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(400, "BAD_REQUEST", "Content-Type must be multipart/form-data.");
  }

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) throw new HttpError(422, "VALIDATION_FAILED", "Missing file.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  enforceUploadLimit(bytes.byteLength);

  const ext = inferExtension({ filename: file.name, contentType: file.type });
  const built = await buildUploadPath(bytes, ext);

  const relPath = validateRepoPath(built.path);
  const path = applyContentRoot(cfg.contentRoot, relPath);

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `upload: ${relPath.split("/").slice(-1)[0]}`,
    writes: [{ path, encoding: "base64", content: bytes }],
  });

  return c.json(
    {
      asset: {
        path: relPath,
        url: built.url,
        bytes: bytes.byteLength,
        contentType: file.type || "application/octet-stream",
      },
      commit: { sha: commit.sha, url: commit.url },
      },
    201,
  );
});

adminUploadsRoutes.get("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const after = (c.req.query("after") ?? "").trim() || null;
  const limitRaw = Number(c.req.query("limit") ?? "");
  const limit = clamp(Number.isFinite(limitRaw) ? limitRaw : 80, 1, 200);

  const ref = await ghJson<RefResponse>({
    token: user.ghToken,
    method: "GET",
    path: `/repos/${cfg.contentRepo}/git/ref/heads/${cfg.contentBranch}`,
  });
  const headSha = ref.object.sha;

  const headCommit = await ghJson<CommitResponse>({
    token: user.ghToken,
    method: "GET",
    path: `/repos/${cfg.contentRepo}/git/commits/${headSha}`,
  });
  const treeSha = headCommit.tree.sha;

  const tree = await ghJson<TreeResponse>({
    token: user.ghToken,
    method: "GET",
    path: `/repos/${cfg.contentRepo}/git/trees/${treeSha}?recursive=1`,
  });

  const uploadPrefix = applyContentRoot(cfg.contentRoot, "public/uploads/").replace(/\/+$/g, "") + "/";

  const all = (tree.tree ?? [])
    .filter((it) => it.type === "blob")
    .filter((it) => it.path.startsWith(uploadPrefix))
    .map((it) => {
      const relRaw = stripContentRoot(cfg.contentRoot, it.path);
      const rel = validateRepoPath(relRaw);
      const url = rel.startsWith("public/") ? rel.slice("public".length) : `/${rel}`;
      const contentType = guessContentTypeFromPath(rel);
      const bytes = typeof it.size === "number" ? it.size : null;
      return {
        path: rel,
        url,
        rawUrl: rawGithubUrl({ repo: cfg.contentRepo, branch: cfg.contentBranch, path: it.path }),
        bytes,
        contentType,
        sha: it.sha,
      };
    })
    .filter((a) => {
      if (!q) return true;
      return a.path.toLowerCase().includes(q) || a.url.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.path < b.path ? 1 : a.path > b.path ? -1 : 0));

  let start = 0;
  if (after) {
    const idx = all.findIndex((a) => a.path === after);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = all.slice(start, start + limit);
  const nextAfter = start + limit < all.length ? slice.at(-1)?.path ?? null : null;

  return c.json({
    assets: slice,
    paging: { after, nextAfter },
    truncated: Boolean(tree.truncated),
  });
});

adminUploadsRoutes.delete("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  let body: { path?: string };
  try {
    body = (await c.req.json()) as { path?: string };
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const relPath = validateRepoPath(String(body.path ?? ""));
  if (!relPath.startsWith("public/uploads/")) throw new HttpError(422, "VALIDATION_FAILED", "Invalid upload path.", { path: relPath });

  const path = applyContentRoot(cfg.contentRoot, relPath);
  const filename = relPath.split("/").at(-1) ?? relPath;

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `upload(delete): ${filename}`,
    writes: [],
    deletes: [path],
  });

  return c.json({ ok: true, commit: { sha: commit.sha, url: commit.url } });
});
