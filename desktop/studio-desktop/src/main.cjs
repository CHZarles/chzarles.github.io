/* eslint-disable no-console */
const { app, BrowserWindow, shell } = require("electron");

function parseArg(name) {
  const idx = process.argv.findIndex((x) => x === `--${name}`);
  if (idx < 0) return null;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith("--")) return "";
  return v;
}

function normalizeUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function resolveStartUrl() {
  const fromArg = normalizeUrl(parseArg("url"));
  if (fromArg) return fromArg;

  const fromEnv = normalizeUrl(process.env.HYPERBLOG_STUDIO_URL);
  if (fromEnv) return fromEnv;

  return "https://chzarles.github.io/studio/notes";
}

function createWindow() {
  const startUrl = resolveStartUrl();
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    backgroundColor: "#0b0b0f",
    title: "Hyperblog Studio",
    webPreferences: {
      // Keep this minimal: Studio is a normal web app.
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      void shell.openExternal(url);
    } catch {}
    return { action: "deny" };
  });

  void win.loadURL(startUrl);

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
