// FEATURE P0.6 — Onda 2 · Bridge between Context Engine and Prompt Builder.
// Keeps the Prompt Builder pure by handling the reduce→ContextBlock mapping.

import { buildUserPrompt, type ContextBlock } from "../prompt-builder";
import { reduceContext } from "./token-budget";
import type { BusinessContext } from "./types";

export type BuildFromContextInput = {
  businessContext: BusinessContext;
  userInput: string;
  maxContextTokens?: number;
};

export function buildUserPromptFromContext(input: BuildFromContextInput): {
  prompt: string;
  totalContextTokens: number;
  droppedModules: string[];
  truncatedModules: string[];
} {
  const budget = input.maxContextTokens ?? 6_000;
  const reduced = reduceContext(input.businessContext, budget);
  const blocks: ContextBlock[] = reduced.blocks.map((b) => ({ label: b.label, content: b.content }));
  return {
    prompt: buildUserPrompt(input.userInput, blocks),
    totalContextTokens: reduced.plan.totalTokens,
    droppedModules: reduced.plan.dropped,
    truncatedModules: reduced.plan.truncated,
  };
}
