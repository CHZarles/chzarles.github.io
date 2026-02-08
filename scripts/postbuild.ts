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

function injectProfileIntoIndexHtml(indexHtml: string, profile: unknown): string {
  if (indexHtml.includes('id="hb-profile"')) return indexHtml;
  if (!indexHtml.includes("</head>")) return indexHtml;

  const profileJson = escapeJsonForHtmlScript(JSON.stringify(profile));

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

  return indexHtml.replace("</head>", `${snippet}  </head>`);
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

  // mindmaps index + detail
  const mindmapsIndex = db.mindmaps
    .map((m) => ({
      id: m.id,
      title: m.title,
      updated: m.updated,
      format: m.format,
      nodeCount: Array.isArray(m.nodes) ? m.nodes.length : 0,
      edgeCount: Array.isArray(m.edges) ? m.edges.length : 0,
    }))
    .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
  await writeJson(path.join(apiDir, "mindmaps.json"), mindmapsIndex);
  for (const m of db.mindmaps) {
    await writeJson(path.join(apiDir, "mindmaps", `${m.id}.json`), m);
  }

  // roadmaps index + roadmap detail
  const roadmapsIndex = db.roadmaps.map((rm) => {
    const all = [...db.nodesIndex.values()].filter((x) => x.roadmapId === rm.id);
    const done = all.filter((x) => x.status === "solid" || x.status === "teach").length;
    return { id: rm.id, title: rm.title, description: rm.description, theme: rm.theme, progress: { done, total: all.length } };
  });
  await writeJson(path.join(apiDir, "roadmaps.json"), roadmapsIndex);
  for (const rm of db.roadmaps) {
    await writeJson(path.join(apiDir, "roadmaps", `${rm.id}.json`), rm);
  }

  // nodes index (for roadmap node pages + global search)
  const nodesIndex = [...db.nodesIndex.values()];
  await writeJson(path.join(apiDir, "nodes.json"), nodesIndex);

  // GitHub Pages SPA fallback
  const indexPath = path.join(distDir, "index.html");
  const indexHtmlRaw = await fs.readFile(indexPath, "utf8");
  const indexHtml = injectProfileIntoIndexHtml(indexHtmlRaw, db.profile);
  if (indexHtml !== indexHtmlRaw) await fs.writeFile(indexPath, indexHtml, "utf8");
  await fs.writeFile(path.join(distDir, "404.html"), indexHtml, "utf8");
  await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
