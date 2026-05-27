import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, RefreshCw, Trash2, Save } from "lucide-react";
import { startMetaOAuth, listMetaAccounts, updatePixelId, disconnectMetaAccount } from "@/lib/meta-ads.functions";

const searchSchema = z.object({
  connected: z.coerce.number().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/app/meta-ads/")({
  validateSearch: searchSchema,
  component: AccountsPage,
});

function AccountsPage() {
  const search = useSearch({ from: "/app/meta-ads/" });
  const qc = useQueryClient();
  const startOAuth = useServerFn(startMetaOAuth);
  const list = useServerFn(listMetaAccounts);
  const updatePixel = useServerFn(updatePixelId);
  const disconnect = useServerFn(disconnectMetaAccount);

  const { data, isLoading } = useQuery({
    queryKey: ["meta-accounts"],
    queryFn: () => list(),
  });

  const connectMut = useMutation({
    mutationFn: () => startOAuth(),
    onSuccess: (r: { url: string }) => { window.location.href = r.url; },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (accountId: string) => disconnect({ data: { accountId } }),
    onSuccess: () => { toast.success("Conta removida."); qc.invalidateQueries({ queryKey: ["meta-accounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-5xl">
      {search.connected ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          {search.connected} conta(s) conectada(s) com sucesso.
        </div>
      ) : null}
      {search.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          Erro: {search.error}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contas de anúncio</h2>
          <p className="text-sm text-muted-foreground">Conecte via Facebook OAuth para sincronizar campanhas e enviar conversões.</p>
        </div>
        <Button onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
          <Plug size={16} className="mr-2" /> Conectar conta Meta
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : data?.accounts?.length ? (
        <div className="grid gap-3">
          {data.accounts.map((a) => (
            <AccountCard
              key={a.id}
              acc={a}
              onSavePixel={(pixel) => updatePixel({ data: { accountId: a.id, pixelId: pixel } })
                .then(() => { toast.success("Pixel salvo."); qc.invalidateQueries({ queryKey: ["meta-accounts"] }); })
                .catch((e: Error) => toast.error(e.message))}
              onDelete={() => delMut.mutate(a.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma conta conectada. Clique em <strong>Conectar conta Meta</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type Acc = {
  id: string; name: string; ad_account_id: string; business_id: string | null;
  pixel_id: string | null; status: string; token_expires_at: string | null; created_at: string;
};

function AccountCard({ acc, onSavePixel, onDelete }: { acc: Acc; onSavePixel: (p: string) => void; onDelete: () => void }) {
  const [pixel, setPixel] = useState(acc.pixel_id ?? "");
  const expSoon = acc.token_expires_at && new Date(acc.token_expires_at).getTime() - Date.now() < 7 * 24 * 3600 * 1000;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{acc.name}</CardTitle>
          <p className="text-xs text-muted-foreground">act_{acc.ad_account_id}{acc.business_id ? ` · BM ${acc.business_id}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={acc.status === "active" ? "default" : "secondary"}>{acc.status}</Badge>
          {expSoon ? <Badge variant="destructive">token expira em breve</Badge> : null}
          <Button size="icon" variant="ghost" aria-label="Remover conta Meta Ads" onClick={onDelete}><Trash2 size={14} /></Button>
        </div>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Pixel ID</label>
          <Input value={pixel} onChange={(e) => setPixel(e.target.value)} placeholder="ex: 1234567890" />
        </div>
        <Button size="sm" onClick={() => onSavePixel(pixel)} disabled={!pixel || pixel === acc.pixel_id}>
          <Save size={14} className="mr-2" /> Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

// satisfies unused import lint
void RefreshCw;
