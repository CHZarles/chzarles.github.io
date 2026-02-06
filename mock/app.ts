import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";

type Profile = {
  name: string;
  handle: string;
  tagline: string;
  accent?: string; // hsl string: "270 95% 65%"
  avatarUrl?: string;
  links?: Array<{ label: string; href: string }>;
  hero?: {
    imageUrl?: string;
    blurPx?: number;
    opacity?: number;
    position?: string;
  };
};

type Category = {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "cyan" | "violet" | "lime" | "amber" | "rose";
};

type RoadmapNode = {
  id: string;
  title: string;
  description?: string;
  status?: "idea" | "learning" | "using" | "solid" | "teach";
  icon?: string;
  children?: RoadmapNode[];
  edges?: string[]; // dependency node ids (same roadmap)
  pinned?: string[]; // note ids
  projects?: string[]; // project ids
};

type RoadmapFile = {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  layout?: "vertical" | "horizontal";
  nodes: RoadmapNode[];
};

type Project = {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  homepage?: string;
  stack?: string[];
  highlights?: string[];
  nodes?: string[]; // roadmap refs: "ai-infra/otel"
};

type NoteFrontmatter = {
  title: string;
  date?: string;
  updated?: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
  nodes?: string[];
  cover?: string;
};

type Note = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  updated: string;
  categories: string[];
  tags: string[];
  nodes: Array<{
    ref: string; // "ai-infra/otel"
    roadmapId: string;
    nodeId: string;
    title: string;
    roadmapTitle: string;
    crumbs: Array<{ id: string; title: string }>;
  }>;
  cover?: string;
};

type NodeIndexEntry = {
  roadmapId: string;
  roadmapTitle: string;
  nodeId: string;
  title: string;
  description?: string;
  status?: RoadmapNode["status"];
  icon?: string;
  crumbs: Array<{ id: string; title: string }>;
  children: Array<{ nodeId: string; title: string; status?: RoadmapNode["status"] }>;
  dependencies: Array<{ nodeId: string; title: string }>;
  pinned?: string[];
  projects?: string[];
};

function toIsoDate(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[[^\]]*]\([^)]*\)/g, "")
    .replace(/[#>*_-]{1,}\s?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readYamlFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return YAML.parse(raw) as T;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

type Db = {
  profile: Profile;
  categories: Category[];
  roadmaps: RoadmapFile[];
  nodesIndex: Map<string, NodeIndexEntry>; // key: "roadmapId/nodeId"
  notes: Note[];
  projects: Project[];
};

async function loadDb(): Promise<Db> {
  const root = process.cwd();
  const contentDir = path.join(root, "content");

  const profilePath = path.join(contentDir, "profile.json");
  const categoriesPath = path.join(contentDir, "categories.yml");
  const projectsPath = path.join(contentDir, "projects.json");
  const roadmapsDir = path.join(contentDir, "roadmaps");
  const notesDir = path.join(contentDir, "notes");

  const profile: Profile = (await exists(profilePath))
    ? JSON.parse(await fs.readFile(profilePath, "utf8"))
    : {
        name: "Charles",
        handle: "@charles",
        tagline: "探索式技术空间（Demo）",
        accent: "270 95% 65%",
        links: [{ label: "GitHub", href: "https://github.com/" }],
        hero: { imageUrl: "/hero.svg", blurPx: 22, opacity: 0.28, position: "center" },
      };

  const categories: Category[] = (await exists(categoriesPath))
    ? await readYamlFile<Category[]>(categoriesPath)
    : [
        { id: "engineering", title: "工程实践", tone: "cyan" },
        { id: "ai", title: "AI / LLM", tone: "violet" },
        { id: "product", title: "产品", tone: "amber" },
      ];

  const projects: Project[] = (await exists(projectsPath))
    ? JSON.parse(await fs.readFile(projectsPath, "utf8"))
    : [];

  const roadmaps: RoadmapFile[] = [];
  if (await exists(roadmapsDir)) {
    const files = (await fs.readdir(roadmapsDir))
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .sort();
    for (const file of files) {
      const roadmap = await readYamlFile<RoadmapFile>(path.join(roadmapsDir, file));
      roadmaps.push(roadmap);
    }
  }

  const nodesIndex = new Map<string, NodeIndexEntry>();
  const edgeIndex = new Map<string, string[]>(); // key: "roadmapId/nodeId" -> dependency ids

  function indexRoadmapNode(args: {
    roadmapId: string;
    roadmapTitle: string;
    node: RoadmapNode;
    crumbs: Array<{ id: string; title: string }>;
  }) {
    const { roadmapId, roadmapTitle, node, crumbs } = args;
    const key = `${roadmapId}/${node.id}`;

    const children =
      node.children?.map((c) => ({ nodeId: c.id, title: c.title, status: c.status })) ?? [];
    edgeIndex.set(key, node.edges ?? []);

    nodesIndex.set(key, {
      roadmapId,
      roadmapTitle,
      nodeId: node.id,
      title: node.title,
      description: node.description,
      status: node.status,
      icon: node.icon,
      crumbs,
      children,
      dependencies: [],
      pinned: node.pinned,
      projects: node.projects,
    });

    for (const child of node.children ?? []) {
      indexRoadmapNode({
        roadmapId,
        roadmapTitle,
        node: child,
        crumbs: [...crumbs, { id: child.id, title: child.title }],
      });
    }
  }

  for (const rm of roadmaps) {
    for (const top of rm.nodes ?? []) {
      indexRoadmapNode({
        roadmapId: rm.id,
        roadmapTitle: rm.title,
        node: top,
        crumbs: [{ id: top.id, title: top.title }],
      });
    }
  }

  for (const [key, depIds] of edgeIndex.entries()) {
    const entry = nodesIndex.get(key);
    if (!entry) continue;
    entry.dependencies = depIds
      .map((depId) => {
        const dep = nodesIndex.get(`${entry.roadmapId}/${depId}`);
        return dep ? { nodeId: dep.nodeId, title: dep.title } : null;
      })
      .filter(Boolean) as Array<{ nodeId: string; title: string }>;
  }

  const notes: Note[] = [];
  if (await exists(notesDir)) {
    const files = (await fs.readdir(notesDir)).filter((f) => f.endsWith(".md")).sort().reverse();
    for (const file of files) {
      const full = path.join(notesDir, file);
      const raw = await fs.readFile(full, "utf8");
      const parsed = matter(raw);
      const fm = parsed.data as Partial<NoteFrontmatter>;

      const stat = await fs.stat(full);
      const date = toIsoDate(fm.date ?? stat.birthtime);
      const updated = toIsoDate(fm.updated ?? stat.mtime);
      const title = (fm.title ?? file.replace(/\.md$/, "")).toString();
      const categoriesRefs = Array.isArray(fm.categories) ? fm.categories : [];
      const tags = Array.isArray(fm.tags) ? fm.tags : [];
      const nodesRefs = Array.isArray(fm.nodes) ? fm.nodes : [];

      const body = parsed.content.trim();
      const excerptBase = fm.excerpt ? String(fm.excerpt) : stripMarkdown(body).slice(0, 220);
      const id = file.replace(/\.md$/, "");

      const nodes = nodesRefs
        .map((ref) => {
          const [roadmapId, nodeId] = String(ref).split("/");
          if (!roadmapId || !nodeId) return null;
          const entry = nodesIndex.get(`${roadmapId}/${nodeId}`);
          if (!entry) return null;
          return {
            ref: `${roadmapId}/${nodeId}`,
            roadmapId,
            nodeId,
            title: entry.title,
            roadmapTitle: entry.roadmapTitle,
            crumbs: entry.crumbs,
          };
        })
        .filter(Boolean) as Note["nodes"];

      notes.push({
        id,
        title,
        excerpt: excerptBase,
        content: body,
        date,
        updated,
        categories: categoriesRefs,
        tags,
        nodes,
        cover: fm.cover ? String(fm.cover) : undefined,
      });
    }
  }

  // Backfill category titles if content doesn't define them.
  const knownCategoryIds = new Set(categories.map((c) => c.id));
  for (const note of notes) {
    for (const c of note.categories) {
      if (!knownCategoryIds.has(c)) {
        categories.push({ id: c, title: c.replace(/-/g, " ") });
        knownCategoryIds.add(c);
      }
    }
  }

  return { profile, categories, roadmaps, nodesIndex, notes, projects };
}

function toNoteListItem(n: Note) {
  return {
    id: n.id,
    title: n.title,
    excerpt: n.excerpt,
    date: n.date,
    updated: n.updated,
    categories: n.categories,
    tags: n.tags,
    nodes: n.nodes,
    cover: n.cover,
  };
}

export function createMockApp(options?: { enableCors?: boolean }) {
  const app = express();
  if (options?.enableCors) app.use(cors());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/api/profile", async (_req, res) => {
    const db = await loadDb();
    res.json(db.profile);
  });

  app.get("/api/categories", async (_req, res) => {
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

  app.get("/api/categories/:id", async (req, res) => {
    const db = await loadDb();
    const id = req.params.id;
    const category = db.categories.find((c) => c.id === id);
    if (!category) return res.status(404).json({ error: "category_not_found" });

    const notes = db.notes.filter((n) => n.categories.includes(id));
    res.json({ category, notes: notes.map(toNoteListItem) });
  });

  app.get("/api/notes", async (req, res) => {
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

  app.get("/api/notes/:id", async (req, res) => {
    const db = await loadDb();
    const id = req.params.id;
    const note = db.notes.find((n) => n.id === id);
    if (!note) return res.status(404).json({ error: "note_not_found" });
    res.json(note);
  });

  app.get("/api/projects", async (_req, res) => {
    const db = await loadDb();
    res.json(db.projects);
  });

  app.get("/api/projects/:id", async (req, res) => {
    const db = await loadDb();
    const p = db.projects.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "project_not_found" });
    res.json(p);
  });

  app.get("/api/roadmaps", async (_req, res) => {
    const db = await loadDb();
    const list = db.roadmaps.map((rm) => {
      const all = [...db.nodesIndex.values()].filter((x) => x.roadmapId === rm.id);
      const done = all.filter((x) => x.status === "solid" || x.status === "teach").length;
      return { id: rm.id, title: rm.title, description: rm.description, theme: rm.theme, progress: { done, total: all.length } };
    });
    res.json(list);
  });

  app.get("/api/roadmaps/:id", async (req, res) => {
    const db = await loadDb();
    const rm = db.roadmaps.find((r) => r.id === req.params.id);
    if (!rm) return res.status(404).json({ error: "roadmap_not_found" });
    res.json(rm);
  });

  app.get("/api/roadmaps/:roadmapId/nodes/:nodeId", async (req, res) => {
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
