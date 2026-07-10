// EPIC I — Executive Advisor: convenience façade answering executive questions.
import type { ExecutiveReport } from "./types";

export type AdvisorAnswer = {
  question: string;
  answer: string;
  refs: string[];
};

export const ExecutiveAdvisor = {
  whatHappened(r: ExecutiveReport): AdvisorAnswer {
    return { question: "O que aconteceu?", answer: r.situation, refs: r.criticalKpis.map((k) => k.kpi) };
  },
  whyItHappened(r: ExecutiveReport): AdvisorAnswer {
    const causes = r.risks.map((x) => x.title).slice(0, 3).join("; ") || "Sem causas claras detectadas.";
    return { question: "Por que aconteceu?", answer: causes, refs: r.risks.map((x) => x.id) };
  },
  whatToDo(r: ExecutiveReport): AdvisorAnswer {
    const actions = r.nextActions.map((a) => a.title).join("; ") || "Nenhuma ação prioritária.";
    return { question: "O que devo fazer?", answer: actions, refs: r.nextActions.map((a) => a.id) };
  },
  howMuchMoney(r: ExecutiveReport): AdvisorAnswer {
    return { question: "Quanto dinheiro isso impacta?", answer: `Impacto líquido estimado: ${r.financialImpactCents} centavos`, refs: [] };
  },
  priority(r: ExecutiveReport): AdvisorAnswer {
    const top = r.priorities[0];
    return { question: "Qual a prioridade?", answer: top ? `P${top.priority}: ${top.title}` : "Sem prioridades ativas.", refs: top ? [top.id] : [] };
  },
  risks(r: ExecutiveReport): AdvisorAnswer {
    return { question: "Quais riscos existem?", answer: r.risks.map((x) => x.title).join("; ") || "Nenhum risco ativo.", refs: r.risks.map((x) => x.id) };
  },
  whatIfDoNothing(r: ExecutiveReport): AdvisorAnswer {
    const exposure = r.risks.reduce((s, x) => s + Math.abs(x.impactCents), 0);
    return { question: "O que acontecerá se eu não agir?", answer: `Exposição potencial de ${exposure} centavos em risco não mitigado.`, refs: r.risks.map((x) => x.id) };
  },
  all(r: ExecutiveReport): AdvisorAnswer[] {
    return [
      this.whatHappened(r), this.whyItHappened(r), this.whatToDo(r),
      this.howMuchMoney(r), this.priority(r), this.risks(r), this.whatIfDoNothing(r),
    ];
  },
};
