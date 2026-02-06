import { Hono } from "hono";
import type { Config } from "./config";
import { loadConfig } from "./config";
import { corsAllowlist } from "./http/cors";
import { HttpError, jsonError } from "./http/errors";
import { requestId } from "./http/requestId";
import type { AuthUser, Bindings } from "./types";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";

type Variables = {
  requestId: string;
  config: Config;
  user: AuthUser;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requestId());
app.use("*", async (c, next) => {
  const cfg = loadConfig(c.env);
  c.set("config", cfg);
  await next();
});
app.use("/api/*", async (c, next) => {
  const cfg = c.get("config");
  return corsAllowlist(cfg.allowedOrigins)(c, next);
});

app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api/admin", adminRoutes);

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found.", details: {} } }, 404));

app.onError((err, c) => {
  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
  if (err instanceof HttpError) return jsonError(c, err, requestId);
  // eslint-disable-next-line no-console
  console.error(err);
  return jsonError(c, new HttpError(500, "INTERNAL", "Internal error."), requestId);
});

export default app;

