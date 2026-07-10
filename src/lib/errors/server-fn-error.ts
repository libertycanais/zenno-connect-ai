// RC1.14 — Padronização de erros para Server Functions.
// Usa AiRuntimeError-like shape mas escopo generalizado (não apenas AI).
// Additive — nenhum contrato existente foi alterado; adoção é opt-in.

export type ServerFnErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "INTERNAL"
  | "PAYLOAD_TOO_LARGE";

export type SafeServerFnError = {
  ok: false;
  code: ServerFnErrorCode;
  message: string;
  requestId?: string;
};

export class ServerFnError extends Error {
  public readonly code: ServerFnErrorCode;
  public readonly httpStatus: number;
  public readonly userMessage: string;

  constructor(
    code: ServerFnErrorCode,
    userMessage: string,
    httpStatus?: number,
  ) {
    super(userMessage);
    this.name = "ServerFnError";
    this.code = code;
    this.userMessage = userMessage;
    this.httpStatus = httpStatus ?? defaultStatusFor(code);
  }
}

function defaultStatusFor(code: ServerFnErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED": return 401;
    case "FORBIDDEN": return 403;
    case "NOT_FOUND": return 404;
    case "VALIDATION_FAILED": return 422;
    case "CONFLICT": return 409;
    case "RATE_LIMITED": return 429;
    case "TIMEOUT": return 504;
    case "UPSTREAM_UNAVAILABLE": return 502;
    case "PAYLOAD_TOO_LARGE": return 413;
    case "INTERNAL":
    default: return 500;
  }
}

const SECRET_RE = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]+|AIza[0-9A-Za-z_-]{20,})/g;

export function scrubMessage(msg: string): string {
  return String(msg ?? "").replace(SECRET_RE, "[REDACTED]").slice(0, 500);
}

/** Wrap unknown errors into a stable, safe user-facing shape. */
export function toSafeServerFnError(err: unknown, requestId?: string): SafeServerFnError {
  if (err instanceof ServerFnError) {
    return { ok: false, code: err.code, message: scrubMessage(err.userMessage), requestId };
  }
  const raw = err instanceof Error ? err.message : String(err ?? "");
  return { ok: false, code: "INTERNAL", message: scrubMessage(raw) || "Erro interno.", requestId };
}
