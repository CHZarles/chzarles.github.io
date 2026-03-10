import fs from "node:fs/promises";
import path from "node:path";
import { loadDb, toNoteListItem } from "../mock/db";

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(outPath: string, data: unknown) {
  await ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, JSON.stringify(data), "utf8");
}

function escapeJsonForHtmlScript(raw: string): string {
  // Prevent breaking out of <script> with `</script>` sequences.
  return raw.replace(/</g, "\\u003c");
}

function resolveBuildId(): string {
  const env = process.env;
  const sha =
    env.GITHUB_SHA ||
    env.CF_PAGES_COMMIT_SHA ||
    env.VERCEL_GIT_COMMIT_SHA ||
    env.COMMIT_SHA ||
    env.SOURCE_VERSION ||
    "";
  if (sha) return sha.slice(0, 12);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function injectProfileIntoIndexHtml(indexHtml: string, profile: unknown, buildId: string): string {
  if (!indexHtml.includes("</head>")) return indexHtml;

  const profileJson = escapeJsonForHtmlScript(JSON.stringify(profile));
  const buildJson = escapeJsonForHtmlScript(JSON.stringify(buildId));

  let out = indexHtml;

  if (!out.includes('id="hb-profile"')) {
    const snippet =
      `\n    <script id="hb-profile" type="application/json">${profileJson}</script>\n` +
      `    <script>\n` +
      `      (() => {\n` +
      `        try {\n` +
      `          const el = document.getElementById("hb-profile");\n` +
      `          if (!el) return;\n` +
      `          const profile = JSON.parse(el.textContent || "null");\n` +
      `          window.__HB_PROFILE__ = profile;\n` +
      `\n` +
      `          const path = (location.pathname || "/").replace(/\\/index\\.html$/, "/");\n` +
      `          if (path !== "/") return;\n` +
      `\n` +
      `          const hero = profile && profile.hero;\n` +
      `          if (!hero || hero.preload === false || !hero.imageUrl) return;\n` +
      `          const href = new URL(hero.imageUrl, location.origin + "/").toString();\n` +
      `          const link = document.createElement("link");\n` +
      `          link.rel = "preload";\n` +
      `          link.as = "image";\n` +
      `          link.href = href;\n` +
      `          link.setAttribute("fetchpriority", "high");\n` +
      `          document.head.appendChild(link);\n` +
      `        } catch {\n` +
      `          // ignore\n` +
      `        }\n` +
      `      })();\n` +
      `    </script>\n`;

    out = out.replace("</head>", `${snippet}  </head>`);
  }

  if (!out.includes("__HB_BUILD__")) {
    const buildSnippet = `\n    <script>\n      try { window.__HB_BUILD__ = ${buildJson}; } catch {}\n    </script>\n`;
    out = out.replace("</head>", `${buildSnippet}  </head>`);
  }

  const v = encodeURIComponent(buildId);
  out = out
    .replace('href="/api/notes.json"', `href="/api/notes.json?v=${v}"`)
    .replace('href="/api/categories.json"', `href="/api/categories.json?v=${v}"`);

  return out;
}

async function main() {
  const distDir = path.join(process.cwd(), "dist");
  const apiDir = path.join(distDir, "api");

  await ensureDir(apiDir);

  const db = await loadDb();

  // profile
  await writeJson(path.join(apiDir, "profile.json"), db.profile);

  // categories (+ note counts)
  const counts = new Map<string, number>();
  for (const n of db.notes) {
    if (n.draft) continue;
    for (const c of n.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const categories = db.categories
    .map((c) => ({ ...c, noteCount: counts.get(c.id) ?? 0 }))
    .sort((a, b) => (b.noteCount ?? 0) - (a.noteCount ?? 0));
  await writeJson(path.join(apiDir, "categories.json"), categories);

  // notes index + note detail
  const notesIndex = db.notes.map(toNoteListItem);
  await writeJson(path.join(apiDir, "notes.json"), notesIndex);
  for (const n of db.notes) {
    await writeJson(path.join(apiDir, "notes", `${n.id}.json`), n);
  }

  // projects
  await writeJson(path.join(apiDir, "projects.json"), db.projects);

  // GitHub Pages SPA fallback
  const indexPath = path.join(distDir, "index.html");
  const indexHtmlRaw = await fs.readFile(indexPath, "utf8");
  const buildId = resolveBuildId();
  const indexHtml = injectProfileIntoIndexHtml(indexHtmlRaw, db.profile, buildId);
  if (indexHtml !== indexHtmlRaw) await fs.writeFile(indexPath, indexHtml, "utf8");
  await fs.writeFile(path.join(distDir, "404.html"), indexHtml, "utf8");
  await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
