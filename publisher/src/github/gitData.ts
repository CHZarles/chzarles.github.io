import { HttpError } from "../http/errors";
import { base64Encode } from "../util/base64";
import { ghJson } from "./client";

type RefResponse = { object: { sha: string } };
type CommitResponse = { tree: { sha: string } };
type BlobResponse = { sha: string };
type TreeResponse = { sha: string };
type CreateCommitResponse = { sha: string };

export type WriteFile = {
  path: string; // validated, repo-relative (after contentRoot applied)
  encoding: "utf8" | "base64";
  content: string | Uint8Array;
};

export async function commitAtomic(args: {
  token: string;
  repo: string; // "owner/name"
  branch: string; // "main"
  message: string;
  expectedHeadSha?: string;
  writes: WriteFile[];
  deletes?: string[];
}): Promise<{ sha: string; url: string; headSha: string }> {
  const ref = await ghJson<RefResponse>({
    token: args.token,
    method: "GET",
    path: `/repos/${args.repo}/git/ref/heads/${args.branch}`,
  });
  const headSha = ref.object.sha;

  if (args.expectedHeadSha && args.expectedHeadSha !== headSha) {
    throw new HttpError(409, "HEAD_MOVED", "Branch head moved.", {
      expectedHeadSha: args.expectedHeadSha,
      actualHeadSha: headSha,
    });
  }

  const headCommit = await ghJson<CommitResponse>({
    token: args.token,
    method: "GET",
    path: `/repos/${args.repo}/git/commits/${headSha}`,
  });
  const baseTreeSha = headCommit.tree.sha;

  const blobs: Array<{ path: string; sha: string }> = [];
  for (const w of args.writes) {
    const encoding = w.encoding === "base64" ? "base64" : "utf-8";
    const content =
      typeof w.content === "string"
        ? w.content
        : w.encoding === "base64"
          ? base64Encode(w.content)
          : new TextDecoder().decode(w.content);

    const blob = await ghJson<BlobResponse>({
      token: args.token,
      method: "POST",
      path: `/repos/${args.repo}/git/blobs`,
      body: { content, encoding },
    });
    blobs.push({ path: w.path, sha: blob.sha });
  }

  const tree = await ghJson<TreeResponse>({
    token: args.token,
    method: "POST",
    path: `/repos/${args.repo}/git/trees`,
    body: {
      base_tree: baseTreeSha,
      tree: [
        ...blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
        ...(args.deletes ?? []).map((p) => ({ path: p, mode: "100644", type: "blob", sha: null })),
      ],
    },
  });

  const commit = await ghJson<CreateCommitResponse>({
    token: args.token,
    method: "POST",
    path: `/repos/${args.repo}/git/commits`,
    body: { message: args.message, tree: tree.sha, parents: [headSha] },
  });

  await ghJson({
    token: args.token,
    method: "PATCH",
    path: `/repos/${args.repo}/git/refs/heads/${args.branch}`,
    body: { sha: commit.sha, force: false },
  });

  return { sha: commit.sha, url: `https://github.com/${args.repo}/commit/${commit.sha}`, headSha };
}

