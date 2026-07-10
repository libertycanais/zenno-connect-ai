// Signal priority + severity scoring (pure)
import type { SignalSeverity } from "./types";

export function severityToPriority(sev: SignalSeverity): number {
  switch (sev) {
    case "critical": return 1;
    case "high":     return 2;
    case "medium":   return 3;
    case "low":      return 4;
    case "info":     return 5;
  }
}

export function scoreToSeverity(score: number): SignalSeverity {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  if (score >= 20) return "low";
  return "info";
}

/** Composite priority combining severity, confidence and business impact (0..1). */
export function computePriority(sev: SignalSeverity, confidence: number, impact = 0.5): number {
  const base = severityToPriority(sev);
  const modifier = (1 - Math.max(0, Math.min(1, confidence * 0.6 + impact * 0.4))) * 0.9;
  return Math.max(1, Math.min(5, Math.round(base + modifier - 0.5)));
}
