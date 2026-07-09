import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { listEvidence } from "@/lib/experts.functions";

export const Route = createFileRoute("/app/inteligencia/evidencias/$id")({
  component: EvidenceDetails,
});

function EvidenceDetails() {
  const { id } = Route.useParams();
  const fetchList = useServerFn(listEvidence);
  const { data, isLoading } = useQuery({
    queryKey: ["ev-all"],
    queryFn: () => fetchList({ data: { limit: 200 } }),
  });
  const ev = data?.find((e) => e.evidenceId === id);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!ev) return (
    <div className="p-6 space-y-3">
      <Link to="/app/inteligencia/evidencias" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </Link>
      <p className="text-sm">Evidência não encontrada.</p>
    </div>
  );

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <Link to="/app/inteligencia/evidencias" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </Link>
      <Card>
        <CardHeader>
          <div className="flex gap-2 items-center flex-wrap">
            <Badge variant="outline">{ev.expertId}</Badge>
            <span className="text-xs text-muted-foreground">
              Confiança {Math.round(ev.confidence * 100)}%
            </span>
          </div>
          <CardTitle className="text-lg">Evidência {ev.evidenceId}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-2">Fontes ({ev.sources.length})</h4>
            <ul className="space-y-1">
              {ev.sources.map((s, i) => (
                <li key={i} className="text-sm rounded border border-border/60 p-2 bg-muted/20">
                  <div className="text-[10px] uppercase text-muted-foreground mb-0.5">{s.kind}</div>
                  <div>{describe(s)}</div>
                </li>
              ))}
            </ul>
          </div>
          {ev.missing.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-1">Dados ausentes</h4>
              <ul className="space-y-1 text-sm">
                {ev.missing.map((m, i) => (
                  <li key={i} className="rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1">
                    <span className="font-mono text-[11px] text-amber-400 mr-2">{m.code}</span>
                    {m.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Snapshot bruto</summary>
            <pre className="mt-2 p-2 rounded bg-muted/40 overflow-auto text-[11px]">
              {JSON.stringify(ev, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describe(s: any): string {
  switch (s.kind) {
    case "kpi": return `${s.kpi} = ${s.value ?? "—"} ${s.unit ?? ""} · ${s.formula ?? ""}`;
    case "knowledge_rule": return `${s.ruleId} · domínio ${s.domain} · v${s.version}`;
    case "benchmark": return `${s.key} · percentil ${s.percentile}`;
    case "context_snapshot": return `${s.module} · snapshot ${s.snapshotId}`;
    case "raw_data": return `${s.description} (n=${s.sampleSize})`;
    default: return JSON.stringify(s);
  }
}
