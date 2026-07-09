// FEATURE P0.6 — Onda 3 · AI Skill Registry (infrastructure only)
// Skills are declarative capability descriptors. Actual agent execution
// arrives in Onda 4.

export type SkillCategory =
  | "campaigns"
  | "tracking"
  | "seo"
  | "cro"
  | "billing"
  | "finance"
  | "executive"
  | "forecast"
  | "competitor"
  | "audience";

export type SkillDescriptor = {
  id: string;
  category: SkillCategory;
  displayName: string;
  description: string;
  requiredContext: string[];       // context module ids required
  suggestedModels: string[];       // e.g. ["openai:gpt-5.5", "google:gemini-2.5-pro"]
  needsReasoning: boolean;
  needsVision: boolean;
  needsTools: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
};

const DEFAULT_SKILLS: SkillDescriptor[] = [
  {
    id: "campaign_analysis",
    category: "campaigns",
    displayName: "Análise de Campanhas",
    description: "Analisa CAC, ROAS, CTR e recomenda ajustes por campanha.",
    requiredContext: ["ads", "tracking"],
    suggestedModels: ["openai:gpt-5.5", "anthropic:claude-3-5-sonnet-latest"],
    needsReasoning: true, needsVision: false, needsTools: false,
    estimatedInputTokens: 4_000, estimatedOutputTokens: 1_500,
  },
  {
    id: "tracking_analysis",
    category: "tracking",
    displayName: "Análise de Tracking",
    description: "Avalia qualidade de atribuição, eventos, funil e drop-offs.",
    requiredContext: ["tracking", "analytics"],
    suggestedModels: ["openai:gpt-5.5-mini", "google:gemini-2.5-flash"],
    needsReasoning: false, needsVision: false, needsTools: false,
    estimatedInputTokens: 3_000, estimatedOutputTokens: 1_000,
  },
  {
    id: "seo_analysis",
    category: "seo",
    displayName: "Análise de SEO",
    description: "Avalia keywords, on-page, backlinks e Core Web Vitals.",
    requiredContext: ["analytics"],
    suggestedModels: ["google:gemini-2.5-pro"],
    needsReasoning: true, needsVision: false, needsTools: true,
    estimatedInputTokens: 4_000, estimatedOutputTokens: 1_500,
  },
  {
    id: "cro_analysis",
    category: "cro",
    displayName: "Análise de CRO",
    description: "Detecta gargalos de conversão e propõe testes A/B.",
    requiredContext: ["tracking", "analytics"],
    suggestedModels: ["openai:gpt-5.5", "google:gemini-2.5-pro"],
    needsReasoning: true, needsVision: false, needsTools: false,
    estimatedInputTokens: 3_500, estimatedOutputTokens: 1_200,
  },
  {
    id: "billing_analysis",
    category: "billing",
    displayName: "Análise de Billing",
    description: "Avalia MRR/ARR, churn e receita por plano.",
    requiredContext: ["billing"],
    suggestedModels: ["openai:gpt-5.5-mini", "deepseek:deepseek-chat"],
    needsReasoning: false, needsVision: false, needsTools: false,
    estimatedInputTokens: 2_000, estimatedOutputTokens: 800,
  },
  {
    id: "finance_analysis",
    category: "finance",
    displayName: "Análise Financeira",
    description: "Fluxo de caixa, receitas x despesas, categorias.",
    requiredContext: ["finance"],
    suggestedModels: ["openai:gpt-5.5-mini"],
    needsReasoning: false, needsVision: false, needsTools: false,
    estimatedInputTokens: 3_000, estimatedOutputTokens: 1_000,
  },
  {
    id: "executive_summary",
    category: "executive",
    displayName: "Sumário Executivo",
    description: "Consolida KPIs e recomendações estratégicas.",
    requiredContext: ["executive", "billing", "ads", "tracking"],
    suggestedModels: ["openai:gpt-5.5", "anthropic:claude-3-5-sonnet-latest"],
    needsReasoning: true, needsVision: false, needsTools: false,
    estimatedInputTokens: 6_000, estimatedOutputTokens: 2_000,
  },
  {
    id: "forecast",
    category: "forecast",
    displayName: "Previsão",
    description: "Projeta MRR/ROAS/CAC futuros com base em histórico.",
    requiredContext: ["billing", "ads"],
    suggestedModels: ["openai:gpt-5.5", "deepseek:deepseek-reasoner"],
    needsReasoning: true, needsVision: false, needsTools: false,
    estimatedInputTokens: 5_000, estimatedOutputTokens: 1_500,
  },
  {
    id: "competitor_analysis",
    category: "competitor",
    displayName: "Análise de Concorrência",
    description: "Compara métricas contra benchmarks de mercado.",
    requiredContext: ["ads"],
    suggestedModels: ["openai:gpt-5.5", "google:gemini-2.5-pro"],
    needsReasoning: true, needsVision: false, needsTools: true,
    estimatedInputTokens: 4_000, estimatedOutputTokens: 1_500,
  },
  {
    id: "audience_analysis",
    category: "audience",
    displayName: "Análise de Audiência",
    description: "Segmenta e caracteriza audiência com base em CRM.",
    requiredContext: ["crm"],
    suggestedModels: ["openai:gpt-5.5-mini", "google:gemini-2.5-flash"],
    needsReasoning: false, needsVision: false, needsTools: false,
    estimatedInputTokens: 3_000, estimatedOutputTokens: 1_000,
  },
];

export class SkillRegistry {
  private byId = new Map<string, SkillDescriptor>();
  constructor(seed: SkillDescriptor[] = DEFAULT_SKILLS) {
    for (const s of seed) this.register(s);
  }
  register(s: SkillDescriptor): void { this.byId.set(s.id, s); }
  get(id: string): SkillDescriptor | undefined { return this.byId.get(id); }
  list(): SkillDescriptor[] { return [...this.byId.values()]; }
  listByCategory(cat: SkillCategory): SkillDescriptor[] {
    return this.list().filter((s) => s.category === cat);
  }
}

export const skillRegistry = new SkillRegistry();
