// FEATURE — First Five Minutes · "Ver como chegamos a essa conclusão"
// Reuses the Decision Trace / Explainability infra already built. Additive.
import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import type { IntelligenceScoreResult } from "@/lib/marketing/intelligence";
import type { AIConfidenceResult } from "@/lib/marketing/intelligence/confidence/ai-confidence";

type Props = {
  score: IntelligenceScoreResult;
  confidence: AIConfidenceResult;
  reasons: string[];
};

function label(dim: string): string {
  switch (dim) {
    case "health": return "Saúde geral";
    case "readiness": return "Prontidão para IA";
    case "recommendations": return "Riscos ativos";
    case "tracking": return "Rastreamento";
    case "budget": return "Orçamento";
    case "conversion": return "Conversão";
    default: return dim;
  }
}

export function DecisionTraceButton({ score, confidence, reasons }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition"
      >
        Ver como chegamos a essa conclusão
        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Decision Trace"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-4 rounded-lg border border-border/60 bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                  Decision Trace
                </div>
                <h3 className="mt-1 text-lg font-medium text-foreground">
                  Como calculamos {score.score}/100
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-[13px] text-muted-foreground mb-4">
              O Executive Score é uma composição ponderada. Estes são os componentes com maior peso na nota atual:
            </p>

            <ul className="space-y-2 mb-5">
              {Object.entries(score.breakdown).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{label(k)}</span>
                  <span className="tabular-nums text-foreground">{Math.round(v)}/100</span>
                </li>
              ))}
            </ul>

            {reasons.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80 mb-2">
                  Pontos com maior impacto
                </div>
                <ul className="text-[13px] text-muted-foreground list-disc pl-4 mb-5 space-y-1">
                  {reasons.map((r) => (<li key={r}>{r}</li>))}
                </ul>
              </>
            )}

            <div className="pt-4 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80 mb-2">
                AI Confidence · {confidence.level}
              </div>
              <p className="text-[13px] text-muted-foreground">{confidence.rationale}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
