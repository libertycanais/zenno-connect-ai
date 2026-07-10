import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Solicitar acesso — Zenno Enterprise Intelligence OS" },
      { name: "description", content: "Crie sua conta no Zenno — sistema operacional de inteligência com Copilot multi-expert, decisões auditáveis e memória organizacional." },
      { property: "og:title", content: "Solicitar acesso — Zenno Enterprise Intelligence OS" },
      { property: "og:description", content: "Crie sua conta no Zenno — sistema operacional de inteligência com Copilot multi-expert, decisões auditáveis e memória organizacional." },
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
    <AuthLayout>
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary zenno-pulse-dot" />
          Solicitar acesso
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Ative sua organização</h1>
        <p className="text-sm text-muted-foreground">
          Provisiona workspace, Copilot e memória organizacional em segundos.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <Button
          onClick={handleGoogle}
          variant="outline"
          className="w-full h-11 zenno-focus-ring border-border/70 hover:border-primary/40"
        >
          <span className="inline-flex items-center gap-2">
            <GoogleIcon /> Continuar com Google
          </span>
        </Button>

        <div className="relative py-1" role="separator">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card/60 backdrop-blur px-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">ou</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Seu nome</Label>
              <Input id="full_name" name="full_name" required className="h-11 zenno-focus-ring" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization_name">Organização</Label>
              <Input id="organization_name" name="organization_name" required className="h-11 zenno-focus-ring" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email corporativo</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" className="h-11 zenno-focus-ring" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="new-password" placeholder="••••••••" className="h-11 zenno-focus-ring" />
          </div>
          <Button
            type="submit"
            className="w-full h-11 font-medium shadow-[var(--shadow-glow)] zenno-focus-ring"
            disabled={loading}
          >
            {loading ? "Provisionando…" : "Criar conta enterprise"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline zenno-focus-ring">
            Entrar
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.5l2.63-2.53C16.83 3.36 14.66 2.4 12 2.4 6.98 2.4 2.9 6.48 2.9 11.5S6.98 20.6 12 20.6c6.94 0 8.85-6.09 8.16-9.19H12z" />
    </svg>
  );
}
