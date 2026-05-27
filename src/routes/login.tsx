import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — ZENNO CRM AI" },
      { name: "description", content: "Acesse sua conta ZENNO CRM AI para gerenciar leads, WhatsApp, campanhas Meta Ads e Google Ads em um só lugar." },
      { property: "og:title", content: "Entrar — ZENNO CRM AI" },
      { property: "og:description", content: "Acesse sua conta ZENNO CRM AI para gerenciar leads, WhatsApp, campanhas Meta Ads e Google Ads em um só lugar." },
      { property: "og:url", content: "https://zenno-connect-ai.lovable.app/login" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://zenno-connect-ai.lovable.app/login" }],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/app" });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
    if (result.error) { toast.error(String(result.error)); return; }
    if (!result.redirected) navigate({ to: "/app" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2 text-primary font-bold"><Sparkles size={18} /> ZENNO CRM AI</div>
          <h1 className="text-2xl font-semibold">Entrar na sua conta</h1>
          <CardTitle className="sr-only">Entrar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGoogle} variant="outline" className="w-full">Entrar com Google</Button>
          <div className="text-center text-xs text-muted-foreground">ou</div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            Não tem conta? <Link to="/signup" className="text-primary hover:underline">Criar conta</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
