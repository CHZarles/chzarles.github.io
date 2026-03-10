import { Hono } from "hono";
import { requireAuth } from "../auth/guard";
import { adminCommitRoutes } from "./adminCommit";
import { adminConfigRoutes } from "./adminConfig";
import { adminNotesRoutes } from "./adminNotes";
import { adminUploadsRoutes } from "./adminUploads";

export const adminRoutes = new Hono();

adminRoutes.use("*", async (c, next) => {
  const cfg = c.get("config");
  return requireAuth({ tokenSecret: cfg.tokenSecret, adminLogins: cfg.adminLogins })(c, next);
});

adminRoutes.route("/commit", adminCommitRoutes);
adminRoutes.route("/", adminConfigRoutes);
adminRoutes.route("/notes", adminNotesRoutes);
adminRoutes.route("/uploads", adminUploadsRoutes);
