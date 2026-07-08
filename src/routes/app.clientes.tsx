import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Megaphone, Search, Users, X } from "lucide-react";
import {
  listAllAdAccounts,
  getActiveClient,
  setActiveClient,
  clearActiveClient,
  type UnifiedAccount,
} from "@/lib/clients.functions";

export const Route = createFileRoute("/app/clientes")({ component: ClientesPage });

function ClientesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAllAdAccounts);
  const getActive = useServerFn(getActiveClient);
  const setActive = useServerFn(setActiveClient);
  const clearActive = useServerFn(clearActiveClient);

  const groups = useQuery({ queryKey: ["all-ad-accounts"], queryFn: () => list() });
  const active = useQuery({ queryKey: ["active-client"], queryFn: () => getActive() });

  const pick = useMutation({
    mutationFn: (a: UnifiedAccount) =>
      setActive({ data: { platform: a.platform, accountId: a.id, label: a.name } }),
    onSuccess: () => {
      toast.success("Cliente ativo definido.");
      qc.invalidateQueries({ queryKey: ["active-client"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clear = useMutation({
    mutationFn: () => clearActive(),
    onSuccess: () => {
      toast.success("Seleção limpa.");
      qc.invalidateQueries({ queryKey: ["active-client"] });
    },
  });

  const activeId = active.data?.active?.account_id ?? null;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={22} /> Contas de clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Contas conectadas via Business Manager (Meta) e MCC (Google Ads). Defina o cliente ativo para
            filtrar campanhas, conversões e relatórios em todo o app.
          </p>
        </div>
        {active.data?.active ? (
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm flex items-center gap-3">
            <CheckCircle2 size={16} className="text-primary" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Cliente ativo</div>
              <div className="font-medium">{active.data.active.account_label ?? active.data.active.account_id}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => clear.mutate()} aria-label="Limpar seleção">
              <X size={14} />
            </Button>
          </div>
        ) : null}
      </div>

      {groups.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !groups.data?.groups?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma conta conectada ainda. Conecte um Business Manager em <strong>Meta Ads</strong> ou
            um MCC em <strong>Google Ads</strong>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.data.groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{g.label}</h2>
                <Badge variant="secondary" className="text-[10px]">
                  {g.platform === "meta" ? "Meta" : g.platform === "google" ? "Google" : "Meta + Google"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {g.accounts.length} conta{g.accounts.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {g.accounts.map((a) => {
                  const isActive = a.id === activeId;
                  return (
                    <Card
                      key={a.id}
                      className={isActive ? "border-primary/60 bg-primary/5" : ""}
                    >
                      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          {a.platform === "meta" ? (
                            <Megaphone size={14} className="text-primary" />
                          ) : (
                            <Search size={14} className="text-primary" />
                          )}
                          {a.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          {a.is_manager ? <Badge variant="outline" className="text-[10px]">Gerenciadora</Badge> : null}
                          {a.is_client_account ? <Badge className="text-[10px]">Cliente</Badge> : null}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {a.platform === "meta" ? "act_" : ""}{a.external_id}
                          {a.currency ? ` · ${a.currency}` : ""}
                          {a.status ? ` · ${a.status}` : ""}
                        </div>
                        {a.is_manager ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : isActive ? (
                          <Button size="sm" variant="secondary" disabled>
                            <CheckCircle2 size={14} className="mr-1" /> Ativo
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => pick.mutate(a)} disabled={pick.isPending}>
                            Definir como ativo
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
