import { HttpError } from "../http/errors";

export type MindmapInput = {
  id: string;
  title?: string;
  format?: string;
  nodes?: unknown[];
  edges?: unknown[];
  viewport?: unknown;
  updated?: string; // ISO
};

export function validateMindmapId(id: string): string {
  const v = String(id ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,80}$/.test(v)) throw new HttpError(422, "VALIDATION_FAILED", "Invalid mindmap id.", { id });
  return v;
}

export function renderMindmapJson(input: MindmapInput): string {
  const id = validateMindmapId(input.id);
  const updated = input.updated ? String(input.updated) : new Date().toISOString();
  return JSON.stringify(
    {
      id,
      title: input.title ?? id,
      updated,
      format: input.format ?? "reactflow",
      nodes: Array.isArray(input.nodes) ? input.nodes : [],
      edges: Array.isArray(input.edges) ? input.edges : [],
      viewport: input.viewport ?? { x: 0, y: 0, zoom: 1 },
    },
    null,
    2,
  );
}

