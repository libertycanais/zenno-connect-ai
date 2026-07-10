import type { BusinessSignal } from "../signals/types";
import type { InsightRule } from "./types";

const has = (signals: BusinessSignal[], type: string) => signals.some(s => s.type === type);

export const builtInInsightRules: InsightRule[] = [
  {
    id: "insight.creative-fatigue",
    matches(signals) { return has(signals, "ROASDrop") && has(signals, "CTRDrop") && has(signals, "CPAIncrease"); },
    build(signals) {
      const ids = signals.filter(s => ["ROASDrop", "CTRDrop", "CPAIncrease"].includes(s.type)).map(s => s.id);
      const orgId = signals[0].organizationId;
      return {
        organizationId: orgId,
        title: "Provável fadiga criativa",
        narrative: "ROAS caiu, CTR caiu e CPA aumentou no mesmo período. A causa mais provável é fadiga criativa.",
        causalChain: ["ROASDrop", "CTRDrop", "CPAIncrease"],
        signalIds: ids, confidence: 0.78, priority: 2,
        playbook: {
          summary: "Rotacionar criativos e refrescar públicos com fadiga.",
          diagnosis: "Queda de ROAS acompanhada de queda de CTR e aumento de CPA indica desgaste da mensagem publicitária.",
          impact: "Contenção de perda de eficiência de mídia e recuperação de ROAS.",
          priority: 2,
          checklist: [
            { id: "c1", label: "Pausar criativos com CTR abaixo do benchmark", done: false },
            { id: "c2", label: "Subir 3 novos criativos em variação de mensagem", done: false },
            { id: "c3", label: "Trocar público quente por lookalike novo", done: false },
          ],
          actionPlan: [
            "Auditar top 20 anúncios por CTR e frequência",
            "Gerar 3 variações criativas com ângulos diferentes",
            "Publicar em novo ad set com 20% do orçamento",
            "Reavaliar em 72h",
          ],
          experts: ["marketing", "cro"],
          successCriteria: ["ROAS recupera 80% do baseline em 7 dias", "CPA volta a ≤ baseline*1.1"],
        },
      };
    },
  },
  {
    id: "insight.revenue-risk",
    matches(signals) { return has(signals, "MRRDrop") && has(signals, "ChurnIncrease"); },
    build(signals) {
      const ids = signals.filter(s => ["MRRDrop", "ChurnIncrease"].includes(s.type)).map(s => s.id);
      return {
        organizationId: signals[0].organizationId,
        title: "Risco de receita recorrente",
        narrative: "MRR caiu e o churn subiu simultaneamente — a base recorrente está sob pressão.",
        causalChain: ["ChurnIncrease", "MRRDrop"],
        signalIds: ids, confidence: 0.82, priority: 1,
        playbook: {
          summary: "Ativar retenção e reengajamento imediato.",
          diagnosis: "A combinação churn↑ + MRR↓ indica perda de valor recorrente maior que expansão.",
          impact: "Perda material de receita mensal recorrente.",
          priority: 1,
          checklist: [
            { id: "c1", label: "Segmentar contas em risco (uso, NPS)", done: false },
            { id: "c2", label: "Contato proativo dos CS", done: false },
            { id: "c3", label: "Oferta de retenção", done: false },
          ],
          actionPlan: [
            "Rodar Customer Success Expert",
            "Priorizar top 10% ARR em risco",
            "Playbook de winback em 48h",
          ],
          experts: ["customer-success", "sales", "executive"],
          successCriteria: ["Churn retorna ao baseline em 30 dias", "MRR estabiliza em 14 dias"],
        },
      };
    },
  },
];
