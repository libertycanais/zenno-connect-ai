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
import { listGoogleAdAccounts, listGoogleAdsCampaigns, syncGoogleAdsCampaigns } from "@/lib/google-ads.functions";

export const Route = createFileRoute("/app/google-ads/campaigns")({ component: GAdsCampaignsPage });

function GAdsCampaignsPage() {
  const qc = useQueryClient();
  const listAccs = useServerFn(listGoogleAdAccounts);
  const listC = useServerFn(listGoogleAdsCampaigns);
  const syncC = useServerFn(syncGoogleAdsCampaigns);

  const accs = useQuery({ queryKey: ["google-accounts"], queryFn: () => listAccs() });
  const [sel, setSel] = useState<string>("");
  const accountId = sel || accs.data?.accounts?.[0]?.id || "";
  const camps = useQuery({
    queryKey: ["gads-campaigns", accountId],
    queryFn: () => listC({ data: { accountId } }),
    enabled: !!accountId,
  });
  const sync = useMutation({
    mutationFn: () => syncC({ data: { accountId } }),
    onSuccess: (r: { synced: number }) => { toast.success(`${r.synced} sincronizadas.`); qc.invalidateQueries({ queryKey: ["gads-campaigns", accountId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!accs.data?.accounts?.length) return <p className="text-sm text-muted-foreground">Conecte uma conta primeiro.</p>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-2">
        <Select value={accountId} onValueChange={setSel}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{accs.data.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => sync.mutate()} disabled={!accountId || sync.isPending}>
          <RefreshCw size={14} className="mr-2" /> Sincronizar
        </Button>
      </div>
      {camps.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : camps.data?.campaigns?.length ? (
        <div className="grid gap-2">
          {camps.data.campaigns.map((c) => (
            <Card key={c.id}><CardContent className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.channel_type ?? "—"} · {c.start_date ?? "—"}</div>
              </div>
              <Badge variant={c.status === "ENABLED" ? "default" : "secondary"}>{c.status ?? "—"}</Badge>
            </CardContent></Card>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Nenhuma campanha. Clique em Sincronizar.</p>}
    </div>
  );
}
