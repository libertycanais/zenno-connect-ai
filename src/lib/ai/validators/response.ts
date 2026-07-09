// FEATURE P0.6 — Onda 4 · AI Response Validator
// Post-hoc validation of raw provider output. Detects:
// - empty / whitespace-only responses
// - refusal boilerplate ("I cannot help", "As an AI...")
// - prompt injection echo (assistant repeating <untrusted> tags)
// - secret leakage (sk-*, xoxb-*, ghp_*, AKIA*, bearer tokens)
// - broken JSON when jsonMode was requested
// - hallucinated tool calls (name not in allowed tool set)
//
// Pure function — safe to call from any layer.

export type ResponseValidationInput = {
  text: string;
  jsonMode?: boolean;
  allowedToolNames?: readonly string[];
  toolCallNames?: readonly string[];
  minLength?: number;
};

export type ResponseValidationIssue = {
  code:
    | "EMPTY"
    | "TOO_SHORT"
    | "REFUSAL"
    | "INJECTION_ECHO"
    | "SECRET_LEAK"
    | "INVALID_JSON"
    | "UNAUTHORIZED_TOOL";
  message: string;
  severity: "warn" | "error";
};

export type ResponseValidation = {
  ok: boolean;
  issues: ResponseValidationIssue[];
};

const REFUSAL_PATTERNS: RegExp[] = [
  /^\s*(desculpe|sinto muito|i(?:'|)m sorry|as an ai|como uma ia)/i,
  /não posso (ajudar|responder|fornecer)/i,
  /i (?:can(?:not|'t)|am unable to) (?:help|assist|provide)/i,
];

const INJECTION_ECHO = /<\/?untrusted[\s>]/i;

const SECRET_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: "openai_key", re: /\bsk-[A-Za-z0-9]{20,}/ },
  { code: "anthropic_key", re: /\bsk-ant-[A-Za-z0-9-]{20,}/ },
  { code: "github_token", re: /\bghp_[A-Za-z0-9]{30,}/ },
  { code: "slack_bot", re: /\bxoxb-[A-Za-z0-9-]{10,}/ },
  { code: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { code: "bearer", re: /bearer\s+[A-Za-z0-9._-]{20,}/i },
];

export function validateResponse(input: ResponseValidationInput): ResponseValidation {
  const issues: ResponseValidationIssue[] = [];
  const text = input.text ?? "";
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    issues.push({ code: "EMPTY", message: "Provider returned empty content", severity: "error" });
  } else if (input.minLength && trimmed.length < input.minLength) {
    issues.push({ code: "TOO_SHORT", message: `Content shorter than ${input.minLength} chars`, severity: "warn" });
  }

  if (trimmed.length > 0 && REFUSAL_PATTERNS.some((r) => r.test(trimmed))) {
    issues.push({ code: "REFUSAL", message: "Response looks like a refusal boilerplate", severity: "warn" });
  }

  if (INJECTION_ECHO.test(text)) {
    issues.push({ code: "INJECTION_ECHO", message: "Response echoes <untrusted> delimiter", severity: "error" });
  }

  for (const { code, re } of SECRET_PATTERNS) {
    if (re.test(text)) {
      issues.push({ code: "SECRET_LEAK", message: `Possible ${code} in response`, severity: "error" });
      break;
    }
  }

  if (input.jsonMode && trimmed.length > 0) {
    try { JSON.parse(trimmed); }
    catch { issues.push({ code: "INVALID_JSON", message: "jsonMode requested but response is not valid JSON", severity: "error" }); }
  }

  if (input.allowedToolNames && input.toolCallNames?.length) {
    const allowed = new Set(input.allowedToolNames);
    for (const name of input.toolCallNames) {
      if (!allowed.has(name)) {
        issues.push({ code: "UNAUTHORIZED_TOOL", message: `Tool "${name}" not in allowed set`, severity: "error" });
      }
    }
  }

  const ok = !issues.some((i) => i.severity === "error");
  return { ok, issues };
}

/** Redact secrets before persisting/logging the response. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const { re } of SECRET_PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}
