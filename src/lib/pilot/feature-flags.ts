// RC2 Pilot Program — Feature Flag evaluation (org-scoped, additive).
// Reuses existing `workspace_feature_flags` table (org_id + flag_key + enabled + rollout_percent).
// This module provides pure evaluation logic; persistence is done via server functions.

export interface FeatureFlagRecord {
  flagKey: string;
  organizationId: string;
  enabled: boolean;
  rolloutPercent: number; // 0..100
  targetCohorts?: string[]; // optional cohort allow-list
}

export interface FlagEvaluationContext {
  organizationId: string;
  cohort?: string;
  userId?: string;
}

// FNV-1a 32-bit for deterministic bucketing (org+flag → 0..99).
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

export function bucketOf(orgId: string, flagKey: string): number {
  return fnv1a(`${orgId}:${flagKey}`) % 100;
}

export function evaluateFlag(flag: FeatureFlagRecord | undefined, ctx: FlagEvaluationContext): boolean {
  if (!flag || !flag.enabled) return false;
  if (flag.targetCohorts && flag.targetCohorts.length > 0) {
    if (!ctx.cohort || !flag.targetCohorts.includes(ctx.cohort)) return false;
  }
  const pct = Math.max(0, Math.min(100, flag.rolloutPercent));
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return bucketOf(ctx.organizationId, flag.flagKey) < pct;
}

export class FeatureFlagRegistry {
  private byOrg = new Map<string, Map<string, FeatureFlagRecord>>();

  upsert(flag: FeatureFlagRecord): void {
    let orgMap = this.byOrg.get(flag.organizationId);
    if (!orgMap) { orgMap = new Map(); this.byOrg.set(flag.organizationId, orgMap); }
    orgMap.set(flag.flagKey, flag);
  }

  get(orgId: string, flagKey: string): FeatureFlagRecord | undefined {
    return this.byOrg.get(orgId)?.get(flagKey);
  }

  isEnabled(flagKey: string, ctx: FlagEvaluationContext): boolean {
    return evaluateFlag(this.get(ctx.organizationId, flagKey), ctx);
  }

  clear(): void { this.byOrg.clear(); }
}
