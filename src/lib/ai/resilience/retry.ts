// FEATURE P0.6 — Onda 4 · Retry Policy
// Exponential backoff with full jitter. Retries only for retryable errors.
// Never retries POLICY_BLOCKED, BUDGET_EXCEEDED, INVALID_INPUT, CONTENT_FILTER.
//
// Compatible with AbortSignal (aborts short-circuit retries).

import { normalizeAIError, type NormalizedAIError } from "../errors";

export type RetryPolicy = {
  maxAttempts: number;         // total attempts including the first (>=1)
  baseDelayMs: number;         // base for exponential backoff
  maxDelayMs: number;          // cap
  jitter: "none" | "full";
};

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  jitter: "full",
};

export const NON_RETRYABLE_CODES: ReadonlySet<NormalizedAIError["code"]> = new Set([
  "POLICY_BLOCKED",
  "BUDGET_EXCEEDED",
  "INVALID_INPUT",
  "INVALID_KEY",
  "CONTENT_FILTER",
]);

export function isRetryable(err: NormalizedAIError): boolean {
  if (NON_RETRYABLE_CODES.has(err.code)) return false;
  return err.retryable;
}

export function computeDelay(attempt: number, policy: RetryPolicy, rnd: () => number = Math.random): number {
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  return policy.jitter === "full" ? Math.floor(rnd() * exp) : exp;
}

export type RetryDeps = {
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  rnd?: () => number;
  signal?: AbortSignal;
};

/**
 * Execute `fn` with retry. `fn` receives the 1-indexed attempt number.
 * The function itself must be idempotent — callers ensure that.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY,
  deps: RetryDeps = {},
): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep;
  const rnd = deps.rnd ?? Math.random;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    if (deps.signal?.aborted) throw new DOMException("aborted", "AbortError");
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const normalized = normalizeAIError(err);
      if (!isRetryable(normalized) || attempt === policy.maxAttempts) throw err;
      const delay = computeDelay(attempt, policy, rnd);
      await sleep(delay, deps.signal);
    }
  }
  throw lastErr;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
