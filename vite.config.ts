import react from "@vitejs/plugin-react";
import { defineConfig, splitVendorChunkPlugin } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
import { createMockApp } from "./mock/app";

function escapeJsonForHtmlScript(raw: string): string {
  return raw.replace(/</g, "\\u003c");
}

export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    {
      name: "hyperblog-dev-embed-profile",
      apply: "serve",
      transformIndexHtml: async (html) => {
        if (html.includes('id="hb-profile"')) return html;
        if (!html.includes("</head>")) return html;
        try {
          const profilePath = path.join(process.cwd(), "content", "profile.json");
          const raw = await fs.readFile(profilePath, "utf8");
          const json = escapeJsonForHtmlScript(JSON.stringify(JSON.parse(raw)));
          return html.replace("</head>", `\n    <script id="hb-profile" type="application/json">${json}</script>\n  </head>`);
        } catch {
          return html;
        }
      },
    },
    {
      name: "hyperblog-mock-api",
      configureServer(server) {
        const mock = createMockApp({ enableCors: false });
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? "";
          if (url.startsWith("/api") || url.startsWith("/health"))
            return (mock as unknown as (req: any, res: any, next: any) => void)(req, res, next);
          return next();
        });
      },
    },
  ],
});
