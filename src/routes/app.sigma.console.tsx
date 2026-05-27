import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listIntegrations, executeRequest } from "@/lib/sigma.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sigma/console")({
  component: ConsolePage,
});

function ConsolePage() {
  const listFn = useServerFn(listIntegrations);
  const execFn = useServerFn(executeRequest);
  const { data } = useQuery({ queryKey: ["sigma-integrations"], queryFn: () => listFn() });
  const integrations = data?.integrations ?? [];

  const [integration_id, setIntegrationId] = useState("");
  const [method, setMethod] = useState("GET");
  const [endpoint, setEndpoint] = useState("/");
  const [bodyText, setBodyText] = useState("");
  const [result, setResult] = useState<any>(null);

  const mut = useMutation({
    mutationFn: (payload: any) => execFn({ data: payload }),
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  function run() {
    if (!integration_id) { toast.error("Selecione uma integração"); return; }
    let body: any = undefined;
    if (bodyText.trim() && method !== "GET") {
      try { body = JSON.parse(bodyText); } catch { toast.error("Body inválido"); return; }
    }
    mut.mutate({ integration_id, method, endpoint, body });
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Requisição</h2>
        <Select value={integration_id} onValueChange={setIntegrationId}>
          <SelectTrigger><SelectValue placeholder="Selecione integração" /></SelectTrigger>
          <SelectContent>
            {integrations.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="/endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
        </div>
        {method !== "GET" && (
          <Textarea placeholder='Body JSON (ex: {"key": "value"})' value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={6} className="font-mono text-xs" />
        )}
        <Button onClick={run} disabled={mut.isPending} className="w-full">
          {mut.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Play size={14} className="mr-2" />}
          Executar
        </Button>
      </Card>
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Resposta</h2>
        {!result && <div className="text-sm text-muted-foreground">Sem resposta ainda.</div>}
        {result && (
          <div className="space-y-2">
            <div className="flex gap-3 text-sm">
              <span>Status: <strong className={result.status >= 200 && result.status < 300 ? "text-green-500" : "text-red-500"}>{result.status || "—"}</strong></span>
              <span className="text-muted-foreground">{result.duration_ms}ms</span>
            </div>
            {result.error && <Card className="p-2 bg-destructive/10 text-destructive text-sm">{result.error}</Card>}
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96">{JSON.stringify(result.response, null, 2)}</pre>
          </div>
        )}
      </Card>
    </div>
  );
}
