// FEATURE P0.6 — Onda 3 · Runtime facade
// Single entrypoint tying Registry + Selection + Cost + Health + Benchmark +
// Usage + Skills together. Features (chat, batch, cron) import ONLY this.

export { providerRegistry, ProviderRegistry } from "../registry";
export type { ProviderDescriptor, ModelDescriptor, ProviderStatus } from "../registry";

export { selectModel, estimateCostCents } from "../selection";
export type { SelectionInput, SelectionResult, SelectionCandidate, SelectionRequirements } from "../selection";

export { providerBenchmark, ProviderBenchmarkStore } from "../benchmark";
export type { BenchmarkSample, ProviderBenchmarkSnapshot } from "../benchmark";

export { compareModels, suggestCheaperAlternative, estimateTokensFromText } from "../cost";
export type { CostComparisonRow, SavingsSuggestion } from "../cost";

export { providerHealth, ProviderHealthMonitor } from "../health";
export type { HealthSample, HealthSnapshot, ProviderHealthStatus } from "../health";

export { usageCollector, UsageCollector } from "../usage";
export type { UsageRecord, UsageSink } from "../usage";

export { skillRegistry, SkillRegistry } from "../skills";
export type { SkillDescriptor, SkillCategory } from "../skills";

export { toolRegistry, ToolRegistry } from "../tools";
export type { ToolDescriptor, ToolCall, ToolResult, ToolExecutor } from "../tools";

export type { AIProviderAdapter, AdapterRequest, AdapterResponse } from "../provider-adapter";

export { attachExplainability, classifyFreshness, explainabilitySchema } from "../explainability";
export type { Explainability, ExplainedResponse, SourceRef } from "../explainability";

export { collectStream, toSSE, toSSEResponse } from "../streaming";
export type { StreamEvent, StreamingProvider } from "../streaming";

export { ConversationEngine, deriveTitle, trimHistory, shouldSummarize } from "../conversation";
export type { ConversationStore, ConversationRow, PersistedMessage } from "../conversation";
