export type Profile = {
  name: string;
  handle: string;
  tagline: string;
  accent?: string; // "270 95% 65%"
  avatarUrl?: string;
  links?: Array<{ label: string; href: string }>;
  now?: string[];
  hero?: {
    imageUrl?: string;
    blurPx?: number;
    opacity?: number;
    position?: string; // CSS object-position
  };
};

export type Category = {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "cyan" | "violet" | "lime" | "amber" | "rose";
  noteCount?: number;
};

export type RoadmapNode = {
  id: string;
  title: string;
  description?: string;
  status?: "idea" | "learning" | "using" | "solid" | "teach";
  icon?: string;
  edges?: string[];
  pinned?: string[];
  projects?: string[];
  children?: RoadmapNode[];
};

export type Roadmap = {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  layout?: "vertical" | "horizontal";
  nodes: RoadmapNode[];
};

export type RoadmapListItem = {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  progress?: { done: number; total: number };
};

export type NoteNodeRef = {
  ref: string; // "ai-infra/otel"
  roadmapId: string;
  nodeId: string;
  title: string;
  roadmapTitle: string;
  crumbs: Array<{ id: string; title: string }>;
};

export type NoteListItem = {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  updated: string;
  categories: string[];
  tags: string[];
  nodes: NoteNodeRef[];
  cover?: string;
};

export type Note = NoteListItem & {
  content: string;
};

export type RoadmapNodeEntry = {
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

export type RoadmapNodeDetail = {
  node: RoadmapNodeEntry;
  notes: NoteListItem[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  homepage?: string;
  stack?: string[];
  highlights?: string[];
  nodes?: string[];
};

export type SearchHit = {
  type: "note" | "category" | "roadmap" | "node" | "project";
  title: string;
  subtitle?: string;
  href: string;
};
