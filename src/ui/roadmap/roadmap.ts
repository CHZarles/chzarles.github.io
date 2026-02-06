import type { Roadmap, RoadmapNode } from "../types";

export type FlatNode = {
  node: RoadmapNode;
  depth: number;
  parentId: string | null;
  crumbs: Array<{ id: string; title: string }>;
  order: number;
};

export function flattenRoadmap(roadmap: Roadmap): { list: FlatNode[]; byId: Map<string, FlatNode> } {
  const list: FlatNode[] = [];
  const byId = new Map<string, FlatNode>();
  let order = 0;

  function walk(nodes: RoadmapNode[], depth: number, parentId: string | null, crumbs: FlatNode["crumbs"]) {
    for (const n of nodes) {
      const entry: FlatNode = {
        node: n,
        depth,
        parentId,
        crumbs: [...crumbs, { id: n.id, title: n.title }],
        order: order++,
      };
      list.push(entry);
      byId.set(n.id, entry);
      if (n.children?.length) walk(n.children, depth + 1, n.id, entry.crumbs);
    }
  }

  walk(roadmap.nodes ?? [], 0, null, []);
  return { list, byId };
}

