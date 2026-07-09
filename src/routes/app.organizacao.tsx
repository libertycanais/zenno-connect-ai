import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  createInvitation,
  getOrganization,
  listInvitations,
  listMembers,
  removeMember,
  resendInvitation,
  revokeInvitation,
  updateOrganization,
} from "@/lib/organization.functions";
import { INVITABLE_ROLES } from "@/lib/organization.helpers";

export const Route = createFileRoute("/app/organizacao")({ component: OrganizationPage });

function OrganizationPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Organização</h1>
      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Empresa</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="invites">Convites</TabsTrigger>
        </TabsList>
        <TabsContent value="org" className="mt-4"><OrgTab /></TabsContent>
        <TabsContent value="team" className="mt-4"><TeamTab /></TabsContent>
        <TabsContent value="invites" className="mt-4"><InvitesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function OrgTab() {
  const fetchOrg = useServerFn(getOrganization);
  const updateOrg = useServerFn(updateOrganization);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: () => fetchOrg({ data: undefined as never }),
  });
  const mut = useMutation({
    mutationFn: (payload: Record<string, string>) => updateOrg({ data: payload as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organization"] });
      toast({ title: "Salvo" });
    },
    onError: (e: unknown) => toast({ title: "Erro", description: String(e), variant: "destructive" }),
  });
  const org = data?.organization;
  const [form, setForm] = useState<Record<string, string>>({});
  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  const bind = (k: string) => ({
    value: form[k] ?? (org?.[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Informações da empresa</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nome</Label><Input {...bind("name")} /></div>
          <div><Label>Domínio</Label><Input placeholder="acme.com" {...bind("domain")} /></div>
          <div><Label>Logo (URL)</Label><Input {...bind("logo_url")} /></div>
          <div><Label>Timezone</Label><Input {...bind("timezone")} /></div>
          <div><Label>Idioma</Label><Input placeholder="pt-BR" {...bind("language")} /></div>
          <div><Label>Moeda</Label><Input placeholder="BRL" {...bind("currency")} /></div>
        </div>
        <Button
          disabled={mut.isPending || Object.keys(form).length === 0}
          onClick={() => mut.mutate(Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "")))}
        >
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

function TeamTab() {
  const fetchMembers = useServerFn(listMembers);
  const remove = useServerFn(removeMember);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers({ data: undefined as never }),
  });
  const mut = useMutation({
    mutationFn: (uid: string) => remove({ data: { target_user_id: uid } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); toast({ title: "Removido" }); },
    onError: (e) => toast({ title: "Erro", description: String(e), variant: "destructive" }),
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  return (
    <Card>
      <CardHeader><CardTitle>Membros da equipe</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(data?.members ?? []).map((m) => (
          <div key={m.user_id} className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="font-medium">{m.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{m.email}</div>
            </div>
            <div className="flex gap-2 items-center">
              {m.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
              <Button size="sm" variant="outline" onClick={() => mut.mutate(m.user_id)}>Remover</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InvitesTab() {
  const fetchInvites = useServerFn(listInvitations);
  const create = useServerFn(createInvitation);
  const revoke = useServerFn(revokeInvitation);
  const resend = useServerFn(resendInvitation);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const { data, isLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: () => fetchInvites({ data: undefined as never }),
  });
  const createMut = useMutation({
    mutationFn: () => create({ data: { email, role: role as never } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      toast({ title: "Convite criado", description: `Token: ${r.token.slice(0, 8)}…` });
      setEmail("");
    },
    onError: (e) => toast({ title: "Erro", description: String(e), variant: "destructive" }),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { invitation_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
  const resendMut = useMutation({
    mutationFn: (id: string) => resend({ data: { invitation_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Novo convite</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Input placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INVITABLE_ROLES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button disabled={!email || createMut.isPending} onClick={() => createMut.mutate()}>Convidar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Convites</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div>
            : (data?.invitations ?? []).map((i) => (
              <div key={i.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="font-medium">{i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.role} · {i.status} · expira {new Date(i.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  {i.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => resendMut.mutate(i.id)}>Reenviar</Button>
                      <Button size="sm" variant="destructive" onClick={() => revokeMut.mutate(i.id)}>Revogar</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
