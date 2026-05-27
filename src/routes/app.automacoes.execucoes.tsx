import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listRuns } from "@/lib/automations.functions";

export const Route = createFileRoute("/app/automacoes/execucoes")({
  component: RunsPage,
});

function RunsPage() {
  const fn = useServerFn(listRuns);
  const { data, isLoading } = useQuery({ queryKey: ["automation-runs"], queryFn: () => fn({ data: {} }) });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.runs.length)
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma execução ainda.</CardContent></Card>;

  return (
    <div className="space-y-2 max-w-5xl">
      {data.runs.map((r) => (
        <Card key={r.id}>
          <CardContent className="pt-4 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              <Badge variant={r.status === "success" ? "default" : r.status === "partial" ? "secondary" : "destructive"}>
                {r.status}
              </Badge>
            </div>
            {r.error && <p className="text-destructive text-xs mb-1">{r.error}</p>}
            <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto">
              {JSON.stringify(r.actions_result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
