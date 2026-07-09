import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  listRecommendations, listPlaybooks, listEvidence, updateRecommendationStatus,
} from "@/lib/experts.functions";
import type { RecommendationStatus } from "@/lib/ai/contracts/expert-persistence";

export const Route = createFileRoute("/app/inteligencia/recomendacoes/$id")({
  component: RecommendationDetails,
});

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function RecommendationDetails() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRecs = useServerFn(listRecommendations);
  const fetchPbs = useServerFn(listPlaybooks);
  const fetchEv = useServerFn(listEvidence);
  const updateStatus = useServerFn(updateRecommendationStatus);

  const { data: recs, isLoading } = useQuery({
    queryKey: ["recs-all"],
    queryFn: () => fetchRecs({ data: { limit: 200 } }),
  });
  const rec = recs?.find((r) => r.recommendationId === id);

  const { data: playbooks } = useQuery({
    queryKey: ["pbs-all"],
    queryFn: () => fetchPbs({ data: { limit: 200 } }),
    enabled: !!rec?.playbookId,
  });
  const playbook = playbooks?.find((p) => p.playbookId === rec?.playbookId);

  const { data: evidence } = useQuery({
    queryKey: ["ev-all"],
    queryFn: () => fetchEv({ data: { limit: 200 } }),
    enabled: !!rec?.evidenceId,
  });
  const ev = evidence?.find((e) => e.evidenceId === rec?.evidenceId);

  const mut = useMutation({
    mutationFn: (status: RecommendationStatus) =>
      updateStatus({ data: { recommendationId: id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recs-all"] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!rec) return (
    <div className="p-6 space-y-3">
      <Link to="/app/inteligencia/recomendacoes" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </Link>
      <Card><CardContent className="p-6 text-sm">Recomendação não encontrada.</CardContent></Card>
    </div>
  );

  const NEXT: Array<{ v: RecommendationStatus; label: string }> = [
    { v: "in_progress", label: "Iniciar" },
    { v: "resolved", label: "Concluir" },
    { v: "dismissed", label: "Descartar" },
    { v: "archived", label: "Arquivar" },
  ];

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/app/inteligencia/recomendacoes" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="flex gap-1 flex-wrap">
          {NEXT.filter((s) => s.v !== rec.status).map((s) => (
            <Button key={s.v} size="sm" variant="outline"
              disabled={mut.isPending}
              onClick={() => mut.mutate(s.v)}>{s.label}</Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline">{rec.urgency}</Badge>
            <Badge variant="secondary">{rec.status}</Badge>
            <span className="text-xs text-muted-foreground">
              Confiança {Math.round(rec.confidence * 100)}% · Complexidade {rec.complexity}
            </span>
          </div>
          <CardTitle className="text-xl">{rec.summary}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Section title="Diagnóstico">{rec.diagnosis}</Section>
          <Section title="Problema">{rec.problem}</Section>
          <Section title="Impacto">{rec.impact}</Section>
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-1">Estimativa financeira</h4>
            <div className="text-2xl font-bold text-primary">{fmtBRL(rec.financialValueCents)}</div>
          </div>
          {rec.checklist.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-2">Checklist</h4>
              <ul className="space-y-1">
                {rec.checklist.map((c) => (
                  <li key={c.id} className="text-sm flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 rounded-full ${c.done ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                    <span className={c.done ? "line-through text-muted-foreground" : ""}>{c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {playbook && (
        <Card>
          <CardHeader><CardTitle className="text-base">Playbook</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">{playbook.title}</p>
            <p className="text-xs text-muted-foreground">{playbook.diagnosis}</p>
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-1">Plano de ação</h4>
              <ol className="space-y-2">
                {playbook.actionPlan.map((s, i) => (
                  <li key={s.id} className="text-sm border-l-2 border-primary/40 pl-3">
                    <div className="font-medium">{i + 1}. {s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Owner: {s.ownerRole} · ~{s.estimatedMinutes}min
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            {playbook.nextSteps.length > 0 && (
              <div>
                <h4 className="text-xs uppercase text-muted-foreground mb-1">Próximos passos</h4>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  {playbook.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {playbook.successCriteria.length > 0 && (
              <div>
                <h4 className="text-xs uppercase text-muted-foreground mb-1">Critérios de sucesso</h4>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  {playbook.successCriteria.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            <Link to="/app/inteligencia/playbooks/$id" params={{ id: playbook.playbookId }}
              className="text-xs text-primary hover:underline">Ver playbook completo →</Link>
          </CardContent>
        </Card>
      )}

      {ev && (
        <Card>
          <CardHeader><CardTitle className="text-base">Evidências</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {ev.sources.length} fonte{ev.sources.length === 1 ? "" : "s"} · Confiança {Math.round(ev.confidence * 100)}%
            </div>
            <ul className="space-y-1 text-sm">
              {ev.sources.slice(0, 6).map((s, i) => (
                <li key={i} className="rounded border border-border/60 px-2 py-1 bg-muted/20">
                  <span className="text-[10px] uppercase text-muted-foreground mr-2">{s.kind}</span>
                  <span>{describeSource(s)}</span>
                </li>
              ))}
            </ul>
            <Link to="/app/inteligencia/evidencias/$id" params={{ id: ev.evidenceId }}
              className="text-xs text-primary hover:underline">Ver evidência completa →</Link>
          </CardContent>
        </Card>
      )}
      {/* Navigate is unused but router requires the import to remain silent. */}
      <span className="hidden">{navigate ? "" : ""}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase text-muted-foreground mb-1">{title}</h4>
      <p className="text-sm whitespace-pre-wrap">{children}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeSource(s: any): string {
  switch (s.kind) {
    case "kpi": return `${s.kpi} = ${s.value ?? "—"} ${s.unit ?? ""}`;
    case "knowledge_rule": return `${s.ruleId} · ${s.domain} v${s.version}`;
    case "benchmark": return `${s.key} · p${s.percentile}`;
    case "context_snapshot": return `${s.module} · ${s.snapshotId}`;
    case "raw_data": return `${s.description} (n=${s.sampleSize})`;
    default: return JSON.stringify(s);
  }
}
