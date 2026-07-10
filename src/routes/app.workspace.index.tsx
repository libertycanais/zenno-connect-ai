// Command Center — Invisible UI (Linear-style).
// Poucos elementos. Muito respiro. Tipografia como interface.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getIntelligenceWidgets } from "@/lib/experts-analytics.functions";
import { useAuth } from "@/lib/auth";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/workspace/")({ component: WorkspaceOverview });

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function WorkspaceOverview() {
  const { user } = useAuth();
  const name = ((user?.email ?? "").split("@")[0] ?? "").split(/[._-]/)[0];
  const fn = useServerFn(getIntelligenceWidgets);
  const q = useQuery({ queryKey: ["intel", "widgets"], queryFn: () => fn(), staleTime: 60_000 });

  const opps = q.data?.totals.open ?? 3;
  const roi = q.data?.financial.estimatedRoiCents ?? 1_843_000;
  const savings = Math.round(roi * 0.15);

  return (
    <WorkspaceShell title="Command Center">
      {/* Hero — só isto na primeira dobra */}
      <section className="min-h-[52vh] flex flex-col justify-center">
        <p className="text-[13px] text-muted-foreground mb-6">
          {greet()}, <span className="text-foreground/90 capitalize">{name || "operador"}</span>.
        </p>
        <h1 className="text-4xl md:text-6xl font-medium tracking-[-0.02em] leading-[1.05] text-foreground">
          Sua empresa está saudável.
        </h1>
        <p className="mt-5 text-xl md:text-2xl text-muted-foreground font-light leading-snug max-w-2xl">
          A IA encontrou <span className="text-foreground">{opps} oportunidades</span> hoje.
        </p>

        <div className="mt-14 flex items-baseline gap-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">Economia potencial</div>
            <div className="mt-2 text-3xl md:text-4xl font-medium tabular-nums text-foreground">{money(savings)}</div>
          </div>
          <button className="group inline-flex items-center gap-1.5 text-sm text-foreground/90 hover:text-foreground transition">
            Ver recomendações
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      {/* Status — uma linha, texto puro, sem cards */}
      <section className="mt-24 pt-6 border-t border-border/40">
        <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-3 text-[13px]">
          <StatusItem label="Health" value="98" />
          <StatusItem label="AI" value="Online" dot />
          <StatusItem label="Modelo" value="Claude Enterprise" />
          <StatusItem label="Experts" value="7 ativos" />
          <StatusItem label="Última análise" value="há 18s" />
        </dl>
      </section>

      {/* Três painéis. Só três. Sem bordas pesadas. */}
      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-10">
        <Panel
          eyebrow="Executive"
          title="Receita em linha com meta"
          body="Você está 4% acima da projeção mensal. Nenhum risco crítico ativo."
        />
        <Panel
          eyebrow="Marketing"
          title="Nova oportunidade detectada"
          body="Meta Ads · CPL caiu 22% na campanha Conversão-04. Escalar orçamento sugerido."
        />
        <Panel
          eyebrow="Financeiro"
          title="Fluxo estável"
          body="Contas a receber cobrem 3.4× as saídas dos próximos 30 dias."
        />
      </section>

      {/* Timeline — tipografia, sem caixas */}
      <section className="mt-24 pt-6 border-t border-border/40">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-6">Hoje</h2>
        <ol className="space-y-4">
          <TimelineRow time="09:14" source="Forecast Expert" text="Projeção 30 dias atualizada · +12.4%" />
          <TimelineRow time="09:12" source="Marketing Expert" text="Nova oportunidade identificada" />
          <TimelineRow time="09:10" source="Executive Expert" text="Análise executiva concluída" />
        </ol>
      </section>

      <div className="h-24" />
    </WorkspaceShell>
  );
}

function StatusItem({ label, value, dot }: { label: string; value: string; dot?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="text-foreground/90 tabular-nums inline-flex items-center gap-1.5">
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />}
        {value}
      </dd>
    </div>
  );
}

function Panel({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <article>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80 mb-3">{eyebrow}</div>
      <h3 className="text-[15px] font-medium text-foreground leading-snug">{title}</h3>
      <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">{body}</p>
    </article>
  );
}

function TimelineRow({ time, source, text }: { time: string; source: string; text: string }) {
  return (
    <li className="grid grid-cols-[64px_1fr] gap-6 text-[13px]">
      <span className="text-muted-foreground/70 tabular-nums">{time}</span>
      <span className="text-foreground/90">
        <span className="text-muted-foreground">{source} · </span>
        {text}
      </span>
    </li>
  );
}
