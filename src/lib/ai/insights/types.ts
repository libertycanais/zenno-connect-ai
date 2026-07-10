import type { BusinessSignal, SignalRecommendedExpert } from "../signals/types";

export type InsightPriority = 1 | 2 | 3 | 4 | 5;

export type InsightChecklistItem = { id: string; label: string; done: boolean };

export type InsightPlaybook = {
  summary: string;
  diagnosis: string;
  impact: string;
  priority: InsightPriority;
  checklist: InsightChecklistItem[];
  actionPlan: string[];
  experts: SignalRecommendedExpert[];
  successCriteria: string[];
};

export type Insight = {
  id: string;
  organizationId: string;
  title: string;
  narrative: string;
  causalChain: string[];         // e.g. ["ROASDrop", "CTRDrop", "CPAIncrease"]
  signalIds: string[];
  confidence: number;
  priority: InsightPriority;
  playbook: InsightPlaybook;
  createdAt: string;
};

export type InsightRule = {
  id: string;
  matches(signals: BusinessSignal[]): boolean;
  build(signals: BusinessSignal[]): Omit<Insight, "id" | "createdAt">;
};
