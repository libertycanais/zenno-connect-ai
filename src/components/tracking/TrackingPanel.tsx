import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Code2, Activity, Users, BarChart3, ShieldCheck, Save } from "lucide-react";
import {
  getTrackingConfig,
  listTrackingLeads,
  listTrackingEvents,
  trackingAttribution,
  updateTrackingOrigins,
} from "@/lib/tracking.functions";

type Props = { source: "meta" | "google"; sourceLabel: string };

export function TrackingPanel({ source, sourceLabel }: Props) {
  const qc = useQueryClient();
  const cfgFn = useServerFn(getTrackingConfig);
  const leadsFn = useServerFn(listTrackingLeads);
  const eventsFn = useServerFn(listTrackingEvents);
  const attrFn = useServerFn(trackingAttribution);
  const updOriginsFn = useServerFn(updateTrackingOrigins);

  const cfg = useQuery({ queryKey: ["tracking-cfg"], queryFn: () => cfgFn() });
  const leads = useQuery({
    queryKey: ["tracking-leads", source],
    queryFn: () => leadsFn({ data: { source, limit: 100 } }),
  });
  const events = useQuery({
    queryKey: ["tracking-events", source],
    queryFn: () => eventsFn({ data: { limit: 50 } }),
  });
  const attr = useQuery({
    queryKey: ["tracking-attr", source],
    queryFn: () => attrFn({ data: { source, days: 30 } }),
  });

  const pk = cfg.data?.organization?.tracking_public_key ?? "";
  const savedOrigins: string[] = (cfg.data?.organization as { tracking_allowed_origins?: string[] } | undefined)?.tracking_allowed_origins ?? [];
  const [originsText, setOriginsText] = useState("");
  useEffect(() => { setOriginsText(savedOrigins.join("\n")); }, [savedOrigins.join("|")]);

  const saveOrigins = useMutation({
    mutationFn: () => updOriginsFn({ data: {
      origins: originsText.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean),
    } }),
    onSuccess: (r) => {
      toast.success(`${r.origins.length} domínio(s) autorizado(s)`);
      qc.invalidateQueries({ queryKey: ["tracking-cfg"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const scriptTag = `<script async src="${origin}/api/public/track/script.js?pk=${pk}"></script>`;
  const leadSnippet = `<script>
  // Após o envio do formulário de lead:
  window.zennoTrack({ event: "Lead", email: "cliente@email.com", phone: "+5511999999999" });
</script>`;
  const purchaseSnippet = `<script>
  // Na página de obrigado / pós-compra:
  window.zennoTrack({ event: "Purchase", email: "cliente@email.com", value: 297.00, currency: "BRL" });
</script>`;

  const copy = (s: string, label: string) => {
    navigator.clipboard.writeText(s).then(() => toast.success(`${label} copiado`));
  };

  return (
    <Tabs defaultValue="install" className="space-y-4">
      <TabsList>
        <TabsTrigger value="install"><Code2 className="w-4 h-4 mr-2" />Instalação</TabsTrigger>
        <TabsTrigger value="leads"><Users className="w-4 h-4 mr-2" />Leads rastreados</TabsTrigger>
        <TabsTrigger value="events"><Activity className="w-4 h-4 mr-2" />Eventos</TabsTrigger>
        <TabsTrigger value="attribution"><BarChart3 className="w-4 h-4 mr-2" />Atribuição</TabsTrigger>
      </TabsList>

      <TabsContent value="install" className="space-y-4">
        <Card className={savedOrigins.length === 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4" />
              Domínios autorizados {savedOrigins.length === 0
                ? <Badge variant="destructive" className="ml-2">Obrigatório</Badge>
                : <Badge variant="default" className="ml-2">{savedOrigins.length} ativo(s)</Badge>}
            </CardTitle>
            <CardDescription>
              Liste os domínios que podem enviar eventos para essa chave (um por linha). Enquanto estiver vazio,
              <strong> os eventos são coletados mas não são enviados para o Meta CAPI nem para o Google Offline
              Conversions</strong> — isso protege sua conta de anúncio caso alguém copie a chave pública do HTML.
              Suporta curinga: <code>*.seudominio.com</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
              placeholder={"exemplo.com\n*.exemplo.com\nlanding.cliente.com.br"}
              value={originsText}
              onChange={(e) => setOriginsText(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => saveOrigins.mutate()} disabled={saveOrigins.isPending}>
                <Save className="w-4 h-4 mr-2" />Salvar domínios
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pixel de rastreio {sourceLabel}</CardTitle>
            <CardDescription>
              Cole este script no <code>&lt;head&gt;</code> do site do cliente. Ele captura automaticamente
              utm_source/medium/campaign/term/content/id, fbclid, gclid, referrer e gera uma sessão única —
              estilo Tintim.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sua chave pública</label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={pk} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(pk, "Chave")}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Script base (pageview + atribuição)</label>
              <pre className="mt-1 bg-muted p-3 rounded text-xs overflow-x-auto">{scriptTag}</pre>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(scriptTag, "Script")}>
                <Copy className="w-4 h-4 mr-2" />Copiar script
              </Button>
            </div>
            <div>
              <label className="text-sm font-medium">Disparar evento de Lead</label>
              <pre className="mt-1 bg-muted p-3 rounded text-xs overflow-x-auto">{leadSnippet}</pre>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(leadSnippet, "Snippet Lead")}>
                <Copy className="w-4 h-4 mr-2" />Copiar
              </Button>
            </div>
            <div>
              <label className="text-sm font-medium">Disparar evento de Compra</label>
              <pre className="mt-1 bg-muted p-3 rounded text-xs overflow-x-auto">{purchaseSnippet}</pre>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(purchaseSnippet, "Snippet Purchase")}>
                <Copy className="w-4 h-4 mr-2" />Copiar
              </Button>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-3">
              Quando o evento <code>Lead</code> ou <code>Purchase</code> chegar com <code>fbclid</code> presente,
              o sistema envia automaticamente para a <strong>Conversion API do Meta</strong>. Com <code>gclid</code>,
              registra uma <strong>Conversão Offline do Google Ads</strong>.
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leads">
        <Card>
          <CardHeader><CardTitle>Leads rastreados ({sourceLabel})</CardTitle></CardHeader>
          <CardContent>
            {leads.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead>Click ID</TableHead>
                    <TableHead className="text-right">Eventos</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Último hit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(leads.data?.leads ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell><Badge variant={l.status === "customer" ? "default" : l.status === "lead" ? "secondary" : "outline"}>{l.status}</Badge></TableCell>
                      <TableCell className="text-xs">{l.email || l.phone || l.name || l.session_id.slice(0, 10)}</TableCell>
                      <TableCell className="text-xs">{l.first_utm_campaign || "—"}</TableCell>
                      <TableCell className="text-xs">{l.first_utm_content || "—"}</TableCell>
                      <TableCell className="text-xs font-mono truncate max-w-[120px]">{l.first_fbclid || l.first_gclid || "—"}</TableCell>
                      <TableCell className="text-right">{l.events_count}</TableCell>
                      <TableCell className="text-right">{Number(l.conversion_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell className="text-xs">{new Date(l.last_seen_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                  {(leads.data?.leads ?? []).length === 0 && !leads.isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhum lead rastreado ainda. Instale o pixel no site do cliente.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="events">
        <Card>
          <CardHeader><CardTitle>Últimos eventos capturados</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Página</TableHead>
                    <TableHead>UTM</TableHead>
                    <TableHead>Click ID</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(events.data?.events ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell><Badge variant="outline">{e.event_name}</Badge></TableCell>
                      <TableCell className="text-xs truncate max-w-[260px]">{e.event_source_url || "—"}</TableCell>
                      <TableCell className="text-xs">{e.utm_source || "—"} / {e.utm_campaign || "—"}</TableCell>
                      <TableCell className="text-xs font-mono truncate max-w-[120px]">{e.fbclid || e.gclid || "—"}</TableCell>
                      <TableCell className="text-xs">{e.country || "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                  {(events.data?.events ?? []).length === 0 && !events.isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem eventos ainda.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="attribution">
        <Card>
          <CardHeader>
            <CardTitle>Atribuição por campanha — últimos 30 dias</CardTitle>
            <CardDescription>Cliques, leads e clientes agrupados por utm_campaign / utm_content.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Anúncio (utm_content)</TableHead>
                    <TableHead className="text-right">Hits</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(attr.data?.rows ?? []).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.campaign}</TableCell>
                      <TableCell className="text-xs">{r.ad}</TableCell>
                      <TableCell className="text-right">{r.clicks}</TableCell>
                      <TableCell className="text-right">{r.leads}</TableCell>
                      <TableCell className="text-right">{r.customers}</TableCell>
                      <TableCell className="text-right">{Number(r.revenue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    </TableRow>
                  ))}
                  {(attr.data?.rows ?? []).length === 0 && !attr.isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem dados de atribuição ainda.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
