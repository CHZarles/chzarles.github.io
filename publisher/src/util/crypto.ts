import { base64UrlDecode, base64UrlEncode } from "./base64";

const te = new TextEncoder();
const td = new TextDecoder();

let cachedAesKey: CryptoKey | null = null;
let cachedSecretFingerprint: string | null = null;

async function importAesKey(secret: string): Promise<CryptoKey> {
  if (cachedAesKey && cachedSecretFingerprint === secret) return cachedAesKey;
  const keyBytes = await crypto.subtle.digest("SHA-256", te.encode(secret));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  cachedAesKey = key;
  cachedSecretFingerprint = secret;
  return key;
}

function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

export async function sealJson(secret: string, payload: unknown): Promise<string> {
  const key = await importAesKey(secret);
  const iv = randomBytes(12);
  const plaintext = te.encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return `v0.${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}`;
}

export async function openSealedJson<T>(secret: string, token: string): Promise<T> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v0") throw new Error("Invalid sealed token format");
  const iv = base64UrlDecode(parts[1]);
  const ciphertext = base64UrlDecode(parts[2]);
  const key = await importAesKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const json = td.decode(new Uint8Array(plaintext));
  return JSON.parse(json) as T;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

