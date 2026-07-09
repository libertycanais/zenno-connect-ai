// FEATURE P0.6 — Onda 4 · Circuit Breaker
// State machine per (provider, model). Additive: no changes to Provider Layer.
// States: closed → (failures ≥ threshold) → open → (after cooldown) → half_open
//         half_open → success ⇒ closed | failure ⇒ open
//
// Design goals:
// - Zero dependencies, safe in Workers (no timers required to run — time is
//   read on demand via `now()`).
// - Pure snapshot per key; caller decides the key granularity (default
//   `provider:model`).
// - Thread-safe within a single isolate (JS single-threaded).

export type BreakerState = "closed" | "open" | "half_open";

export type BreakerOptions = {
  failureThreshold: number;          // consecutive failures to open
  cooldownMs: number;                // time to wait before probing (half_open)
  halfOpenMaxProbes: number;         // successes required in half_open to close
  now?: () => number;
};

export type BreakerSnapshot = {
  key: string;
  state: BreakerState;
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  openedAt: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
};

const DEFAULTS: BreakerOptions = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxProbes: 2,
};

export class CircuitBreaker {
  private readonly opts: Required<BreakerOptions>;
  private readonly state = new Map<string, BreakerSnapshot>();

  constructor(opts: Partial<BreakerOptions> = {}) {
    this.opts = {
      ...DEFAULTS,
      now: () => Date.now(),
      ...opts,
    } as Required<BreakerOptions>;
  }

  /** Returns true when the caller MUST NOT invoke the downstream. */
  isOpen(key: string): boolean {
    const s = this.get(key);
    if (s.state === "closed") return false;
    if (s.state === "open") {
      // Auto-transition to half_open after cooldown.
      if (s.openedAt !== null && this.opts.now() - s.openedAt >= this.opts.cooldownMs) {
        this.mutate(key, (cur) => ({ ...cur, state: "half_open", halfOpenSuccesses: 0 }));
        return false;
      }
      return true;
    }
    // half_open — allow limited probes.
    return false;
  }

  /** Read-only snapshot (defensive copy). */
  snapshot(key: string): BreakerSnapshot {
    return { ...this.get(key) };
  }

  onSuccess(key: string): void {
    this.mutate(key, (cur) => {
      const now = this.opts.now();
      if (cur.state === "half_open") {
        const halfOpenSuccesses = cur.halfOpenSuccesses + 1;
        if (halfOpenSuccesses >= this.opts.halfOpenMaxProbes) {
          return { ...cur, state: "closed", consecutiveFailures: 0, halfOpenSuccesses: 0, lastSuccessAt: now, openedAt: null };
        }
        return { ...cur, halfOpenSuccesses, lastSuccessAt: now };
      }
      return { ...cur, consecutiveFailures: 0, lastSuccessAt: now };
    });
  }

  onFailure(key: string): void {
    this.mutate(key, (cur) => {
      const now = this.opts.now();
      const consecutiveFailures = cur.consecutiveFailures + 1;
      if (cur.state === "half_open") {
        return { ...cur, state: "open", openedAt: now, consecutiveFailures, lastFailureAt: now, halfOpenSuccesses: 0 };
      }
      if (consecutiveFailures >= this.opts.failureThreshold) {
        return { ...cur, state: "open", openedAt: now, consecutiveFailures, lastFailureAt: now };
      }
      return { ...cur, consecutiveFailures, lastFailureAt: now };
    });
  }

  /** Force-reset a key (admin/ops path). */
  reset(key: string): void {
    this.state.delete(key);
  }

  private get(key: string): BreakerSnapshot {
    let s = this.state.get(key);
    if (!s) {
      s = {
        key,
        state: "closed",
        consecutiveFailures: 0,
        halfOpenSuccesses: 0,
        openedAt: null,
        lastFailureAt: null,
        lastSuccessAt: null,
      };
      this.state.set(key, s);
    }
    return s;
  }

  private mutate(key: string, fn: (cur: BreakerSnapshot) => BreakerSnapshot): void {
    this.state.set(key, fn(this.get(key)));
  }
}

export const circuitBreaker = new CircuitBreaker();

/** Canonical key builder — keeps callers consistent across the codebase. */
export function breakerKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}
