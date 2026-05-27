import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Plug, Settings2, ExternalLink, Trash2, RefreshCw, Search } from "lucide-react";
import {
  listPaymentIntegrations,
  savePaymentIntegration,
  testPaymentIntegration,
  deletePaymentIntegration,
} from "@/lib/payment-integrations.functions";

export const Route = createFileRoute("/app/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — ZENNO CRM AI" },
      { name: "description", content: "Conecte gateways de pagamento (Asaas, Mercado Pago) à sua conta ZENNO." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntegracoesPage,
});

type Provider = "asaas" | "mercadopago";

const CATALOG: Array<{
  id: Provider;
  name: string;
  category: "Formas de pagamento";
  description: string;
  docs: string;
  keyLabel: string;
  keyHint: string;
}> = [
  {
    id: "asaas",
    name: "Asaas",
    category: "Formas de pagamento",
    description: "Receba via Pix, boleto e cartão. Gera cobranças e baixa automática.",
    docs: "https://docs.asaas.com/",
    keyLabel: "API Key (access_token)",
    keyHint: "Em Asaas → Integrações → API → Gerar nova chave",
  },
  {
    id: "mercadopago",
    name: "Mercado Pago",
    category: "Formas de pagamento",
    description: "Aceite Pix, cartão e boleto via Mercado Pago. Webhook de pagamento incluso.",
    docs: "https://www.mercadopago.com.br/developers/panel/app",
    keyLabel: "Access Token",
    keyHint: "Em Mercado Pago → Suas integrações → Credenciais → Access Token",
  },
];

function IntegracoesPage() {
  const list = useServerFn(listPaymentIntegrations);
  const q = useQuery({ queryKey: ["payment-integrations"], queryFn: () => list({ data: undefined as any }) });
  const items = q.data?.integrations ?? [];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "Formas de pagamento">("all");
  const [editing, setEditing] = useState<Provider | null>(null);

  const activeByProvider = new Map(items.map((i: any) => [i.provider as Provider, i]));
  const activeList = CATALOG.filter((c) => activeByProvider.has(c.id));
  const availableList = CATALOG.filter((c) => !activeByProvider.has(c.id));

  function matchFilters<T extends { name: string; category: string }>(arr: T[]) {
    return arr.filter((c) => {
      if (filter !== "all" && c.category !== filter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Plug className="text-primary" /> Integrações
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte serviços externos à ZENNO. Suas chaves ficam guardadas com segurança e nunca aparecem no navegador.
        </p>
      </header>

      <Tabs defaultValue="ativo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ativo">
            Ativo <Badge variant="secondary" className="ml-2">{activeList.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="disponivel">
            Disponível <Badge variant="secondary" className="ml-2">{availableList.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
              Todos
            </Button>
            <Button
              size="sm"
              variant={filter === "Formas de pagamento" ? "default" : "outline"}
              onClick={() => setFilter("Formas de pagamento")}
            >
              Formas de pagamento
            </Button>
          </div>
        </div>

        <TabsContent value="ativo" className="space-y-3">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : matchFilters(activeList).length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma integração ativa ainda.</CardContent></Card>
          ) : (
            matchFilters(activeList).map((c) => (
              <IntegrationRow
                key={c.id}
                provider={c}
                state={activeByProvider.get(c.id) as any}
                onManage={() => setEditing(c.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="disponivel" className="space-y-3">
          {matchFilters(availableList).map((c) => (
            <IntegrationRow key={c.id} provider={c} state={null} onManage={() => setEditing(c.id)} />
          ))}
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              As chaves de API ficam armazenadas com criptografia em repouso e só podem ser acessadas por owners e admins
              da organização. Para revogar acesso, remova a integração na aba "Ativo".
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editing && (
        <ConnectDialog
          provider={CATALOG.find((c) => c.id === editing)!}
          current={(activeByProvider.get(editing) as any) ?? null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function IntegrationRow({
  provider,
  state,
  onManage,
}: {
  provider: (typeof CATALOG)[number];
  state: any;
  onManage: () => void;
}) {
  const active = !!state;
  const ok = state?.status === "active";
  return (
    <Card className={active ? "border-primary/40" : ""}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 grid place-items-center text-primary font-bold text-lg">
          {provider.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{provider.name}</h3>
            <a
              href={provider.docs}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink size={12} /> Suporte
            </a>
            {active && (ok ? (
              <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
                <CheckCircle2 size={12} className="mr-1" /> Conectado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle size={12} className="mr-1" /> Erro
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{provider.description}</p>
          <div className="mt-1.5 inline-block text-[10px] uppercase tracking-wide text-muted-foreground/80 bg-muted/40 rounded px-1.5 py-0.5">
            {provider.category}
          </div>
        </div>
        <Button size="sm" onClick={onManage} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {active ? <Settings2 size={14} className="mr-1.5" /> : <Plug size={14} className="mr-1.5" />}
          {active ? "Gerenciar" : "Conectar"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ConnectDialog({
  provider,
  current,
  onClose,
}: {
  provider: (typeof CATALOG)[number];
  current: any | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(savePaymentIntegration);
  const test = useServerFn(testPaymentIntegration);
  const del = useServerFn(deletePaymentIntegration);

  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">(current?.environment ?? "sandbox");

  const saveMut = useMutation({
    mutationFn: () => save({ data: { provider: provider.id, environment, api_key: apiKey } }),
    onSuccess: (r: any) => {
      if (r.test?.ok) toast.success(`${provider.name} conectado com sucesso`);
      else toast.error(`Salvo, mas teste falhou: ${r.test?.error ?? ""}`);
      qc.invalidateQueries({ queryKey: ["payment-integrations"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const testMut = useMutation({
    mutationFn: () => test({ data: { id: current!.id } }),
    onSuccess: (r: any) => {
      if (r.ok) toast.success("Conexão OK");
      else toast.error(r.error);
      qc.invalidateQueries({ queryKey: ["payment-integrations"] });
    },
  });

  const delMut = useMutation({
    mutationFn: () => del({ data: { id: current!.id } }),
    onSuccess: () => {
      toast.success("Integração removida");
      qc.invalidateQueries({ queryKey: ["payment-integrations"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{current ? "Gerenciar" : "Conectar"} {provider.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ambiente</Label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (teste)</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{provider.keyLabel}</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={current ? "•••••••• (deixe em branco para manter)" : "Cole sua chave aqui"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{provider.keyHint}</p>
          </div>
          {current?.last_error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              Último erro: {current.last_error}
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {current && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => delMut.mutate()}
                disabled={delMut.isPending}
                className="text-destructive hover:text-destructive sm:mr-auto"
              >
                <Trash2 size={14} className="mr-1.5" /> Remover
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending}
              >
                <RefreshCw size={14} className={`mr-1.5 ${testMut.isPending ? "animate-spin" : ""}`} />
                Testar
              </Button>
            </>
          )}
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || (!current && !apiKey)}
          >
            {saveMut.isPending ? "Salvando…" : current ? "Atualizar" : "Conectar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
