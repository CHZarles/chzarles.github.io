import type { MiddlewareHandler } from "hono";
import { HttpError } from "./errors";

function isAllowedOrigin(origin: string, allowed: string[]) {
  if (!origin) return false;
  return allowed.includes(origin);
}

export function corsAllowlist(allowedOrigins: string[]): MiddlewareHandler {
  const allowed = allowedOrigins;

  return async (c, next) => {
    const origin = c.req.header("Origin") ?? "";
    const hasOrigin = Boolean(origin);

    if (hasOrigin && allowed.length > 0 && !isAllowedOrigin(origin, allowed)) {
      throw new HttpError(403, "FORBIDDEN_ORIGIN", "Origin not allowed.", { origin });
    }

    if (hasOrigin && (allowed.length === 0 || isAllowedOrigin(origin, allowed))) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }

    c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Authorization,Content-Type");
    c.header("Access-Control-Max-Age", "600");

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  };
}
