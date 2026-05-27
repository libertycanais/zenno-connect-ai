import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listRequests, listIntegrations } from "@/lib/sigma.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export const Route = createFileRoute("/app/sigma/logs")({
  component: LogsPage,
});

function LogsPage() {
  const listFn = useServerFn(listRequests);
  const intgFn = useServerFn(listIntegrations);
  const { data } = useQuery({ queryKey: ["sigma-requests"], queryFn: () => listFn({ data: {} }) });
  const { data: intgs } = useQuery({ queryKey: ["sigma-integrations"], queryFn: () => intgFn() });
  const [expanded, setExpanded] = useState<string | null>(null);
  const intMap = Object.fromEntries((intgs?.integrations ?? []).map((i: any) => [i.id, i.name]));
  const rows = data?.requests ?? [];

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Histórico de requisições</h2>
      {rows.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma requisição ainda.</Card>}
      {rows.map((r: any) => {
        const ok = r.response_status && r.response_status >= 200 && r.response_status < 300;
        return (
          <Card key={r.id} className="p-3">
            <button className="w-full text-left flex items-center gap-3" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
              <Badge variant="outline">{r.method}</Badge>
              <span className="text-sm font-mono truncate flex-1">{intMap[r.integration_id] ?? "?"} {r.endpoint}</span>
              <Badge className={ok ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}>
                {r.response_status ?? "ERR"}
              </Badge>
              <span className="text-xs text-muted-foreground">{r.duration_ms}ms</span>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
            </button>
            {expanded === r.id && (
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Request</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">{JSON.stringify(r.request_body, null, 2)}</pre>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Response</div>
                  {r.error && <div className="text-xs text-destructive mb-1">{r.error}</div>}
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">{JSON.stringify(r.response_body, null, 2)}</pre>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
