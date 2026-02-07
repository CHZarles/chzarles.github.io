import type {
  Category,
  Note,
  NoteListItem,
  Profile,
  Project,
  Roadmap,
  RoadmapListItem,
  RoadmapNodeDetail,
  RoadmapNodeEntry,
  SearchHit,
} from "../types";

async function apiFetch<T>(input: string): Promise<T> {
  const res = await fetch(input, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

const fetchMemo = new Map<string, Promise<unknown>>();
function apiFetchCached<T>(input: string): Promise<T> {
  const hit = fetchMemo.get(input);
  if (hit) return hit as Promise<T>;
  const p = apiFetch<T>(input);
  fetchMemo.set(input, p as Promise<unknown>);
  return p;
}

let notesIndexPromise: Promise<NoteListItem[]> | null = null;
function getNotesIndex(): Promise<NoteListItem[]> {
  if (!notesIndexPromise) notesIndexPromise = apiFetchCached<NoteListItem[]>("/api/notes.json");
  return notesIndexPromise;
}

let nodesIndexPromise: Promise<RoadmapNodeEntry[]> | null = null;
function getNodesIndex(): Promise<RoadmapNodeEntry[]> {
  if (!nodesIndexPromise) nodesIndexPromise = apiFetchCached<RoadmapNodeEntry[]>("/api/nodes.json");
  return nodesIndexPromise;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function filterNotes(all: NoteListItem[], params?: { q?: string; category?: string; roadmap?: string; node?: string }) {
  const q = params?.q ? normalize(params.q) : "";
  const category = params?.category ?? "";
  const roadmap = params?.roadmap ?? "";
  const node = params?.node ?? "";

  return all.filter((n) => {
    if (category && !n.categories.includes(category)) return false;
    if (roadmap && !n.nodes.some((r) => r.roadmapId === roadmap)) return false;
    if (node && !n.nodes.some((r) => r.nodeId === node)) return false;
    if (q) {
      const hay = `${n.title} ${n.excerpt} ${n.tags.join(" ")} ${n.categories.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const api = {
  profile: () => apiFetchCached<Profile>("/api/profile.json"),
  categories: () => apiFetchCached<Category[]>("/api/categories.json"),
  category: async (id: string) => {
    const [categories, notes] = await Promise.all([apiFetchCached<Category[]>("/api/categories.json"), getNotesIndex()]);
    const category = categories.find((c) => c.id === id);
    if (!category) throw new Error("category_not_found");
    return { category, notes: notes.filter((n) => n.categories.includes(id)) };
  },
  notes: async (params?: { q?: string; category?: string; roadmap?: string; node?: string }) => {
    const all = await getNotesIndex();
    return filterNotes(all, params);
  },
  note: (id: string) => apiFetchCached<Note>(`/api/notes/${id}.json`),
  projects: () => apiFetchCached<Project[]>("/api/projects.json"),
  project: async (id: string) => {
    const list = await apiFetchCached<Project[]>("/api/projects.json");
    const p = list.find((x) => x.id === id);
    if (!p) throw new Error("project_not_found");
    return p;
  },
  roadmaps: () => apiFetchCached<RoadmapListItem[]>("/api/roadmaps.json"),
  roadmap: (id: string) => apiFetchCached<Roadmap>(`/api/roadmaps/${id}.json`),
  node: async (roadmapId: string, nodeId: string) => {
    const [nodes, notes] = await Promise.all([getNodesIndex(), getNotesIndex()]);
    const node = nodes.find((n) => n.roadmapId === roadmapId && n.nodeId === nodeId);
    if (!node) throw new Error("node_not_found");
    const inNode = notes.filter((n) => n.nodes.some((r) => r.roadmapId === roadmapId && r.nodeId === nodeId));
    return { node, notes: inNode } satisfies RoadmapNodeDetail;
  },
  search: async (q: string) => {
    const query = normalize(q);
    const [notes, categories, roadmaps, nodes, projects] = await Promise.all([
      getNotesIndex(),
      apiFetchCached<Category[]>("/api/categories.json"),
      apiFetchCached<RoadmapListItem[]>("/api/roadmaps.json"),
      getNodesIndex(),
      apiFetchCached<Project[]>("/api/projects.json"),
    ]);

    if (!query) {
      return notes.slice(0, 8).map((n) => ({
        type: "note",
        title: n.title,
        subtitle: "最近更新",
        href: `/notes/${n.id}`,
      })) satisfies SearchHit[];
    }

    const hits: SearchHit[] = [];

    for (const n of notes) {
      if (hits.length >= 12) break;
      const hay = `${n.title} ${n.excerpt}`.toLowerCase();
      if (hay.includes(query)) hits.push({ type: "note", title: n.title, subtitle: "Note", href: `/notes/${n.id}` });
    }

    for (const c of categories) {
      if (hits.length >= 18) break;
      const hay = `${c.title} ${c.id}`.toLowerCase();
      if (hay.includes(query))
        hits.push({ type: "category", title: c.title, subtitle: "Category", href: `/categories/${c.id}` });
    }

    for (const rm of roadmaps) {
      if (hits.length >= 22) break;
      const hay = `${rm.title} ${rm.id}`.toLowerCase();
      if (hay.includes(query))
        hits.push({ type: "roadmap", title: rm.title, subtitle: "Roadmap", href: `/roadmaps/${rm.id}` });
    }

    for (const node of nodes) {
      if (hits.length >= 28) break;
      const hay = `${node.title} ${node.nodeId}`.toLowerCase();
      if (hay.includes(query))
        hits.push({
          type: "node",
          title: node.title,
          subtitle: `${node.roadmapTitle}`,
          href: `/roadmaps/${node.roadmapId}/node/${node.nodeId}`,
        });
    }

    for (const p of projects) {
      if (hits.length >= 34) break;
      const hay = `${p.name} ${p.description}`.toLowerCase();
      if (hay.includes(query))
        hits.push({ type: "project", title: p.name, subtitle: "Project", href: `/projects/${p.id}` });
    }

    return hits;
  },
};
