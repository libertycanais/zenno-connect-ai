// FEATURE P0.6 — Onda 4 · Resilience facade
export { CircuitBreaker, circuitBreaker, breakerKey } from "./circuit-breaker";
export type { BreakerOptions, BreakerSnapshot, BreakerState } from "./circuit-breaker";
export { withRetry, computeDelay, isRetryable, DEFAULT_RETRY, NON_RETRYABLE_CODES } from "./retry";
export type { RetryPolicy, RetryDeps } from "./retry";
