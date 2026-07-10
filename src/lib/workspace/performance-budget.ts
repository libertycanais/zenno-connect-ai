// EPIC K — Widget Performance Budget validator
import type { WidgetPerformanceBudget } from "./types";

export type BudgetObservation = {
  loadTimeMs: number;
  memoryMb: number;
  requests: number;
};

export type BudgetVerdict = {
  ok: boolean;
  breaches: Array<"loadTime" | "memory" | "requests">;
};

export function evaluateBudget(
  budget: WidgetPerformanceBudget,
  obs: BudgetObservation,
): BudgetVerdict {
  const breaches: BudgetVerdict["breaches"] = [];
  if (obs.loadTimeMs > budget.maxLoadTimeMs) breaches.push("loadTime");
  if (obs.memoryMb > budget.maxMemoryMb) breaches.push("memory");
  if (obs.requests > budget.maxRequests) breaches.push("requests");
  return { ok: breaches.length === 0, breaches };
}

export const DEFAULT_BUDGETS: Record<"critical" | "standard" | "background", WidgetPerformanceBudget> = {
  critical:   { maxLoadTimeMs: 800,  maxMemoryMb: 32, maxRequests: 4, cacheTtlSeconds: 30,  priority: 1 },
  standard:   { maxLoadTimeMs: 1500, maxMemoryMb: 48, maxRequests: 6, cacheTtlSeconds: 60,  priority: 3 },
  background: { maxLoadTimeMs: 3000, maxMemoryMb: 64, maxRequests: 8, cacheTtlSeconds: 300, priority: 5 },
};
