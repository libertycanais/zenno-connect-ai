# Zenno AI Suite — Release Plan (Staging Enterprise)

> Documento vivo, aditivo. Não altera arquitetura, RLS, Provider Layer,
> contratos públicos ou endpoints existentes.

## Objetivo da release

Preparar o Zenno AI Suite para operação contínua em ambiente de **Staging
Enterprise**, com paridade estrutural com produção, sob observabilidade,
segurança e testes já consolidados nas Sprints anteriores. A release NÃO
introduz novas funcionalidades — apenas endurece o processo de entrega,
governança e rollback.

## Escopo

**Dentro do escopo**
- Consolidação de documentação operacional (release, staging, deploy, prod-readiness).
- Template de variáveis de ambiente (`.env.staging.example`).
- Confirmação dos *quality gates* automatizados (typecheck, testes, coverage, build).
- Verificação dos artefatos de deploy (Docker, docker-compose, healthchecks).

**Fora do escopo**
- Novas features de produto.
- Alterações em contratos públicos (`/api/public/*`), Provider Layer, RLS,
  schema do banco ou endpoints existentes.
- Migração para produção final (essa é a próxima etapa após validação de staging).

## Versão atual

- **App version**: `sprint-4-final` (tag lógica ao encerramento da Sprint 4).
- **Schema**: 100% das migrations aplicadas em `supabase/migrations/`.
- **CI**: pipeline `.github/workflows/ci.yml` verde (typecheck → test → coverage → build → audit).
- **Testes**: 313 testes passando (unit + integration + contract).

## Histórico das Sprints

### Sprint Infra 1 — Fundação operacional
- `Dockerfile` multi-stage (deps → build Nitro node-server → runtime Node 20 alpine).
- `docker-compose.yml` (app + worker placeholder + Postgres + Redis).
- Endpoints operacionais `/api/public/live`, `/ready`, `/health`.
- Logger JSON estruturado com redaction automática (`src/lib/logger.ts`).
- `.dockerignore`, `DEPLOYMENT.md`, `docs/DOCKER.md`.

### Sprint Segurança 2 — Endurecimento de dados
- `audit_log` particionado por mês com trigger append-only.
- Função `global_rate_limit_hit(key, limit, window)` para OAuth/webhooks/login.
- `SET search_path = pg_catalog, app_private, public` em todas as funções `SECURITY DEFINER`.
- Redaction em pipeline de log/audit.

### Sprint Arquitetura 3 — Provider Layer & Multi-tenant
- Provider Layer congelada: Ads (Meta/Google), WhatsApp (Uazapi), Payments
  (Stripe/MercadoPago), AI (Lovable).
- Fábricas + interfaces + tipagem forte + testes unitários por provider.
- Isolamento multi-tenant validado via RLS + `has_role()`.

### Sprint 3.5 — Segurança em profundidade
- Testes de fuzzing, provider leakage, tracking dispatch, webhook Uazapi.
- Middleware `requireSupabaseAuth` + attacher no client boundary.
- Rate limit por org/IP nos endpoints `/api/public/*`.

### Sprint 4 — Testes, contratos e CI
- WS-7: suíte `tests/integration/database/*` (RLS, indexes, integrity,
  migrations, rate-limit, security-definer, audit-log).
- WS-8: snapshots contratuais em `tests/contracts/*` (endpoints públicos,
  payloads Meta CAPI / Google OCI / Uazapi, `app_write_audit_log`).
- WS-9: GitHub Actions CI, `vitest` isolado, thresholds mínimos.
- WS-10: quality gate final consolidado (`PROJECT_READINESS.md`).

## Critérios para produção

Ordem obrigatória (todos verdes antes do go-live):

1. `bunx tsgo --noEmit` sem erros.
2. `bun test` — 100% verde, sem `.only`/`.skip` órfãos.
3. `bun test --coverage` acima dos thresholds (piso atual 20% global; alvo 60% nos módulos server).
4. `bun run build` verde para preset `node-server` (Docker) **e** preset Cloudflare (Lovable).
5. Todos os contratos públicos em `tests/contracts/*` congelados (snapshots atualizados intencionalmente).
6. RLS habilitado em 100% das tabelas `public.*` (verificado por `tests/integration/database/rls.test.ts`).
7. Runbook de rollback validado em staging (drill executado com sucesso).
8. Observabilidade externa plugada (Sentry/Datadog) e política de retenção do `audit_log` definida.

## Critérios para rollback

Disparar rollback imediato se **qualquer** um ocorrer nos primeiros 60 min pós-deploy:

- Aumento > 2% em 5xx nos endpoints `/api/public/*`.
- Latência p95 > 2× baseline por 5 min consecutivos.
- Falha de auth (login/OAuth) sustentada > 1 min.
- Divergência em snapshot de contrato público detectada em produção (via testes de smoke).
- Erro estrutural em `audit_log` (particionamento, insert bloqueado, RLS quebrado).
- Vazamento detectado (secret em log, PII fora de campo redacted).

## Plano de rollback

1. `pm2 restart zenno --update-env` com a imagem/tag anterior **ou**
   `docker compose up -d --no-deps zenno-app:previous`.
2. `supabase db reset --linked` **não é usado** — para migrations, reverter
   via migration inversa versionada (nunca truncar tabela em produção).
3. Reverter secrets alterados no deploy (snapshot em cofre externo).
4. Anúncio no canal de incident + registro em `docs/incidents/`.
5. Post-mortem em até 48h com root cause e ação corretiva.

## Estratégia de migração

- Cada migration em `supabase/migrations/` é **imutável** após merge na main.
- Alterações destrutivas (drop column, drop table) exigem 2 releases:
  1. Release N: adiciona nova estrutura + dual-write.
  2. Release N+1: remove estrutura antiga após validação em staging.
- Toda migration nova roda primeiro em staging por ≥ 24h antes de produção.

## Estratégia de banco

- Multi-tenant via `organization_id` + RLS + `has_role()`.
- `audit_log` particionado por mês, append-only, com trigger de bloqueio de UPDATE/DELETE.
- Índices auditados em `tests/integration/database/indexes.test.ts`.
- Funções `SECURITY DEFINER` com `search_path` fixo, testadas em `security-definer.test.ts`.

## Estratégia de backups

- **Supabase Cloud**: backup automático diário (padrão da plataforma) + PITR quando disponível no plano.
- **Self-hosted**: `pg_dump` diário via cron (ver `DEPLOYMENT.md` §11), retenção 30 dias, cópia offsite S3/Backblaze.
- Restore drill trimestral em ambiente scratch.

## Estratégia de logs

- `src/lib/logger.ts` emite JSON estruturado por linha, com redaction de chaves sensíveis.
- Campos obrigatórios: `timestamp`, `level`, `service`, `version`, `environment`,
  `request_id`, `trace_id`, `organization_id`, `user_id`, `event`, `message`.
- Coletor externo (Loki / Datadog / CloudWatch) consumindo stdout via driver
  Docker `json-file` ou `journald`.

## Estratégia de monitoramento

- Healthchecks: `/api/public/live` (liveness), `/ready` (readiness),
  `/health` (versão/uptime).
- Métricas alvo: taxa 5xx, latência p50/p95/p99 por rota, throughput por
  provider, taxa de retry em webhooks, uso de conexões Postgres.
- Alertas: 5xx > 1% em 5 min, p95 > 1s por 5 min, worker parado > 2 min,
  fila Redis > 1000 jobs.

## Estratégia de observabilidade

- **Logs**: agregador externo (obrigatório antes de produção).
- **Métricas**: exportadas via `/metrics` (a implementar em Sprint futura) ou
  scraping das próprias linhas JSON.
- **Traces**: `trace_id` + `request_id` propagados em todo server function e
  edge handler.
- **Erros**: Sentry (obrigatório antes de produção) plugado no client e no server.

## Plano de deploy

1. Merge em `main` → CI verde.
2. Tag `staging-YYYYMMDD-HHMM`.
3. Build Docker → registry.
4. Aplicar migrations pendentes em staging (`supabase db push`).
5. `docker compose up -d` (ou `pm2 reload`) em staging.
6. Smoke tests (`docs/DEPLOY_CHECKLIST.md`).
7. Soak 24h em staging.
8. Promoção para produção com mesma imagem + tag `prod-YYYYMMDD-HHMM`.

## Plano pós-deploy

### Checklist de validação
- [ ] `/api/public/live` retorna 200.
- [ ] `/api/public/ready` retorna 200 com todas as dependências `ok`.
- [ ] Login com email/senha OK.
- [ ] Login com Google OAuth OK.
- [ ] Criação de lead + persistência OK.
- [ ] Recebimento de webhook WhatsApp OK.
- [ ] Recebimento de webhook Meta/Google OK.
- [ ] `audit_log` recebendo eventos.
- [ ] Rate limit aplicado (teste com burst controlado).
- [ ] Logs chegando no coletor externo.
- [ ] Métricas visíveis no dashboard.

### Checklist de rollback
- [ ] Tag anterior identificada e disponível no registry.
- [ ] Snapshot de secrets validado.
- [ ] Runbook de rollback testado nos últimos 30 dias.
- [ ] Canal de comunicação de incidente aberto.
- [ ] Post-mortem agendado em até 48h.
