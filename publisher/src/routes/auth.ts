import { Hono } from "hono";
import { HttpError } from "../http/errors";
import { requireAuth } from "../auth/guard";
import { issuePublisherToken } from "../auth/token";
import { issueOAuthState, verifyOAuthState } from "../auth/oauthState";
import { exchangeCodeForAccessToken, githubAuthorizeUrl } from "../github/oauth";
import { ghJson } from "../github/client";
import { getRepo, getViewer } from "../github/user";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/g, "");
}

function resolveRedirect(input: string | null, allowedOrigins: string[]): string {
  const allowed = allowedOrigins.map(normalizeOrigin);
  const val = (input ?? "").trim();

  const defaultRedirect = allowed[0] ? new URL("/auth/callback", allowed[0]).toString() : "/";
  if (!val) return defaultRedirect;

  // allow relative redirects only when we have an origin allowlist
  if (val.startsWith("/")) {
    if (!allowed[0]) throw new HttpError(422, "VALIDATION_FAILED", "Redirect must be absolute URL.");
    return new URL(val, allowed[0]).toString();
  }

  let url: URL;
  try {
    url = new URL(val);
  } catch {
    throw new HttpError(422, "VALIDATION_FAILED", "Invalid redirect URL.");
  }

  if (allowed.length > 0 && !allowed.includes(normalizeOrigin(url.origin))) {
    throw new HttpError(403, "FORBIDDEN", "Redirect origin not allowed.", { origin: url.origin });
  }
  return url.toString();
}

export const authRoutes = new Hono();

authRoutes.get("/github/start", async (c) => {
  const cfg = c.get("config");
  const redirect = resolveRedirect(c.req.query("redirect"), cfg.allowedOrigins);
  const state = await issueOAuthState(cfg.tokenSecret, redirect);
  const callback = new URL("/api/auth/github/callback", cfg.baseUrl).toString();
  const url = await githubAuthorizeUrl({
    clientId: cfg.githubClientId,
    redirectUri: callback,
    state,
    scope: "public_repo read:user",
  });
  return c.redirect(url, 302);
});

authRoutes.get("/github/callback", async (c) => {
  const cfg = c.get("config");
  const code = (c.req.query("code") ?? "").trim();
  const stateRaw = (c.req.query("state") ?? "").trim();
  if (!code || !stateRaw) throw new HttpError(400, "BAD_REQUEST", "Missing code/state.");

  const state = await verifyOAuthState(cfg.tokenSecret, stateRaw);
  const callback = new URL("/api/auth/github/callback", cfg.baseUrl).toString();
  const accessToken = await exchangeCodeForAccessToken({
    clientId: cfg.githubClientId,
    clientSecret: cfg.githubClientSecret,
    code,
    redirectUri: callback,
  });

  const viewer = await getViewer(accessToken);
  const login = viewer.login.toLowerCase();
  if (!cfg.adminLogins.has(login)) throw new HttpError(403, "FORBIDDEN", "Not allowed.");

  const repo = await getRepo(accessToken, cfg.contentRepo);
  if (repo.permissions && repo.permissions.push === false) {
    throw new HttpError(403, "FORBIDDEN", "No push permission to repo.");
  }

  const token = await issuePublisherToken({
    secret: cfg.tokenSecret,
    ttlSeconds: cfg.tokenTtlSeconds,
    user: { id: viewer.id, login: viewer.login, avatarUrl: viewer.avatar_url, ghToken: accessToken },
  });

  const redirectUrl = new URL(state.redirect);
  const hp = new URLSearchParams(redirectUrl.hash.startsWith("#") ? redirectUrl.hash.slice(1) : "");
  hp.set("token", token);
  redirectUrl.hash = hp.toString();
  return c.redirect(redirectUrl.toString(), 302);
});

authRoutes.get("/me", async (c) => {
  const cfg = c.get("config");
  await requireAuth({ tokenSecret: cfg.tokenSecret, adminLogins: cfg.adminLogins })(c, async () => {});
  const user = c.get("user");
  const ref = await ghJson<{ object: { sha: string } }>({
    token: user.ghToken,
    method: "GET",
    path: `/repos/${cfg.contentRepo}/git/ref/heads/${cfg.contentBranch}`,
  });
  return c.json({
    user: { id: user.id, login: user.login, avatarUrl: user.avatarUrl ?? null },
    repo: { fullName: cfg.contentRepo, branch: cfg.contentBranch, headSha: ref.object.sha },
  });
});

authRoutes.post("/logout", (c) => c.json({ ok: true }));
