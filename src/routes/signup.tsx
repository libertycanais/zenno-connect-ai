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

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Criar conta — ZENNO CRM AI" },
      { name: "description", content: "Crie sua conta ZENNO CRM AI grátis e organize leads, WhatsApp e campanhas Meta/Google Ads em uma única plataforma." },
      { property: "og:title", content: "Criar conta — ZENNO CRM AI" },
      { property: "og:description", content: "Crie sua conta ZENNO CRM AI grátis e organize leads, WhatsApp e campanhas Meta/Google Ads em uma única plataforma." },
      { property: "og:url", content: "https://zenno-connect-ai.lovable.app/signup" },
    ],
    links: [{ rel: "canonical", href: "https://zenno-connect-ai.lovable.app/signup" }],
  }),
  component: SignupPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Nome obrigatório").max(120),
  organization_name: z.string().trim().min(2, "Nome da empresa obrigatório").max(120),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      full_name: fd.get("full_name"),
      organization_name: fd.get("organization_name"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin + "/app",
        data: { full_name: parsed.data.full_name, organization_name: parsed.data.organization_name },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada! Verifique seu email se necessário.");
    navigate({ to: "/app" });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
    if (result.error) { toast.error(String(result.error)); return; }
    if (!result.redirected) navigate({ to: "/app" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2 text-primary font-bold"><Sparkles size={18} /> ZENNO CRM AI</div>
          <h1 className="text-2xl font-semibold">Criar sua conta</h1>
          <CardTitle className="sr-only">Criar conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGoogle} variant="outline" className="w-full">Cadastrar com Google</Button>
          <div className="text-center text-xs text-muted-foreground">ou</div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="full_name">Seu nome</Label><Input id="full_name" name="full_name" required /></div>
            <div className="space-y-1.5"><Label htmlFor="organization_name">Nome da empresa</Label><Input id="organization_name" name="organization_name" required /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" required autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
