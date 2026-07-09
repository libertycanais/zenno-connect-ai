// P0.6 · Onda 1 — API key encryption round-trip
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  // Deterministic 64-hex master key for tests.
  process.env.AI_ENCRYPTION_KEY = "0".repeat(64);
});

describe("crypto.server", () => {
  it("round-trips a plaintext API key", async () => {
    const { encryptApiKey, decryptApiKey } = await import("@/lib/ai/crypto.server");
    const key = "sk-super-secret-key-abcdef1234567890";
    const enc = encryptApiKey(key);
    expect(enc.ciphertext.length).toBeGreaterThan(0);
    expect(enc.nonce.length).toBe(12);
    expect(enc.last4).toBe("7890");
    expect(enc.fingerprint).toHaveLength(32);
    expect(decryptApiKey(enc.ciphertext, enc.nonce)).toBe(key);
  });

  it("produces different ciphertext for same input (unique nonce)", async () => {
    const { encryptApiKey } = await import("@/lib/ai/crypto.server");
    const a = encryptApiKey("sk-same-value-1234");
    const b = encryptApiKey("sk-same-value-1234");
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.nonce.equals(b.nonce)).toBe(false);
    expect(a.fingerprint).toBe(b.fingerprint); // fingerprint is deterministic
  });

  it("rejects short keys", async () => {
    const { encryptApiKey } = await import("@/lib/ai/crypto.server");
    expect(() => encryptApiKey("short")).toThrow();
  });

  it("fails to decrypt with wrong nonce (AEAD)", async () => {
    const { encryptApiKey, decryptApiKey } = await import("@/lib/ai/crypto.server");
    const enc = encryptApiKey("sk-real-value-1234567890");
    const badNonce = Buffer.alloc(12, 0xff);
    expect(() => decryptApiKey(enc.ciphertext, badNonce)).toThrow();
  });
});
