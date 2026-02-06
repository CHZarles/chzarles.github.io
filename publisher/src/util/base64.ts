const b64abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64Encode(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += b64abc[(n >>> 18) & 63] + b64abc[(n >>> 12) & 63] + b64abc[(n >>> 6) & 63] + b64abc[n & 63];
  }

  if (i === bytes.length) return result;

  if (i + 1 === bytes.length) {
    const n = bytes[i] << 16;
    result += b64abc[(n >>> 18) & 63] + b64abc[(n >>> 12) & 63] + "==";
    return result;
  }

  const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
  result += b64abc[(n >>> 18) & 63] + b64abc[(n >>> 12) & 63] + b64abc[(n >>> 6) & 63] + "=";
  return result;
}

export function base64Decode(str: string): Uint8Array {
  const clean = str.replace(/[\r\n\s]/g, "");
  if (clean.length % 4 !== 0) throw new Error("Invalid base64 length");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const outLen = (clean.length / 4) * 3 - padding;
  const out = new Uint8Array(outLen);

  const rev = new Map<string, number>();
  for (let i = 0; i < b64abc.length; i++) rev.set(b64abc[i], i);

  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = rev.get(clean[i]);
    const c1 = rev.get(clean[i + 1]);
    const c2 = clean[i + 2] === "=" ? 0 : rev.get(clean[i + 2]);
    const c3 = clean[i + 3] === "=" ? 0 : rev.get(clean[i + 3]);
    if (c0 == null || c1 == null || c2 == null || c3 == null) throw new Error("Invalid base64 char");
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (o < outLen) out[o++] = (n >>> 16) & 255;
    if (o < outLen) out[o++] = (n >>> 8) & 255;
    if (o < outLen) out[o++] = n & 255;
  }
  return out;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlDecode(str: string): Uint8Array {
  const padLen = (4 - (str.length % 4)) % 4;
  const padded = (str + "=".repeat(padLen)).replace(/-/g, "+").replace(/_/g, "/");
  return base64Decode(padded);
}

