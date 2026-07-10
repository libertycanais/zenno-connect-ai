// RC1.2 — Rotação versionada de AI_ENCRYPTION_KEY.
// Suporta múltiplas chaves ativas (versionadas) para reencriptar credenciais existentes
// sem downtime. Additive — o path padrão (v1) continua idêntico ao existente.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

/** Read a versioned key from env: AI_ENCRYPTION_KEY (v1) and AI_ENCRYPTION_KEY_V2..V9. */
function envForVersion(v: number): string | undefined {
  if (v <= 1) return process.env.AI_ENCRYPTION_KEY;
  return process.env[`AI_ENCRYPTION_KEY_V${v}`];
}

function deriveKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64) {
    return Buffer.from(raw.slice(0, 64), "hex");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function getVersionedKey(version: number): Buffer {
  const raw = envForVersion(version);
  if (!raw || raw.length < 32) {
    throw new Error(`AI_ENCRYPTION_KEY v${version} not configured`);
  }
  return deriveKey(raw);
}

export function currentKeyVersion(): number {
  // Highest available V2..V9; default 1
  for (let v = 9; v >= 2; v--) {
    if (envForVersion(v)) return v;
  }
  return 1;
}

export type VersionedCiphertext = {
  ciphertext: Buffer;
  nonce: Buffer;
  keyVersion: number;
};

export function encryptWithVersion(plaintext: string, version?: number): VersionedCiphertext {
  const v = version ?? currentKeyVersion();
  const key = getVersionedKey(v);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([enc, tag]), nonce: iv, keyVersion: v };
}

export function decryptWithVersion(
  ciphertext: Buffer,
  nonce: Buffer,
  keyVersion: number,
): string {
  if (ciphertext.length <= TAG_LEN) throw new Error("Invalid ciphertext");
  const key = getVersionedKey(keyVersion);
  const enc = ciphertext.subarray(0, ciphertext.length - TAG_LEN);
  const tag = ciphertext.subarray(ciphertext.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Rotate a stored credential from old version to current version. */
export function rotateCiphertext(input: VersionedCiphertext): VersionedCiphertext {
  const target = currentKeyVersion();
  if (input.keyVersion === target) return input;
  const plaintext = decryptWithVersion(input.ciphertext, input.nonce, input.keyVersion);
  return encryptWithVersion(plaintext, target);
}
