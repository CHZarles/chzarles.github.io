import assert from "node:assert/strict";
import { base64Decode, base64Encode, base64UrlDecode, base64UrlEncode } from "../src/util/base64";
import { openSealedJson, sealJson } from "../src/util/crypto";
import { issuePublisherToken, verifyPublisherToken } from "../src/auth/token";
import { validateRepoPath } from "../src/github/validate";
import { normalizeNoteId, parseFrontmatter, renderNoteMarkdown } from "../src/content/notes";

async function main() {
  // base64
  {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const b64 = base64Encode(bytes);
    assert.deepEqual(base64Decode(b64), bytes);

    const b64u = base64UrlEncode(bytes);
    assert.deepEqual(base64UrlDecode(b64u), bytes);
  }

  // seal/open
  {
    const secret = "devsecret";
    const token = await sealJson(secret, { hello: "world", n: 1 });
    const out = await openSealedJson<{ hello: string; n: number }>(secret, token);
    assert.equal(out.hello, "world");
    assert.equal(out.n, 1);
  }

  // publisher token
  {
    const secret = "devsecret";
    const token = await issuePublisherToken({
      secret,
      ttlSeconds: 3600,
      user: { id: 1, login: "charles", avatarUrl: "x", ghToken: "gho_dummy" },
    });
    const u = await verifyPublisherToken(secret, token);
    assert.equal(u.id, 1);
    assert.equal(u.login, "charles");
    assert.equal(u.ghToken, "gho_dummy");
  }

  // path whitelist
  {
    assert.equal(validateRepoPath("content/notes/2026-02-06-hello.md"), "content/notes/2026-02-06-hello.md");
    assert.equal(validateRepoPath("content/profile.json"), "content/profile.json");
    assert.equal(validateRepoPath("content/categories.yml"), "content/categories.yml");
    assert.equal(validateRepoPath("content/projects.json"), "content/projects.json");
    assert.equal(validateRepoPath("content/roadmaps/ai-infra.yml"), "content/roadmaps/ai-infra.yml");
    assert.equal(validateRepoPath("content/roadmaps/ai-infra.yaml"), "content/roadmaps/ai-infra.yaml");
    assert.throws(() => validateRepoPath("../etc/passwd"));
    assert.throws(() => validateRepoPath("src/main.ts"));
    assert.throws(() => validateRepoPath("content/notes/2026-02-06-hello.txt"));
    assert.throws(() => validateRepoPath("content/roadmaps/ai-infra.txt"));
  }

  // notes render/parse
  {
    const input = { title: "Hello", content: "## Body", date: "2026-02-06", slug: "hello" };
    const { noteId } = normalizeNoteId(input);
    const md = renderNoteMarkdown({ noteId, input });
    const parsed = parseFrontmatter(md);
    assert.equal(parsed.frontmatter.title, "Hello");
    assert.ok(String(parsed.body).includes("## Body"));
  }

  console.log("[publisher] smoke ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
