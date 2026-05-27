import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, Trash2 } from "lucide-react";
import { startGoogleAdsOAuth, listGoogleAdAccounts, disconnectGoogleAccount } from "@/lib/google-ads.functions";

export const Route = createFileRoute("/app/google-ads/")({
  validateSearch: z.object({ connected: z.coerce.number().optional(), error: z.string().optional() }),
  component: GoogleAdsAccountsPage,
});

function GoogleAdsAccountsPage() {
  const search = useSearch({ from: "/app/google-ads/" });
  const qc = useQueryClient();
  const start = useServerFn(startGoogleAdsOAuth);
  const list = useServerFn(listGoogleAdAccounts);
  const disconnect = useServerFn(disconnectGoogleAccount);

  const { data, isLoading } = useQuery({ queryKey: ["google-accounts"], queryFn: () => list() });

  const conn = useMutation({
    mutationFn: () => start(),
    onSuccess: (r: { url: string }) => { window.location.href = r.url; },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => disconnect({ data: { accountId: id } }),
    onSuccess: () => { toast.success("Conta removida."); qc.invalidateQueries({ queryKey: ["google-accounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-5xl">
      {search.connected ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          {search.connected} conta(s) conectada(s).
        </div>
      ) : null}
      {search.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          Erro: {search.error}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contas Google Ads</h2>
          <p className="text-sm text-muted-foreground">Acesso via OAuth com refresh token automático.</p>
        </div>
        <Button onClick={() => conn.mutate()} disabled={conn.isPending}>
          <Plug size={16} className="mr-2" /> Conectar Google Ads
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : data?.accounts?.length ? (
        <div className="grid gap-3">
          {data.accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Customer {a.customer_id}{a.manager_customer_id ? ` · MCC ${a.manager_customer_id}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(a.id)}><Trash2 size={14} /></Button>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {a.currency ?? "—"} · {a.timezone ?? "—"} · token expira {a.token_expires_at ? new Date(a.token_expires_at).toLocaleString("pt-BR") : "—"}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma conta. Clique em <strong>Conectar Google Ads</strong>.
        </CardContent></Card>
      )}
    </div>
  );
}
