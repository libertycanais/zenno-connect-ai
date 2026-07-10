// RC2 Pilot Program — Onboarding checklist definition (additive, no side effects).

export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  required: boolean;
  category: "setup" | "connect" | "activate" | "explore";
  estimatedMinutes: number;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { key: "profile.completed",      title: "Complete perfil",           description: "Nome, foto e organização preenchidos.", required: true,  category: "setup",    estimatedMinutes: 2 },
  { key: "team.invited",           title: "Convide time",              description: "Convide ao menos 1 colaborador.",       required: false, category: "setup",    estimatedMinutes: 3 },
  { key: "integration.whatsapp",   title: "Conecte o WhatsApp",        description: "Ative uma instância para receber leads.", required: true, category: "connect", estimatedMinutes: 5 },
  { key: "integration.ads",        title: "Conecte Ads",               description: "Google Ads ou Meta Ads.",               required: false, category: "connect",  estimatedMinutes: 5 },
  { key: "workspace.dashboard",    title: "Abra o Dashboard",          description: "Explore o Executive Score.",            required: true,  category: "activate", estimatedMinutes: 1 },
  { key: "copilot.first_prompt",   title: "Use o Copiloto",            description: "Faça sua primeira pergunta à IA.",      required: true,  category: "activate", estimatedMinutes: 2 },
  { key: "recommendation.first",   title: "Aceite uma recomendação",   description: "Aja sobre um insight sugerido.",        required: false, category: "explore",  estimatedMinutes: 2 },
  { key: "report.first_export",    title: "Exporte um relatório",      description: "PDF ou CSV.",                           required: false, category: "explore",  estimatedMinutes: 1 },
] as const;

export function computeOnboardingProgress(completedKeys: string[]): {
  completed: number; total: number; requiredCompleted: number; requiredTotal: number; percent: number;
} {
  const total = ONBOARDING_STEPS.length;
  const requiredSteps = ONBOARDING_STEPS.filter((s) => s.required);
  const completedSet = new Set(completedKeys);
  const completed = ONBOARDING_STEPS.filter((s) => completedSet.has(s.key)).length;
  const requiredCompleted = requiredSteps.filter((s) => completedSet.has(s.key)).length;
  const percent = Math.round((completed / total) * 100);
  return { completed, total, requiredCompleted, requiredTotal: requiredSteps.length, percent };
}

export function nextRecommendedStep(completedKeys: string[]): OnboardingStep | null {
  const completedSet = new Set(completedKeys);
  const pending = ONBOARDING_STEPS.filter((s) => !completedSet.has(s.key));
  const required = pending.find((s) => s.required);
  return required ?? pending[0] ?? null;
}
