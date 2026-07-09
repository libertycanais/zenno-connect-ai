// FEATURE P0.6 — Zenno AI Copilot Enterprise · Onda 1
// Shared types for the AI orchestration layer.
// This module is client-safe (no server imports).

export const AI_PROVIDERS = [
  "lovable",
  "openai",
  "anthropic",
  "google",
  "groq",
  "deepseek",
  "xai",
] as const;
export type AIProviderName = (typeof AI_PROVIDERS)[number];

export const TASK_TYPES = [
  "AI",
  "SYNC",
  "IMPORT",
  "EXPORT",
  "AUTOMATION",
  "REPORT",
  "BILLING",
  "AUDIT",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "timeout",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const AI_AGENTS = [
  "free_chat",
  "campaign_analyst",
  "tracking_analyst",
  "seo_analyst",
  "cro_analyst",
  "executive_advisor",
] as const;
export type AIAgent = (typeof AI_AGENTS)[number];

export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export type NormalizedAIError = {
  code:
    | "RATE_LIMITED"
    | "INVALID_KEY"
    | "CONTENT_FILTER"
    | "TIMEOUT"
    | "UPSTREAM_5XX"
    | "BUDGET_EXCEEDED"
    | "POLICY_BLOCKED"
    | "INVALID_INPUT"
    | "PROVIDER_UNAVAILABLE"
    | "UNKNOWN";
  retryable: boolean;
  userMessage: string;
  subCode?: string;
};

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; error: NormalizedAIError };

export type AIProviderCredentialSafe = {
  id: string;
  organization_id: string;
  provider: AIProviderName;
  label: string | null;
  default_model: string | null;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  api_key_fingerprint: string;
  api_key_last4: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};
