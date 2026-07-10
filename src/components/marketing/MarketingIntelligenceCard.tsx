// FEATURE — Marketing Intelligence Experience · Command Center card
// Invisible UI. Tipografia como interface. Sem gráficos.
// First Five Minutes: score sempre explicado, AI Confidence como 4º indicador,
// Decision Trace acessível, notificação de briefing (nunca abre Copilot sozinho),
// selo "Powered by Zenno Intelligence".
import { useState } from "react";
import type { MarketingIntelligenceSnapshot } from "@/lib/marketing/intelligence";
import type { BriefingNotification } from "@/lib/marketing/intelligence";
import type { TTFIRun } from "@/lib/marketing/intelligence";
import { formatTTFI } from "@/lib/marketing/intelligence";
import { PoweredByZennoBadge } from "./PoweredByZennoBadge";
import { DecisionTraceButton } from "./DecisionTraceButton";
import { Sparkles } from "lucide-react";

type Props = {
  snapshot: MarketingIntelligenceSnapshot | null;
  briefing?: BriefingNotification | null;
  ttfi?: TTFIRun | null;
  onOpenBriefing?: (id: string) => void;
  onDismissBriefing?: (id: string) => void;
};

function fmtDelta(d: number): string {
  if (!d) return "estável esta semana";
  const sign = d > 0 ? "↑" : "↓";
  return `${sign} ${Math.abs(d).toFixed(1)} esta semana`;
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "há instantes";
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return d.toLocaleDateString("pt-BR");
}

export function MarketingIntelligenceCard({
  snapshot, briefing, ttfi, onOpenBriefing, onDismissBriefing,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const showBriefing = briefing && briefing.status === "pending" && !dismissed;

  if (!snapshot) {
    return (
      <article>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80 mb-3">
          Marketing Intelligence
        </div>
        <div className="text-5xl font-medium tabular-nums text-muted-foreground/60 leading-none">—</div>
        <p className="mt-4 text-[13px] text-muted-foreground leading-relaxed">
          Aguardando primeira sincronização.
        </p>
        <div className="mt-6"><PoweredByZennoBadge /></div>
      </article>
    );
  }

  return (
    <article>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
          Marketing Intelligence
        </div>
        {ttfi?.durationMs != null && (
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            TTFI · {formatTTFI(ttfi.durationMs)}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-3">
        <div className="text-5xl font-medium tabular-nums text-foreground leading-none">
          {snapshot.score.score}
        </div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
          {snapshot.score.grade} Grade
        </div>
      </div>

      {/* A IA sempre explica — nunca apenas mostra nota. */}
      <p className="mt-3 text-[13px] text-foreground/90 leading-snug">
        {snapshot.explanation.headline}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
        {snapshot.explanation.detail}
      </p>

      {/* Quarto indicador: AI Confidence. */}
      <div className="mt-5 pt-4 border-t border-border/40">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
            AI Confidence
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-medium tabular-nums text-foreground">
              {snapshot.confidence.score}%
            </span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
              {snapshot.confidence.level}
            </span>
          </div>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
          {snapshot.confidence.rationale}
        </p>
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground/80">
        {snapshot.opportunitiesCount} oportunidade{snapshot.opportunitiesCount === 1 ? "" : "s"} · {snapshot.risksCount} risco{snapshot.risksCount === 1 ? "" : "s"} · {fmtDelta(snapshot.weeklyDelta)}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground/60">
        Última análise · {fmtTime(snapshot.lastAnalysisAt)}
      </p>

      <div className="mt-4">
        <DecisionTraceButton
          score={snapshot.score}
          confidence={snapshot.confidence}
          reasons={snapshot.explanation.reasons}
        />
      </div>

      {/* Briefing como notificação discreta — Copilot nunca abre sozinho. */}
      {showBriefing && (
        <div className="mt-5 rounded-md border border-border/50 bg-card/60 p-3">
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 text-foreground/70" />
            <div className="flex-1">
              <p className="text-[12px] text-foreground/90">A IA preparou um briefing.</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                {briefing.briefing.body}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenBriefing?.(briefing.id)}
                  className="text-[12px] text-foreground hover:opacity-80 transition"
                >
                  Ver agora
                </button>
                <button
                  type="button"
                  onClick={() => { setDismissed(true); onDismissBriefing?.(briefing.id); }}
                  className="text-[12px] text-muted-foreground hover:text-foreground transition"
                >
                  Ignorar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5"><PoweredByZennoBadge /></div>
    </article>
  );
}
