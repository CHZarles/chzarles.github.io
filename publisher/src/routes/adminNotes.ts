import { Hono } from "hono";
import YAML from "yaml";
import { HttpError } from "../http/errors";
import { normalizeNoteId, parseFrontmatter, renderNoteMarkdown, todayUtc, type NoteInput } from "../content/notes";
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

function validateNoteId(id: string): string {
  const v = String(id ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{3,80}$/.test(v)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid note id.", { id });
  return v;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function noteIdFromFilename(name: string): string | null {
  if (!name.toLowerCase().endsWith(".md")) return null;
  const id = name.slice(0, -3);
  try {
    return validateNoteId(id);
  } catch {
    return null;
  }
}

function safeParseNote(md: string, id: string): { frontmatter: Record<string, unknown>; body: string } {
  try {
    return parseFrontmatter(md);
  } catch {
    throw new HttpError(422, "VALIDATION_FAILED", "Invalid note frontmatter.", { id });
  }
}

export const adminNotesRoutes = new Hono();

adminNotesRoutes.get("/", async (c) => {
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

  const dirPath = applyContentRoot(cfg.contentRoot, "content/notes");
  const items = await listRepoDir({ token: user.ghToken, repo: cfg.contentRepo, path: dirPath, ref: cfg.contentBranch });

  const notesAll = items
    .filter((it) => it.type === "file")
    .map((it) => {
      const id = noteIdFromFilename(it.name);
      if (!id) return null;
      return { id, path: validateRepoPath(`content/notes/${id}.md`), sha: it.sha, size: it.size };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  let start = 0;
  if (after) {
    const idx = notesAll.findIndex((n) => n.id === after);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = notesAll.slice(start, start + limit);

  let metaById: Record<string, { title?: string; date?: string; updated?: string; draft?: boolean; excerpt?: string }> = {};
  if (includeMeta) {
    const metaPairs = await Promise.all(
      slice.map(async (n) => {
        const rawPath = applyContentRoot(cfg.contentRoot, n.path);
        const md = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path: rawPath, ref: cfg.contentBranch });
        const parsed = safeParseNote(md, n.id);
        const fm = parsed.frontmatter ?? {};
        return [
          n.id,
          {
            title: typeof fm.title === "string" ? fm.title : undefined,
            date: typeof fm.date === "string" ? fm.date : undefined,
            updated: typeof fm.updated === "string" ? fm.updated : undefined,
            draft: typeof fm.draft === "boolean" ? fm.draft : undefined,
            excerpt: typeof fm.excerpt === "string" ? fm.excerpt : undefined,
          },
        ] as const;
      }),
    );
    metaById = Object.fromEntries(metaPairs);
  }

  const nextAfter = start + limit < notesAll.length ? slice.at(-1)?.id ?? null : null;

  return c.json({
    notes: slice.map((n) => ({ ...n, meta: metaById[n.id] })),
    paging: { after, nextAfter },
  });
});

adminNotesRoutes.get("/:id", async (c) => {
  const cfg = c.get("config");
  const user = c.get("user");
  const noteId = validateNoteId(c.req.param("id"));

  const relPath = validateRepoPath(`content/notes/${noteId}.md`);
  const path = applyContentRoot(cfg.contentRoot, relPath);

  const md = await readRepoFileUtf8({ token: user.ghToken, repo: cfg.contentRepo, path, ref: cfg.contentBranch });
  const parsed = safeParseNote(md, noteId);
  const fm = parsed.frontmatter ?? {};

  const note: NoteInput = {
    title: typeof fm.title === "string" ? fm.title : noteId,
    date: typeof fm.date === "string" ? fm.date : undefined,
    updated: typeof fm.updated === "string" ? fm.updated : undefined,
    excerpt: typeof fm.excerpt === "string" ? fm.excerpt : undefined,
    categories: Array.isArray(fm.categories) ? (fm.categories as string[]) : undefined,
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : undefined,
    nodes: Array.isArray(fm.nodes) ? (fm.nodes as string[]) : undefined,
    mindmaps: Array.isArray(fm.mindmaps) ? (fm.mindmaps as string[]) : undefined,
    cover: typeof fm.cover === "string" ? fm.cover : undefined,
    draft: typeof fm.draft === "boolean" ? fm.draft : undefined,
    content: parsed.body ?? "",
  };

  return c.json({ note: { id: noteId, path: relPath, input: note, markdown: md } });
});

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
