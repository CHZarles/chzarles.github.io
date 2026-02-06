import type { MiddlewareHandler } from "hono";
import type { AuthUser } from "../types";
import { HttpError } from "../http/errors";
import { verifyPublisherToken } from "./token";

export function requireAuth(opts: { tokenSecret: string; adminLogins: Set<string> }): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) throw new HttpError(401, "UNAUTHENTICATED", "Missing bearer token.");
    const token = m[1].trim();
    const user = await verifyPublisherToken(opts.tokenSecret, token);
    if (!opts.adminLogins.has(user.login.toLowerCase())) {
      throw new HttpError(403, "FORBIDDEN", "Not allowed.");
    }
    c.set("user", user satisfies AuthUser);
    await next();
  };
}

