import { ghJson } from "./client";

export type GhUser = {
  id: number;
  login: string;
  avatar_url?: string;
};

export async function getViewer(token: string): Promise<GhUser> {
  return ghJson<GhUser>({ token, method: "GET", path: "/user" });
}

export async function getRepo(token: string, repo: string): Promise<{ full_name: string; permissions?: { push?: boolean } }> {
  return ghJson<{ full_name: string; permissions?: { push?: boolean } }>({
    token,
    method: "GET",
    path: `/repos/${repo}`,
  });
}

