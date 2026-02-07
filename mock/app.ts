import cors from "cors";
import express from "express";
import { loadDb, toNoteListItem } from "./db";

export function createMockApp(options?: { enableCors?: boolean }) {
  const app = express();
  if (options?.enableCors) app.use(cors());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get(["/api/profile", "/api/profile.json"], async (_req, res) => {
    const db = await loadDb();
    res.json(db.profile);
  });

  app.get(["/api/categories", "/api/categories.json"], async (_req, res) => {
    const db = await loadDb();
    const counts = new Map<string, number>();
    for (const n of db.notes) {
      for (const c of n.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    res.json(
      db.categories
        .map((c) => ({ ...c, noteCount: counts.get(c.id) ?? 0 }))
        .sort((a, b) => b.noteCount - a.noteCount),
    );
  });

  app.get(["/api/categories/:id", "/api/categories/:id.json"], async (req, res) => {
    const db = await loadDb();
    const id = req.params.id;
    const category = db.categories.find((c) => c.id === id);
    if (!category) return res.status(404).json({ error: "category_not_found" });

    const notes = db.notes.filter((n) => n.categories.includes(id));
    res.json({ category, notes: notes.map(toNoteListItem) });
  });

  app.get(["/api/notes", "/api/notes.json"], async (req, res) => {
    const db = await loadDb();
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const roadmap = typeof req.query.roadmap === "string" ? req.query.roadmap : "";
    const node = typeof req.query.node === "string" ? req.query.node : "";

    const filtered = db.notes.filter((n) => {
      if (category && !n.categories.includes(category)) return false;
      if (roadmap && !n.nodes.some((r) => r.roadmapId === roadmap)) return false;
      if (node && !n.nodes.some((r) => r.nodeId === node)) return false;
      if (q) {
        const hay = `${n.title} ${n.excerpt} ${n.tags.join(" ")} ${n.categories.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.json(filtered.map(toNoteListItem));
  });

  app.get(["/api/notes/:id", "/api/notes/:id.json"], async (req, res) => {
    const db = await loadDb();
    const id = req.params.id;
    const note = db.notes.find((n) => n.id === id);
    if (!note) return res.status(404).json({ error: "note_not_found" });
    res.json(note);
  });

  app.get(["/api/projects", "/api/projects.json"], async (_req, res) => {
    const db = await loadDb();
    res.json(db.projects);
  });

  app.get(["/api/projects/:id", "/api/projects/:id.json"], async (req, res) => {
    const db = await loadDb();
    const p = db.projects.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "project_not_found" });
    res.json(p);
  });

  app.get(["/api/roadmaps", "/api/roadmaps.json"], async (_req, res) => {
    const db = await loadDb();
    const list = db.roadmaps.map((rm) => {
      const all = [...db.nodesIndex.values()].filter((x) => x.roadmapId === rm.id);
      const done = all.filter((x) => x.status === "solid" || x.status === "teach").length;
      return { id: rm.id, title: rm.title, description: rm.description, theme: rm.theme, progress: { done, total: all.length } };
    });
    res.json(list);
  });

  app.get(["/api/roadmaps/:id", "/api/roadmaps/:id.json"], async (req, res) => {
    const db = await loadDb();
    const rm = db.roadmaps.find((r) => r.id === req.params.id);
    if (!rm) return res.status(404).json({ error: "roadmap_not_found" });
    res.json(rm);
  });

  app.get(["/api/nodes", "/api/nodes.json"], async (_req, res) => {
    const db = await loadDb();
    res.json([...db.nodesIndex.values()]);
  });

  app.get(["/api/roadmaps/:roadmapId/nodes/:nodeId", "/api/roadmaps/:roadmapId/nodes/:nodeId.json"], async (req, res) => {
    const db = await loadDb();
    const roadmapId = req.params.roadmapId;
    const nodeId = req.params.nodeId;
    const entry = db.nodesIndex.get(`${roadmapId}/${nodeId}`);
    if (!entry) return res.status(404).json({ error: "node_not_found" });

    const notes = db.notes
      .filter((n) => n.nodes.some((r) => r.roadmapId === roadmapId && r.nodeId === nodeId))
      .map(toNoteListItem);

    res.json({ node: entry, notes });
  });

  app.get("/api/search", async (req, res) => {
    const db = await loadDb();
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    if (!q) {
      const hot = db.notes.slice(0, 8).map((n) => ({
        type: "note" as const,
        title: n.title,
        subtitle: "最近更新",
        href: `/notes/${n.id}`,
      }));
      return res.json(hot);
    }

    const hits: Array<{ type: string; title: string; subtitle?: string; href: string }> = [];

    for (const n of db.notes) {
      if (hits.length >= 12) break;
      if (n.title.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q)) {
        hits.push({ type: "note", title: n.title, subtitle: "Note", href: `/notes/${n.id}` });
      }
    }

    for (const c of db.categories) {
      if (hits.length >= 18) break;
      if (c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) {
        hits.push({ type: "category", title: c.title, subtitle: "Category", href: `/categories/${c.id}` });
      }
    }

    for (const rm of db.roadmaps) {
      if (hits.length >= 22) break;
      if (rm.title.toLowerCase().includes(q) || rm.id.toLowerCase().includes(q)) {
        hits.push({ type: "roadmap", title: rm.title, subtitle: "Roadmap", href: `/roadmaps/${rm.id}` });
      }
    }

    for (const node of db.nodesIndex.values()) {
      if (hits.length >= 28) break;
      if (node.title.toLowerCase().includes(q) || node.nodeId.toLowerCase().includes(q)) {
        hits.push({
          type: "node",
          title: node.title,
          subtitle: `${node.roadmapTitle}`,
          href: `/roadmaps/${node.roadmapId}/node/${node.nodeId}`,
        });
      }
    }

    for (const p of db.projects) {
      if (hits.length >= 34) break;
      if (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
        hits.push({ type: "project", title: p.name, subtitle: "Project", href: `/projects/${p.id}` });
      }
    }

    res.json(hits);
  });

  return app;
}
