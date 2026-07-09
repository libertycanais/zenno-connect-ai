import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listEvidence } from "@/lib/experts.functions";

export const Route = createFileRoute("/app/inteligencia/evidencias")({
  component: EvidenceList,
});

function EvidenceList() {
  const fetchList = useServerFn(listEvidence);
  const { data, isLoading } = useQuery({
    queryKey: ["ev-list"],
    queryFn: () => fetchList({ data: { limit: 100 } }),
  });

  return (
    <div className="p-6 space-y-3 max-w-6xl mx-auto">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma evidência registrada.
        </CardContent></Card>
      ) : (
        data!.map((e) => (
          <Link key={e.evidenceId} to="/app/inteligencia/evidencias/$id" params={{ id: e.evidenceId }} className="block">
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{e.expertId}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {e.sources.length} fonte{e.sources.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Confiança {Math.round(e.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Registrada em {new Date(e.createdAt).toLocaleString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
