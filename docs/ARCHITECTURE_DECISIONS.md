# Architecture Decision Records (ADR) — Zenno AI Suite

## Introdução

### Objetivo
Este documento registra oficialmente todas as decisões arquiteturais
estruturais do Zenno AI Suite. Cada ADR captura o **contexto**, o
**problema**, as **alternativas avaliadas**, a **decisão**, suas
**consequências** (positivas e negativas) e o **status**. O objetivo é
evitar que futuros contribuintes reabram decisões já resolvidas sem
justificativa técnica nova.

### Escopo
- Decisões que afetam múltiplos módulos, contratos públicos, segurança,
  banco de dados, deploy ou testes.
- **Fora de escopo**: escolhas locais de implementação, refactors internos
  a um único arquivo, decisões de UI que não afetam o design system.

### Como utilizar este documento
- Antes de propor uma mudança arquitetural, leia o ADR relacionado.
- Se a mudança contradiz um ADR **Aceito**, abra um novo ADR marcando o
  anterior como **Depreciado** e vincule-os.
- Use o índice no final para ver status, responsável e condições de alteração.

### Processo para adicionar novos ADRs
1. Copie o template abaixo.
2. Numere sequencialmente (`ADR-013`, `ADR-014`, …).
3. Abra um PR marcado `adr:` com o novo registro.
4. Requer aprovação de ≥ 1 revisor técnico sênior.
5. Ao merge, o ADR entra como **Aceito** e é adicionado ao índice final.

**Template mínimo obrigatório**
```
## ADR-XXX — <título>
- Status: Aceito | Revisar | Depreciado
- Data: YYYY-MM-DD
- Responsável: <papel/pessoa>

### Contexto
### Problema
### Decisão
### Alternativas avaliadas
### Consequências positivas
### Consequências negativas
### Impacto técnico
### Impacto operacional
### Motivo da decisão
```

---

## ADR-001 — Framework: TanStack Start

- **Status**: Aceito
- **Data**: 2026-01
- **Responsável**: Arquitetura

### Contexto
Zenno AI Suite é um SaaS full-stack (SSR + APIs + páginas autenticadas +
webhooks públicos) rodando na plataforma Lovable com preset Cloudflare
Workers e opção de deploy externo em Node 20.

### Problema
Precisávamos de um framework React que suportasse SSR, file-based routing
tipado, server functions com validação de input e execução em edge runtime,
mantendo o mesmo bundle rodável em Node para deploy externo.

### Decisão
Adotar **TanStack Start v1** com Vite 7, TanStack Router (file-based),
TanStack Query (data fetching) e `createServerFn` (RPC tipado).

### Alternativas avaliadas
- **Next.js**: maduro, mas o modelo App Router acopla server components a
  RSC-only APIs e complica o deploy em Cloudflare Workers puro.
- **Remix**: excelente DX, mas menos aderente a edge runtime e à tipagem
  ponta-a-ponta que buscávamos.
- **NestJS SSR**: separa backend do frontend, gera duplicação de contratos
  e não oferece SSR nativo React.
- **Express + React (custom)**: máxima flexibilidade, custo de manutenção
  proibitivo (routing, SSR, bundling, tipagem tudo manual).

### Consequências positivas
- Tipagem ponta-a-ponta entre client e server via `createServerFn`.
- Roteamento file-based com validação de path params.
- SSR compatível com Workers e Node com trocar apenas o preset Nitro.

### Consequências negativas
- Ecossistema mais novo → menos exemplos comunitários vs Next.js.
- Vite plugins (code-splitter, server-fn transformer) impõem restrições de
  sintaxe que geram falhas de build se ignoradas.

### Impacto técnico
Arquitetura organizada em `src/routes/` (páginas) e `src/lib/*.functions.ts`
(server functions). Zero divergência de contratos entre client e server.

### Impacto operacional
Um único codebase para SSR + APIs + assets. Deploy simplificado.

### Motivo da decisão
Melhor equilíbrio entre tipagem ponta-a-ponta, portabilidade entre
Workers/Node e produtividade para um time pequeno.

---

## ADR-002 — Banco de Dados: PostgreSQL + Supabase

- **Status**: Aceito
- **Data**: 2026-01
- **Responsável**: Arquitetura de Dados

### Contexto
Aplicação multi-tenant com auth, storage, realtime, RLS por organização e
funções `SECURITY DEFINER` para políticas complexas.

### Problema
Precisávamos de um banco relacional maduro com RLS nativa, além de auth,
storage e realtime prontos, sem construir infra própria.

### Decisão
**PostgreSQL 16** gerenciado via **Supabase** (Cloud ou self-hosted). Todas
as migrations em `supabase/migrations/`.

### Alternativas avaliadas
- **MySQL/MariaDB**: sem RLS madura.
- **MongoDB**: sem SQL, difícil garantir integridade multi-tenant.
- **Firebase**: lock-in maior, sem SQL nem RLS declarativa.
- **Postgres puro + Auth próprio**: reinvenção de auth/storage/realtime.

### Consequências positivas
- RLS nativa (base do isolamento multi-tenant).
- Auth, Storage, Realtime prontos.
- Portabilidade: self-host possível via Docker.

### Consequências negativas
- Acoplamento ao ecossistema Supabase (mitigado por SQL puro em migrations).
- Cloud tem limites de plano gratuito.

### Impacto técnico
Todo esquema versionado; RLS obrigatória em 100% das tabelas públicas.

### Impacto operacional
Backups automáticos no Cloud; `pg_dump` diário em self-host.

### Riscos
Se o Supabase mudar preços/termos, portabilidade exige apenas trocar o host
(schema é Postgres puro).

---

## ADR-003 — Multi-Tenant: `organization_id` + RLS

- **Status**: Aceito
- **Data**: 2026-01
- **Responsável**: Arquitetura de Dados / Segurança

### Contexto
SaaS B2B com múltiplas organizações compartilhando o mesmo banco.

### Problema
Isolar 100% dos dados por organização sem duplicar infra por cliente.

### Decisão
Usar coluna `organization_id UUID` em toda tabela tenant-scoped, com **RLS**
aplicando `has_role(auth.uid(), organization_id, ...)` e `current_org_id()`.

### Alternativas avaliadas
- **Schema por cliente**: isolamento físico, mas migrations viram pesadelo
  em escala; junções cross-tenant impossíveis para analytics.
- **Banco por cliente**: custo linear com número de tenants.
- **Row-level via checagem em código**: qualquer bypass no código expõe
  dados de outros tenants; RLS é defense-in-depth.

### Por que não schema por cliente
- Manutenção de migrations em N schemas.
- Custo operacional (backups, monitoring) linear.
- Analytics agregadas exigem consolidação manual.
- RLS já resolve isolamento com ordem de magnitude menor de complexidade.

### Consequências positivas (benefícios)
- Um único schema, um único conjunto de migrations.
- Isolamento garantido no banco, não no código.
- Escala para milhares de tenants sem overhead operacional.

### Consequências negativas (trade-offs)
- Toda query precisa considerar RLS (pode surpreender em queries admin).
- `SECURITY DEFINER` exige cuidado extra com `search_path`.

### Impacto técnico
Suíte `tests/integration/database/rls.test.ts` garante que 100% das tabelas
públicas têm RLS e ≥ 1 policy referenciando `organization_id`/`auth.uid()`.

### Impacto operacional
Onboarding de tenant = inserir uma linha em `organizations`.

---

## ADR-004 — Segurança em profundidade

- **Status**: Aceito
- **Data**: 2026-02
- **Responsável**: Segurança

### Contexto
Aplicação lida com dados de leads, credenciais OAuth, webhooks financeiros
e integrações de anúncios — múltiplas superfícies de ataque.

### Decisão
Camadas obrigatórias, cada uma com justificativa:

- **RLS em 100% das tabelas públicas** — última linha de defesa: mesmo se
  o código vazar service_role em algum ponto, o banco recusa cross-tenant.
- **`SECURITY DEFINER` com `search_path` fixo** — impede *search_path
  hijacking* (`SET search_path = pg_catalog, app_private, public`).
- **`audit_log` particionado append-only** — trigger bloqueia UPDATE/DELETE,
  particionamento mensal evita bloat, retenção controlável por drop de partição.
- **Rate limit via `global_rate_limit_hit(key, limit, window)`** — protege
  OAuth callbacks, webhooks e login contra brute force e abuso.
- **OAuth com state assinado + PKCE quando possível** — mitiga CSRF em
  callback e interceptação de code.
- **`webhook_secret` por integração, verificação HMAC obrigatória** — todo
  endpoint `/api/public/*/webhook` valida assinatura ANTES de processar payload.
- **Tracking security**: allowlist de origem, HMAC no payload, rate limit
  por org+IP, campos sanitizados antes de chegar ao provider.

### Alternativas avaliadas
- **Segurança em código** apenas → um bug expõe tudo.
- **Segurança em rede** (WAF apenas) → não protege queries diretas via SDK.

### Consequências positivas
- Defesa em profundidade real.
- Testes automatizados verificam cada camada.

### Consequências negativas
- Complexidade de desenvolvimento: toda migration precisa GRANT + RLS.
- Curva de aprendizado maior para novos devs.

### Impacto técnico / operacional
Cobertura auditada em `tests/integration/database/*` e `tests/integration/security/*`.

### Motivo da decisão
Superfície de ataque é ampla; qualquer camada única é insuficiente.

---

## ADR-005 — Provider Layer

- **Status**: Aceito
- **Data**: 2026-03
- **Responsável**: Arquitetura

### Contexto
Zenno integra Ads (Meta, Google), WhatsApp (Uazapi), Payments
(Stripe, MercadoPago, Asaas) e AI (Lovable Gateway). Cada vendor tem
contrato e SDK próprio.

### Problema
Evitar lock-in em um vendor específico e permitir substituição sem alterar
código de aplicação.

### Decisão
Introduzir uma **Provider Layer** com interfaces estáveis:
- `AdsProvider` (Meta, Google)
- `WhatsAppProvider` (Uazapi, extensível)
- `PaymentProvider` (Stripe, MercadoPago)
- `AIProvider` (Lovable, OpenAI-compat)

Fábricas selecionam a implementação por env var (`ADS_PROVIDER`,
`WHATSAPP_PROVIDER`, `PAYMENT_PROVIDER`, `AI_PROVIDER`).

### Objetivos
- Inversão de dependência: `src/lib/*.functions.ts` depende da interface,
  nunca da implementação.
- Troca de providers sem alterar consumidores.
- Lock-in avoidance: schema neutro, sem vazamento de campos vendor-specific
  em contratos internos.

### Alternativas avaliadas
- **Chamadas diretas ao SDK** em cada função → duplicação e lock-in.
- **BFF por vendor** → overhead operacional injustificado nessa escala.

### Consequências positivas
- Testes unitários por provider (mocks previsíveis).
- Snapshots contratuais (`tests/contracts/provider-payloads.contract.test.ts`)
  congelam o payload externo → qualquer mudança acidental quebra CI.

### Consequências negativas
- Camada extra a manter.
- Interfaces precisam evoluir cuidadosamente para não vazar semântica de
  um vendor específico.

### Impacto técnico
`src/providers/**` isolado do domínio. Consumidores importam apenas a
interface.

---

## ADR-006 — Tracking

- **Status**: Aceito
- **Data**: 2026-03
- **Responsável**: Growth Engineering

### Contexto
Precisamos rastrear visitantes e conversões para atribuição em Meta CAPI e
Google Offline Conversions, sem depender de vendors terceiros de tracking
(evitar Segment/RudderStack).

### Decisão
Stack de tracking **próprio**:

- **Tracking Public Key** por organização (rotacionável).
- **Tracking Session** (cookie 1st-party + fingerprint leve).
- **Attribution engine** em `src/lib/attribution.server.ts` (últimas N
  touchpoints, decay configurável).
- **Meta CAPI** — envia server-side com deduplicação por `event_id`.
- **Google Offline Conversion** — upload em lote via server function.
- **Endpoints públicos**: `/api/public/track/event`,
  `/api/public/track/wa-link`, `/api/public/track/script.js`.

### Fluxo completo
1. Página carrega `<script src="/api/public/track/script.js?k=<pk>">`.
2. Script cria sessão e envia eventos para `/api/public/track/event`.
3. Endpoint valida public key + rate limit + salva evento + dispara para
   providers (Meta CAPI, Google OCI) via Provider Layer.
4. `audit_log` registra o evento; contratos congelados por snapshot.

### Alternativas avaliadas
- **Segment / RudderStack**: custo + lock-in + limites de payload.
- **GTM server-side puro**: acopla ao Google, sem controle de RLS/multi-tenant.

### Consequências positivas
- Controle total sobre payload, deduplicação e retenção.
- Sem custo por evento.

### Consequências negativas
- Manutenção do coletor é responsabilidade nossa.

### Impacto técnico
Tracking security auditada em `src/providers/__tests__/tracking-security.test.ts`
e `tests/integration/security/tracking-dispatch.test.ts`.

---

## ADR-007 — Arquitetura Backend

- **Status**: Aceito
- **Data**: 2026-02
- **Responsável**: Arquitetura

### Contexto
Precisamos separar claramente APIs públicas (webhooks, cron, tracking)
de APIs internas (chamadas do frontend autenticado).

### Decisão
- **Server functions (`createServerFn`)** para toda lógica interna
  consumida pelo frontend.
- **`/api/public/*`** (server routes via `createFileRoute`) para
  webhooks, cron e endpoints públicos.
- **Middleware `requireSupabaseAuth`** obrigatório em toda server
  function que acessa dados protegidos.
- **Fila de jobs (BullMQ + Redis)** foi originalmente cogitada mas **não
  faz parte da baseline v1.0 congelada**: Cloudflare Workers não executa
  processos Node persistentes. Jobs assíncronos hoje são resolvidos por
  `pg_cron`, triggers e endpoints `/api/public/*` idempotentes. Uma futura
  adoção (Cloudflare Queues ou worker Node externo) exige **novo ADR**.

### Alternativas avaliadas
- **API REST monolítica** (`/api/v1/...`): perde tipagem ponta-a-ponta.
- **tRPC**: sobreposto ao que `createServerFn` já oferece nativamente.
- **Fila em Postgres (LISTEN/NOTIFY)** e **`pg_cron`**: adotados na baseline
  para tarefas agendadas; suficientes na escala atual.

### Consequências positivas
- Auth centralizada; contratos públicos isolados em `/api/public/*`.
- Jobs pesados fora do request/response cycle.

### Consequências negativas
- Complexidade operacional adicional quando o worker for ativado
  (Redis, monitoring, DLQ).

### Impacto técnico
Contratos públicos congelados por snapshots em `tests/contracts/*`.

### Impacto operacional
Worker ainda é placeholder; ativação prevista em Sprint futura.

---

## ADR-008 — Frontend

- **Status**: Aceito
- **Data**: 2026-01
- **Responsável**: UI Architect

### Contexto
Frontend de painel administrativo complexo (Kanban, chat WhatsApp,
dashboards, forms extensos), acessibilidade obrigatória.

### Decisão
- **React 19** (via TanStack Start).
- **TanStack Query** para todo data fetching + cache.
- **TanStack Router** file-based, tipado.
- **shadcn/ui** como base de componentes.
- **Tailwind v4** com CSS `@import` no `src/styles.css`.
- **Tokens semânticos** obrigatórios (`bg-background`, `text-primary`, …);
  proibido hard-code de cores.

### Alternativas avaliadas
- **MUI/Chakra**: acoplam a um design system pronto; menos flexibilidade.
- **CSS-in-JS (styled-components/emotion)**: runtime overhead + SSR complexo.
- **Redux Toolkit**: substituído por Query + Router para server/UI state.

### Consequências positivas
- Dark mode automático via class strategy + tokens.
- SSR sem hydration mismatch (com uso correto de `useEffect`/`useHydrated`).

### Consequências negativas
- Ecossistema shadcn exige copiar componentes ao invés de instalar como lib.

### Impacto técnico
Design system enforced por tokens; nenhum componente hard-codeia cor.

---

## ADR-009 — Deploy

- **Status**: Aceito
- **Data**: 2026-02
- **Responsável**: Deploy Ops

### Contexto
Precisamos rodar tanto no Lovable (Cloudflare Workers) quanto em VPS
externa (Node 20) sem manter dois codebases.

### Decisão
- **Cloudflare Workers** como target padrão do Lovable.
- **Docker multi-stage** (Node 20 alpine, preset Nitro `node-server`) para
  deploy externo (VPS, Coolify, Railway, Fly, K8s).
- **docker-compose** com app + worker placeholder + Postgres + Redis para
  ambiente reprodutível.
- **Health checks obrigatórios**:
  - `/api/public/live` — liveness (não consulta dependências).
  - `/api/public/ready` — readiness (Postgres + Redis).
  - `/api/public/health` — versão/uptime.
- **CI** (`.github/workflows/ci.yml`): typecheck → test → coverage →
  build → audit; artifact de coverage retido 14 dias.

### Alternativas avaliadas
- **Node-only** → perderia edge deploy.
- **Cloudflare-only** → prenderia usuários self-host.

### Consequências positivas
- Portabilidade real (Lovable + externo).
- Healthchecks compatíveis com K8s/Coolify.

### Consequências negativas
- Restrições do runtime Worker (sem `child_process`, `sharp`, etc.).

### Impacto técnico
Módulos server-only marcados `.server.ts`; `NITRO_PRESET=node-server` no
Docker.

---

## ADR-010 — Testes

- **Status**: Aceito
- **Data**: 2026-03
- **Responsável**: Testing Agent

### Contexto
SaaS que precisa evoluir sem regressões em RLS, contratos públicos,
providers e migrations.

### Decisão
- **Vitest** como test runner (compatível com Vite/TanStack Start).
- Estratégia em camadas:
  - **Unit** (`tests/unit/**`): providers, utils, hooks isolados.
  - **Integration** (`tests/integration/**`): API, banco (RLS, indexes,
    integrity, migrations, rate-limit, security-definer, audit-log),
    fluxos de segurança.
  - **Contracts** (`tests/contracts/**`): snapshots dos endpoints
    `/api/public/*`, payloads Meta CAPI / Google OCI / Uazapi, assinatura
    de `app_write_audit_log`.
- **Quality Gate** obrigatório: `bunx tsgo --noEmit`, `bun test`,
  `bun test --coverage`, `bun run build` — todos verdes para merge.
- **Cobertura**: piso atual 20% global, alvo 60% em `src/lib/*.functions.ts`
  e `src/providers/*`.

### Alternativas avaliadas
- **Jest**: mais lento no ecossistema Vite; sem HMR.
- **Playwright unit**: subutilizado; reservado para E2E futuro.

### Consequências positivas
- Snapshots contratuais impedem regressão silenciosa em integrações externas.
- Testes de RLS impedem que uma nova tabela sem RLS chegue à main.

### Consequências negativas
- Suíte cresce em tempo (~44s atualmente).

### Impacto técnico / operacional
CI roda em ~2 min com cache do Bun.

---

## ADR-011 — Observabilidade

- **Status**: Revisar
- **Data**: 2026-07
- **Responsável**: Deploy Ops

### Contexto
Ambiente pré-produção; incidentes precisam ser detectados em minutos, não horas.

### Estado atual
- **Logs**: `src/lib/logger.ts` emite JSON estruturado com redaction de
  chaves sensíveis. Coletor externo **ainda não plugado**.
- **Métricas**: sem endpoint `/metrics`. Métricas apenas via parsing dos
  logs stdout.
- **Tracing**: `trace_id` + `request_id` propagados no logger, mas sem
  OTel exportando spans.
- **Erros**: sem Sentry (client ou server).

### Pendências (bloqueadores para produção)
- **Sentry** no client e no server.
- **OpenTelemetry** com exporter OTLP para provedor externo.
- **Prometheus** endpoint `/metrics` + scraping.
- **Grafana** dashboards (5xx, latência, throughput, fila Redis).
- **Logs** ingeridos em Loki / Datadog / CloudWatch.

### Alternativas avaliadas
- Solução all-in-one (Datadog) vs open-source (Loki + Prom + Grafana +
  Sentry self-host). Decisão adiada para o momento da implementação.

### Consequências positivas (quando implementado)
- Detecção de incidente em <2 min.
- Root cause via correlação logs+traces+erros.

### Consequências negativas
- Custo operacional; overhead de ingestão de logs.

### Impacto técnico / operacional
Bloqueador para promoção a produção — ver `docs/PRODUCTION_READINESS.md`.

---

## ADR-012 — Futuro

- **Status**: Revisar
- **Data**: 2026-07
- **Responsável**: Arquitetura

### Contexto
Registro dos itens planejados para as próximas sprints, com o objetivo de
alinhar expectativas e evitar mudanças estruturais fora dos ADRs.

### Itens planejados

**Sprint 5** — Cobertura e contratos
- Elevar cobertura server-side para ≥ 60%.
- Extrair snapshots contratuais para `.snap` versionados.
- Publicar spec OpenAPI gerada.

**Sprint 6** — Observabilidade e resiliência
- Plugar Sentry (client + server).
- OTel + coletor externo de logs.
- Job de retenção de partições do `audit_log`.
- Load-test formal (k6/Artillery) nos endpoints críticos.

### Escalabilidade
- Server stateless: escala horizontalmente atrás de LB.
- Postgres: read replicas quando p95 de read > alvo.
- Fila de jobs externa: **N/A na baseline v1.0**; considerar Cloudflare Queues
  ou worker Node externo apenas com novo ADR.

### Alta disponibilidade
- Multi-AZ para Postgres (Supabase Pro / RDS multi-AZ).
- Redis: N/A na baseline (não faz parte do stack ativo).
- App em ≥ 2 instâncias atrás de LB com healthchecks.

### Disaster Recovery
- **RPO alvo**: ≤ 1h (via PITR / dump horário).
- **RTO alvo**: ≤ 4h (imagem Docker + secrets + restore de dump).
- Drill trimestral de restore em ambiente scratch.

### Consequências positivas
- Roadmap explícito, sem "surpresas arquiteturais".

### Consequências negativas
- Documento precisa ser revisado a cada sprint para não virar folclore.

---

## Índice de ADRs

| ADR | Título | Status | Data | Responsável | Impacto | Pode ser alterado? |
|-----|--------|--------|------|-------------|---------|--------------------|
| ADR-001 | Framework: TanStack Start | Aceito | 2026-01 | Arquitetura | Alto (todo o stack) | Somente com POC comparativa + custo de migração aprovado |
| ADR-002 | Banco: PostgreSQL + Supabase | Aceito | 2026-01 | Arq. Dados | Alto (persistência) | Somente para outro Postgres-compat; migração planejada |
| ADR-003 | Multi-tenant: org_id + RLS | Aceito | 2026-01 | Arq. Dados / Segurança | Crítico (segurança) | Não. Alterar exige novo ADR + plano de migração multi-release |
| ADR-004 | Segurança em profundidade | Aceito | 2026-02 | Segurança | Crítico | Não. Camadas só podem ser adicionadas, não removidas |
| ADR-005 | Provider Layer | Aceito | 2026-03 | Arquitetura | Alto (integrações) | Sim, desde que interfaces sejam preservadas |
| ADR-006 | Tracking próprio | Aceito | 2026-03 | Growth Eng. | Alto (atribuição) | Sim, com plano de coexistência para não perder eventos |
| ADR-007 | Backend (server fn + /api/public) | Aceito | 2026-02 | Arquitetura | Alto | Sim, para APIs internas. `/api/public/*` é contrato — só via nova versão |
| ADR-008 | Frontend (React 19 + TanStack + shadcn + Tailwind) | Aceito | 2026-01 | UI Architect | Médio | Componentes sim; stack base não |
| ADR-009 | Deploy (Cloudflare + Docker) | Aceito | 2026-02 | Deploy Ops | Alto | Sim, adição de targets. Remoção de target exige ADR |
| ADR-010 | Testes (Vitest + camadas + quality gate) | Aceito | 2026-03 | Testing | Alto | Sim, para adicionar camadas. Remover camadas exige ADR |
| ADR-011 | Observabilidade | Revisar | 2026-07 | Deploy Ops | Alto | Em definição; próxima sprint promove a Aceito com stack escolhida |
| ADR-012 | Futuro (roadmap) | Revisar | 2026-07 | Arquitetura | Informativo | Revisão a cada sprint |

---

## Resumo

Este documento registra **12 ADRs** cobrindo framework, banco,
multi-tenant, segurança, provider layer, tracking, backend, frontend,
deploy, testes, observabilidade e roadmap futuro. Cada ADR segue o
template obrigatório (contexto, problema, decisão, alternativas,
consequências, impacto, motivo, status).

### Recomendações futuras
- Revisar ADR-011 assim que Sentry + coletor de logs estiverem plugados,
  promovendo-o de **Revisar** para **Aceito**.
- Revisitar ADR-012 no fim de cada sprint para refletir o estado real.
- Toda mudança que contradiga um ADR **Aceito** exige novo ADR com link
  explícito para o depreciado.

### Possíveis ADRs adicionais (versões futuras)
- **ADR-013** — Estratégia de fila de jobs assíncronos (Cloudflare Queues
  vs BullMQ em worker Node externo) se/quando for adotada.
- **ADR-014** — Estratégia de retenção e arquivamento do `audit_log`.
- **ADR-015** — SLO/SLA formais e política de erro budget.
- **ADR-016** — Estratégia de feature flags (LaunchDarkly / OpenFeature /
  próprio).
- **ADR-017** — Estratégia de i18n (quando internacionalizar).
- **ADR-018** — Estratégia de billing (Stripe vs MercadoPago vs Asaas por
  região).
- **ADR-019** — LGPD/GDPR: política de retenção de dados de lead e fluxo
  de esquecimento.
- **ADR-020** — Estratégia de mobile (PWA vs app nativo).
