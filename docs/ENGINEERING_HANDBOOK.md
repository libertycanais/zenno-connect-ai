# Zenno AI Suite — Engineering Handbook

> Guia oficial para engenheiros que trabalham no Zenno AI Suite. Consolida
> padrões, fluxos, segurança, deploy e onboarding. Documento vivo — atualize
> junto com o código que muda uma prática.

---

## 1. Introdução

### Objetivo do projeto
Zenno AI Suite é um SaaS B2B multi-tenant que unifica CRM, WhatsApp, Meta
Ads, Google Ads, financeiro, tracking próprio, atribuição, IA e automações
em uma única plataforma.

### Visão geral
- **Frontend**: painel administrativo (Kanban, chat, dashboards, forms).
- **Backend**: server functions tipadas + endpoints públicos para webhooks
  e tracking.
- **Integrações**: Meta CAPI, Google Offline Conversion, Uazapi (WhatsApp),
  Stripe/MercadoPago/Asaas, Lovable AI Gateway.
- **Multi-tenant**: `organization_id` + RLS Postgres.

### Stack
- **Framework**: TanStack Start v1 (React 19 + Vite 7).
- **Roteamento**: TanStack Router (file-based, tipado).
- **Data**: TanStack Query.
- **Backend**: `createServerFn` + rotas `src/routes/api/public/*`.
- **UI**: shadcn/ui + Tailwind v4 (tokens semânticos).
- **DB**: PostgreSQL 16 via Supabase (Cloud ou self-hosted).
- **Auth/Storage/Realtime**: Supabase.
- **Deploy**: Cloudflare Workers (Lovable) **ou** Docker Node 20 (externo).
- **Testes**: Vitest + Playwright (planejado para E2E).
- **CI**: GitHub Actions (`.github/workflows/ci.yml`).

### Arquitetura
Ver `docs/ARCHITECTURE.md` (visão detalhada) e
`docs/ARCHITECTURE_DECISIONS.md` (ADRs).

---

## 2. Organização do repositório

```
zenno/
├── src/
│   ├── routes/                # Páginas + endpoints públicos (file-based)
│   │   ├── __root.tsx         # Root layout (head, providers)
│   │   ├── index.tsx          # Home
│   │   ├── app.*.tsx          # Painel autenticado
│   │   └── api/public/*.ts    # Webhooks, tracking, health, oauth callbacks
│   ├── providers/             # Provider Layer (ads, whatsapp, payments, ai)
│   │   ├── ads/
│   │   ├── whatsapp/
│   │   ├── payments/
│   │   ├── ai/
│   │   └── common/
│   ├── lib/                   # Server functions, utils, logger, auth
│   │   ├── *.functions.ts     # createServerFn (client-safe imports)
│   │   ├── *.server.ts        # Helpers server-only
│   │   ├── logger.ts
│   │   └── rate-limit.server.ts
│   ├── hooks/                 # Hooks React reutilizáveis
│   ├── components/            # UI reutilizável (shadcn + custom)
│   ├── modules/               # Domínios (crm, whatsapp, ...)
│   ├── integrations/supabase/ # AUTO-GERADO — nunca editar manualmente
│   └── styles.css             # Tokens Tailwind v4
├── tests/
│   ├── unit/                  # Providers, utils, hooks isolados
│   ├── integration/           # API, database, security
│   │   ├── api/public/
│   │   ├── database/          # rls, indexes, migrations, audit-log, ...
│   │   └── security/
│   ├── contracts/             # Snapshots de contratos públicos
│   ├── fixtures/              # Payloads canônicos reutilizáveis
│   ├── helpers/               # pg, auth, render, tenant, ...
│   └── mocks/                 # supabase, providers, fetch
├── supabase/
│   ├── migrations/            # SQL versionado (imutável após merge)
│   └── config.toml            # AUTO-GERADO
├── docs/                      # Documentação viva
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── DEPLOY_CHECKLIST.md
│   ├── DOCKER.md
│   ├── ENGINEERING_HANDBOOK.md
│   ├── PRODUCTION_READINESS.md
│   ├── PROJECT_READINESS.md
│   ├── RELEASE_PLAN.md
│   ├── SECURITY.md
│   └── STAGING_CHECKLIST.md
├── scripts/                   # Utilitários (quando existirem)
├── public/                    # Estáticos (robots, sitemap, favicon)
├── Dockerfile
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.staging.example
├── vitest.config.ts
├── vite.config.ts
└── package.json
```

**Regras invioláveis de pasta**
- `src/integrations/supabase/*` → auto-gerado, nunca editar.
- `src/routes/api/public/*` → contrato público, mudanças exigem snapshot review.
- `supabase/migrations/*` → imutável após merge em `main`.
- Sem `src/pages/` (isso é convenção Next; usamos `src/routes/`).

---

## 3. Fluxo de desenvolvimento

### 3.1 Como criar uma feature
1. Abrir issue com escopo, critério de aceite e impacto em contratos/RLS.
2. Se toca banco → **primeiro** ADR (se estrutural) ou migration nova.
3. Criar branch `feat/<slug>`.
4. Implementar: migration → server function → UI → testes.
5. Rodar `bunx tsgo --noEmit && bun test && bun run build`.
6. Abrir PR seguindo o **Checklist para Pull Request** (seção 12).

### 3.2 Como abrir PR
- Título: `feat: <o que>` / `fix: <o que>` / `docs: ...` / `chore: ...`.
- Descrição: contexto → decisão → como testar → screenshots (se UI).
- Link para issue e para ADR (se aplicável).
- Marcar reviewers apropriados (segurança se toca RLS/OAuth/tracking).

### 3.3 Como criar migration
1. Nome: `YYYYMMDDHHMMSS_<slug>.sql` em `supabase/migrations/`.
2. Estrutura obrigatória para toda nova tabela em `public.*`:
   ```sql
   CREATE TABLE public.<nome> (...);
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<nome> TO authenticated;
   GRANT ALL ON public.<nome> TO service_role;
   ALTER TABLE public.<nome> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "<descrição>" ON public.<nome> ...;
   ```
3. Toda coluna FK → índice.
4. `created_at`/`updated_at TIMESTAMPTZ DEFAULT now()` obrigatórios.
5. Nunca DROP destrutivo direto: fazer em 2 releases (dual-write → drop).

### 3.4 Como alterar banco
- Sempre via migration versionada. Nunca `psql` manual em staging/prod.
- Toda alteração roda em staging ≥ 24h antes de produção.
- `tests/integration/database/*` deve continuar verde.

### 3.5 Como criar Provider
1. Interface em `src/providers/<dominio>/<dominio>-provider.interface.ts`.
2. Implementação em `src/providers/<dominio>/<vendor>.provider.ts`.
3. Registrar na fábrica `src/providers/<dominio>/<dominio>-provider.factory.ts`.
4. Selecionar por env var (`<DOMINIO>_PROVIDER`).
5. Adicionar testes unitários em `tests/unit/providers/<dominio>/`.
6. Se emite payload para vendor externo → snapshot em `tests/contracts/provider-payloads.contract.test.ts`.

### 3.6 Como criar Server Function
```ts
// src/lib/<dominio>.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const fooBar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ...
    return { ok: true };
  });
```
- `process.env.*` só dentro de `.handler()`.
- Helpers server-only em arquivo `*.server.ts` (importados apenas pelo handler).
- Nunca chamar server function protegida de loader em rota pública (falha em SSR).

### 3.7 Como criar Endpoint Público
```ts
// src/routes/api/public/<slug>.ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/<slug>")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Verificar assinatura HMAC / public key
        // 2. Rate limit
        // 3. Validar payload com Zod
        // 4. Processar
        // 5. Registrar em audit_log
        return Response.json({ ok: true });
      },
    },
  },
});
```
- **Toda alteração aqui é breaking change** → snapshot em `tests/contracts/public-endpoints.contract.test.ts` deve ser revisado explicitamente.

### 3.8 Como criar componente React
- Arquivo em `src/components/<Nome>.tsx` (PascalCase).
- Interface `Props` exportada nomeada.
- `cn()` de `@/lib/utils` para classes condicionais.
- **Somente tokens semânticos** (`bg-background`, `text-primary`, ...).
- Mobile-first (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
- Máx. 150 linhas — excedeu, extrair sub-componentes.
- Sem `useEffect` para estado derivado.

### 3.9 Como criar teste
- **Unit**: `tests/unit/<caminho>/<arquivo>.test.ts` (mock providers e supabase).
- **Integration**: `tests/integration/<dominio>/<arquivo>.test.ts` (usa helpers `pg`, `auth`, `tenant`).
- **Contract**: `tests/contracts/<arquivo>.contract.test.ts` (snapshot inline).
- Usar fixtures de `tests/fixtures/*` — nunca hard-codar payloads soltos.

---

## 4. Padrões obrigatórios

### Naming
- Arquivos server function: `<dominio>.functions.ts`.
- Arquivos server-only helpers: `<slug>.server.ts`.
- Componentes: PascalCase.
- Hooks: `useXxx` camelCase.
- Tabelas: `snake_case_plural`.
- FKs: `singular_id` (`organization_id`, `user_id`).
- Env vars: `SCREAMING_SNAKE_CASE`; públicas ao client precisam prefixo `VITE_`.

### Imports
- Absolutos via `@/…` (configurado no `tsconfig.json`).
- Nunca importar `.server.ts` a partir de componente.
- Nunca importar `src/integrations/supabase/client.server.ts` no top-level de `*.functions.ts` — usar dynamic import dentro do handler.

### Pastas
- Server functions em `src/lib/` ou próximo da rota.
- Nunca colocar server function em `src/server/` (bloqueado por import protection).

### Env Vars
- Server-only: lidas de `process.env.X` **dentro** do `.handler()`.
- Client (público): `import.meta.env.VITE_X`.
- Nunca colocar secret em `VITE_*`.
- Template canônico: `.env.staging.example`.

### Logs
- Sempre via `import { log } from "@/lib/logger"`.
- Formato JSON, uma linha por evento.
- Campos-chave: `event`, `organization_id`, `user_id`, `request_id`, `trace_id`.
- Chaves sensíveis (`authorization`, `token`, `password`, `api_key`, `secret`) são redigidas automaticamente.

### Errors
- Server functions: lançar `Error` com mensagem descritiva; middleware traduz para status HTTP.
- Endpoints públicos: retornar `Response` com status apropriado + body JSON `{ error }`.
- Nunca vazar stacktrace em produção.

### DTOs / Schemas / Zod
- Todo input de server function e endpoint público → validado com Zod em `.inputValidator()` ou no handler.
- DTOs de saída explícitos, sem `any`.
- Tipos de banco vêm de `src/integrations/supabase/types.ts` (auto-gerado).

### React Query
- Toda leitura via `queryOptions` compartilhado + `useSuspenseQuery` no componente + `context.queryClient.ensureQueryData` no loader.
- `staleTime` por query, nunca global.
- Nunca `useEffect + fetch` para dados iniciais.

### Server Functions
- Um handler por função, sem lógica compartilhada em módulo top-level (o splitter remove).
- Middleware `requireSupabaseAuth` obrigatório se acessa dados protegidos.
- Não chamar em loader de rota pública.

---

## 5. Segurança

### RLS
- **100% das tabelas `public.*`** com `ENABLE ROW LEVEL SECURITY`.
- Toda policy referencia `auth.uid()` ou `has_role(auth.uid(), org, role)` ou `current_org_id()`.
- Validado em `tests/integration/database/rls.test.ts`.

### Provider Layer
- Nunca chamar SDK vendor diretamente fora de `src/providers/**`.
- Consumidores dependem da interface, nunca da implementação.
- Payloads externos congelados por snapshot contratual.

### OAuth
- `state` assinado + verificação de origem + PKCE quando o provider suporta.
- `client_secret` só em `process.env`, nunca em log.
- Refresh tokens criptografados em repouso (via coluna `encrypted_*` quando aplicável).

### Tracking
- Public key por organização (rotacionável).
- Allowlist de origem.
- Rate limit por org+IP.
- Payload sanitizado antes de sair para vendor.

### Audit Log
- Particionado por mês, append-only via trigger.
- Toda ação sensível (login, oauth, webhook, mutação em tabela crítica) registra evento.
- Redaction automática.

### Rate Limit
- Função `global_rate_limit_hit(key, limit, window)`.
- Aplicado em login, OAuth callbacks, webhooks e `/api/public/track/*`.

### Secrets
- Sempre via cofre externo (Doppler/Vault/1Password/Secrets Manager).
- Nunca em código, nunca em log.
- Rotação < 90 dias para OAuth/webhook secrets.

### LGPD
- `audit_log` cobre trilha de auditoria mínima.
- Política de retenção e fluxo de esquecimento — pendente (bloqueador para produção, ver `PRODUCTION_READINESS.md`).

---

## 6. Banco

### Migrações
- Uma migration por mudança lógica; imutável após merge.
- Aplicar em staging ≥ 24h antes de produção.
- Nunca `db reset` fora de dev local.

### Índices
- Toda FK indexada.
- Toda coluna usada em `WHERE`, `ORDER BY`, `JOIN` frequente → índice.
- Índices auditados em `tests/integration/database/indexes.test.ts`.

### Triggers
- `updated_at` via trigger `update_updated_at_column`.
- `audit_log` bloqueia UPDATE/DELETE por trigger.
- Trigger nova → teste em `tests/integration/database/*`.

### Policies
- Nomes descritivos: `"Users can read their org data"`.
- Sempre `USING` + `WITH CHECK` em INSERT/UPDATE.

### SECURITY DEFINER
- Somente quando estritamente necessário (bypass controlado de RLS).
- **Obrigatório**: `SET search_path = pg_catalog, app_private, public`.
- Cobertura em `tests/integration/database/security-definer.test.ts`.

### search_path
- Nunca deixar mutável em função `SECURITY DEFINER`.
- Ordem obrigatória: `pg_catalog, app_private, public`.

---

## 7. Testes

### Unit
- Vitest, mocks para supabase e fetch.
- Providers isolados: fábrica retorna correto por env.

### Integration
- Executa contra Postgres real (ver `tests/helpers/pg.ts`).
- Cobre API, RLS, indexes, integrity, migrations, rate-limit, security-definer, audit-log.

### Contracts
- Snapshots inline em `tests/contracts/*.contract.test.ts`.
- Cobre: endpoints `/api/public/*`, payloads Meta CAPI / Google OCI / Uazapi, assinatura `app_write_audit_log`.
- Falha em snapshot = decisão consciente (aprovar `--update` só com PR review).

### Database
- Toda tabela nova → passa em `rls.test.ts`.
- Toda coluna FK nova → índice detectado em `indexes.test.ts`.

### Security
- Fuzzing de inputs.
- Provider leakage (secrets não vazam para consumidores).
- Multi-tenant (cross-tenant read/write bloqueado).

### Snapshots
- Nunca aprovar sem revisar diff.
- Snapshots de payload externo são contrato — mudança = coordenação com integração.

### Coverage
- Piso: 20% global.
- Alvo: 60% em `src/lib/*.functions.ts` e `src/providers/**`.
- Relatório salvo em `coverage/` no CI.

### CI
- Pipeline: `typecheck → test → coverage → build → audit`.
- Cache do Bun por hash de `bun.lockb`/`package.json`.

---

## 8. Deploy

### Docker
- `Dockerfile` multi-stage (deps → build Nitro node-server → runtime Node 20 alpine).
- `docker-compose.yml` reprodutível (app + worker placeholder + Postgres + Redis).
- Healthcheck aponta para `/api/public/live`.

### Cloudflare (Lovable)
- Target padrão; preset Cloudflare aplicado pelo template.
- Restrições: sem `child_process`, `sharp`, `puppeteer`, `fs.watch`.

### Coolify / Railway / Render
- Apontar para repo → detectam `Dockerfile` automaticamente.
- Configurar env vars no painel (ver `.env.staging.example`).

### AWS
- ECS Fargate: imagem no ECR + task definition; ALB fazendo TLS.
- Alternativa: EKS com healthchecks `/live` e `/ready`.

### GCP
- Cloud Run: deploy da imagem, min-instances ≥ 1 para evitar cold start.

### DigitalOcean
- App Platform: apontar repo + Dockerfile.
- Alternativa: Droplet + Coolify.

---

## 9. Observabilidade

### Logs
- JSON estruturado via `@/lib/logger`, redaction automática.
- Coletor externo (Loki/Datadog/CloudWatch) obrigatório antes de produção.

### Tracing
- `request_id` + `trace_id` propagados em todo handler.
- OTel exporter — planejado.

### Métricas
- Endpoint `/metrics` (Prometheus format) — planejado.
- Alvos: 5xx rate, latência p50/p95/p99, throughput por provider, fila Redis, uso de conexões Postgres.

### Alertas
- 5xx > 1% em 5 min.
- p95 > 1s em 5 min.
- Fila Redis > 1000 jobs.
- `audit_log` sem eventos > 5 min.

### Sentry (planejado)
- Client + server, ambientes `staging` / `production`.
- `SENTRY_TRACES_SAMPLE_RATE=0.1` inicial.

### OpenTelemetry (planejado)
- Exporter OTLP para provedor externo.
- Instrumentar server functions e endpoints públicos.

---

## 10. Boas práticas

### O que fazer
- TypeScript strict, sempre.
- Tokens semânticos para toda cor.
- Mobile-first.
- RLS em toda tabela nova.
- Validar input com Zod.
- Escrever teste antes de fix (TDD em bug crítico).
- Rodar quality gate antes de push.

### O que nunca fazer
- Hard-code de cor (`bg-blue-500`, `text-white`).
- `service_role` no frontend.
- `useEffect` para estado derivado.
- Chamar SDK vendor fora de `src/providers/**`.
- Editar `src/integrations/supabase/*.ts` (auto-gen).
- Editar `src/routeTree.gen.ts`.
- Modificar migration já mergeada.
- Aprovar snapshot contratual sem revisar diff.
- Chamar server function protegida em loader de rota pública.

### Anti-patterns
- Estado global desnecessário (usar Query + Router).
- Props drilling > 2 níveis (usar contexto ou compor).
- `key={index}` em listas.
- `any` (usar `unknown` + narrow).
- Query N+1 (join no banco ou usar `select` com relations).

---

## 11. Checklists

### Checklist para Pull Request
- [ ] Título convencional (`feat:`, `fix:`, `docs:`, `chore:`).
- [ ] Descrição com contexto + como testar.
- [ ] `bunx tsgo --noEmit` verde.
- [ ] `bun test` verde.
- [ ] `bun run build` verde.
- [ ] Sem `console.log`, sem `.only`, sem `.skip`.
- [ ] Se toca banco: migration + GRANT + RLS + policies + testes.
- [ ] Se toca `/api/public/*`: snapshot de contrato revisado.
- [ ] Se toca segurança: aprovação de reviewer sênior.
- [ ] Docs atualizados (se aplicável).

### Checklist para Release
Ver `docs/RELEASE_PLAN.md` (plano de deploy + rollback + validação).

### Checklist para Produção
Ver `docs/PRODUCTION_READINESS.md` (bloqueadores + score + plano).

### Checklist para Hotfix
- [ ] Issue de incidente criada.
- [ ] Reproduzir bug com teste antes do fix (TDD).
- [ ] Branch `hotfix/<slug>` a partir de `main`.
- [ ] Fix mínimo, sem refactor colateral.
- [ ] Quality gate verde.
- [ ] Deploy imediato + smoke tests.
- [ ] Post-mortem em 48h.

---

## 12. Onboarding

### Primeira hora
- Ler `README.md` e este handbook (seções 1–4).
- Clonar repo, `bun install`.
- Copiar `.env.staging.example` para `.env` e preencher com credenciais dev.
- Rodar `bun dev` e abrir preview local.

### Primeiro dia
- Ler `docs/ARCHITECTURE.md` e `docs/ARCHITECTURE_DECISIONS.md`.
- Rodar quality gate localmente (`bunx tsgo --noEmit && bun test && bun run build`).
- Navegar por `src/routes/`, `src/lib/`, `src/providers/`, `tests/`.
- Escolher uma issue `good-first-issue` e discutir a abordagem.

### Primeira semana
- Ler `docs/SECURITY.md`, `docs/DOCKER.md`, `docs/DEPLOY_CHECKLIST.md`.
- Implementar a primeira feature pequena (com migration + server function + teste).
- Fazer pareamento em 1 revisão de PR.
- Contribuir com algum ajuste em documentação.

### Primeiro mês
- Ler `docs/PROJECT_READINESS.md` e `docs/PRODUCTION_READINESS.md`.
- Participar de um drill (rollback, restore de backup ou incident review).
- Assumir uma feature média end-to-end.
- Propor melhoria em um ADR ou boas práticas.

---

## 13. Glossário

- **Tracking**: coleta própria de eventos de visitante/lead com public key,
  sessão e envio server-side para providers de conversão.
- **Provider**: implementação concreta de uma interface do Provider Layer
  (ex: MetaAdsProvider implementa AdsProvider).
- **Lead**: potencial cliente capturado (form, WhatsApp, tracking).
- **Organization**: tenant. Isolado por `organization_id` + RLS.
- **Workspace**: agrupador conceitual dentro de uma organization
  (usado no Lovable; no domínio Zenno equivale à organization).
- **Webhook**: callback HTTP recebido de terceiros (Meta, Uazapi, Stripe).
  Sempre com HMAC signature verificada.
- **OAuth**: fluxo de autorização delegada (Meta, Google). State assinado.
- **Conversion**: evento com valor econômico enviado para Meta CAPI /
  Google Offline Conversion.
- **Attribution**: engine que associa conversion → touchpoints anteriores.
- **BullMQ**: fila de jobs assíncronos sobre Redis. Worker atualmente
  placeholder.
- **RLS** (Row Level Security): mecanismo Postgres para restringir linhas
  visíveis por usuário; base do isolamento multi-tenant.

---

## 14. Apêndice — Links para documentos

| Documento | Caminho |
|-----------|---------|
| Project Readiness | [`docs/PROJECT_READINESS.md`](./PROJECT_READINESS.md) |
| Release Plan | [`docs/RELEASE_PLAN.md`](./RELEASE_PLAN.md) |
| Deploy Checklist | [`docs/DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md) |
| Staging Checklist | [`docs/STAGING_CHECKLIST.md`](./STAGING_CHECKLIST.md) |
| Production Readiness | [`docs/PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) |
| Architecture Decisions | [`docs/ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) |
| Security | [`docs/SECURITY.md`](./SECURITY.md) |
| Architecture | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Docker | [`docs/DOCKER.md`](./DOCKER.md) |
| Deployment (VPS) | [`../DEPLOYMENT.md`](../DEPLOYMENT.md) |
| README | [`../README.md`](../README.md) |
