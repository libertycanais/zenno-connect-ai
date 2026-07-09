// FEATURE P0.6 — Onda 2 · Per-module TTL cache (in-memory, org-scoped)
// Assembler reuses non-expired modules. Cross-tenant isolation is enforced by
// composing the organizationId into the key — never trust callers to pre-scope.

import type { ContextModuleName } from "./types";

type Entry<T> = { value: T; expiresAt: number };

export interface ContextCache {
  get<T>(orgId: string, module: ContextModuleName): T | undefined;
  set<T>(orgId: string, module: ContextModuleName, value: T, ttlSeconds: number): void;
  invalidate(orgId: string, module?: ContextModuleName): void;
  size(): number;
}

export function createInMemoryContextCache(now: () => number = Date.now): ContextCache {
  const store = new Map<string, Entry<unknown>>();
  const key = (orgId: string, module: ContextModuleName) => `${orgId}::${module}`;

  return {
    get<T>(orgId: string, module: ContextModuleName): T | undefined {
      const k = key(orgId, module);
      const hit = store.get(k);
      if (!hit) return undefined;
      if (hit.expiresAt <= now()) {
        store.delete(k);
        return undefined;
      }
      return hit.value as T;
    },
    set<T>(orgId: string, module: ContextModuleName, value: T, ttlSeconds: number) {
      const ttl = Math.max(1, Math.min(ttlSeconds, 86_400));
      store.set(key(orgId, module), { value: value as unknown, expiresAt: now() + ttl * 1000 });
    },
    invalidate(orgId, module) {
      if (module) {
        store.delete(key(orgId, module));
        return;
      }
      for (const k of Array.from(store.keys())) {
        if (k.startsWith(`${orgId}::`)) store.delete(k);
      }
    },
    size: () => store.size,
  };
}
