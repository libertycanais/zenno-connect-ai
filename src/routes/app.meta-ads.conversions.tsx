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
import { listMetaAccounts, sendConversionEvent, listConversionEvents } from "@/lib/meta-ads.functions";

export const Route = createFileRoute("/app/meta-ads/conversions")({ component: ConversionsPage });

const EVENTS = ["Lead", "Purchase", "CompleteRegistration", "Contact", "Schedule", "SubmitApplication"];

function ConversionsPage() {
  const qc = useQueryClient();
  const listAccs = useServerFn(listMetaAccounts);
  const send = useServerFn(sendConversionEvent);
  const listEvents = useServerFn(listConversionEvents);

  const accs = useQuery({ queryKey: ["meta-accounts"], queryFn: () => listAccs() });
  const events = useQuery({ queryKey: ["meta-conv-events"], queryFn: () => listEvents() });

  const [accountId, setAccountId] = useState("");
  const [eventName, setEventName] = useState("Lead");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [value, setValue] = useState("");
  const [testCode, setTestCode] = useState("");

  const accId = accountId || accs.data?.accounts?.[0]?.id || "";

  const mut = useMutation({
    mutationFn: () => send({
      data: {
        accountId: accId,
        eventName,
        email: email || undefined,
        phone: phone || undefined,
        value: value ? Number(value) : undefined,
        currency: value ? "BRL" : undefined,
        testEventCode: testCode || undefined,
      },
    }),
    onSuccess: () => { toast.success("Evento enviado."); qc.invalidateQueries({ queryKey: ["meta-conv-events"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Enviar evento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Conta</label>
            <Select value={accId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {accs.data?.accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Evento</label>
            <Select value={eventName} onValueChange={setEventName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lead@email.com" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Telefone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511999999999" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Valor (BRL)</label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" type="number" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Test Event Code (opcional)</label>
              <Input value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="TEST12345" />
            </div>
          </div>
          <Button onClick={() => mut.mutate()} disabled={!accId || mut.isPending} className="w-full">
            <Send size={14} className="mr-2" /> Enviar para Conversion API
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Email/telefone são hasheados em SHA-256 antes do envio (PII compliance).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos eventos</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-auto">
          {events.data?.events?.length ? events.data.events.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
              <div>
                <div className="font-medium">{e.event_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</div>
              </div>
              <Badge variant={e.status === "sent" ? "default" : e.status === "error" ? "destructive" : "secondary"}>
                {e.status}
              </Badge>
            </div>
          )) : <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
