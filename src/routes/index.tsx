import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles, MessageSquare, BarChart3, Wallet, Bot, Workflow, LayoutDashboard,
  Users, Target, LineChart, Building2, Compass, ArrowRight, Check, Play,
  Zap, Shield, Brain, Cpu, Layers, Globe, Github,
} from "lucide-react";

const OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8b26309f-6ab7-4460-8284-486bdf725d21/id-preview-2c6d5c77--0e650211-1366-45fd-8deb-5cada506ca5c.lovable.app-1779810311108.png";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [
      { title: "ZENNO AI — O Sistema Operacional Inteligente para Empresas" },
      { name: "description", content: "Zenno AI é o sistema operacional inteligente que conecta CRM, marketing, WhatsApp, Google Ads, Meta Ads, financeiro, automação e IA empresarial em uma única plataforma." },
      { property: "og:title", content: "ZENNO AI — O Sistema Operacional Inteligente para Empresas" },
      { property: "og:description", content: "CRM, marketing, atendimento, financeiro e IA — unificados em um único sistema operacional empresarial." },
      { property: "og:url", content: "https://zenno-connect-ai.lovable.app/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:title", content: "ZENNO AI — O Sistema Operacional Inteligente para Empresas" },
      { name: "twitter:description", content: "Uma plataforma. Todos os departamentos. Inteligência artificial em cada decisão." },
    ],
    links: [{ rel: "canonical", href: "https://zenno-connect-ai.lovable.app/" }],
  }),
  component: Landing,
});

const MODULES = [
  { icon: Users, label: "CRM", desc: "Pipeline, leads, contas" },
  { icon: Target, label: "Marketing", desc: "Jornadas & campanhas" },
  { icon: MessageSquare, label: "WhatsApp", desc: "Atendimento omnichannel" },
  { icon: BarChart3, label: "Google Ads", desc: "Conversion API nativa" },
  { icon: LineChart, label: "Meta Ads", desc: "Rastreio ponta a ponta" },
  { icon: Wallet, label: "Financeiro", desc: "Receita, custos, DRE" },
  { icon: Workflow, label: "Automação", desc: "Workflows & triggers" },
  { icon: Bot, label: "IA Empresarial", desc: "Copiloto & agentes" },
  { icon: LayoutDashboard, label: "Analytics", desc: "KPIs em tempo real" },
  { icon: Compass, label: "Executive", desc: "Decisões estratégicas" },
  { icon: Building2, label: "Workspace", desc: "Tudo em um lugar" },
  { icon: Layers, label: "Integrations", desc: "Ecossistema aberto" },
];

const FLOW = [
  "Marketing", "Leads", "CRM", "WhatsApp", "IA", "Financeiro", "Relatórios", "Executivo",
];

const AI_CAPS = [
  "Analisa campanhas em tempo real",
  "Descobre gargalos no funil",
  "Calcula CAC, LTV e ROAS",
  "Sugere melhorias acionáveis",
  "Explica cada decisão tomada",
  "Aprende com o DNA da empresa",
  "Executa playbooks 24/7",
  "Antecipa cenários futuros",
];

const INTEGRATIONS = [
  "Google Ads", "Meta Ads", "WhatsApp", "Stripe", "Mercado Pago",
  "Google Analytics", "Cloudflare", "Supabase", "Claude AI",
];

const STATS = [
  { n: "40+", l: "Módulos integrados" },
  { n: "800+", l: "Testes automatizados" },
  { n: "100%", l: "Cloud & multi-tenant" },
  { n: "24/7", l: "IA sempre ativa" },
];

const FAQ = [
  { q: "O Zenno substitui HubSpot, Kommo ou RD Station?", a: "Sim. O Zenno consolida CRM, marketing, atendimento, financeiro e automação em uma única plataforma — eliminando a necessidade de múltiplas ferramentas desconectadas." },
  { q: "Como funciona a camada de IA?", a: "A IA do Zenno lê seus dados operacionais (leads, campanhas, atendimento, financeiro), correlaciona sinais e gera recomendações auditáveis com raciocínio explícito e evidências." },
  { q: "É seguro para minha empresa?", a: "Sim. Arquitetura multi-tenant com RLS em 100% das tabelas, criptografia AES-256-GCM para chaves sensíveis, HMAC-SHA256 em webhooks e auditoria completa." },
  { q: "Preciso integrar WhatsApp, Google Ads e Meta Ads separadamente?", a: "Não. As integrações são nativas e prontas para uso — basta autorizar. O Zenno lê e escreve em cada canal de forma unificada." },
  { q: "Existe plano gratuito?", a: "Sim. Você pode começar gratuitamente e evoluir conforme sua operação escala." },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30">
      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-14">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="relative">
              <Sparkles className="text-primary" size={18} />
              <div className="absolute inset-0 blur-md bg-primary/40 -z-10" />
            </div>
            <span>ZENNO<span className="text-muted-foreground font-normal"> AI</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#modulos" className="hover:text-foreground transition">Módulos</a>
            <a href="#ia" className="hover:text-foreground transition">IA</a>
            <a href="#workspace" className="hover:text-foreground transition">Workspace</a>
            <a href="#integracoes" className="hover:text-foreground transition">Integrações</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/signup"><Button size="sm">Começar grátis</Button></Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/40">
        {/* Ambient gradient */}
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/15 blur-[120px]" />
          <div className="absolute top-[30%] left-[10%] h-[300px] w-[300px] rounded-full bg-primary/10 blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_70%)]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            Release Candidate — Pilot Program aberto
          </div>

          <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter leading-[0.95]">
            O Sistema Operacional
            <br />
            <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
              Inteligente para Empresas
            </span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
            CRM, marketing, WhatsApp, Google Ads, Meta Ads, financeiro, automação e IA empresarial —
            unificados em uma única plataforma que aprende, decide e executa com você.
          </p>

          <div className="mt-8 flex items-center gap-3 justify-center flex-wrap">
            <Link to="/signup"><Button size="lg" className="h-11 px-6 gap-2">Começar gratuitamente <ArrowRight size={16} /></Button></Link>
            <Button size="lg" variant="outline" className="h-11 px-6 gap-2">
              <Play size={14} /> Ver demonstração
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-x-6 gap-y-2 flex-wrap text-xs text-muted-foreground">
            {["CRM", "WhatsApp", "Google Ads", "Meta Ads", "Financeiro", "IA", "Automação"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/60" /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Workspace mockup */}
        <div className="max-w-6xl mx-auto px-6 pb-20">
          <div className="relative rounded-2xl border border-border/60 bg-gradient-to-b from-card to-background shadow-2xl shadow-primary/10 overflow-hidden">
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <MockWorkspace />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — Timeline */}
      <section className="border-b border-border/40 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHead
            eyebrow="Como funciona"
            title="Do primeiro clique à receita — em um único fluxo"
            desc="Um sistema operacional que orquestra marketing, vendas, atendimento, IA e financeiro em tempo real."
          />

          <div className="mt-16 relative">
            <div aria-hidden className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
            <div className="space-y-8">
              {[
                { t: "Cliente envia mensagem", d: "Meta Ads, Google Ads ou orgânico → primeiro toque capturado com atribuição completa.", i: MessageSquare },
                { t: "WhatsApp recebe e enfileira", d: "Roteamento inteligente por especialista, fila ou automação.", i: MessageSquare },
                { t: "CRM cria o lead", d: "Contato, empresa, origem e UTMs materializados em segundos.", i: Users },
                { t: "IA analisa e qualifica", d: "Zenno AI lê contexto, histórico e sinais — retorna scoring e próxima ação.", i: Brain },
                { t: "Pipeline atualiza automaticamente", d: "Kanban se reorganiza, tarefas são criadas, SLAs disparados.", i: Workflow },
                { t: "Campanhas se otimizam", d: "Sinais retornam para Meta e Google via Conversion API.", i: Target },
                { t: "Financeiro reconhece", d: "Receita, comissões e custos consolidados em DRE ao vivo.", i: Wallet },
                { t: "Relatórios executivos", d: "Dashboard estratégico com forecast, cenários e recomendações.", i: LineChart },
              ].map((s, i) => (
                <div key={s.t} className={`flex items-start gap-6 md:gap-10 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                  <div className="flex-1 md:text-right"></div>
                  <div className="relative shrink-0 h-11 w-11 rounded-full border border-border bg-card grid place-items-center z-10 shadow-lg shadow-primary/5">
                    <s.i size={16} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className={`inline-block rounded-xl border border-border/60 bg-card/50 backdrop-blur p-4 ${i % 2 !== 0 ? "md:text-right" : ""}`}>
                      <div className="text-sm font-semibold">{s.t}</div>
                      <div className="text-xs text-muted-foreground mt-1">{s.d}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modulos" className="border-b border-border/40 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHead
            eyebrow="Plataforma unificada"
            title="Uma plataforma. Todos os departamentos."
            desc="Marketing, vendas, atendimento, financeiro e IA compartilham o mesmo dado, o mesmo contexto e a mesma inteligência."
          />
          <div className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {MODULES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="group relative rounded-xl border border-border/60 bg-card/40 p-5 hover:bg-card hover:border-primary/40 transition-all">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center mb-3">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI SECTION */}
      <section id="ia" className="relative border-b border-border/40 py-24 overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 -translate-y-1/2 left-1/4 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <Badge variant="outline" className="mb-4 border-primary/40 text-primary bg-primary/5">
              <Brain size={12} className="mr-1.5" /> Zenno AI
            </Badge>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter leading-tight">
              Uma inteligência que <span className="text-primary">entende</span> seu negócio.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              O Zenno AI não é um chatbot. É um copiloto empresarial que lê seus dados, correlaciona sinais,
              executa playbooks e explica cada decisão com evidências auditáveis.
            </p>
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_CAPS.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 h-4 w-4 rounded-full bg-primary/15 grid place-items-center shrink-0">
                    <Check size={10} className="text-primary" />
                  </div>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/signup"><Button className="gap-2">Ver IA em ação <ArrowRight size={14} /></Button></Link>
            </div>
          </div>

          <MockCopilot />
        </div>
      </section>

      {/* WORKSPACE */}
      <section id="workspace" className="border-b border-border/40 py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <SectionHead
            eyebrow="Zenno Workspace"
            title="Tudo acontece aqui."
            desc="Um único ambiente para gerenciar toda a operação. Widgets, dashboards, ações e IA lado a lado."
          />
          <div className="mt-14 relative rounded-2xl border border-border/60 bg-gradient-to-b from-card to-background overflow-hidden shadow-2xl shadow-primary/10">
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <MockWorkspace big />
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integracoes" className="border-b border-border/40 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHead
            eyebrow="Ecossistema"
            title="Conecta com o que sua empresa já usa"
            desc="Integrações nativas e prontas para uso — sem middleware, sem gambiarra."
          />
          <div className="mt-12 grid grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-3">
            {INTEGRATIONS.map((n) => (
              <div key={n} className="aspect-square rounded-xl border border-border/60 bg-card/40 grid place-items-center text-center p-3 hover:border-primary/40 hover:bg-card transition-all">
                <div>
                  <div className="h-8 w-8 mx-auto rounded-lg bg-primary/10 grid place-items-center mb-2">
                    <Globe size={14} className="text-primary" />
                  </div>
                  <div className="text-xs font-medium leading-tight">{n}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className="border-b border-border/40 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHead
            eyebrow="Fluxo operacional"
            title="Do marketing ao executivo — sem fricção"
          />
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {FLOW.map((step, i) => (
              <div key={step} className="flex items-center gap-2 md:gap-3">
                <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-2.5 text-sm font-medium">
                  {step}
                </div>
                {i < FLOW.length - 1 && <ArrowRight size={14} className="text-muted-foreground/50 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-border/40 py-20">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-4xl md:text-5xl font-semibold tracking-tighter bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
                {s.n}
              </div>
              <div className="mt-2 text-xs text-muted-foreground uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY */}
      <section className="border-b border-border/40 py-24">
        <div className="max-w-4xl mx-auto px-6 grid md:grid-cols-3 gap-6">
          {[
            { i: Shield, t: "Segurança RC1", d: "RLS em 100% das tabelas, AES-256-GCM, HMAC em webhooks." },
            { i: Cpu, t: "Cloud nativo", d: "Multi-tenant, isolamento por organização, escala horizontal." },
            { i: Zap, t: "Performance", d: "Edge functions, cache inteligente, latência p95 auditada." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border/60 bg-card/40 p-6">
              <Icon size={18} className="text-primary mb-3" />
              <div className="font-semibold text-sm">{t}</div>
              <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-border/40 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <SectionHead eyebrow="Perguntas frequentes" title="Tudo que você precisa saber" />
          <Accordion type="single" collapsible className="mt-12">
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="text-left hover:no-underline text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[800px] rounded-full bg-primary/20 blur-[120px]" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-[0.95]">
            Pronto para operar sua empresa
            <br />
            <span className="text-primary">com inteligência?</span>
          </h2>
          <p className="mt-6 text-muted-foreground">Comece grátis. Escale quando quiser. Sem cartão de crédito.</p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link to="/signup"><Button size="lg" className="h-11 px-6 gap-2">Criar conta gratuita <ArrowRight size={16} /></Button></Link>
            <Link to="/login"><Button size="lg" variant="outline" className="h-11 px-6">Já tenho conta</Button></Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <span>© {new Date().getFullYear()} Zenno AI — Sistema operacional inteligente para empresas.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground transition">Privacidade</a>
            <a href="#" className="hover:text-foreground transition">Termos</a>
            <a href="#" className="hover:text-foreground transition">Status</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">{eyebrow}</div>
      <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tighter leading-[1.05]">{title}</h2>
      {desc && <p className="mt-4 text-muted-foreground leading-relaxed">{desc}</p>}
    </div>
  );
}

/* --- Mock UI illustrations (pure CSS, no assets) --- */

function MockWorkspace({ big = false }: { big?: boolean }) {
  return (
    <div className={`grid grid-cols-12 gap-3 p-4 ${big ? "min-h-[520px]" : "min-h-[420px]"}`}>
      {/* Sidebar */}
      <div className="col-span-2 rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md bg-primary/20 grid place-items-center">
            <Sparkles size={12} className="text-primary" />
          </div>
          <div className="h-2 w-14 rounded bg-muted-foreground/20" />
        </div>
        {["Dashboard", "CRM", "WhatsApp", "Ads", "Financeiro", "IA", "Automação"].map((s, i) => (
          <div key={s} className={`flex items-center gap-2 rounded px-2 py-1.5 ${i === 0 ? "bg-primary/10" : ""}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
            <div className={`h-1.5 rounded ${i === 0 ? "bg-primary/60 w-12" : "bg-muted-foreground/20 w-10"}`} />
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="col-span-7 space-y-3">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "Leads", v: "1.284", c: "text-primary" },
            { l: "Receita", v: "R$ 342k", c: "text-emerald-400" },
            { l: "ROAS", v: "4.8x", c: "text-primary" },
            { l: "CAC", v: "R$ 68", c: "text-emerald-400" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-border/40 bg-card/60 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.l}</div>
              <div className={`text-sm font-semibold mt-1 ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-lg border border-border/40 bg-card/60 p-4 h-48">
          <div className="flex items-center justify-between mb-3">
            <div className="h-2 w-24 rounded bg-muted-foreground/30" />
            <div className="flex gap-1">
              <div className="h-1.5 w-8 rounded bg-primary/40" />
              <div className="h-1.5 w-8 rounded bg-muted-foreground/20" />
            </div>
          </div>
          <svg viewBox="0 0 400 140" className="w-full h-[calc(100%-24px)]">
            <defs>
              <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,110 C50,80 90,90 130,60 C170,30 210,70 250,50 C290,30 330,45 400,20 L400,140 L0,140 Z" fill="url(#area)" />
            <path d="M0,110 C50,80 90,90 130,60 C170,30 210,70 250,50 C290,30 330,45 400,20" fill="none" stroke="var(--primary)" strokeWidth="2" />
          </svg>
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-3 gap-2">
          {["Novos", "Qualificado", "Ganhos"].map((c, i) => (
            <div key={c} className="rounded-lg border border-border/40 bg-card/60 p-2 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10px] font-medium">{c}</div>
                <div className="text-[10px] text-muted-foreground">{[12, 8, 5][i]}</div>
              </div>
              {[0, 1].map((k) => (
                <div key={k} className="rounded bg-muted/30 border border-border/30 p-1.5 space-y-1">
                  <div className="h-1.5 rounded bg-muted-foreground/30 w-3/4" />
                  <div className="h-1 rounded bg-muted-foreground/15 w-1/2" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Copilot */}
      <div className="col-span-3 rounded-lg border border-primary/20 bg-gradient-to-b from-primary/5 to-card/60 p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md bg-primary/20 grid place-items-center">
            <Brain size={12} className="text-primary" />
          </div>
          <div className="text-[10px] font-medium">Zenno AI</div>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="rounded-lg bg-muted/40 p-2 space-y-1">
            <div className="h-1.5 rounded bg-muted-foreground/30 w-4/5" />
            <div className="h-1.5 rounded bg-muted-foreground/20 w-3/5" />
            <div className="h-1.5 rounded bg-muted-foreground/20 w-2/3" />
          </div>
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 space-y-1">
            <div className="flex items-center gap-1">
              <Zap size={9} className="text-primary" />
              <div className="text-[9px] font-medium text-primary">Recomendação</div>
            </div>
            <div className="h-1.5 rounded bg-primary/40 w-full" />
            <div className="h-1.5 rounded bg-primary/30 w-4/5" />
          </div>
          <div className="rounded-lg bg-muted/40 p-2 space-y-1">
            <div className="h-1.5 rounded bg-muted-foreground/30 w-3/5" />
            <div className="h-1.5 rounded bg-muted-foreground/20 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCopilot() {
  return (
    <div className="relative rounded-2xl border border-border/60 bg-gradient-to-b from-card to-background p-5 shadow-2xl shadow-primary/10">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="flex items-center gap-2 pb-3 border-b border-border/40">
        <div className="h-7 w-7 rounded-lg bg-primary/20 grid place-items-center">
          <Brain size={14} className="text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold">Zenno AI</div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Analisando 14 dias
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex justify-end">
          <div className="rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/20 px-3 py-2 max-w-[80%] text-xs">
            Por que meu CAC subiu essa semana?
          </div>
        </div>
        <div className="flex">
          <div className="rounded-2xl rounded-tl-sm bg-muted/40 border border-border/40 px-3 py-2.5 max-w-[90%] text-xs space-y-2">
            <p>
              Seu <span className="font-semibold text-foreground">CAC subiu 23%</span> nos últimos 7 dias.
              Detectei 3 causas correlacionadas:
            </p>
            <ul className="space-y-1 pl-1">
              <li className="flex gap-2"><span className="text-primary">→</span> Meta Ads: CTR caiu 18% no criativo #A2</li>
              <li className="flex gap-2"><span className="text-primary">→</span> WhatsApp: tempo de 1ª resposta ↑ 4min</li>
              <li className="flex gap-2"><span className="text-primary">→</span> Qualificação: 12 leads sem follow-up</li>
            </ul>
            <div className="pt-2 mt-2 border-t border-border/40 flex items-center gap-2">
              <Zap size={11} className="text-primary" />
              <span className="text-[11px] font-medium text-primary">Executar playbook de recuperação</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
