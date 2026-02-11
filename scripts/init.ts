import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type InitAnswers = {
  githubLogin: string;
  contentRepo: string; // owner/name
  siteUrl: string;
  publisherUrl: string | null;
};

function trimOr(input: string | null | undefined, fallback: string): string {
  const v = String(input ?? "").trim();
  return v || fallback;
}

function parseOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return null;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function upsertTomlVars(toml: string, vars: Record<string, string | number>): string {
  const lines = toml.split(/\r?\n/);
  const varsStart = lines.findIndex((l) => l.trim() === "[vars]");
  if (varsStart === -1) {
    const out = [...lines, "", "[vars]"];
    for (const [k, v] of Object.entries(vars)) out.push(renderTomlVar(k, v));
    return out.join("\n").replace(/\n+$/, "\n");
  }

  let varsEnd = lines.length;
  for (let i = varsStart + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t.startsWith("[") && t.endsWith("]")) {
      varsEnd = i;
      break;
    }
  }

  const block = lines.slice(varsStart + 1, varsEnd);
  const replaced = new Set<string>();

  const nextBlock = block.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) return line;
    const key = m[1]!;
    if (!(key in vars)) return line;
    replaced.add(key);
    return renderTomlVar(key, vars[key]!);
  });

  const toAppend: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    if (replaced.has(k)) continue;
    toAppend.push(renderTomlVar(k, v));
  }

  const out = [...lines.slice(0, varsStart + 1), ...nextBlock];
  if (toAppend.length) {
    if (out.length && out[out.length - 1]!.trim() !== "") out.push("");
    out.push(...toAppend);
  }
  out.push(...lines.slice(varsEnd));
  return out.join("\n").replace(/\n+$/, "\n");
}

function renderTomlVar(key: string, value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${key} = ${value}`;
  const v = String(value);
  const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${key} = "${escaped}"`;
}

async function writeIfChanged(filePath: string, next: string): Promise<boolean> {
  const prev = await fs.readFile(filePath, "utf8").catch(() => null);
  if (prev === next) return false;
  await fs.writeFile(filePath, next, "utf8");
  return true;
}

function normalizeOwnerRepo(input: string): string | null {
  const v = input.trim();
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(v)) return null;
  return v;
}

async function main() {
  const root = process.cwd();
  const profilePath = path.join(root, "content", "profile.json");
  const wranglerPath = path.join(root, "publisher", "wrangler.toml");
  const devVarsExamplePath = path.join(root, "publisher", ".dev.vars.example");

  const profile = (await readJsonFile<Record<string, unknown>>(profilePath)) ?? {};
  const profilePublisher = typeof profile.publisherBaseUrl === "string" ? profile.publisherBaseUrl.trim() : "";

  const rl = readline.createInterface({ input, output });
  try {
    // Basic repo identity
    const githubLogin = trimOr(await rl.question(`GitHub login (owner)${profilePublisher ? "" : ""}: `), "");
    if (!githubLogin) throw new Error("Missing GitHub login.");

    const defaultRepoName = `${githubLogin}.github.io`;
    const repoName = trimOr(await rl.question(`Repo name (default: ${defaultRepoName}): `), defaultRepoName);
    const contentRepo = `${githubLogin}/${repoName}`;

    const defaultSiteUrl = repoName.endsWith(".github.io") ? `https://${repoName}` : `https://${githubLogin}.github.io/${repoName}`;
    const siteUrl = trimOr(await rl.question(`Site URL (default: ${defaultSiteUrl}): `), defaultSiteUrl);

    const defaultPublisherUrl = profilePublisher || "";
    const publisherUrlRaw = trimOr(await rl.question(`Publisher URL (Workers) (optional)${defaultPublisherUrl ? ` (default: ${defaultPublisherUrl})` : ""}: `), defaultPublisherUrl);
    const publisherUrl = publisherUrlRaw ? publisherUrlRaw : null;

    const answers: InitAnswers = { githubLogin, contentRepo, siteUrl, publisherUrl };

    // Update publisher/wrangler.toml vars
    const wranglerRaw = await fs.readFile(wranglerPath, "utf8");
    const siteOrigin = parseOrigin(answers.siteUrl);
    const allowedOrigins = ["http://localhost:5173", "http://localhost:4173", siteOrigin].filter((x): x is string => Boolean(x)).join(",");

    const nextWrangler = upsertTomlVars(wranglerRaw, {
      ...(answers.publisherUrl ? { BASE_URL: answers.publisherUrl } : {}),
      ADMIN_GITHUB_LOGINS: answers.githubLogin,
      CONTENT_REPO: answers.contentRepo,
      CONTENT_BRANCH: "main",
      CONTENT_ROOT: "",
      ALLOWED_ORIGINS: allowedOrigins,
      TOKEN_TTL_SECONDS: 43200,
    });
    const wranglerChanged = await writeIfChanged(wranglerPath, nextWrangler);

    // Update content/profile.json (publisherBaseUrl + GitHub link if present)
    const nextProfile = { ...profile } as any;
    if (answers.publisherUrl) nextProfile.publisherBaseUrl = answers.publisherUrl;

    if (Array.isArray(nextProfile.links)) {
      const gh = nextProfile.links.find((l: any) => String(l?.label ?? "").toLowerCase() === "github");
      if (gh && typeof gh === "object") gh.href = `https://github.com/${answers.githubLogin}`;
    }

    const profileOut = JSON.stringify(nextProfile, null, 2) + "\n";
    const profileChanged = await writeIfChanged(profilePath, profileOut);

    // Write publisher/.dev.vars.example
    const devVarsExample = [
      "# Local Publisher (wrangler dev) environment variables",
      "# Copy to publisher/.dev.vars and fill secrets for local dev (never commit .dev.vars)",
      "",
      `BASE_URL=http://localhost:8788`,
      `ADMIN_GITHUB_LOGINS=${answers.githubLogin}`,
      `CONTENT_REPO=${answers.contentRepo}`,
      "CONTENT_BRANCH=main",
      "CONTENT_ROOT=",
      `ALLOWED_ORIGINS=http://localhost:5173,${siteOrigin ?? ""}`.replace(/,+$/, ""),
      "TOKEN_TTL_SECONDS=43200",
      "",
      "# Secrets (required)",
      "GITHUB_CLIENT_ID=",
      "GITHUB_CLIENT_SECRET=",
      "TOKEN_SECRET=",
      "",
    ].join("\n");
    const devVarsChanged = await writeIfChanged(devVarsExamplePath, devVarsExample);

    // Summary
    // eslint-disable-next-line no-console
    console.log("\n✅ Hyperblog init complete.\n");
    // eslint-disable-next-line no-console
    console.log(`- content repo: ${answers.contentRepo}`);
    // eslint-disable-next-line no-console
    console.log(`- site url:     ${answers.siteUrl}`);
    // eslint-disable-next-line no-console
    console.log(`- publisher:    ${answers.publisherUrl ?? "(not set)"}`);
    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log("Files updated:");
    // eslint-disable-next-line no-console
    console.log(`- publisher/wrangler.toml: ${wranglerChanged ? "updated" : "no change"}`);
    // eslint-disable-next-line no-console
    console.log(`- content/profile.json:    ${profileChanged ? "updated" : "no change"}`);
    // eslint-disable-next-line no-console
    console.log(`- publisher/.dev.vars.example: ${devVarsChanged ? "updated" : "no change"}`);
    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log("Next steps:");
    // eslint-disable-next-line no-console
    console.log("- Enable GitHub Pages: Settings → Pages → Source = GitHub Actions");
    // eslint-disable-next-line no-console
    console.log("- Deploy Worker: pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml");
    // eslint-disable-next-line no-console
    console.log("- Create GitHub OAuth App callback: <PUBLISHER_URL>/api/auth/github/callback");
    // eslint-disable-next-line no-console
    console.log("- Set Worker secrets: pnpm wrangler secret put GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET/TOKEN_SECRET -c publisher/wrangler.toml");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

