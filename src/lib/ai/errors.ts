// FEATURE P0.6 — Onda 1
// normalizeAIError() — mandatory before any user-facing return.
// Ensures raw SDK error text (may contain API keys, request bodies) never
// reaches the client. Every provider call MUST pass errors through this.

import type { NormalizedAIError } from "./types";

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /sk-ant-[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /AIza[0-9A-Za-z_-]{20,}/g, // Google API keys
  /(?:api[_-]?key|apikey|token|secret|password)\s*[:=]\s*['"]?[^\s'"&]+/gi,
];

/** Strip anything that looks like a credential before it reaches a user. */
export function scrubSecrets(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}

/** Never expose raw provider error text. Map everything into a stable code. */
export function normalizeAIError(err: unknown): NormalizedAIError {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const message = scrubSecrets(raw).slice(0, 500);

  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status: unknown }).status)
      : undefined;

  const name = err instanceof Error ? err.name : "";

  if (name === "AbortError" || /aborted|abort/i.test(message)) {
    return {
      code: "TIMEOUT",
      retryable: true,
      userMessage: "A chamada de IA excedeu o tempo limite. Tente novamente.",
    };
  }
  if (status === 429 || /rate.?limit|too many/i.test(message)) {
    return {
      code: "RATE_LIMITED",
      retryable: true,
      userMessage: "Limite de requisições atingido. Aguarde alguns segundos.",
    };
  }
  if (status === 401 || status === 403 || /invalid.?api.?key|unauthorized|forbidden/i.test(message)) {
    return {
      code: "INVALID_KEY",
      retryable: false,
      userMessage: "Credenciais do provedor de IA inválidas ou sem permissão.",
    };
  }
  if (/content.?filter|policy|safety|blocked/i.test(message)) {
    return {
      code: "CONTENT_FILTER",
      retryable: false,
      userMessage: "A resposta foi bloqueada por política de conteúdo do provedor.",
    };
  }
  if (typeof status === "number" && status >= 500) {
    return {
      code: "UPSTREAM_5XX",
      retryable: true,
      userMessage: "O provedor de IA está indisponível. Tente novamente em instantes.",
    };
  }
  return {
    code: "UNKNOWN",
    retryable: false,
    userMessage: "Falha inesperada ao processar a solicitação de IA.",
  };
}

export class AIError extends Error {
  readonly normalized: NormalizedAIError;
  constructor(normalized: NormalizedAIError, cause?: unknown) {
    super(normalized.userMessage);
    this.name = "AIError";
    this.normalized = normalized;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export function policyBlocked(subCode: string, userMessage: string): AIError {
  return new AIError({
    code: "POLICY_BLOCKED",
    retryable: false,
    userMessage,
    subCode,
  });
}

export function budgetExceeded(userMessage = "Orçamento de IA excedido para esta organização."): AIError {
  return new AIError({
    code: "BUDGET_EXCEEDED",
    retryable: false,
    userMessage,
  });
}

export function invalidInput(userMessage: string): AIError {
  return new AIError({
    code: "INVALID_INPUT",
    retryable: false,
    userMessage,
  });
}
