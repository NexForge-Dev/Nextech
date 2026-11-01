import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class MissingKeyError extends Error {
  constructor() {
    super("NETWORK_CREDENTIALS_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)");
    this.name = "MissingKeyError";
  }
}

export type EncryptedCredentials = { ciphertext: string; iv: string; tag: string; last4: string };

function key(): Buffer {
  const raw = process.env.NETWORK_CREDENTIALS_KEY;
  if (!raw) throw new MissingKeyError();
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new MissingKeyError();
  return buf;
}

export function encryptCredentials(plain: Record<string, string>): EncryptedCredentials {
  const k = key();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plain), "utf8"), cipher.final()]);
  const longest = Object.values(plain).sort((a, b) => b.length - a.length)[0] ?? "";
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    last4: longest.length >= 8 ? longest.slice(-4) : "",
  };
}

export function decryptCredentials(row: Pick<EncryptedCredentials, "ciphertext" | "iv" | "tag">): Record<string, string> {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}
