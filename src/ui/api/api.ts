import type {
  Category,
  Note,
  NoteListItem,
  Profile,
  Project,
  Roadmap,
  RoadmapListItem,
  RoadmapNodeDetail,
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

export const api = {
  profile: () => apiFetch<Profile>("/api/profile"),
  categories: () => apiFetch<Category[]>("/api/categories"),
  category: (id: string) => apiFetch<{ category: Category; notes: NoteListItem[] }>(`/api/categories/${id}`),
  notes: (params?: { q?: string; category?: string; roadmap?: string; node?: string }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.category) sp.set("category", params.category);
    if (params?.roadmap) sp.set("roadmap", params.roadmap);
    if (params?.node) sp.set("node", params.node);
    const qs = sp.toString();
    return apiFetch<NoteListItem[]>(`/api/notes${qs ? `?${qs}` : ""}`);
  },
  note: (id: string) => apiFetch<Note>(`/api/notes/${id}`),
  projects: () => apiFetch<Project[]>("/api/projects"),
  project: (id: string) => apiFetch<Project>(`/api/projects/${id}`),
  roadmaps: () => apiFetch<RoadmapListItem[]>("/api/roadmaps"),
  roadmap: (id: string) => apiFetch<Roadmap>(`/api/roadmaps/${id}`),
  node: (roadmapId: string, nodeId: string) =>
    apiFetch<RoadmapNodeDetail>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}`),
  search: (q: string) => apiFetch<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
};

