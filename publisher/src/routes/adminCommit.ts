import { Hono } from "hono";
import { HttpError } from "../http/errors";
import { commitAtomic } from "../github/gitData";
import { applyContentRoot, validateRepoPath } from "../github/validate";
import { base64Decode } from "../util/base64";

type CommitRequest = {
  message: string;
  expectedHeadSha?: string;
  files: Array<
    | { path: string; encoding: "utf8"; content: string }
    | { path: string; encoding: "base64"; contentBase64: string }
  >;
  deletes?: string[];
};

export const adminCommitRoutes = new Hono();

adminCommitRoutes.post("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  let body: CommitRequest;
  try {
    body = (await c.req.json()) as CommitRequest;
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const message = String(body.message ?? "").trim();
  if (!message) throw new HttpError(422, "VALIDATION_FAILED", "Missing commit message.");
  if (!Array.isArray(body.files) || body.files.length === 0) {
    throw new HttpError(422, "VALIDATION_FAILED", "Missing files.");
  }

  const writes = body.files.map((f) => {
    const rawPath = validateRepoPath(String((f as any).path ?? ""));
    const path = applyContentRoot(cfg.contentRoot, rawPath);
    if ((f as any).encoding === "base64") {
      const contentBase64 = String((f as any).contentBase64 ?? "");
      let bytes: Uint8Array;
      try {
        bytes = base64Decode(contentBase64);
      } catch {
        throw new HttpError(422, "VALIDATION_FAILED", "Invalid base64 content.", { path: rawPath });
      }
      return { path, encoding: "base64" as const, content: bytes };
    }
    const content = String((f as any).content ?? "");
    return { path, encoding: "utf8" as const, content };
  });

  const deletes = (body.deletes ?? []).map((p) => applyContentRoot(cfg.contentRoot, validateRepoPath(String(p))));

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message,
    expectedHeadSha: body.expectedHeadSha,
    writes,
    deletes,
  });

  return c.json({ commit: { sha: commit.sha, url: commit.url, headSha: commit.headSha } });
});
