import { HttpError } from "../http/errors";
import { openSealedJson, sealJson } from "../util/crypto";

export type OAuthState = {
  redirect: string;
  iat: number;
  exp: number;
  nonce: string;
};

export async function issueOAuthState(secret: string, redirect: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 10 * 60; // 10 minutes
  const nonce = crypto.randomUUID();
  return sealJson(secret, { redirect, iat: now, exp, nonce } satisfies OAuthState);
}

export async function verifyOAuthState(secret: string, state: string): Promise<OAuthState> {
  let parsed: OAuthState;
  try {
    parsed = await openSealedJson<OAuthState>(secret, state);
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Invalid OAuth state.");
  }

  if (!parsed || typeof parsed.redirect !== "string" || typeof parsed.exp !== "number") {
    throw new HttpError(400, "BAD_REQUEST", "Invalid OAuth state.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (parsed.exp <= now) throw new HttpError(400, "BAD_REQUEST", "OAuth state expired.");
  return parsed;
}

