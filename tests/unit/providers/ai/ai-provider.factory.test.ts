import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAIProvider,
  listAIProviders,
} from "@/providers/ai/ai-provider.factory";
import { LovableAIProvider } from "@/providers/ai/lovable-ai.provider";
import { UnknownProviderError } from "@/providers/common/provider.types";

describe("ai-provider.factory", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("registers lovable", () => {
    expect(listAIProviders()).toContain("lovable");
  });

  it("defaults to lovable", () => {
    delete process.env.AI_PROVIDER;
    expect(getAIProvider()).toBeInstanceOf(LovableAIProvider);
  });

  it("throws UnknownProviderError for unknown", () => {
    expect(() => getAIProvider("openai")).toThrow(UnknownProviderError);
  });
});
