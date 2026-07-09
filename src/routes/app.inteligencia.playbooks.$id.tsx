import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { listPlaybooks } from "@/lib/experts.functions";

export const Route = createFileRoute("/app/inteligencia/playbooks/$id")({
  component: PlaybookDetails,
});

function PlaybookDetails() {
  const { id } = Route.useParams();
  const fetchList = useServerFn(listPlaybooks);
  const { data, isLoading } = useQuery({
    queryKey: ["pbs-all"],
    queryFn: () => fetchList({ data: { limit: 200 } }),
  });
  const pb = data?.find((p) => p.playbookId === id);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!pb) return (
    <div className="p-6 space-y-3">
      <Link to="/app/inteligencia/playbooks" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </Link>
      <p className="text-sm">Playbook não encontrado.</p>
    </div>
  );

  const done = pb.checklist.filter((c) => c.done).length;
  const total = pb.checklist.length;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <Link to="/app/inteligencia/playbooks" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </Link>
      <Card>
        <CardHeader>
          <div className="flex gap-2 items-center flex-wrap">
            <Badge variant="outline">{pb.urgency}</Badge>
            <Badge variant="secondary">{pb.complexity}</Badge>
            <span className="text-xs text-muted-foreground">v{pb.version}</span>
          </div>
          <CardTitle className="text-xl">{pb.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-1">Diagnóstico</h4>
            <p className="text-sm whitespace-pre-wrap">{pb.diagnosis}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-1">Problema</h4>
            <p className="text-sm">{pb.problem}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-1">Progresso</h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{done}/{total}</span>
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-2">Tarefas</h4>
            <ol className="space-y-2">
              {pb.actionPlan.map((s, i) => (
                <li key={s.id} className="text-sm border-l-2 border-primary/40 pl-3">
                  <div className="font-medium">{i + 1}. {s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Owner: {s.ownerRole} · ~{s.estimatedMinutes}min
                    {s.dependsOn.length > 0 && ` · depende de: ${s.dependsOn.join(", ")}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground/70">
                    ✓ Sucesso: {s.successCriterion}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {pb.nextSteps.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-1">Próximos passos</h4>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                {pb.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Metric label="Custo est." value={fmt(pb.financialEstimate.costCents)} />
            <Metric label="Ganho est." value={fmt(pb.financialEstimate.savingsCents)} />
            <Metric label="Payback" value={`${pb.financialEstimate.paybackDays}d`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
