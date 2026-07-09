import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listRecommendations } from "@/lib/experts.functions";
import type { RecommendationStatus } from "@/lib/ai/contracts/expert-persistence";

const STATUSES: Array<{ v: RecommendationStatus | "all"; label: string }> = [
  { v: "all", label: "Todos" },
  { v: "open", label: "Abertas" },
  { v: "in_progress", label: "Em progresso" },
  { v: "resolved", label: "Resolvidas" },
  { v: "dismissed", label: "Descartadas" },
  { v: "archived", label: "Arquivadas" },
];

const PAGE_SIZE = 20;

export const Route = createFileRoute("/app/inteligencia/recomendacoes")({
  component: RecommendationsList,
});

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function urgencyBadge(u: string) {
  const map: Record<string, string> = {
    critical: "bg-destructive/15 text-destructive border-destructive/40",
    high: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    medium: "bg-primary/15 text-primary border-primary/40",
    low: "bg-muted text-muted-foreground border-border",
  };
  return map[u] ?? map.low;
}

function RecommendationsList() {
  const fetchList = useServerFn(listRecommendations);
  const [status, setStatus] = useState<RecommendationStatus | "all">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["recs", status],
    queryFn: () => fetchList({
      data: { status: status === "all" ? undefined : status, limit: 200 },
    }),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((r) =>
      r.summary.toLowerCase().includes(needle) ||
      r.diagnosis.toLowerCase().includes(needle));
  }, [data, q]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar recomendação…"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.v} onClick={() => { setStatus(s.v); setPage(0); }}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                status === s.v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >{s.label}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : paged.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma recomendação encontrada.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {paged.map((r) => (
            <Link
              key={r.recommendationId}
              to="/app/inteligencia/recomendacoes/$id" params={{ id: r.recommendationId }}
              className="block"
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${urgencyBadge(r.urgency)}`}>
                          {r.urgency.toUpperCase()}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5">{r.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Conf. {Math.round(r.confidence * 100)}%
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold truncate">{r.summary}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.diagnosis}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-primary">{fmtBRL(r.financialValueCents)}</div>
                      <div className="text-[11px] text-muted-foreground">impacto est.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1 text-xs rounded-md border border-border disabled:opacity-40 hover:bg-muted"
          >Anterior</button>
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
            className="px-3 py-1 text-xs rounded-md border border-border disabled:opacity-40 hover:bg-muted"
          >Próxima</button>
        </div>
      )}
    </div>
  );
}
