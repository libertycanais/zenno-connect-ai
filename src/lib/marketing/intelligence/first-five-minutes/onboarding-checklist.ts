// FEATURE — First Five Minutes · Onboarding checklist (additive)
// Derives a checklist from state we already have — no new schema.
import type { MarketingIntelligenceSnapshot } from "../snapshot/snapshot-store";
import type { TTFIRun } from "./ttfi-tracker";

export type OnboardingItem = {
  id: string;
  label: string;
  done: boolean;
};

export type OnboardingChecklist = {
  items: OnboardingItem[];
  completed: number;
  total: number;
  ready: boolean;    // all critical items done
};

export type OnboardingInput = {
  platformConnected: boolean;
  snapshot: MarketingIntelligenceSnapshot | null;
  ttfi: TTFIRun | null;
  copilotReady: boolean;
};

export function buildOnboardingChecklist(input: OnboardingInput): OnboardingChecklist {
  const items: OnboardingItem[] = [
    { id: "connect", label: "Conta conectada", done: input.platformConnected },
    { id: "sync", label: "Dados sincronizados", done: Boolean(input.snapshot) },
    { id: "analysis", label: "Análise concluída", done: Boolean(input.snapshot?.lastAnalysisAt) },
    { id: "executive", label: "Resumo executivo gerado", done: Boolean(input.snapshot?.executiveSummary) },
    { id: "copilot", label: "Copiloto preparado", done: input.copilotReady && Boolean(input.snapshot) },
    { id: "ttfi", label: "Primeira inteligência entregue", done: Boolean(input.ttfi?.completedAt) },
  ];
  const completed = items.filter((i) => i.done).length;
  return { items, completed, total: items.length, ready: completed === items.length };
}
