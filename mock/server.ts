import { createMockApp } from "./app";

const app = createMockApp({ enableCors: true });

async function start() {
  let port = Number(process.env.PORT ?? "8792");
  for (let i = 0; i < 20; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = app.listen(port, () => resolve());
        server.on("error", reject);
      });
      // eslint-disable-next-line no-console
      console.log(`[mock] http://localhost:${port}`);
      return;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "EADDRINUSE") {
        port += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error("No available port found for mock server.");
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
