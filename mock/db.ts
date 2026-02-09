import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";

export type Profile = {
  name: string;
  handle: string;
  tagline: string;
  accent?: string; // hsl string: "270 95% 65%"
  publisherBaseUrl?: string; // Publisher API base URL
  avatarUrl?: string;
  links?: Array<{ label: string; href: string }>;
  hero?: {
    imageUrl?: string;
    blurPx?: number;
    opacity?: number;
    position?: string;
    tintOpacity?: number;
    washOpacity?: number;
    saturate?: number;
    contrast?: number;
    textColor?: { light?: string; dark?: string };
    textScale?: number;
  };
};

export type Category = {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "cyan" | "violet" | "lime" | "amber" | "rose";
};

export type RoadmapNode = {
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

export type RoadmapFile = {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  layout?: "vertical" | "horizontal";
  nodes: RoadmapNode[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  homepage?: string;
  stack?: string[];
  highlights?: string[];
  nodes?: string[]; // roadmap refs: "ai-infra/otel"
};

export type Mindmap = {
  id: string;
  title: string;
  updated: string;
  format: string;
  nodes: unknown[];
  edges: unknown[];
  viewport?: unknown;
};

export type MindmapListItem = {
  id: string;
  title: string;
  updated: string;
  format?: string;
  nodeCount?: number;
  edgeCount?: number;
};

export type NoteFrontmatter = {
  title: string;
  date?: string;
  updated?: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
  nodes?: string[];
  mindmaps?: string[];
  cover?: string;
  draft?: boolean;
};

export type Note = {
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
  mindmaps: Array<{ id: string; title: string }>;
  cover?: string;
  draft?: boolean;
};

export type NodeIndexEntry = {
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

export type NoteListItem = {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  updated: string;
  categories: string[];
  tags: string[];
  nodes: Note["nodes"];
  mindmaps: Note["mindmaps"];
  draft?: boolean;
  cover?: string;
};

export type Db = {
  profile: Profile;
  categories: Category[];
  roadmaps: RoadmapFile[];
  nodesIndex: Map<string, NodeIndexEntry>; // key: "roadmapId/nodeId"
  notes: Note[];
  mindmaps: Mindmap[];
  projects: Project[];
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

function normalizeMindmapId(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,80}$/.test(v)) return null;
  return v;
}

export function toNoteListItem(n: Note): NoteListItem {
  return {
    id: n.id,
    title: n.title,
    excerpt: n.excerpt,
    date: n.date,
    updated: n.updated,
    categories: n.categories,
    tags: n.tags,
    nodes: n.nodes,
    mindmaps: n.mindmaps,
    draft: n.draft,
    cover: n.cover,
  };
}

export async function loadDb(): Promise<Db> {
  const root = process.cwd();
  const contentDir = path.join(root, "content");

  const profilePath = path.join(contentDir, "profile.json");
  const categoriesPath = path.join(contentDir, "categories.yml");
  const projectsPath = path.join(contentDir, "projects.json");
  const roadmapsDir = path.join(contentDir, "roadmaps");
  const notesDir = path.join(contentDir, "notes");
  const mindmapsDir = path.join(contentDir, "mindmaps");

  const profile: Profile = (await exists(profilePath))
    ? JSON.parse(await fs.readFile(profilePath, "utf8"))
    : {
        name: "Charles",
        handle: "@charles",
        tagline: "探索式技术空间（Demo）",
        accent: "270 95% 65%",
        links: [{ label: "GitHub", href: "https://github.com/" }],
        hero: { imageUrl: "/hero.svg", blurPx: 22, opacity: 0.28, position: "center", tintOpacity: 0, washOpacity: 0 },
      };

  const categories: Category[] = (await exists(categoriesPath))
    ? await readYamlFile<Category[]>(categoriesPath)
    : [
        { id: "engineering", title: "工程实践", tone: "cyan" },
        { id: "ai", title: "AI / LLM", tone: "violet" },
        { id: "product", title: "产品", tone: "amber" },
      ];

  const projects: Project[] = (await exists(projectsPath)) ? JSON.parse(await fs.readFile(projectsPath, "utf8")) : [];

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

    const children = node.children?.map((c) => ({ nodeId: c.id, title: c.title, status: c.status })) ?? [];
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

  const mindmaps: Mindmap[] = [];
  const mindmapById = new Map<string, Mindmap>();
  if (await exists(mindmapsDir)) {
    const files = (await fs.readdir(mindmapsDir)).filter((f) => f.toLowerCase().endsWith(".json")).sort().reverse();
    for (const file of files) {
      const id = normalizeMindmapId(file.replace(/\.json$/i, ""));
      if (!id) continue;

      const full = path.join(mindmapsDir, file);
      const raw = await fs.readFile(full, "utf8");
      const stat = await fs.stat(full);

      let parsed: Record<string, unknown> = {};
      try {
        const v = JSON.parse(raw);
        parsed = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }

      const title =
        typeof parsed.title === "string" && parsed.title.trim()
          ? String(parsed.title)
          : id;
      const updated = typeof parsed.updated === "string" ? toIsoDate(parsed.updated) : toIsoDate(stat.mtime);
      const format =
        typeof parsed.format === "string" && parsed.format.trim()
          ? String(parsed.format)
          : "reactflow";
      const nodes = Array.isArray(parsed.nodes) ? (parsed.nodes as unknown[]) : [];
      const edges = Array.isArray(parsed.edges) ? (parsed.edges as unknown[]) : [];

      const mindmap: Mindmap = {
        id,
        title,
        updated,
        format,
        nodes,
        edges,
        viewport: parsed.viewport,
      };
      mindmaps.push(mindmap);
      mindmapById.set(id, mindmap);
    }
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
      const mindmapsRefs = Array.isArray(fm.mindmaps) ? fm.mindmaps : [];
      const draft = typeof fm.draft === "boolean" ? fm.draft : undefined;

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

      const mindmaps = mindmapsRefs
        .map((x) => normalizeMindmapId(x))
        .filter(Boolean)
        .map((mid) => {
          const mm = mindmapById.get(mid);
          return { id: mid, title: mm?.title ?? mid };
        });

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
        mindmaps,
        cover: fm.cover ? String(fm.cover) : undefined,
        draft,
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

  return { profile, categories, roadmaps, nodesIndex, notes, mindmaps, projects };
}
