// RC1 backlog — tests for additive utilities
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordServerFnLatency,
  getServerFnStats,
  listServerFnStats,
  measureServerFn,
  __resetServerFnMetricsForTests,
} from "@/lib/observability/server-fn-metrics";
import {
  ServerFnError,
  toSafeServerFnError,
  scrubMessage,
} from "@/lib/errors/server-fn-error";
import {
  encryptWithVersion,
  decryptWithVersion,
  rotateCiphertext,
  currentKeyVersion,
} from "@/lib/ai/crypto-rotation.server";
import { ShareTokenRevocationStore } from "@/lib/workspace/share-tokens";

describe("RC1.5 — server-fn metrics", () => {
  beforeEach(() => __resetServerFnMetricsForTests());

  it("records and computes percentiles", () => {
    for (let i = 1; i <= 100; i++) recordServerFnLatency("fn.a", i);
    const s = getServerFnStats("fn.a");
    expect(s.count).toBe(100);
    expect(s.p50).toBeGreaterThan(0);
    expect(s.p95).toBeGreaterThanOrEqual(s.p50);
    expect(s.p99).toBeGreaterThanOrEqual(s.p95);
  });

  it("measureServerFn instruments an async fn", async () => {
    const result = await measureServerFn("fn.b", async () => 42);
    expect(result).toBe(42);
    expect(listServerFnStats().some((x) => x.name === "fn.b")).toBe(true);
  });

  it("ignores invalid samples", () => {
    recordServerFnLatency("fn.c", -1);
    recordServerFnLatency("fn.c", Number.NaN);
    expect(getServerFnStats("fn.c").count).toBe(0);
  });
});

describe("RC1.14 — ServerFnError normalization", () => {
  it("maps known error codes to safe shape", () => {
    const e = new ServerFnError("VALIDATION_FAILED", "campo x é obrigatório");
    const safe = toSafeServerFnError(e, "req-1");
    expect(safe.ok).toBe(false);
    expect(safe.code).toBe("VALIDATION_FAILED");
    expect(safe.requestId).toBe("req-1");
    expect(e.httpStatus).toBe(422);
  });

  it("scrubs secrets from message", () => {
    const scrubbed = scrubMessage("token sk-abcdef1234567890ABCD failed");
    expect(scrubbed).toContain("[REDACTED]");
    expect(scrubbed).not.toContain("sk-abcdef");
  });

  it("wraps unknown errors as INTERNAL", () => {
    const safe = toSafeServerFnError(new Error("boom"));
    expect(safe.code).toBe("INTERNAL");
  });
});

describe("RC1.2 — versioned crypto rotation", () => {
  it("current version defaults to 1", () => {
    process.env.AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY ?? "a".repeat(64);
    delete process.env.AI_ENCRYPTION_KEY_V2;
    expect(currentKeyVersion()).toBe(1);
  });

  it("round-trips v1", () => {
    process.env.AI_ENCRYPTION_KEY = "a".repeat(64);
    const enc = encryptWithVersion("hello world", 1);
    expect(enc.keyVersion).toBe(1);
    const plain = decryptWithVersion(enc.ciphertext, enc.nonce, 1);
    expect(plain).toBe("hello world");
  });

  it("rotates from v1 to v2 when v2 present", () => {
    process.env.AI_ENCRYPTION_KEY = "a".repeat(64);
    process.env.AI_ENCRYPTION_KEY_V2 = "b".repeat(64);
    const enc1 = encryptWithVersion("secret-key-abc", 1);
    const enc2 = rotateCiphertext(enc1);
    expect(enc2.keyVersion).toBe(2);
    const plain = decryptWithVersion(enc2.ciphertext, enc2.nonce, enc2.keyVersion);
    expect(plain).toBe("secret-key-abc");
    delete process.env.AI_ENCRYPTION_KEY_V2;
  });
});

describe("RC1.1 — share token revocation async checker", () => {
  it("in-memory revoke works", () => {
    const s = new ShareTokenRevocationStore();
    s.revoke("nonce-1");
    expect(s.isRevoked("nonce-1")).toBe(true);
    expect(s.isRevoked("nonce-2")).toBe(false);
  });

  it("async checker plugs persistent store", async () => {
    const s = new ShareTokenRevocationStore();
    const persisted = new Set(["nonce-x"]);
    s.attachAsyncChecker(async (n) => persisted.has(n));
    expect(await s.isRevokedAsync("nonce-x")).toBe(true);
    expect(await s.isRevokedAsync("nonce-y")).toBe(false);
  });

  it("async checker errors are swallowed (fail-safe)", async () => {
    const s = new ShareTokenRevocationStore();
    s.attachAsyncChecker(async () => { throw new Error("db down"); });
    expect(await s.isRevokedAsync("nonce-z")).toBe(false);
  });
});
