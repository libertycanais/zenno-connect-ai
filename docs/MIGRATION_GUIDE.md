# Migration Guide — Zenno AI Suite → Stack Própria

**Escopo:** guia para migrar o Zenno da stack Lovable Cloud (Cloudflare Workers + Supabase gerenciado) para uma stack proprietária, preservando 100% da arquitetura congelada (Freeze v1.0).

**Regra fundamental:** replicar contratos, não copiar implementação. Todo desvio arquitetural exige novo ADR.

---

## 1. Inventário de dependências de plataforma

| Camada | Hoje (Lovable) | Substituto sugerido |
|---|---|---|
| Runtime server | Cloudflare Workers (nodejs_compat) | Node 20 LTS, Bun, Deno, ou Workers próprio |
| Banco | Supabase gerenciado (PostgreSQL 15) | PostgreSQL 15+ auto-hospedado ou RDS/Cloud SQL |
| Auth | Supabase Auth (GoTrue) | GoTrue self-hosted, Auth.js, Clerk, ou próprio (JWT + refresh) |
| Storage | Supabase Storage | S3/R2/GCS + policies equivalentes |
| Realtime | Supabase Realtime | LISTEN/NOTIFY + WebSocket próprio, ou Ably/Pusher |
| Edge Functions | Server Functions TanStack (Workers) | Manter server functions; runtime = Node/Bun/Workers |
| Secrets | Lovable Cloud Secrets | Doppler, Vault, AWS Secrets Manager, Env Vars do orquestrador |
| CI | GitHub Actions | Mantido (`.github/workflows/ci.yml`) |

---

## 2. Ordem de migração (recomendada)

1. **Postgres** — restaurar dump; aplicar todas as migrations em `supabase/migrations/` (SQL puro, portável). Validar RLS + GRANTs com `docs/runbooks/postgres.md`.
2. **Auth** — subir GoTrue self-hosted apontando para o mesmo Postgres. Migrar `auth.users` preservando IDs (RLS depende do `auth.uid()`).
3. **Storage** — migrar buckets 1:1 para S3-compat. Regravar signed URLs curtos, nunca públicos.
4. **Runtime** — build TanStack Start para o runtime alvo. Ver `docs/DOCKER.md` e `Dockerfile` já preparados.
5. **Provider Layer** — nenhuma mudança necessária (é a razão de existir da camada). Apenas trocar chaves via secrets.
6. **Observabilidade** — plugar Prometheus/Grafana/OTEL nos endpoints já expostos.
7. **DNS / Domínio** — cutover em janela agendada. Rollback documentado em `docs/runbooks/rollback.md`.

---

## 3. Variáveis de ambiente

Todas obrigatórias em produção. Template completo em `.env.staging.example`.

Categorias:
- **Postgres:** `DATABASE_URL`, `SUPABASE_DB_URL`
- **Auth:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable), `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- **AI Providers:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, ...
- **Marketing Connectors:** `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `META_APP_ID`, `META_APP_SECRET`
- **Payments:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`
- **WhatsApp:** `UAZAPI_URL`, `UAZAPI_TOKEN`
- **Cripto:** `ENCRYPTION_KEY` (AES-256-GCM, 32 bytes base64) — usado em tokens OAuth armazenados
- **Observabilidade:** `SENTRY_DSN` (opcional), `PROMETHEUS_ENABLED`

**NUNCA** prefixar segredos server-only com `VITE_`.

---

## 4. Migrations Postgres

- Todas em `supabase/migrations/` são **SQL vanilla + extensões padrão** (`pgcrypto`, `pg_cron`, `uuid-ossp`).
- Rodar via `psql -f` na ordem alfabética.
- Após aplicar, executar `tests/integration/database/*` para confirmar RLS, integridade e índices.
- `pg_cron` é usado para prune de `audit_log` e refresh de materialized views — em runtime alvo sem pg_cron, portar para cron externo.

---

## 5. Preservação dos invariantes

Checklist obrigatório antes do cutover:

- [ ] RLS ativo em 100% das tabelas públicas (`tests/integration/database/rls.test.ts` verde)
- [ ] `organization_id` presente em toda linha e toda policy
- [ ] Provider Layer intocado — nenhum consumer importa SDK direto
- [ ] Tokens OAuth criptografados AES-256-GCM
- [ ] Webhooks com HMAC + idempotência (`webhook_events`)
- [ ] Audit log gravando e prune agendado
- [ ] Suíte de testes verde no ambiente alvo
- [ ] `tsgo --noEmit` limpo
- [ ] Smoke tests do `docs/DEPLOY_CHECKLIST.md` §6 aprovados

---

## 6. Rollback

Documentado em `docs/runbooks/rollback.md`. Estratégia:
- DNS TTL curto (≤ 60s) na janela de cutover
- Postgres com snapshot pré-cutover
- Blue/Green nos runtimes de app

---

## 7. Referências

- `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_DECISIONS.md`, `docs/ARCHITECTURE_FREEZE.md`
- `docs/SECURITY.md`, `docs/DISASTER_RECOVERY.md`
- `docs/DOCKER.md`, `DEPLOYMENT.md`, `Dockerfile`, `docker-compose.yml`
- `mem/architecture/deploy-independence.md`
