import fs from "node:fs/promises";
import path from "node:path";

type Issue = { level: "ok" | "warn" | "error"; message: string };

function ok(message: string): Issue {
  return { level: "ok", message };
}

function warn(message: string): Issue {
  return { level: "warn", message };
}

function error(message: string): Issue {
  return { level: "error", message };
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readText(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

function parseOrigin(input: string): string | null {
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}

function parseTomlVars(toml: string): Record<string, string> {
  const lines = toml.split(/\r?\n/);
  const varsStart = lines.findIndex((l) => l.trim() === "[vars]");
  if (varsStart === -1) return {};
  let varsEnd = lines.length;
  for (let i = varsStart + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t.startsWith("[") && t.endsWith("]")) {
      varsEnd = i;
      break;
    }
  }
  const out: Record<string, string> = {};
  for (const line of lines.slice(varsStart + 1, varsEnd)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const m = raw.match(/^([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    out[key] = val;
  }
  return out;
}

function hasPlaceholder(v: string): boolean {
  return /<[^>]+>|\bYOUR_\w+\b/i.test(v);
}

async function main() {
  const root = process.cwd();
  const issues: Issue[] = [];

  const packageJsonPath = path.join(root, "package.json");
  const lockPath = path.join(root, "pnpm-lock.yaml");
  const packageLockPath = path.join(root, "package-lock.json");
  const yarnLockPath = path.join(root, "yarn.lock");

  // package manager drift
  const pkgRaw = await readText(packageJsonPath);
  const pkg = pkgRaw ? (JSON.parse(pkgRaw) as any) : null;
  const pm = typeof pkg?.packageManager === "string" ? pkg.packageManager : "";
  if (pm.startsWith("pnpm@")) issues.push(ok(`packageManager: ${pm}`));
  else issues.push(warn(`packageManager not pinned to pnpm (package.json.packageManager=${JSON.stringify(pm)}).`));

  if (await exists(lockPath)) issues.push(ok("pnpm-lock.yaml present."));
  else issues.push(error("Missing pnpm-lock.yaml (GitHub Actions uses pnpm --frozen-lockfile)."));

  if (await exists(packageLockPath)) issues.push(warn("package-lock.json present (can cause npm/pnpm drift). Consider removing it."));
  if (await exists(yarnLockPath)) issues.push(warn("yarn.lock present (can cause toolchain drift). Consider removing it."));

  // Pages workflow
  const pagesWorkflow = path.join(root, ".github", "workflows", "pages.yml");
  const wf = await readText(pagesWorkflow);
  if (!wf) {
    issues.push(error("Missing .github/workflows/pages.yml (Pages deploy workflow)."));
  } else {
    const usesPnpm = /pnpm install\b/.test(wf) && /corepack enable/.test(wf);
    issues.push(usesPnpm ? ok("GitHub Pages workflow uses pnpm + corepack.") : warn("GitHub Pages workflow may not be using pnpm/corepack."));
  }

  // profile
  const profilePath = path.join(root, "content", "profile.json");
  const profileRaw = await readText(profilePath);
  let profile: any = null;
  if (!profileRaw) {
    issues.push(error("Missing content/profile.json."));
  } else {
    try {
      profile = JSON.parse(profileRaw);
      issues.push(ok("content/profile.json parses."));
    } catch {
      issues.push(error("content/profile.json is not valid JSON."));
    }
  }

  const publisherBaseUrl = typeof profile?.publisherBaseUrl === "string" ? profile.publisherBaseUrl.trim() : "";
  if (publisherBaseUrl) {
    const origin = parseOrigin(publisherBaseUrl);
    issues.push(origin ? ok(`publisherBaseUrl: ${origin}`) : warn(`publisherBaseUrl is not a valid URL: ${publisherBaseUrl}`));
  } else {
    issues.push(warn("publisherBaseUrl missing (Studio will default to http://localhost:8788)."));
  }

  // hero image path sanity
  const hero = profile?.hero;
  if (hero && typeof hero === "object" && !Array.isArray(hero)) {
    const variant = typeof hero.variant === "string" ? hero.variant : "";
    const imageUrl = typeof hero.imageUrl === "string" ? hero.imageUrl : "";
    if (variant === "image") {
      if (!imageUrl) issues.push(warn('Hero variant "image" but missing hero.imageUrl.'));
      else if (!imageUrl.startsWith("/")) issues.push(warn(`Hero imageUrl should be absolute ("/..."), got: ${JSON.stringify(imageUrl)}`));
      else {
        const filePath = path.join(root, "public", imageUrl.replace(/^\//, ""));
        issues.push((await exists(filePath)) ? ok(`Hero image exists: public/${imageUrl.replace(/^\//, "")}`) : warn(`Hero image missing: public/${imageUrl.replace(/^\//, "")}`));
      }
    }
  }

  // publisher/wrangler.toml vars
  const wranglerPath = path.join(root, "publisher", "wrangler.toml");
  const wranglerRaw = await readText(wranglerPath);
  if (!wranglerRaw) {
    issues.push(error("Missing publisher/wrangler.toml."));
  } else {
    const vars = parseTomlVars(wranglerRaw);
    const required = ["BASE_URL", "ADMIN_GITHUB_LOGINS", "CONTENT_REPO", "CONTENT_BRANCH", "CONTENT_ROOT", "ALLOWED_ORIGINS"];
    for (const k of required) {
      const hasKey = Object.prototype.hasOwnProperty.call(vars, k);
      const v = vars[k] ?? "";
      if (!hasKey) {
        issues.push(error(`publisher/wrangler.toml [vars].${k} missing.`));
        continue;
      }
      if (k !== "CONTENT_ROOT" && !String(v).trim()) {
        issues.push(error(`publisher/wrangler.toml [vars].${k} is empty.`));
        continue;
      }
      if (hasPlaceholder(v)) issues.push(warn(`publisher/wrangler.toml [vars].${k} looks like a placeholder: ${JSON.stringify(v)}`));
      else issues.push(ok(`publisher/wrangler.toml ${k} set.`));
    }

    const origins = String(vars.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const bad = origins.filter((o) => o.endsWith("/"));
    if (bad.length) issues.push(warn(`ALLOWED_ORIGINS should not have trailing slashes: ${bad.join(", ")}`));
    if (!origins.includes("http://localhost:5173")) issues.push(warn("ALLOWED_ORIGINS missing http://localhost:5173 (local Studio)."));
  }

  // publisher/.dev.vars.example
  const devVarsExample = path.join(root, "publisher", ".dev.vars.example");
  issues.push((await exists(devVarsExample)) ? ok("publisher/.dev.vars.example present.") : warn("Missing publisher/.dev.vars.example (local Publisher setup)."));

  // Print
  const errs = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");

  // eslint-disable-next-line no-console
  console.log("Hyperblog Doctor\n");
  for (const i of issues) {
    // eslint-disable-next-line no-console
    console.log(`${i.level.toUpperCase()}: ${i.message}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nSummary: ${errs.length} error(s), ${warns.length} warning(s).`);
  if (errs.length) process.exit(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
