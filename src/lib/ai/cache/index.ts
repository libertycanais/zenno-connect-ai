// FEATURE P0.6 — Onda 1 · AI Context Cache (helpers)
// Stable cache-key builder + TTL helpers. DB access via orchestrator.

import { createHash } from "node:crypto";

export function buildCacheKey(parts: Array<string | number | null | undefined>): string {
  const canonical = parts.map((p) => (p == null ? "_" : String(p))).join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 40);
}

export function computeExpiresAt(ttlSeconds: number, now: Date = new Date()): Date {
  const clamped = Math.min(Math.max(ttlSeconds, 1), 86400);
  return new Date(now.getTime() + clamped * 1000);
}

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const t = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isNaN(t) || t < now.getTime();
}
