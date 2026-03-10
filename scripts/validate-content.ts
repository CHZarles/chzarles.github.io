import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";

type Issue = { severity: "error" | "warn"; file?: string; message: string };

const ID_RE = /^[a-z0-9-]{2,80}$/;
const NOTE_ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{3,80}$/;

function ok<T>(v: T): v is NonNullable<T> {
  return Boolean(v);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function isValidYmd(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function coerceYmd(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString().slice(0, 10);
  return "";
}

function error(issues: Issue[], file: string, message: string) {
  issues.push({ severity: "error", file, message });
}

function warn(issues: Issue[], file: string, message: string) {
  issues.push({ severity: "warn", file, message });
}

function formatIssue(i: Issue): string {
  const loc = i.file ? `${i.file}: ` : "";
  return `${i.severity.toUpperCase()}: ${loc}${i.message}`;
}

function normalizeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(lower);
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

async function main() {
  const root = process.cwd();
  const issues: Issue[] = [];

  const contentDir = path.join(root, "content");
  const notesDir = path.join(contentDir, "notes");
  const uploadsDir = path.join(root, "public", "uploads");

  const profilePath = path.join(contentDir, "profile.json");
  if (!(await exists(profilePath))) {
    warn(issues, "content/profile.json", "Missing file (will fall back to defaults).");
  } else {
    try {
      const raw = await fs.readFile(profilePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed)) error(issues, "content/profile.json", "Profile must be a JSON object.");
      else {
        for (const key of ["name", "handle", "tagline"] as const) {
          if (typeof parsed[key] !== "string" || !String(parsed[key]).trim()) {
            error(issues, "content/profile.json", `Missing ${key}.`);
          }
        }
      }
    } catch (e) {
      error(issues, "content/profile.json", `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const categoriesPath = path.join(contentDir, "categories.yml");
  const categoryIds = new Set<string>();
  if (!(await exists(categoriesPath))) {
    warn(issues, "content/categories.yml", "Missing file (will fall back to defaults).");
  } else {
    try {
      const raw = await fs.readFile(categoriesPath, "utf8");
      const parsed = YAML.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        error(issues, "content/categories.yml", "Categories must be a YAML array.");
      } else {
        for (const [idx, item] of parsed.entries()) {
          if (!isRecord(item)) {
            error(issues, "content/categories.yml", `Category at index ${idx} must be an object.`);
            continue;
          }
          const id = typeof item.id === "string" ? item.id.trim() : "";
          const title = typeof item.title === "string" ? item.title.trim() : "";
          if (!id) error(issues, "content/categories.yml", `Category missing id (index ${idx}).`);
          else if (!ID_RE.test(id)) error(issues, "content/categories.yml", `Invalid category id: ${id}.`);
          else if (categoryIds.has(id)) error(issues, "content/categories.yml", `Duplicate category id: ${id}.`);
          else categoryIds.add(id);
          if (!title) error(issues, "content/categories.yml", `Category ${id || idx} missing title.`);
        }
      }
    } catch (e) {
      error(issues, "content/categories.yml", `Invalid YAML: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const projectsPath = path.join(contentDir, "projects.json");
  const projectIds = new Set<string>();
  if (await exists(projectsPath)) {
    try {
      const raw = await fs.readFile(projectsPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        error(issues, "content/projects.json", "Projects must be a JSON array.");
      } else {
        for (const [idx, item] of parsed.entries()) {
          if (!isRecord(item)) {
            error(issues, "content/projects.json", `Project at index ${idx} must be an object.`);
            continue;
          }
          const id = typeof item.id === "string" ? item.id.trim() : "";
          const name = typeof item.name === "string" ? item.name.trim() : "";
          if (!id) error(issues, "content/projects.json", `Project missing id (index ${idx}).`);
          else if (!ID_RE.test(id)) error(issues, "content/projects.json", `Invalid project id: ${id}.`);
          else if (projectIds.has(id)) error(issues, "content/projects.json", `Duplicate project id: ${id}.`);
          else projectIds.add(id);
          if (!name) error(issues, "content/projects.json", `Project ${id || idx} missing name.`);
          if (typeof item.repoUrl !== "string" || !String(item.repoUrl).trim()) {
            warn(issues, "content/projects.json", `Project ${id || idx} missing repoUrl.`);
          }
        }
      }
    } catch (e) {
      error(issues, "content/projects.json", `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const noteIds = new Set<string>();
  if (await exists(notesDir)) {
    const files = (await fs.readdir(notesDir)).filter((f) => f.endsWith(".md")).sort();
    for (const file of files) {
      const rel = path.posix.join("content/notes", file);
      const id = file.replace(/\.md$/i, "");
      if (!NOTE_ID_RE.test(id)) {
        error(issues, rel, `Invalid note id / filename: ${id}.`);
        continue;
      }
      if (noteIds.has(id)) {
        error(issues, rel, `Duplicate note id: ${id}.`);
        continue;
      }
      noteIds.add(id);
    }

    for (const file of files) {
      const rel = path.posix.join("content/notes", file);
      const id = file.replace(/\.md$/i, "");
      if (!NOTE_ID_RE.test(id)) continue;

      let parsed: matter.GrayMatterFile<string>;
      try {
        const raw = await fs.readFile(path.join(notesDir, file), "utf8");
        parsed = matter(raw);
      } catch (e) {
        error(issues, rel, `Failed to parse markdown/frontmatter: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      const fm = parsed.data as Record<string, unknown>;
      const title = typeof fm.title === "string" ? fm.title.trim() : "";
      if (!title) error(issues, rel, "Missing frontmatter title.");

      const date = coerceYmd(fm.date);
      if (date && !isValidYmd(date)) error(issues, rel, `Invalid date: ${date}.`);
      if (!date) warn(issues, rel, "Missing date (will use file mtime).");

      const updated = coerceYmd(fm.updated);
      if (updated && !isValidYmd(updated)) error(issues, rel, `Invalid updated: ${updated}.`);

      if (fm.excerpt !== undefined && typeof fm.excerpt !== "string") error(issues, rel, "excerpt must be string.");
      if (fm.cover !== undefined && typeof fm.cover !== "string") error(issues, rel, "cover must be string.");
      if (fm.draft !== undefined && typeof fm.draft !== "boolean") error(issues, rel, "draft must be boolean.");

      const categories = normalizeList(fm.categories);
      for (const c of categories) {
        if (!categoryIds.size) continue;
        if (!categoryIds.has(c)) warn(issues, rel, `Unknown category: ${c}.`);
      }

      const body = parsed.content ?? "";
      const links = Array.from(body.matchAll(/\]\((\/[^)\s]+)\)/g)).map((m) => m[1]).filter(ok);
      for (const href of links) {
        if (href.startsWith("/notes/")) {
          const target = href.slice("/notes/".length).replace(/\/+$/, "");
          if (target && !noteIds.has(target)) warn(issues, rel, `Broken note link: ${href}.`);
        } else if (href.startsWith("/uploads/")) {
          const name = href.slice("/uploads/".length);
          const filePath = path.join(uploadsDir, name);
          if (await exists(uploadsDir) && !(await exists(filePath))) {
            warn(issues, rel, `Missing upload asset: ${href}.`);
          }
        }
      }
    }
  } else {
    warn(issues, "content/notes", "Missing notes directory.");
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");

  for (const i of issues) {
    console.log(formatIssue(i));
  }

  console.log(`\nContent validation: ${errors.length} error(s), ${warns.length} warning(s).`);

  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
