import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { qualifyLead } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ia/qualificar")({
  component: QualifyPage,
});

function QualifyPage() {
  const qualify = useServerFn(qualifyLead);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const { data: leads } = useQuery({
    queryKey: ["leads-for-ai"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, phone, status, source, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: (id: string) => qualify({ data: { leadId: id } }),
    onSuccess: (r) => {
      setResult(r.result);
      toast.success("Análise concluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="font-semibold mb-3">Selecione um lead</h2>
        <Card className="divide-y divide-border max-h-[70vh] overflow-auto">
          {(leads ?? []).map((l: any) => (
            <button
              key={l.id}
              onClick={() => {
                setSelectedId(l.id);
                setResult(null);
              }}
              className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${selectedId === l.id ? "bg-muted" : ""}`}
            >
              <div className="font-medium text-sm">{l.name}</div>
              <div className="text-xs text-muted-foreground">{l.phone ?? l.email ?? "-"} · {l.status}</div>
            </button>
          ))}
          {(!leads || leads.length === 0) && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum lead disponível</div>
          )}
        </Card>
      </div>
      <div>
        <h2 className="font-semibold mb-3">Análise IA</h2>
        {!selectedId && <Card className="p-6 text-sm text-muted-foreground text-center">Selecione um lead à esquerda</Card>}
        {selectedId && (
          <Card className="p-4 space-y-4">
            <Button onClick={() => mut.mutate(selectedId)} disabled={mut.isPending} className="w-full">
              {mut.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
              {mut.isPending ? "Analisando..." : "Qualificar com IA"}
            </Button>

            {result && (
              <div className="space-y-3">
                {result.score !== undefined && (
                  <div>
                    <div className="text-xs text-muted-foreground">Score</div>
                    <div className="text-3xl font-bold text-primary">{result.score}/100</div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {result.interest_level && <Badge>Interesse: {result.interest_level}</Badge>}
                  {result.recommended_status && <Badge variant="outline">Sugerido: {result.recommended_status}</Badge>}
                </div>
                {result.summary && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Resumo</div>
                    <p className="text-sm">{result.summary}</p>
                  </div>
                )}
                {result.next_action && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Próxima ação</div>
                    <p className="text-sm font-medium">{result.next_action}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
