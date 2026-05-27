import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutDashboard, MessageSquare, BarChart3 } from "lucide-react";

const OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8b26309f-6ab7-4460-8284-486bdf725d21/id-preview-2c6d5c77--0e650211-1366-45fd-8deb-5cada506ca5c.lovable.app-1779810311108.png";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [
      { title: "ZENNO CRM AI — CRM com WhatsApp, Meta Ads e Google Ads" },
      { name: "description", content: "Centralize leads, atendimento WhatsApp, campanhas Meta Ads e Google Ads, financeiro e automações com IA em um único CRM multiempresa." },
      { property: "og:title", content: "ZENNO CRM AI — CRM com WhatsApp, Meta Ads e Google Ads" },
      { property: "og:description", content: "Centralize leads, atendimento WhatsApp, campanhas Meta Ads e Google Ads, financeiro e automações com IA em um único CRM multiempresa." },
      { property: "og:url", content: "https://zenno-connect-ai.lovable.app/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:title", content: "ZENNO CRM AI — CRM com WhatsApp, Meta Ads e Google Ads" },
      { name: "twitter:description", content: "Centralize leads, atendimento WhatsApp, campanhas Meta Ads e Google Ads, financeiro e automações com IA em um único CRM multiempresa." },
    ],
    links: [{ rel: "canonical", href: "https://zenno-connect-ai.lovable.app/" }],
  }),
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
            <h2 className="font-semibold text-lg">{t}</h2>
            <p className="text-sm text-muted-foreground mt-1">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
