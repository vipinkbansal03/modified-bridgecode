import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY ?? "modortho-settings-enc-key-32-byt";
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext; // not encrypted — return as-is
  const [ivHex, tagHex, encHex] = parts;
  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(value);
}
