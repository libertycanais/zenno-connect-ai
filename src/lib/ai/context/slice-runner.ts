// FEATURE P0.6 — Onda 2 · Shared runner: cache → reader → meta wrapping.
// All slice modules use this so cache/meta behaviour is identical.

import type { ContextCache } from "./cache";
import { CONTEXT_TTL, type ContextMeta, type ContextModuleName, type WithMeta } from "./types";

export type SliceRunnerDeps = {
  cache: ContextCache;
  now?: () => Date;
};

export async function runSlice<T>(
  module: ContextModuleName,
  organizationId: string,
  loader: () => Promise<T | null>,
  deps: SliceRunnerDeps,
  source = `zenno.context.${module}`,
): Promise<WithMeta<T>> {
  const nowFn = deps.now ?? (() => new Date());
  const cached = deps.cache.get<WithMeta<T>>(organizationId, module);
  if (cached) {
    return { data: cached.data, meta: { ...cached.meta, freshness: "stale" } };
  }

  let data: T | null = null;
  try {
    data = await loader();
  } catch {
    data = null;
  }
  const ttl = CONTEXT_TTL[module];
  const meta: ContextMeta = {
    source,
    generatedAt: nowFn().toISOString(),
    ttlSeconds: ttl,
    freshness: data == null ? "missing" : "fresh",
    confidence: data == null ? 0 : 0.9,
  };
  const wrapped: WithMeta<T> = { data, meta };
  if (data != null) deps.cache.set(organizationId, module, wrapped, ttl);
  return wrapped;
}
