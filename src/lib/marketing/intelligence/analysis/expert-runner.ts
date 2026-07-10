// FEATURE — Marketing Intelligence · Expert Runner
// Reuses existing Marketing Expert without altering it. Pure orchestration.
import { marketingExpert } from "@/lib/ai/experts";
import type { ExpertRunOutput } from "@/lib/ai/experts/types";
import type { CampaignFacts } from "../types";

export function runMarketingExperts(input: {
  organizationId: string;
  focus: string;
  campaigns: CampaignFacts[];
}): { output: ExpertRunOutput; campaignsAnalyzed: number } {
  const output = marketingExpert.run({
    organizationId: input.organizationId,
    focus: input.focus,
    kpis: [],
    triggeredRules: [],
  });
  return { output, campaignsAnalyzed: input.campaigns.length };
}
