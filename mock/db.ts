import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";

export type Profile = {
  name: string;
  handle: string;
  tagline: string;
  nav?: { title?: string };
  accent?: string;
  publisherBaseUrl?: string;
  avatarUrl?: string;
  links?: Array<{ label: string; href: string }>;
  hero?: {
    title?: string;
    tagline?: string;
    variant?: "image" | "mimo";
    imageUrl?: string;
    preload?: boolean;
    blurPx?: number;
    opacity?: number;
    position?: string;
    tintOpacity?: number;
    washOpacity?: number;
    saturate?: number;
    contrast?: number;
    textColor?: { light?: string; dark?: string };
    textScale?: number;
    patternText?: string;
    patternOpacity?: number;
    patternScale?: number;
    patternMotion?: "none" | "drift";
    spotlightSceneUrl?: string;
    spotlightScenePosition?: string;
    spotlightSceneOpacity?: number;
    spotlightSceneScale?: number;
    spotlightRadiusPx?: number;
    spotlightEase?: number;
    spotlightEaseRadius?: number;
  };
};

export type Category = {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "cyan" | "violet" | "lime" | "amber" | "rose";
};

export type Project = {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  homepage?: string;
  stack?: string[];
  highlights?: string[];
};

export type NoteFrontmatter = {
  title: string;
  date?: string;
  updated?: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
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
  cover?: string;
  draft?: boolean;
};

export type NoteListItem = Omit<Note, "content">;

export type Db = {
  profile: Profile;
  categories: Category[];
  notes: Note[];
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

export function toNoteListItem(n: Note): NoteListItem {
  return {
    id: n.id,
    title: n.title,
    excerpt: n.excerpt,
    date: n.date,
    updated: n.updated,
    categories: n.categories,
    tags: n.tags,
    cover: n.cover,
    draft: n.draft,
  };
}

export async function loadDb(): Promise<Db> {
  const root = process.cwd();
  const contentDir = path.join(root, "content");

  const profilePath = path.join(contentDir, "profile.json");
  const categoriesPath = path.join(contentDir, "categories.yml");
  const projectsPath = path.join(contentDir, "projects.json");
  const notesDir = path.join(contentDir, "notes");

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
      const draft = typeof fm.draft === "boolean" ? fm.draft : undefined;

      const body = parsed.content.trim();
      const excerptBase = fm.excerpt ? String(fm.excerpt) : stripMarkdown(body).slice(0, 220);
      const id = file.replace(/\.md$/, "");

      notes.push({
        id,
        title,
        excerpt: excerptBase,
        content: body,
        date,
        updated,
        categories: categoriesRefs,
        tags,
        cover: fm.cover ? String(fm.cover) : undefined,
        draft,
      });
    }
  }

  const knownCategoryIds = new Set(categories.map((c) => c.id));
  for (const note of notes) {
    for (const c of note.categories) {
      if (!knownCategoryIds.has(c)) {
        categories.push({ id: c, title: c.replace(/-/g, " ") });
        knownCategoryIds.add(c);
      }
    }
  }

  return { profile, categories, notes, projects };
}
