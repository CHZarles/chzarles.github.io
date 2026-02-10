import react from "@vitejs/plugin-react";
import { defineConfig, splitVendorChunkPlugin } from "vite";
import { createMockApp } from "./mock/app";

export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(),
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
