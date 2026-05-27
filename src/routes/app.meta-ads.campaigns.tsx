import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { listMetaAccounts, listMetaCampaigns, syncMetaCampaigns } from "@/lib/meta-ads.functions";

export const Route = createFileRoute("/app/meta-ads/campaigns")({ component: CampaignsPage });

function CampaignsPage() {
  const qc = useQueryClient();
  const listAccs = useServerFn(listMetaAccounts);
  const listC = useServerFn(listMetaCampaigns);
  const syncC = useServerFn(syncMetaCampaigns);

  const accs = useQuery({ queryKey: ["meta-accounts"], queryFn: () => listAccs() });
  const [selected, setSelected] = useState<string>("");
  const accountId = selected || accs.data?.accounts?.[0]?.id || "";

  const campaigns = useQuery({
    queryKey: ["meta-campaigns", accountId],
    queryFn: () => listC({ data: { accountId } }),
    enabled: !!accountId,
  });

  const sync = useMutation({
    mutationFn: () => syncC({ data: { accountId } }),
    onSuccess: (r: { synced: number }) => {
      toast.success(`${r.synced} campanha(s) sincronizada(s).`);
      qc.invalidateQueries({ queryKey: ["meta-campaigns", accountId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!accs.data?.accounts?.length) {
    return <p className="text-sm text-muted-foreground">Conecte uma conta primeiro na aba Contas.</p>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-2">
        <Select value={accountId} onValueChange={setSelected}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
          <SelectContent>
            {accs.data.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => sync.mutate()} disabled={!accountId || sync.isPending}>
          <RefreshCw size={14} className="mr-2" /> Sincronizar
        </Button>
      </div>

      {campaigns.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : campaigns.data?.campaigns?.length ? (
        <div className="grid gap-2">
          {campaigns.data.campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.objective ?? "—"} · {c.daily_budget ? `R$ ${c.daily_budget}/dia` : c.lifetime_budget ? `R$ ${c.lifetime_budget} total` : "sem budget"}
                  </div>
                </div>
                <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status ?? "—"}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma campanha. Clique em Sincronizar.</p>
      )}
    </div>
  );
}
