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
import logo from "@/assets/zenno-logo.png";
import { triggerBoot } from "@/components/experience/BootScreen";

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
    triggerBoot();
    navigate({ to: "/app/workspace" });
  }

  async function handleGoogle() {
    triggerBoot();
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app/workspace" });
    if (result.error) { toast.error(String(result.error)); return; }
    if (!result.redirected) navigate({ to: "/app/workspace" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center text-center gap-3">
          <img
            src={logo}
            alt="ZENNO CRM AI"
            className="mx-auto block h-32 w-auto max-w-full object-contain drop-shadow-[0_0_18px_oklch(0.72_0.18_235/0.45)]"
          />
          <h1 className="text-2xl font-semibold leading-tight">Entrar na sua conta</h1>
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
