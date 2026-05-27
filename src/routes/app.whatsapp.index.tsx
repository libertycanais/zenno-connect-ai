import { createFileRoute } from "@tanstack/react-router";
import { useInstances, useConnectInstance, useRefreshInstance, useDisconnectInstance, useDeleteInstance } from "@/modules/whatsapp/hooks";
import { NewInstanceDialog } from "@/modules/whatsapp/NewInstanceDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, RefreshCw, Power, Trash2, Copy } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getInstanceWebhookSecret } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/app/whatsapp/")({
  component: InstancesPage,
});

const statusColor: Record<string, string> = {
  connected: "bg-green-500/15 text-green-400 border-green-500/30",
  connecting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  disconnected: "bg-muted text-muted-foreground",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
};

function InstancesPage() {
  const { data: instances = [], isLoading } = useInstances();
  const connect = useConnectInstance();
  const refresh = useRefreshInstance();
  const disconnect = useDisconnectInstance();
  const del = useDeleteInstance();
  const fetchSecret = useServerFn(getInstanceWebhookSecret);

  async function copyWebhook(id: string) {
    try {
      const { secret } = await fetchSecret({ data: { instanceId: id } });
      const origin = window.location.origin;
      const url = `${origin}/api/public/whatsapp/webhook/${id}`;
      await navigator.clipboard.writeText(`${url}\nHeader: x-webhook-secret: ${secret}`);
      toast.success("URL e segredo do webhook copiados");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao obter segredo");
    }
  }


  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Instâncias conectadas</h2>
        <NewInstanceDialog />
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
      {!isLoading && instances.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma instância. Crie a primeira para começar.</CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {instances.map((i) => (
          <Card key={i.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{i.name}</CardTitle>
              <Badge variant="outline" className={statusColor[i.status]}>{i.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">{i.base_url}</div>
              {i.phone_number && <div className="text-sm">📱 {i.phone_number}</div>}
              {i.qr_code && (
                <div className="bg-white p-3 rounded-md inline-block">
                  {i.qr_code.startsWith("data:") ? (
                    <img src={i.qr_code} alt={`QR Code de conexão WhatsApp da instância ${i.name}`} width={180} height={180} />
                  ) : (
                    <pre className="text-[6px] leading-[6px]">{i.qr_code}</pre>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => connect.mutate(i.id)} disabled={connect.isPending}>
                  <QrCode size={14} className="mr-1" /> Conectar / QR
                </Button>
                <Button size="sm" variant="ghost" onClick={() => refresh.mutate(i.id)} disabled={refresh.isPending}>
                  <RefreshCw size={14} className="mr-1" /> Atualizar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(i.id)} disabled={disconnect.isPending}>
                  <Power size={14} className="mr-1" /> Desconectar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copyWebhook(i.id)}>
                  <Copy size={14} className="mr-1" /> Webhook
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => { if (confirm("Excluir instância?")) del.mutate(i.id); }}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
