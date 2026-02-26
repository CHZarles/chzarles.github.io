import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import process from "node:process";
import YAML from "yaml";

type PublisherError = { code: string; message: string; details?: Record<string, unknown> };

type ConfigV1 = {
  v: 1;
  publisherBaseUrl: string;
  token?: string;
  savedAt?: number;
};

type StageV1 = {
  v: 1;
  publisherBaseUrl: string;
  expectedHeadSha?: string;
  savedAt: number;
  writes: Array<{ path: string; encoding: "utf8"; content: string }>;
  deletes: string[];
};

type DeviceStartResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
};

type DevicePollResponse =
  | { status: "pending"; error: "authorization_pending" | "slow_down" }
  | { status: "authorized"; token: string; user: { id: number; login: string; avatarUrl: string | null }; scope: string | null };

type MeResponse = {
  user: { id: number; login: string; avatarUrl: string | null };
  repo: { fullName: string; branch: string; headSha: string };
};

type NotesListResponse = {
  notes: Array<{
    id: string;
    path: string;
    sha: string;
    size: number;
    meta?: { title?: string; date?: string; updated?: string; draft?: boolean; excerpt?: string };
  }>;
  paging: { after: string | null; nextAfter: string | null };
};

type NoteGetResponse = {
  note: { id: string; path: string; input: unknown; markdown: string };
};

type CommitResponse = { commit: { sha: string; url: string; headSha: string } };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeBaseUrl(input: string): string | null {
  const raw = String(input ?? "").trim().replace(/\/+$/g, "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/g, "");
  } catch {
    return null;
  }
}

function configDir(): string {
  const xdg = String(process.env.XDG_CONFIG_HOME ?? "").trim();
  if (xdg) return path.join(xdg, "hyperblog");
  return path.join(os.homedir(), ".config", "hyperblog");
}

const CONFIG_PATH = path.join(configDir(), "studio-cli.json");
const STAGE_PATH = path.join(configDir(), "studio-cli.stage.json");

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // ignore on unsupported platforms
  }
}

async function readConfig(): Promise<ConfigV1 | null> {
  const cfg = await readJsonFile<ConfigV1>(CONFIG_PATH);
  if (!cfg || typeof cfg !== "object") return null;
  if (cfg.v !== 1) return null;
  if (typeof cfg.publisherBaseUrl !== "string" || !normalizeBaseUrl(cfg.publisherBaseUrl)) return null;
  if (typeof cfg.token !== "undefined" && typeof cfg.token !== "string") return null;
  return cfg;
}

async function writeConfig(cfg: ConfigV1): Promise<void> {
  await writeJsonFile(CONFIG_PATH, cfg);
}

async function readStage(): Promise<StageV1 | null> {
  const st = await readJsonFile<StageV1>(STAGE_PATH);
  if (!st || typeof st !== "object") return null;
  if (st.v !== 1) return null;
  if (typeof st.publisherBaseUrl !== "string" || !normalizeBaseUrl(st.publisherBaseUrl)) return null;
  if (typeof st.savedAt !== "number") return null;
  if (!Array.isArray(st.writes) || !Array.isArray(st.deletes)) return null;
  return st;
}

async function writeStage(st: StageV1): Promise<void> {
  await writeJsonFile(STAGE_PATH, st);
}

async function clearStage(): Promise<void> {
  try {
    await fs.unlink(STAGE_PATH);
  } catch {
    // ignore
  }
}

function resolvePublisherBaseUrl(args: { baseUrl?: string }, cfg: ConfigV1 | null): string {
  const env = normalizeBaseUrl(process.env.HYPERBLOG_PUBLISHER_URL ?? process.env.PUBLISHER_BASE_URL ?? "");
  if (env) return env;
  const fromArg = normalizeBaseUrl(args.baseUrl ?? "");
  if (fromArg) return fromArg;
  const fromCfg = normalizeBaseUrl(cfg?.publisherBaseUrl ?? "");
  if (fromCfg) return fromCfg;
  return "http://localhost:8788";
}

function resolveToken(args: { token?: string }, cfg: ConfigV1 | null): string | null {
  const env = String(process.env.HYPERBLOG_PUBLISHER_TOKEN ?? "").trim();
  if (env) return env;
  const fromArg = String(args.token ?? "").trim();
  if (fromArg) return fromArg;
  const fromCfg = String(cfg?.token ?? "").trim();
  return fromCfg || null;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function publisherFetchJson<T>(args: {
  baseUrl: string;
  path: string;
  method?: string;
  token?: string | null;
  body?: unknown;
}): Promise<T> {
  const url = new URL(args.path, args.baseUrl).toString();
  const res = await fetch(url, {
    method: args.method ?? (args.body ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      ...(args.body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  if (!res.ok) {
    const data = (await readJsonSafe(res)) as { error?: PublisherError } | null;
    const err = data?.error ?? { code: "HTTP_ERROR", message: res.statusText, details: { status: res.status } };
    throw Object.assign(new Error(err.message), { publisher: err, status: res.status });
  }

  return (await res.json()) as T;
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return "—";
  if (diff < 15_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / 3_600_000)}h`;
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s;
}

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}

function parseFrontmatter(md: string): { frontmatter: Record<string, unknown>; body: string; ok: boolean } {
  const raw = String(md ?? "");
  if (!raw.startsWith("---\n")) return { frontmatter: {}, body: raw, ok: false };
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: raw, ok: false };
  const yaml = raw.slice(4, end + 1);
  const body = raw.slice(end + 5).replace(/^\s*\n/, "");
  const fm = (YAML.parse(yaml) ?? {}) as Record<string, unknown>;
  return { frontmatter: fm && typeof fm === "object" ? fm : {}, body, ok: true };
}

function withUpdated(md: string, updatedYmd: string): string {
  const parsed = parseFrontmatter(md);
  if (!parsed.ok) return md;

  const fm: Record<string, unknown> = { ...(parsed.frontmatter ?? {}) };
  const date = typeof fm.date === "string" ? fm.date.trim() : "";

  if (date && updatedYmd === date) delete fm.updated;
  else fm.updated = updatedYmd;

  const yaml = YAML.stringify(fm).trimEnd();
  const body = parsed.body.trim();
  return `---\n${yaml}\n---\n\n${body}\n`;
}

function quotedBash(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

async function openInEditor(args: { initial: string; nameHint: string }): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hyperblog-"));
  const filePath = path.join(tmpDir, args.nameHint);
  await fs.writeFile(filePath, args.initial, "utf8");

  const editor = (process.env.VISUAL || process.env.EDITOR || "vi").trim() || "vi";
  const cmd = `${editor} ${quotedBash(filePath)}`;
  const r = spawnSync("bash", ["-lc", cmd], { stdio: "inherit" });
  if (typeof r.status === "number" && r.status !== 0) {
    throw new Error(`Editor exited with ${r.status}`);
  }

  const out = await fs.readFile(filePath, "utf8");
  await fs.rm(tmpDir, { recursive: true, force: true });
  return out;
}

async function ensureStageBaseHead(args: { baseUrl: string; token: string }): Promise<string> {
  const me = await publisherFetchJson<MeResponse>({ baseUrl: args.baseUrl, path: "/api/auth/me", token: args.token });
  return me.repo.headSha;
}

async function stageWrite(args: { baseUrl: string; token: string; filePath: string; content: string }): Promise<void> {
  const normalizedBase = normalizeBaseUrl(args.baseUrl) ?? args.baseUrl;
  const existing = await readStage();
  if (existing && normalizeBaseUrl(existing.publisherBaseUrl) !== normalizeBase) {
    throw new Error(`Stage belongs to ${existing.publisherBaseUrl}; clear it first.`);
  }

  const stage: StageV1 =
    existing ?? { v: 1, publisherBaseUrl: normalizedBase, savedAt: Date.now(), writes: [], deletes: [] };

  if (!stage.expectedHeadSha) {
    stage.expectedHeadSha = await ensureStageBaseHead({ baseUrl: args.baseUrl, token: args.token });
  }

  stage.savedAt = Date.now();
  stage.deletes = stage.deletes.filter((p) => p !== args.filePath);

  const idx = stage.writes.findIndex((w) => w.path === args.filePath);
  if (idx >= 0) stage.writes[idx] = { path: args.filePath, encoding: "utf8", content: args.content };
  else stage.writes.push({ path: args.filePath, encoding: "utf8", content: args.content });

  await writeStage(stage);
}

async function printStage(): Promise<void> {
  const st = await readStage();
  if (!st || (!st.writes.length && !st.deletes.length)) {
    console.log("No staged changes.");
    return;
  }
  console.log(`Staged (${fmtRelative(st.savedAt)}): ${st.writes.length} write(s), ${st.deletes.length} delete(s)`);
  if (st.expectedHeadSha) console.log(`Base HEAD: ${st.expectedHeadSha.slice(0, 7)}`);
  for (const w of st.writes) console.log(`  write  ${w.path}`);
  for (const d of st.deletes) console.log(`  delete ${d}`);
}

function usage(): string {
  return [
    "Hyperblog Studio CLI (v0)\n",
    "Usage:",
    "  pnpm studio:cli -- login [baseUrl]",
    "  pnpm studio:cli -- me",
    "  pnpm studio:cli -- notes list",
    "  pnpm studio:cli -- notes edit <noteId>",
    "  pnpm studio:cli -- notes new [title...]",
    "  pnpm studio:cli -- stage",
    "  pnpm studio:cli -- publish -m \"message\" [--force]\n",
    "Env:",
    "  HYPERBLOG_PUBLISHER_URL / PUBLISHER_BASE_URL",
    "  HYPERBLOG_PUBLISHER_TOKEN\n",
  ].join("\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? "help";

  const cfg = await readConfig();

  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    console.log(usage());
    return;
  }

  if (cmd === "login") {
    const baseUrl = resolvePublisherBaseUrl({ baseUrl: argv[1] }, cfg);
    const started = await publisherFetchJson<DeviceStartResponse>({
      baseUrl,
      path: "/api/auth/device/start",
      method: "POST",
      body: {},
    });

    console.log(`\nGitHub device login`);
    console.log(`- Open: ${started.verificationUriComplete ?? started.verificationUri}`);
    console.log(`- Code: ${started.userCode}`);
    console.log(`- Expires in: ${Math.round(clamp(started.expiresIn, 30, 3600) / 60)} min`);

    let intervalSec = clamp(started.interval ?? 5, 3, 30);
    const startedAt = Date.now();
    const expiresAt = startedAt + clamp(started.expiresIn, 30, 3600) * 1000;

    while (true) {
      if (Date.now() > expiresAt) throw new Error("Device code expired. Run login again.");
      await sleep(intervalSec * 1000);
      let polled: DevicePollResponse;
      try {
        polled = await publisherFetchJson<DevicePollResponse>({
          baseUrl,
          path: "/api/auth/device/poll",
          method: "POST",
          body: { deviceCode: started.deviceCode },
        });
      } catch (err: unknown) {
        const e = err as any;
        if (e?.publisher?.code === "UNAUTHENTICATED") throw err;
        // transient: keep polling
        continue;
      }

      if (polled.status === "pending") {
        if (polled.error === "slow_down") intervalSec = Math.min(30, intervalSec + 5);
        continue;
      }

      const nextCfg: ConfigV1 = {
        v: 1,
        publisherBaseUrl: baseUrl,
        token: polled.token,
        savedAt: Date.now(),
      };
      await writeConfig(nextCfg);

      console.log(`\n✅ Logged in as @${polled.user.login}. Token saved to ${CONFIG_PATH}`);
      return;
    }
  }

  const baseUrl = resolvePublisherBaseUrl({}, cfg);
  const token = resolveToken({}, cfg);

  if (cmd === "me") {
    if (!token) throw new Error("Missing token. Run `login` first.");
    const me = await publisherFetchJson<MeResponse>({ baseUrl, path: "/api/auth/me", token });
    console.log(`@${me.user.login} · ${me.repo.fullName}@${me.repo.branch} · HEAD ${me.repo.headSha.slice(0, 7)}`);
    return;
  }

  if (cmd === "notes") {
    const sub = argv[1] ?? "list";
    if (!token) throw new Error("Missing token. Run `login` first.");

    if (sub === "list") {
      const res = await publisherFetchJson<NotesListResponse>({
        baseUrl,
        path: "/api/admin/notes?include=meta&limit=50",
        token,
      });
      for (const n of res.notes) {
        const title = n.meta?.title ?? n.id;
        const flags = [n.meta?.draft ? "draft" : null].filter(Boolean).join(" ");
        const date = n.meta?.updated ?? n.meta?.date ?? "";
        console.log(`${n.id}  ${date.padEnd(10)}  ${flags.padEnd(5)}  ${title}`);
      }
      if (res.paging.nextAfter) console.log(`\nMore: run with after=${res.paging.nextAfter}`);
      return;
    }

    if (sub === "edit") {
      const noteId = String(argv[2] ?? "").trim();
      if (!noteId) throw new Error("Usage: notes edit <noteId>");

      const res = await publisherFetchJson<NoteGetResponse>({
        baseUrl,
        path: `/api/admin/notes/${encodeURIComponent(noteId)}`,
        token,
      });

      const initial = res.note.markdown ?? "";
      const edited = await openInEditor({ initial, nameHint: `${noteId}.md` });
      if (edited === initial) {
        console.log("No changes.");
        return;
      }

      const next = withUpdated(edited, todayUtc());
      await stageWrite({ baseUrl, token, filePath: `content/notes/${noteId}.md`, content: next });
      console.log(`Staged: content/notes/${noteId}.md`);
      return;
    }

    if (sub === "new") {
      if (!token) throw new Error("Missing token. Run `login` first.");
      const titleArg = argv.slice(2).join(" ").trim();
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const title = titleArg || (await rl.question("Title: "));
      rl.close();
      const t = title.trim();
      if (!t) throw new Error("Missing title.");

      const date = todayLocal();
      const slugBase = slugify(t);
      const slug = slugBase || `note-${shortHash(`${t}:${Date.now()}`)}`;
      const noteId = `${date}-${slug}`;

      const seedFm = { title: t, date };
      const seedYaml = YAML.stringify(seedFm).trimEnd();
      const seed = `---\n${seedYaml}\n---\n\n`;
      const edited = await openInEditor({ initial: seed, nameHint: `${noteId}.md` });

      const next = withUpdated(edited, todayUtc());
      await stageWrite({ baseUrl, token, filePath: `content/notes/${noteId}.md`, content: next });
      console.log(`Staged new: content/notes/${noteId}.md`);
      return;
    }

    throw new Error(`Unknown notes subcommand: ${sub}`);
  }

  if (cmd === "stage") {
    await printStage();
    return;
  }

  if (cmd === "publish") {
    if (!token) throw new Error("Missing token. Run `login` first.");
    const st = await readStage();
    if (!st || (!st.writes.length && !st.deletes.length)) {
      console.log("Nothing to publish.");
      return;
    }

    const force = argv.includes("--force");
    const mi = argv.findIndex((x) => x === "-m" || x === "--message");
    const message = mi >= 0 ? String(argv[mi + 1] ?? "").trim() : "";
    const commitMessage = message || `studio: publish ${st.writes.length} write(s), ${st.deletes.length} delete(s)`;

    const me = await publisherFetchJson<MeResponse>({ baseUrl, path: "/api/auth/me", token });
    const remoteHead = me.repo.headSha;
    const expected = force ? remoteHead : st.expectedHeadSha ?? remoteHead;

    if (!force && st.expectedHeadSha && st.expectedHeadSha !== remoteHead) {
      throw new Error(`Remote HEAD moved (${st.expectedHeadSha.slice(0, 7)} → ${remoteHead.slice(0, 7)}). Re-stage or use --force.`);
    }

    const res = await publisherFetchJson<CommitResponse>({
      baseUrl,
      path: "/api/admin/commit",
      method: "POST",
      token,
      body: { message: commitMessage, expectedHeadSha: expected, files: st.writes, deletes: st.deletes },
    });

    await clearStage();
    console.log(`Published: ${res.commit.sha.slice(0, 7)}`);
    console.log(res.commit.url);
    return;
  }

  console.log(usage());
}

main().catch((err: unknown) => {
  const e = err as any;
  const pub: PublisherError | undefined = e?.publisher;
  if (pub) {
    // eslint-disable-next-line no-console
    console.error(`ERROR: ${pub.code}: ${pub.message}`);
    if (pub.details) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(pub.details, null, 2));
    }
  } else {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? `ERROR: ${err.message}` : `ERROR: ${String(err)}`);
  }
  process.exitCode = 1;
});
