import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vercel serverless has a read-only project filesystem; use /tmp (ephemeral) for DB + uploads.
 * Local and long-running hosts keep using the repo `data/` directory.
 */
export function isVercelServerless(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

export function getDataDir(): string {
  const base = isVercelServerless() ? path.join(tmpdir(), "al-idara-pro-data") : path.join(__dirname, "..", "data");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

export function getUploadDir(): string {
  const p = path.join(getDataDir(), "uploads");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function getTlUploadRoot(): string {
  const p = path.join(getUploadDir(), "tl");
  fs.mkdirSync(p, { recursive: true });
  return p;
}
