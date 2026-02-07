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
  const indexHtml = await fs.readFile(indexPath, "utf8");
  await fs.writeFile(path.join(distDir, "404.html"), indexHtml, "utf8");
  await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

