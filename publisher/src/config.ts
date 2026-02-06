import type { Bindings } from "./types";

export type Config = {
  baseUrl: string;
  githubClientId: string;
  githubClientSecret: string;
  tokenSecret: string;
  tokenTtlSeconds: number;
  adminLogins: Set<string>;
  contentRepo: string;
  contentBranch: string;
  contentRoot: string;
  allowedOrigins: string[];
};

function requireEnv(env: Bindings, key: keyof Bindings): string {
  const v = env[key];
  if (!v) throw new Error(`Missing env: ${String(key)}`);
  return String(v);
}

function csvSet(input: string): Set<string> {
  return new Set(
    input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase()),
  );
}

function csvList(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env: Bindings): Config {
  const baseUrl = requireEnv(env, "BASE_URL");
  const githubClientId = requireEnv(env, "GITHUB_CLIENT_ID");
  const githubClientSecret = requireEnv(env, "GITHUB_CLIENT_SECRET");
  const tokenSecret = requireEnv(env, "TOKEN_SECRET");
  const tokenTtlSecondsRaw = env.TOKEN_TTL_SECONDS ? Number(env.TOKEN_TTL_SECONDS) : 12 * 60 * 60;
  const tokenTtlSeconds = Number.isFinite(tokenTtlSecondsRaw) && tokenTtlSecondsRaw > 0 ? tokenTtlSecondsRaw : 12 * 60 * 60;

  const adminLogins = csvSet(requireEnv(env, "ADMIN_GITHUB_LOGINS"));

  const contentRepo = requireEnv(env, "CONTENT_REPO");
  const contentBranch = env.CONTENT_BRANCH ? String(env.CONTENT_BRANCH) : "main";
  const contentRoot = env.CONTENT_ROOT ? String(env.CONTENT_ROOT) : "";

  const allowedOrigins = env.ALLOWED_ORIGINS ? csvList(env.ALLOWED_ORIGINS) : [];

  return {
    baseUrl,
    githubClientId,
    githubClientSecret,
    tokenSecret,
    tokenTtlSeconds,
    adminLogins,
    contentRepo,
    contentBranch,
    contentRoot,
    allowedOrigins,
  };
}

