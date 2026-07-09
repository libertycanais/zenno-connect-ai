// FEATURE P0.6 — Onda 4 · Capability Validator
// Guards adapter requests against the Provider Registry BEFORE dispatch.
// Fails fast with a normalized AIError instead of letting the provider return
// an obscure 400. Pure function — no I/O.

import { invalidInput } from "../errors";
import type { AdapterRequest } from "../provider-adapter";
import { providerRegistry, type ModelDescriptor, type ProviderRegistry } from "../registry";

export type CapabilityRequirements = {
  needsStreaming?: boolean;
  needsTools?: boolean;
  needsJson?: boolean;
  needsVision?: boolean;
  needsReasoning?: boolean;
  minContextTokens?: number;
};

export type CapabilityCheck =
  | { ok: true; model: ModelDescriptor }
  | { ok: false; reason: string; missing: string[] };

export function inferRequirements(req: AdapterRequest): CapabilityRequirements {
  return {
    needsTools: (req.tools?.length ?? 0) > 0,
    needsJson: req.jsonMode === true,
  };
}

export function validateCapability(
  providerId: string,
  modelId: string,
  requirements: CapabilityRequirements = {},
  registry: ProviderRegistry = providerRegistry,
): CapabilityCheck {
  const model = registry.findModel(providerId, modelId);
  if (!model) {
    return { ok: false, reason: `Model "${modelId}" not registered for provider "${providerId}"`, missing: ["model"] };
  }
  const missing: string[] = [];
  if (requirements.needsStreaming && !model.supportsStreaming) missing.push("streaming");
  if (requirements.needsTools && !model.supportsTools) missing.push("tools");
  if (requirements.needsJson && !model.supportsJson) missing.push("json_mode");
  if (requirements.needsVision && !model.supportsVision) missing.push("vision");
  if (requirements.needsReasoning && !model.supportsReasoning) missing.push("reasoning");
  if (requirements.minContextTokens && model.maxContext < requirements.minContextTokens) missing.push("context_window");
  if (missing.length > 0) {
    return { ok: false, reason: `Model "${modelId}" missing capabilities: ${missing.join(", ")}`, missing };
  }
  return { ok: true, model };
}

/** Throws AIError(INVALID_INPUT) when unsupported — use before dispatching. */
export function assertCapability(
  providerId: string,
  modelId: string,
  requirements: CapabilityRequirements = {},
  registry: ProviderRegistry = providerRegistry,
): ModelDescriptor {
  const check = validateCapability(providerId, modelId, requirements, registry);
  if (!check.ok) throw invalidInput(check.reason);
  return check.model;
}
