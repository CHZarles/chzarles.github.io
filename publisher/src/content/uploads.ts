import { HttpError } from "../http/errors";
import { sha256Hex } from "../util/crypto";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function inferExtension(args: { filename?: string; contentType?: string }): string {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
  };
  const ct = (args.contentType ?? "").toLowerCase();
  if (byType[ct]) return byType[ct];

  const name = (args.filename ?? "").toLowerCase();
  const m = name.match(/\.([a-z0-9]{2,8})$/);
  if (m) return m[1];
  return "bin";
}

export async function buildUploadPath(bytes: Uint8Array, ext: string): Promise<{ path: string; url: string }> {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const h = await sha256Hex(bytes);
  const safeExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const rel = `public/uploads/${y}/${m}/${h}.${safeExt}`;
  return { path: rel, url: `/uploads/${y}/${m}/${h}.${safeExt}` };
}

export function enforceUploadLimit(bytes: number, maxBytes = 8 * 1024 * 1024) {
  if (bytes > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "File too large.", { bytes, maxBytes });
}

