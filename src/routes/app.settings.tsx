import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const { data } = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () => {
      const [{ data: prof }, { data: org }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").single(),
        supabase.from("organizations").select("*").single(),
        supabase.from("user_roles").select("role"),
      ]);
      return { prof, org, roles: roles ?? [] };
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Configurações</h1>
      <Card className="mb-4">
        <CardHeader><CardTitle>Empresa</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm">Nome: <span className="font-medium">{data?.org?.name ?? "—"}</span></div>
          <div className="text-xs text-muted-foreground mt-1">ID: {data?.org?.id}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Seu perfil</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">Nome: <span className="font-medium">{data?.prof?.full_name ?? "—"}</span></div>
          <div className="text-sm">Email: <span className="font-medium">{data?.prof?.email ?? "—"}</span></div>
          <div className="text-sm flex gap-2 items-center">Papéis: {data?.roles.map((r) => <Badge key={r.role} variant="secondary">{r.role}</Badge>)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
