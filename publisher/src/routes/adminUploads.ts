import { Hono } from "hono";
import { HttpError } from "../http/errors";
import { buildUploadPath, enforceUploadLimit, inferExtension } from "../content/uploads";
import { commitAtomic } from "../github/gitData";
import { applyContentRoot, validateRepoPath } from "../github/validate";

export const adminUploadsRoutes = new Hono();

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

