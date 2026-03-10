import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { loadDb, toNoteListItem } from "./db";

export function createMockApp(options?: { enableCors?: boolean }) {
  const app = express();
  if (options?.enableCors) app.use(cors());

  function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  function stripJsonSuffix(raw: string | undefined): string {
    return (raw ?? "").replace(/\.json$/i, "");
  }

  function normalizeExternalUrl(input: string | undefined): string | null {
    const raw = String(input ?? "").trim();
    if (!raw) return null;
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  function primaryProjectUrl(p: { repoUrl?: string; homepage?: string }): string | null {
    return normalizeExternalUrl(p.repoUrl) ?? normalizeExternalUrl(p.homepage);
  }

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get(["/api/profile", "/api/profile.json"], asyncHandler(async (_req, res) => {
    const db = await loadDb();
    res.json(db.profile);
  }));

  app.get(["/api/categories", "/api/categories.json"], asyncHandler(async (_req, res) => {
    const db = await loadDb();
    const counts = new Map<string, number>();
    for (const n of db.notes) {
      if (n.draft) continue;
      for (const c of n.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    res.json(
      db.categories
        .map((c) => ({ ...c, noteCount: counts.get(c.id) ?? 0 }))
        .sort((a, b) => b.noteCount - a.noteCount),
    );
  }));

  app.get(["/api/categories/:id", "/api/categories/:id.json"], asyncHandler(async (req, res) => {
    const db = await loadDb();
    const id = stripJsonSuffix(req.params.id);
    const category = db.categories.find((c) => c.id === id);
    if (!category) return res.status(404).json({ error: "category_not_found" });

    const notes = db.notes.filter((n) => n.categories.includes(id));
    res.json({ category, notes: notes.map(toNoteListItem) });
  }));

  app.get(["/api/notes", "/api/notes.json"], asyncHandler(async (req, res) => {
    const db = await loadDb();
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";

    const filtered = db.notes.filter((n) => {
      if (category && !n.categories.includes(category)) return false;
      if (q) {
        const hay = `${n.title} ${n.excerpt} ${n.tags.join(" ")} ${n.categories.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.json(filtered.map(toNoteListItem));
  }));

  app.get(["/api/notes/:id", "/api/notes/:id.json"], asyncHandler(async (req, res) => {
    const db = await loadDb();
    const id = stripJsonSuffix(req.params.id);
    const note = db.notes.find((n) => n.id === id);
    if (!note) return res.status(404).json({ error: "note_not_found" });
    res.json(note);
  }));

  app.get(["/api/projects", "/api/projects.json"], asyncHandler(async (_req, res) => {
    const db = await loadDb();
    res.json(db.projects);
  }));

  app.get(["/api/projects/:id", "/api/projects/:id.json"], asyncHandler(async (req, res) => {
    const db = await loadDb();
    const id = stripJsonSuffix(req.params.id);
    const p = db.projects.find((x) => x.id === id);
    if (!p) return res.status(404).json({ error: "project_not_found" });
    res.json(p);
  }));

  app.get("/api/search", asyncHandler(async (req, res) => {
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
        hits.push({ type: "category", title: c.title, subtitle: "Category", href: `/notes?category=${encodeURIComponent(c.id)}` });
      }
    }

    for (const p of db.projects) {
      if (hits.length >= 24) break;
      if (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
        hits.push({ type: "project", title: p.name, subtitle: "Project", href: primaryProjectUrl(p) ?? `/projects/${p.id}` });
      }
    }

    res.json(hits);
  }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "internal_error", message });
  });

  return app;
}
