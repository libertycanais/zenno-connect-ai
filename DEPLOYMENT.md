# Zenno CRM AI — Manual de Deploy em VPS Externa

Este manual ensina como rodar o projeto **fora do Lovable**, em sua própria VPS (Ubuntu/Debian), usando apenas ferramentas externas e open-source. O projeto é uma aplicação **TanStack Start (React 19 + Vite)** com backend **Supabase** (PostgreSQL + Auth + Storage).

---

## 1. Visão geral da arquitetura

```
┌─────────────┐      ┌────────────────────┐      ┌──────────────────┐
│   Browser   │ ───► │  Nginx (VPS)       │ ───► │  Node app :3000  │
└─────────────┘      │  - SSL / domínio   │      │  (TanStack SSR)  │
                     └────────────────────┘      └─────────┬────────┘
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │ Supabase (próprio ou │
                                                │  self-hosted Docker) │
                                                │  Postgres + Auth     │
                                                └──────────────────────┘
```

Você precisa de:
- **1 VPS Ubuntu 22.04+** (mínimo 2 vCPU / 2 GB RAM)
- **1 domínio** apontado para o IP da VPS (ex.: `app.seudominio.com.br`)
- **1 projeto Supabase próprio** (cloud em supabase.com — gratuito até 500 MB) **OU** Supabase self-hosted via Docker

---

## 2. Criar um projeto Supabase próprio

### 2.1 Opção A — Supabase Cloud (mais simples, recomendado)
1. Crie conta em https://supabase.com e clique **New project**.
2. Anote:
   - **Project URL** (ex.: `https://xxxx.supabase.co`)
   - **anon public key** (Settings → API)
   - **service_role key** (Settings → API — **segredo!**)
   - **Database password** (escolhido na criação)

### 2.2 Opção B — Self-hosted via Docker
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# edite .env com senhas fortes (POSTGRES_PASSWORD, JWT_SECRET, etc.)
docker compose up -d
```
Studio fica em `http://SEU_IP:8000`. Pegue as chaves geradas no `.env`.

---

## 3. Aplicar as migrations do banco

Todas as migrations SQL do projeto estão em `supabase/migrations/`. Aplique-as no seu Supabase:

```bash
# Instale o CLI do Supabase
npm install -g supabase

# Faça login (apenas Cloud)
supabase login

# Linke ao seu projeto
supabase link --project-ref SEU_PROJECT_REF

# Envie todas as migrations
supabase db push
```

**Alternativa manual:** abra o SQL Editor do Supabase Studio, e cole cada arquivo de `supabase/migrations/` em ordem alfabética, executando um por um.

---

## 4. Configurar autenticação

No Supabase Studio → **Authentication → Providers**:
- Ative **Email** (desative "Confirm email" apenas se quiser pular a verificação).
- (Opcional) Ative **Google**: crie credenciais OAuth em https://console.cloud.google.com, cole Client ID/Secret.

No Supabase Studio → **Authentication → URL Configuration**:
- **Site URL:** `https://app.seudominio.com.br`
- **Redirect URLs:** adicione `https://app.seudominio.com.br/**`

---

## 5. Preparar a VPS

### 5.1 Pacotes base
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx ufw certbot python3-certbot-nginx

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Bun (opcional, mais rápido que npm)
curl -fsSL https://bun.sh/install | bash

# PM2 (gerenciador de processo)
sudo npm install -g pm2
```

### 5.2 Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 6. Clonar e configurar o projeto

```bash
cd /opt
sudo git clone <URL-DO-SEU-REPO-GIT> zenno
sudo chown -R $USER:$USER zenno
cd zenno

# Instalar dependências
bun install        # ou: npm install
```

### 6.1 Criar arquivo `.env`
Crie `/opt/zenno/.env` com:

```env
# --- Cliente (build-time) ---
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
VITE_SUPABASE_PROJECT_ID=xxxx

# --- Servidor (runtime) ---
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # NUNCA exponha no front

# Opcionais (se for usar)
LOVABLE_API_KEY=                 # deixe vazio se não usar Lovable AI
META_APP_ID=
META_APP_SECRET=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
```

> ⚠️ O template foi pensado para Cloudflare Workers no Lovable. Para rodar em Node puro, veja a seção **7.1** abaixo.

---

## 7. Build & adaptar para Node

### 7.1 Substituir o entry de Cloudflare por Node
Edite `vite.config.ts` e remova o preset cloudflare — o `@lovable.dev/vite-tanstack-config` aplica-o automaticamente em build. Crie um override:

```ts
// vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: { server: { entry: "server", preset: "node-server" } },
});
```

Apague (ou ignore) `wrangler.jsonc` — só serve para Cloudflare.

### 7.2 Build
```bash
bun run build      # gera .output/ (Nitro node-server)
```

### 7.3 Testar localmente
```bash
node .output/server/index.mjs
# abra http://localhost:3000
```

---

## 8. Subir com PM2

```bash
cd /opt/zenno
pm2 start .output/server/index.mjs --name zenno --env production
pm2 save
pm2 startup systemd   # cole o comando que ele imprimir
```

Comandos úteis: `pm2 logs zenno`, `pm2 restart zenno`, `pm2 status`.

---

## 9. Nginx + HTTPS

Crie `/etc/nginx/sites-available/zenno`:

```nginx
server {
  listen 80;
  server_name app.seudominio.com.br;

  client_max_body_size 25M;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zenno /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL automático
sudo certbot --nginx -d app.seudominio.com.br
```

---

## 10. Webhooks externos (WhatsApp, Meta, Google Ads)

Atualize as URLs nos serviços externos para o seu domínio:
- **WhatsApp (UAZAPI):** `https://app.seudominio.com.br/api/public/whatsapp/webhook/{instance_id}`
- **Meta OAuth callback:** `https://app.seudominio.com.br/api/public/meta/oauth/callback`
- **Google Ads OAuth:** `https://app.seudominio.com.br/api/public/google-ads/oauth/callback`

---

## 11. Backup do banco

```bash
# diariamente via cron
0 3 * * * pg_dump "postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres" \
  | gzip > /var/backups/zenno-$(date +\%F).sql.gz
```

Mantenha pelo menos 30 dias e copie para um S3/Backblaze.

---

## 12. Atualizações

```bash
cd /opt/zenno
git pull
bun install
bun run build
pm2 restart zenno

# se houver novas migrations:
supabase db push
```

---

## 13. Estrutura de pastas

```
zenno/
├── src/
│   ├── routes/          # páginas (file-based routing)
│   ├── lib/*.functions.ts # server functions (RPC tipado)
│   ├── components/      # UI (shadcn + Tailwind)
│   ├── integrations/supabase/  # clientes gerados — NÃO EDITAR
│   └── styles.css       # design tokens
├── supabase/
│   ├── migrations/      # SQL versionado
│   └── config.toml
├── public/              # estáticos
├── .env                 # variáveis de ambiente
├── vite.config.ts
└── package.json
```

---

## 14. Funcionalidades incluídas

- ✅ **Autenticação** (email/senha + Google opcional)
- ✅ **Multi-tenant** com `organizations` + `user_roles` (owner/admin/manager)
- ✅ **CRM Leads** com pipeline Kanban
- ✅ **WhatsApp** (UAZAPI) com chat em tempo real
- ✅ **Meta Ads / Google Ads** com OAuth e sincronização
- ✅ **Sigma** (HTTP genérico)
- ✅ **Financeiro** com categorias, transações
- ✅ **Integrações de pagamento** (Asaas, Mercado Pago)
- ✅ **Automações** (gatilhos + ações)
- ✅ **IA** (qualificação de leads via Lovable AI ou OpenAI compatível)
- ✅ **Tickets** de suporte
- ✅ **Assinatura** com trial de 15 dias (Básico R$29,99 / Completo R$69,99)
- ✅ **Dashboard** com gráficos (Recharts) e status de integrações

---

## 15. Cobrança real da assinatura

A tabela `subscriptions` já controla planos e trial. Para cobrar de verdade integre um gateway:
- **Stripe** (internacional): SDK `stripe` + webhook em `/api/public/stripe/webhook`
- **Mercado Pago / Asaas** (BR): já há integrações; basta criar planos recorrentes e atualizar `plan` + `current_period_end` no webhook.

Esqueleto sugerido:
```ts
// src/routes/api/public/billing.webhook.ts
// 1. validar assinatura HMAC do provider
// 2. localizar organization_id (metadata do checkout)
// 3. supabaseAdmin.from('subscriptions').update({ plan, status, current_period_end })
```

---

## 16. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Tela branca, 500 no SSR | env faltando | conferir `.env` e reiniciar PM2 |
| 401 em todas as chamadas | bearer não anexado | confirmar `attachSupabaseAuth` em `src/start.ts` |
| `permission denied for table` | GRANT faltando | reaplicar migrations |
| RLS bloqueando query | usuário sem `organization_id` no profile | rodar `handle_new_user` manualmente |
| WhatsApp sem mensagens | webhook URL errada | atualizar UAZAPI |

---

## Suporte

- Docs TanStack Start: https://tanstack.com/start
- Docs Supabase: https://supabase.com/docs
- Docs Nginx: https://nginx.org/en/docs/

Boa sorte! 🚀
