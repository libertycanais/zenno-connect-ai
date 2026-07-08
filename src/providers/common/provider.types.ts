// Tipos compartilhados entre todas as camadas de provider.
// Nenhum consumer deve importar SDK/API de fornecedor — apenas estas interfaces.

export type ProviderName = string;

export type ProviderConfig = Record<string, string | undefined>;

export type ProviderContext = {
  organizationId: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
};

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${provider}:${code}] ${message}`);
    this.name = "ProviderError";
  }
}

export class ProviderNotConfiguredError extends ProviderError {
  constructor(provider: ProviderName, missing: string[]) {
    super(provider, "not_configured", `Missing config: ${missing.join(", ")}`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class UnknownProviderError extends ProviderError {
  constructor(domain: string, requested: string, supported: string[]) {
    super(requested, "unknown_provider",
      `Unknown ${domain} provider "${requested}". Supported: ${supported.join(", ")}`);
    this.name = "UnknownProviderError";
  }
}

/** Sanitiza mensagens de erro externas antes de expor ao consumer. */
export function sanitizeProviderError(e: unknown): string {
  if (e instanceof ProviderError) return e.message;
  if (e instanceof Error) {
    // Remove tokens que possam vazar em stack/message.
    return e.message.replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]");
  }
  return "provider_error";
}
