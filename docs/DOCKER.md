# Docker — Zenno SaaS

Este documento cobre o build/execução em Docker para deploy fora do Lovable.
**A infraestrutura Lovable/Cloudflare continua funcionando normalmente** — os
artefatos Docker são aditivos, apenas habilitam deploy externo e reprodutibilidade
em GitHub/Coolify/Railway/Render/Fly.io/K8s.

## Arquivos

| Arquivo | Papel |
|---|---|
| `Dockerfile` | Build multi-stage (deps → build Nitro node-server → runtime Node 20 alpine) |
| `docker-compose.yml` | Stack completo (`zenno-app` + `zenno-worker` + `postgres` + `redis`) |
| `.dockerignore` | Exclui `node_modules`, `.output`, `.env`, `mem/`, etc. |

## Preset Nitro

O template padrão do Lovable compila para **Cloudflare Workers**. O `Dockerfile`
força `NITRO_PRESET=node-server` na etapa de build para gerar um bundle Node
compatível com qualquer host que rode Node 20+. Nada em `vite.config.ts` é
alterado — a mudança acontece apenas em build-time via env var.

## Endpoints de health (Kubernetes/Coolify/LB)

| Endpoint | Papel | Consulta dependências? |
|---|---|---|
| `/api/public/live` | Liveness — "o processo está vivo?" | Não |
| `/api/public/ready` | Readiness — "pronto para receber tráfego?" | Sim (Postgres, Redis) |
| `/api/public/health` | Overview — versão, uptime | Não |

O `Dockerfile` já registra `HEALTHCHECK` apontando para `/api/public/live`.
No compose, cada serviço tem `healthcheck` próprio; `zenno-app` só sobe após
`postgres` e `redis` ficarem `healthy`.

## Logs estruturados

Toda saída server-side deve usar `import { log } from "@/lib/logger"`:

```ts
log.info(
  { event: "user.login", organization_id, user_id, request_id },
  "user signed in",
);
```

Formato JSON emitido (uma linha por evento — pronto para Loki/Datadog/CloudWatch):

```json
{
  "timestamp": "2026-07-08T12:34:56.789Z",
  "level": "info",
  "service": "zenno-api",
  "version": "abc123",
  "environment": "production",
  "request_id": "req_...",
  "trace_id": "...",
  "organization_id": "...",
  "user_id": "...",
  "event": "user.login",
  "message": "user signed in"
}
```

Chaves sensíveis (`authorization`, `token`, `password`, `api_key`, `secret`,
`webhook_secret`, `service_role_key`, etc.) são redigidas automaticamente para
`[REDACTED]` mesmo se passadas por engano.

## Variáveis de ambiente

### Build-time (embebidas no bundle client — precisam existir no `docker build`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Runtime (server-only — passe via `--env-file` ou compose)

| Variável | Uso |
|---|---|
| `SUPABASE_URL` | Backend Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Client auth-scoped no server |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin (bypass RLS) — nunca no front |
| `DATABASE_URL` | Postgres direto (worker/migrations locais) |
| `REDIS_URL` | ⚠️ Reservado — N/A na baseline v1.0 (sem fila externa) |
| `SERVICE_NAME` | Rótulo nos logs (`zenno-api`, `zenno-worker`) |
| `APP_ENV` | `production` \| `staging` \| `development` |
| `APP_VERSION` \| `GIT_SHA` | Rastreabilidade de deploy nos logs |
| `LOVABLE_API_KEY` | Gateway IA (opcional) |
| `META_APP_ID` / `META_APP_SECRET` | OAuth Meta Ads (opcional) |
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | OAuth Google Ads (opcional) |

## Comandos

```bash
# Build isolado
docker build \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
  --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
  -t zenno-app .

# Run isolado (com Supabase Cloud externo)
docker run --rm -p 3000:3000 --env-file .env zenno-app

# Stack completo (app + worker + postgres + redis)
docker compose up --build

# Verificar saúde
curl http://localhost:3000/api/public/live
curl http://localhost:3000/api/public/ready | jq
curl http://localhost:3000/api/public/health | jq

# Logs estruturados (parseáveis com jq)
docker compose logs -f zenno-app | grep '^{' | jq
```

## Deploy externo

- **Coolify/Railway/Render/Fly**: apontar o repo → build usa `Dockerfile`
  automaticamente. Configurar env vars no painel do provedor.
- **Kubernetes**: expor `/api/public/live` como `livenessProbe` e
  `/api/public/ready` como `readinessProbe`.
- **AWS/GCP/DO**: buildar imagem, publicar em ECR/Artifact Registry/Container
  Registry e rodar em ECS/Cloud Run/App Platform.

## Próximas etapas (Sprint Segurança 2)

Após validar o Sprint Infra 1:
1. `audit_log` particionado + triggers + retenção
2. `global_rate_limit_hit(key, limit, window)` em OAuth/webhooks/login
3. `SET search_path = pg_catalog, app_private, public` nas funções SECURITY DEFINER
