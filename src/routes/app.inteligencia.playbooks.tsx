import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPlaybooks } from "@/lib/experts.functions";

export const Route = createFileRoute("/app/inteligencia/playbooks")({
  component: PlaybooksList,
});

function PlaybooksList() {
  const fetchList = useServerFn(listPlaybooks);
  const { data, isLoading } = useQuery({
    queryKey: ["pbs-list"],
    queryFn: () => fetchList({ data: { limit: 100 } }),
  });

  return (
    <div className="p-6 space-y-3 max-w-6xl mx-auto">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum playbook gerado ainda.
        </CardContent></Card>
      ) : (
        data!.map((p) => {
          const total = p.checklist.length;
          const done = p.checklist.filter((c) => c.done).length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <Link key={p.playbookId} to="/app/inteligencia/playbooks/$id" params={{ id: p.playbookId }} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">{p.title}</h3>
                    <Badge variant="outline">{p.urgency}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.diagnosis}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{done}/{total}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}
