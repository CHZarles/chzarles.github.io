import { Hono } from "hono";
import YAML from "yaml";
import { HttpError } from "../http/errors";
import { normalizeNoteId, parseFrontmatter, renderNoteMarkdown, todayUtc, type NoteInput } from "../content/notes";
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

function validateNoteId(id: string): string {
  const v = String(id ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{3,80}$/.test(v)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid note id.", { id });
  return v;
}

export const adminNotesRoutes = new Hono();

adminNotesRoutes.post("/", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");

  let input: NoteInput;
  try {
    input = (await c.req.json()) as NoteInput;
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const { noteId } = normalizeNoteId(input);
  const md = renderNoteMarkdown({ noteId, input: { ...input, date: input.date ?? todayUtc() } });

  const relPath = validateRepoPath(`content/notes/${noteId}.md`);
  const path = applyContentRoot(cfg.contentRoot, relPath);

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `publish: ${noteId}`,
    writes: [{ path, encoding: "utf8", content: md }],
  });

  return c.json(
    {
      note: { id: noteId, path: relPath },
      commit: { sha: commit.sha, url: commit.url },
    },
    201,
  );
});

adminNotesRoutes.patch("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const noteId = validateNoteId(c.req.param("id"));

  let patch: Partial<NoteInput>;
  try {
    patch = (await c.req.json()) as Partial<NoteInput>;
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const relPath = validateRepoPath(`content/notes/${noteId}.md`);
  const path = applyContentRoot(cfg.contentRoot, relPath);

  const existing = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });
  const parsed = parseFrontmatter(existing);

  const nextFm: Record<string, unknown> = { ...(parsed.frontmatter ?? {}) };
  const nextBody = typeof patch.content === "string" ? patch.content.trim() : parsed.body.trim();

  if (typeof patch.title === "string") nextFm.title = patch.title.trim();
  if (typeof patch.date === "string") nextFm.date = patch.date.trim();
  if (typeof patch.updated === "string") nextFm.updated = patch.updated.trim();
  else nextFm.updated = todayUtc();

  if (typeof patch.excerpt === "string") nextFm.excerpt = patch.excerpt;
  if (Array.isArray(patch.categories)) nextFm.categories = patch.categories;
  if (Array.isArray(patch.tags)) nextFm.tags = patch.tags;
  if (Array.isArray(patch.nodes)) nextFm.nodes = patch.nodes;
  if (Array.isArray(patch.mindmaps)) nextFm.mindmaps = patch.mindmaps;
  if (typeof patch.cover === "string") nextFm.cover = patch.cover;
  if (typeof patch.draft === "boolean") nextFm.draft = patch.draft;

  if (!nextFm.title || typeof nextFm.title !== "string") throw new HttpError(422, "VALIDATION_FAILED", "Missing title.");
  if (!nextFm.date || typeof nextFm.date !== "string") throw new HttpError(422, "VALIDATION_FAILED", "Missing date.");

  const yaml = YAML.stringify(nextFm).trimEnd();
  const md = `---\n${yaml}\n---\n\n${nextBody}\n`;

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `update: ${noteId}`,
    writes: [{ path, encoding: "utf8", content: md }],
  });

  return c.json({ note: { id: noteId, path: relPath }, commit: { sha: commit.sha, url: commit.url } });
});

adminNotesRoutes.delete("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const noteId = validateNoteId(c.req.param("id"));

  const relPath = validateRepoPath(`content/notes/${noteId}.md`);
  const srcPath = applyContentRoot(cfg.contentRoot, relPath);
  const existing = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path: srcPath, ref: cfg.contentBranch });

  const trashRel = validateRepoPath(`content/.trash/notes/${noteId}.md`);
  const trashPath = applyContentRoot(cfg.contentRoot, trashRel);

  const commit = await commitAtomic({
    token: user.ghToken,
    repo: cfg.contentRepo,
    branch: cfg.contentBranch,
    message: `trash: ${noteId}`,
    writes: [{ path: trashPath, encoding: "utf8", content: existing }],
    deletes: [srcPath],
  });

  return c.json({ ok: true, commit: { sha: commit.sha, url: commit.url } });
});
