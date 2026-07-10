// FEATURE — Marketing Platform · Health Engine
// Pure. Score 0..100. Deterministic. Zero I/O.

import type { AssetHealth, PlatformAsset } from "../contracts/assets";

const STALE_WARN_SEC = 6 * 3600;
const STALE_ERROR_SEC = 24 * 3600;

export function scoreAsset(input: { asset: PlatformAsset; lastSyncedAt: string | null; lastError: string | null; now?: Date }): AssetHealth {
  const now = input.now ?? new Date();
  const reasons: AssetHealth["reasons"] = [];
  let score = 100;

  if (input.lastError) {
    score -= 40;
    reasons.push({ code: "last_error", message: input.lastError, severity: "error" });
  }

  const last = input.lastSyncedAt ? new Date(input.lastSyncedAt).getTime() : 0;
  const ageSec = last ? Math.max(0, Math.floor((now.getTime() - last) / 1000)) : Number.POSITIVE_INFINITY;

  if (!last) {
    score -= 30;
    reasons.push({ code: "never_synced", message: "Asset was never synced", severity: "warning" });
  } else if (ageSec > STALE_ERROR_SEC) {
    score -= 40;
    reasons.push({ code: "stale_24h", message: `Last sync ${Math.floor(ageSec / 3600)}h ago`, severity: "error" });
  } else if (ageSec > STALE_WARN_SEC) {
    score -= 15;
    reasons.push({ code: "stale_6h", message: `Last sync ${Math.floor(ageSec / 3600)}h ago`, severity: "warning" });
  }

  if (input.asset.capabilities && Object.keys(input.asset.capabilities).length === 0) {
    reasons.push({ code: "no_capabilities", message: "No capabilities detected", severity: "info" });
  }

  score = Math.max(0, Math.min(100, score));
  const status: AssetHealth["status"] = score >= 85 ? "online" : score >= 50 ? "warning" : "offline";
  return { score, status, reasons, measuredAt: now.toISOString() };
}

export function aggregateHealth(scores: number[]): number {
  if (!scores.length) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
}
