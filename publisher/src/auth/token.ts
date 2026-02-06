import type { AuthUser } from "../types";
import { HttpError } from "../http/errors";
import { openSealedJson, sealJson } from "../util/crypto";

export async function issuePublisherToken(args: {
  secret: string;
  ttlSeconds: number;
  user: { id: number; login: string; avatarUrl?: string; ghToken: string };
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.max(60, Math.floor(args.ttlSeconds));
  return sealJson(args.secret, {
    sub: args.user.id,
    login: args.user.login,
    avatarUrl: args.user.avatarUrl,
    gh: args.user.ghToken,
    iat: now,
    exp,
  });
}

export async function verifyPublisherToken(secret: string, token: string): Promise<AuthUser> {
  let payload: unknown;
  try {
    payload = await openSealedJson(secret, token);
  } catch {
    throw new HttpError(401, "UNAUTHENTICATED", "Invalid token.");
  }

  if (!payload || typeof payload !== "object") throw new HttpError(401, "UNAUTHENTICATED", "Invalid token payload.");

  const sub = (payload as any).sub;
  const login = (payload as any).login;
  const avatarUrl = (payload as any).avatarUrl;
  const gh = (payload as any).gh;
  const iat = (payload as any).iat;
  const exp = (payload as any).exp;

  if (typeof sub !== "number" || !Number.isFinite(sub)) throw new HttpError(401, "UNAUTHENTICATED", "Invalid token.");
  if (typeof login !== "string" || !login.trim()) throw new HttpError(401, "UNAUTHENTICATED", "Invalid token.");
  if (typeof gh !== "string" || !gh.trim()) throw new HttpError(401, "UNAUTHENTICATED", "Invalid token.");
  if (typeof iat !== "number" || typeof exp !== "number") throw new HttpError(401, "UNAUTHENTICATED", "Invalid token.");

  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) throw new HttpError(401, "UNAUTHENTICATED", "Token expired.");

  return {
    id: sub,
    login,
    avatarUrl: typeof avatarUrl === "string" ? avatarUrl : undefined,
    ghToken: gh,
    iat,
    exp,
  };
}

