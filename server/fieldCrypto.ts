/**
 * Optional AES-256-GCM for sensitive fields at rest.
 * Set FIELD_ENCRYPTION_KEY to a 64-char hex string (32 bytes) in production.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_HEX = process.env.FIELD_ENCRYPTION_KEY?.trim();

function getKey(): Buffer | null {
  if (!KEY_HEX || KEY_HEX.length < 64) return null;
  try {
    return Buffer.from(KEY_HEX.slice(0, 64), "hex");
  } catch {
    return null;
  }
}

export function encryptField(plain: string): string {
  const key = getKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `encv1|${iv.toString("hex")}|${tag.toString("hex")}|${enc.toString("base64")}`;
}

export function decryptField(stored: string): string {
  if (!stored.startsWith("encv1|")) return stored;
  const key = getKey();
  if (!key) return stored;
  const parts = stored.split("|");
  if (parts.length !== 4) return stored;
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const data = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

