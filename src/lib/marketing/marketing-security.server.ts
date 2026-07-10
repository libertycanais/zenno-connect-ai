// FEATURE — Marketing Platform · SERVER-ONLY helpers
// Token encryption + OAuth state HMAC. Never imported by client code.

import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { encryptApiKey, decryptApiKey } from "@/lib/ai/crypto.server";

/** Encrypt a token to base64 pieces safe for text columns. */
export function encryptToken(plaintext: string): { ciphertext: string; nonce: string } {
  const { ciphertext, nonce } = encryptApiKey(plaintext);
  return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64") };
}

export function decryptToken(ciphertext: string, nonce: string): string {
  return decryptApiKey(Buffer.from(ciphertext, "base64"), Buffer.from(nonce, "base64"));
}

function stateSecret(): string {
  return process.env.AI_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "zenno-marketing-state";
}

/** Sign an opaque state value; returns raw random token + HMAC. */
export function issueState(): { state: string; hash: string } {
  const state = randomBytes(24).toString("hex");
  const hash = createHmac("sha256", stateSecret()).update(state).digest("hex");
  return { state, hash };
}

/** Verify a state string against its stored HMAC (constant-time). */
export function verifyState(state: string, expectedHash: string): boolean {
  const h = createHmac("sha256", stateSecret()).update(state).digest();
  const e = Buffer.from(expectedHash, "hex");
  if (h.length !== e.length) return false;
  return timingSafeEqual(h, e);
}

export function hashState(state: string): string {
  return createHmac("sha256", stateSecret()).update(state).digest("hex");
}

/** Short fingerprint for log/audit (never plaintext token). */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}
