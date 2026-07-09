// FEATURE P0.6 — Onda 2 · Token Budget Manager
// Purpose: estimate tokens, prioritise slices, reduce context so no request
// exceeds the model window. Estimator is heuristic (≈4 chars/token) but stable.

import type { BusinessContext, ContextModuleName } from "./types";

/** ~4 chars per token is a widely-used rough heuristic (OpenAI cookbook). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Priority order — higher wins when budget is tight. */
export const MODULE_PRIORITY: Record<ContextModuleName, number> = {
  conversation: 100,
  memory: 90,
  executive: 85,
  billing: 80,
  organization: 75,
  crm: 70,
  ads: 65,
  tracking: 60,
  analytics: 55,
  finance: 50,
  whatsapp: 45,
  team: 40,
};

/** Serialise one slice deterministically for the prompt. */
export function serializeSlice(name: ContextModuleName, slice: unknown): string {
  return JSON.stringify({ module: name, ...(slice as object) });
}

/** Truncate arrays inside a slice to at most `max` entries. */
export function truncateLists<T extends object>(slice: T, max: number): T {
  const out: Record<string, unknown> = { ...slice };
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v) && v.length > max) out[k] = v.slice(0, max);
  }
  return out as T;
}

export type BudgetPlan = {
  totalTokens: number;
  included: ContextModuleName[];
  dropped: ContextModuleName[];
  truncated: ContextModuleName[];
};

export type BudgetOutput = {
  plan: BudgetPlan;
  blocks: Array<{ label: ContextModuleName; content: string }>;
};

/**
 * Reduce a BusinessContext to fit within `maxTokens`.
 * Strategy: sort by priority desc, include full slice while budget allows;
 * when a slice would overflow, try list truncation (max=5), else drop.
 */
export function reduceContext(ctx: BusinessContext, maxTokens: number): BudgetOutput {
  const modules = (Object.keys(MODULE_PRIORITY) as ContextModuleName[]).sort(
    (a, b) => MODULE_PRIORITY[b] - MODULE_PRIORITY[a],
  );

  const blocks: BudgetOutput["blocks"] = [];
  const included: ContextModuleName[] = [];
  const dropped: ContextModuleName[] = [];
  const truncated: ContextModuleName[] = [];
  let total = 0;

  for (const m of modules) {
    const slice = ctx[m];
    if (!slice || slice.data == null) {
      dropped.push(m);
      continue;
    }
    let payload = { ...slice.data, _meta: slice.meta };
    let text = serializeSlice(m, payload);
    let cost = estimateTokens(text);

    if (total + cost > maxTokens) {
      // try truncation
      payload = { ...truncateLists(slice.data as object, 5), _meta: slice.meta } as typeof payload;
      text = serializeSlice(m, payload);
      cost = estimateTokens(text);
      if (total + cost > maxTokens) {
        dropped.push(m);
        continue;
      }
      truncated.push(m);
    }

    total += cost;
    included.push(m);
    blocks.push({ label: m, content: text });
  }

  return { plan: { totalTokens: total, included, dropped, truncated }, blocks };
}
