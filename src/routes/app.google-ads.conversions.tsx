import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";
import { listGoogleAdAccounts, uploadOfflineConversion, listGoogleAdsConversions } from "@/lib/google-ads.functions";

export const Route = createFileRoute("/app/google-ads/conversions")({ component: GAdsConvPage });

function GAdsConvPage() {
  const qc = useQueryClient();
  const listAccs = useServerFn(listGoogleAdAccounts);
  const upload = useServerFn(uploadOfflineConversion);
  const listC = useServerFn(listGoogleAdsConversions);

  const accs = useQuery({ queryKey: ["google-accounts"], queryFn: () => listAccs() });
  const events = useQuery({ queryKey: ["gads-conv"], queryFn: () => listC() });

  const [acc, setAcc] = useState("");
  const [action, setAction] = useState("");
  const [gclid, setGclid] = useState("");
  const [dt, setDt] = useState(() => new Date().toISOString().slice(0, 16));
  const [value, setValue] = useState("");
  const [orderId, setOrderId] = useState("");

  const accId = acc || accs.data?.accounts?.[0]?.id || "";

  const mut = useMutation({
    mutationFn: () => upload({
      data: {
        accountId: accId,
        conversionAction: action,
        gclid,
        conversionDateTime: new Date(dt).toISOString().replace("T", " ").replace("Z", "+00:00"),
        value: value ? Number(value) : undefined,
        currency: value ? "BRL" : undefined,
        orderId: orderId || undefined,
      },
    }),
    onSuccess: () => { toast.success("Conversão enviada."); qc.invalidateQueries({ queryKey: ["gads-conv"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Upload conversão offline</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Conta</label>
            <Select value={accId} onValueChange={setAcc}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{accs.data?.accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Conversion Action (resource name)</label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="customers/123/conversionActions/456" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">GCLID</label>
            <Input value={gclid} onChange={(e) => setGclid(e.target.value)} placeholder="CjwKCAjw..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Data/Hora</label>
              <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Valor (BRL)</label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Order ID (opcional)</label>
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          </div>
          <Button onClick={() => mut.mutate()} disabled={!accId || !action || !gclid || mut.isPending} className="w-full">
            <Send size={14} className="mr-2" /> Enviar conversão
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas conversões</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-auto">
          {events.data?.conversions?.length ? events.data.conversions.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
              <div>
                <div className="font-medium">{e.conversion_action.split("/").pop()}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.conversion_date_time).toLocaleString("pt-BR")}
                  {e.conversion_value ? ` · ${e.currency ?? ""} ${e.conversion_value}` : ""}
                </div>
              </div>
              <Badge variant={e.status === "sent" ? "default" : e.status === "error" ? "destructive" : "secondary"}>{e.status}</Badge>
            </div>
          )) : <p className="text-sm text-muted-foreground">Nenhuma conversão enviada.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
