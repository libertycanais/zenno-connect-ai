// FEATURE P0.6 — Onda 1 · SERVER ONLY
// AES-256-GCM encryption for provider API keys.
// The master key is stored in the AI_ENCRYPTION_KEY env var (64 hex chars).
// Ciphertext + nonce are stored in `ai_provider_credentials`.
// Plaintext keys NEVER leave this module.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getMasterKey(): Buffer {
  const raw = process.env.AI_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("AI_ENCRYPTION_KEY not configured or too short");
  }
  // Support both hex (64 chars) and utf8 (>=32 chars) — always derive 32 bytes.
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64) {
    return Buffer.from(raw.slice(0, 64), "hex");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export type EncryptedKey = {
  ciphertext: Buffer;
  nonce: Buffer;
  fingerprint: string;
  last4: string;
};

export function encryptApiKey(plaintext: string): EncryptedKey {
  if (typeof plaintext !== "string" || plaintext.length < 8) {
    throw new Error("API key must be a non-empty string of at least 8 chars");
  }
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store ciphertext + tag concatenated.
  const ciphertext = Buffer.concat([enc, tag]);
  const fingerprint = createHash("sha256").update(plaintext, "utf8").digest("hex").slice(0, 32);
  const last4 = plaintext.slice(-4);
  return { ciphertext, nonce: iv, fingerprint, last4 };
}

export function decryptApiKey(ciphertext: Buffer, nonce: Buffer): string {
  if (ciphertext.length <= TAG_LEN) {
    throw new Error("Invalid ciphertext");
  }
  const key = getMasterKey();
  const enc = ciphertext.subarray(0, ciphertext.length - TAG_LEN);
  const tag = ciphertext.subarray(ciphertext.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function fingerprintOnly(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex").slice(0, 32);
}
