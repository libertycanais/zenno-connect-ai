import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutDashboard, MessageSquare, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Sparkles className="text-primary" /> ZENNO CRM AI
        </div>
        <div className="flex gap-2">
          <Link to="/login"><Button variant="ghost">Entrar</Button></Link>
          <Link to="/signup"><Button>Criar conta</Button></Link>
        </div>
      </header>
      <section className="container mx-auto px-6 pt-16 pb-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          CRM completo, <span className="text-primary">inteligente</span> e multiempresa
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
          Gerencie leads, WhatsApp, Meta Ads, Google Ads, financeiro e automações em um único painel — com IA integrada.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/signup"><Button size="lg">Começar grátis</Button></Link>
          <Link to="/login"><Button size="lg" variant="outline">Já tenho conta</Button></Link>
        </div>
      </section>
      <section className="container mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: LayoutDashboard, t: "Pipeline visual", d: "Kanban arrastável, funil de vendas e gestão de leads multiempresa." },
          { icon: MessageSquare, t: "WhatsApp + IA", d: "Atendimento centralizado com automações e respostas com IA." },
          { icon: BarChart3, t: "Ads & Conversões", d: "Meta Ads, Google Ads e Conversion API conectados nativamente." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-xl border border-border bg-card p-6">
            <Icon className="text-primary mb-3" />
            <h3 className="font-semibold text-lg">{t}</h3>
            <p className="text-sm text-muted-foreground mt-1">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
