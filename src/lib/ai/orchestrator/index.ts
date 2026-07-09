// FEATURE P0.6 — Onda 1 · AI Orchestrator (skeleton)
// SOLE entrypoint for AI features. Wave 1 wires the pipeline but exposes only
// the shape — actual provider execution and DB persistence land in Wave 2/3.
//
// Invariant: no feature may skip these steps. The linter (ESLint) will restrict
// SDK imports outside src/providers/ai/** in a follow-up change.

import { AIError, normalizeAIError } from "../errors";
import { evaluatePolicy, type PolicyInput } from "../policy";
import { buildSystemPrompt, buildUserPrompt, type ContextBlock } from "../prompt-builder";
import { postProcess, type StructuredResponse } from "../post-processor";
import type { AIAgent, AIProviderName } from "../types";

export type OrchestratorInput = {
  organizationId: string;
  userId: string;
  agent: AIAgent;
  provider: AIProviderName;
  model: string;
  userInput: string;
  context?: ContextBlock[];
  estimatedCostCents?: number;
};

export type OrchestratorRunResult = {
  ok: true;
  response: StructuredResponse;
  raw: string;
  usage: { tokensIn: number; tokensOut: number; latencyMs: number };
} | {
  ok: false;
  error: ReturnType<typeof normalizeAIError>;
};

/**
 * Pure pipeline: policy → prompt build → provider execute → post-process.
 * The `executeProvider` dependency is injected so unit tests can stub it and
 * so Wave 2 can plug the real AIProvider factory without touching the pipeline.
 */
export async function runOrchestrator(
  input: OrchestratorInput,
  deps: {
    policyInputBuilder: (i: OrchestratorInput) => Promise<PolicyInput>;
    executeProvider: (args: {
      provider: AIProviderName;
      model: string;
      systemPrompt: string;
      userPrompt: string;
      signal: AbortSignal;
    }) => Promise<{ text: string; tokensIn: number; tokensOut: number }>;
    timeoutMs?: number;
  },
): Promise<OrchestratorRunResult> {
  const controller = new AbortController();
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const policyInput = await deps.policyInputBuilder(input);
    const decision = evaluatePolicy(policyInput);
    if (!decision.allowed) return { ok: false, error: decision.error };

    const systemPrompt = buildSystemPrompt(input.agent);
    const userPrompt = buildUserPrompt(input.userInput, input.context ?? []);

    const providerResult = await deps.executeProvider({
      provider: input.provider,
      model: input.model,
      systemPrompt,
      userPrompt,
      signal: controller.signal,
    });

    const response = postProcess(providerResult.text);
    return {
      ok: true,
      response,
      raw: providerResult.text,
      usage: {
        tokensIn: providerResult.tokensIn,
        tokensOut: providerResult.tokensOut,
        latencyMs: Date.now() - start,
      },
    };
  } catch (err) {
    if (err instanceof AIError) return { ok: false, error: err.normalized };
    return { ok: false, error: normalizeAIError(err) };
  } finally {
    clearTimeout(timer);
  }
}
