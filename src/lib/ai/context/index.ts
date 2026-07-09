// FEATURE P0.6 — Onda 1 · Context Engine (interfaces + skeleton)
// Full implementation ships in Wave 2. This file locks down the contract
// so Orchestrator + Prompt Builder can already depend on it.

import type { AIAgent } from "../types";

export type ContextScope = {
  organizationId: string;
  userId: string;
  agent: AIAgent;
  /** Optional windows (defaults set by engine) */
  lookbackDays?: number;
};

export type ContextBundle = {
  memory: Array<{ scope: string; key: string; value: unknown }>;
  facts: Array<{ label: string; content: string }>;
  cacheHit: boolean;
};

/** Wave 2 will fill this in. For now, return an empty, deterministic bundle. */
export async function assembleContext(_scope: ContextScope): Promise<ContextBundle> {
  return { memory: [], facts: [], cacheHit: false };
}
