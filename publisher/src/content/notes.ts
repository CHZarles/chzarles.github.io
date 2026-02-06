import YAML from "yaml";
import { HttpError } from "../http/errors";

export type NoteInput = {
  title: string;
  content: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
  nodes?: string[];
  mindmaps?: string[];
  cover?: string;
  draft?: boolean;
  slug?: string;
  date?: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s;
}

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}

export function normalizeNoteId(input: NoteInput): { noteId: string; date: string; slug: string } {
  const date = input.date?.trim() || todayUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid date.", { date });

  const slugBase = input.slug?.trim() || slugify(input.title);
  const slug = slugBase || `note-${shortHash(`${input.title}:${Date.now()}`)}`;
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid slug.", { slug });

  return { noteId: `${date}-${slug}`, date, slug };
}

export function renderNoteMarkdown(args: { noteId: string; input: NoteInput }): string {
  const { input } = args;
  const title = (input.title ?? "").trim();
  const body = (input.content ?? "").trim();
  if (!title) throw new HttpError(422, "VALIDATION_FAILED", "Missing title.");
  if (!body) throw new HttpError(422, "VALIDATION_FAILED", "Missing content.");

  const date = input.date?.trim() || todayUtc();
  const updated = input.updated?.trim() || date;

  const frontmatter: Record<string, unknown> = {
    title,
    date,
  };

  if (updated && updated !== date) frontmatter.updated = updated;
  if (input.excerpt) frontmatter.excerpt = String(input.excerpt);
  if (Array.isArray(input.categories) && input.categories.length) frontmatter.categories = input.categories;
  if (Array.isArray(input.tags) && input.tags.length) frontmatter.tags = input.tags;
  if (Array.isArray(input.nodes) && input.nodes.length) frontmatter.nodes = input.nodes;
  if (Array.isArray(input.mindmaps) && input.mindmaps.length) frontmatter.mindmaps = input.mindmaps;
  if (input.cover) frontmatter.cover = String(input.cover);
  if (typeof input.draft === "boolean") frontmatter.draft = input.draft;

  const yaml = YAML.stringify(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n\n${body}\n`;
}

export function parseFrontmatter(md: string): { frontmatter: Record<string, unknown>; body: string } {
  const raw = md ?? "";
  if (!raw.startsWith("---\n")) return { frontmatter: {}, body: raw };
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: raw };
  const yaml = raw.slice(4, end + 1);
  const body = raw.slice(end + 5).replace(/^\s*\n/, "");
  const fm = (YAML.parse(yaml) ?? {}) as Record<string, unknown>;
  return { frontmatter: fm && typeof fm === "object" ? fm : {}, body };
}

