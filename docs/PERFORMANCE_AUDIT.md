# PERFORMANCE AUDIT — Zenno AI Suite

**Versão:** 1.0
**Data:** 2026-07-08
**Escopo:** Sprint 5.1 — Preparação para Staging Enterprise
**Status:** 🟡 Análise (não implementar ainda)
**Restrições:** Respeitar Architecture Freeze v1.0 — nenhuma alteração de arquitetura, Provider Layer, RLS, endpoints ou contratos públicos. Todas as recomendações são **aditivas**.

---

## 1. Sumário Executivo

O Zenno AI Suite apresenta arquitetura sólida (multi-tenant + RLS + Provider Layer congelados) e está funcionalmente pronto para staging. Esta auditoria identifica **23 pontos de otimização** distribuídos em quatro camadas: banco, backend (server functions + workers BullMQ), frontend React e observabilidade.

**Distribuição por prioridade:**

| Prioridade | Itens | Impacto potencial |
|------------|-------|-------------------|
| 🔴 Crítica | 4 | Bloqueiam escala em staging com carga real |
| 🟠 Alta    | 7 | Degradam UX / custo de compute significativamente |
| 🟡 Média   | 8 | Ganhos mensuráveis, sem urgência |
| 🔵 Baixa   | 4 | Polimento / consistência |

**Parecer geral:** ✅ **APTO PARA STAGING** com plano de mitigação dos 4 itens 🔴 na Sprint 5.2.

---

## 2. WS-5.1 — Performance Audit (visão geral)

### 2.1 Consultas lentas suspeitas
Baseado no schema (`audit_log` particionado, `tracking_events`, `tracking_leads`, `whatsapp_messages`, `meta_ads_insights`, `google_ads_insights`) e nos server functions listados em `src/lib/*.functions.ts`.

| # | Query / Local | Prioridade | Observação |
|---|---------------|------------|------------|
| Q1 | `tracking.functions.ts` — leitura de `tracking_events` por `organization_id + created_at` sem paginação obrigatória | 🔴 | Tabela cresce rápido; sem `LIMIT` e sem index BRIN em `created_at` a varredura degrada |
| Q2 | `dashboard.functions.ts` — agregações cross-módulo (leads + tracking + ads) em single request | 🟠 | Candidato a `Promise.all` server-side + view materializada futura |
| Q3 | `meta-ads.functions.ts` / `google-ads.functions.ts` — joins de insights + campaigns + accounts | 🟠 | Sem index composto `(account_id, date)` a leitura escala linearmente |
| Q4 | `attributed-leads.functions.ts` — attribution join entre `tracking_leads` e `leads` | 🟡 | Confirmar index em `tracking_leads.lead_id` |
| Q5 | `audit_log` particionado — SELECT sem `WHERE created_at` cross-partition | 🟠 | Todo consumidor deve filtrar mês; documentar em runbook |

### 2.2 Queries N+1
| # | Local | Prioridade |
|---|-------|------------|
| N1 | `whatsapp.functions.ts` — listagem de chats seguida de fetch individual de última mensagem | 🟠 |
| N2 | `clients.functions.ts` — leads → tags via `lead_tag_assignments` sem join agregado | 🟡 |
| N3 | `tickets.functions.ts` — tickets → last message por linha | 🟡 |

**Recomendação:** consolidar via `select('*, related(*)')` do PostgREST ou RPC dedicada.

### 2.3 Loops e operações síncronas evitáveis
- `copilot-executors.server.ts` — execução sequencial de ações pendentes; candidato a `Promise.allSettled` respeitando limites de provider.
- `attribution.server.ts` — loop de matching sincronizado; mover para worker BullMQ dedicado (aditivo).
- Serialização JSON grande em `audit_redact` já é `IMMUTABLE` — ok.

### 2.4 Requisições duplicadas (frontend)
- Várias rotas (`app.leads.*`, `app.meta-ads.*`) invocam o mesmo server fn de `orgProfile`/`subscription` sem `queryKey` unificado ⇒ duplica fetch por rota.
- **Fix aditivo:** `queryOptions()` compartilhado em `src/lib/queries/` + `ensureQueryData` no loader do layout `app.tsx`.

### 2.5 Renders excessivos React
- `app.whatsapp.chat.tsx` — lista de mensagens sem `React.memo` nem `key` estável derivada de id (verificar).
- Provedores globais no `__root.tsx` re-renderizam em `onAuthStateChange` sem filtro fino (já parcialmente mitigado — reforçar filtro `SIGNED_IN | SIGNED_OUT | USER_UPDATED`).
- Kanban de leads (`app.leads.kanban.tsx`) — cards sem memoização; DnD dispara re-render global.

### 2.6 Uso inadequado de TanStack Query
- Ausência de `staleTime` explícito em várias queries ⇒ refetch agressivo.
- Loaders que chamam `ensureQueryData` **e** componentes que refazem `useQuery` (não `useSuspenseQuery`) ⇒ waterfall.
- Falta invalidação granular por `queryKey` composto (`['leads', orgId, filters]`).

### 2.7 Gargalos BullMQ
Ver seção WS-5.3.

### 2.8 Uso de memória
- `audit_log` growth: garantir política de retenção (drop de partições > 12 meses).
- Cache in-memory eventual em server functions **não deve existir** (workers são stateless) — auditar `rate-limit.server.ts` (usa Postgres ✅).

### 2.9 Operações que podem ser assíncronas
- Envio de webhook após criação de lead → mover para fila BullMQ (`webhooks` queue).
- Enriquecimento de tracking (geo/UA) → job em background.
- Sincronização inicial de campanhas Meta/Google após OAuth → job dedicado com retry.

---

## 3. WS-5.2 — Database Optimization

### 3.1 Índices recomendados (aditivos, sem migration nesta sprint)

| Tabela | Índice proposto | Justificativa | Prioridade |
|--------|-----------------|---------------|------------|
| `tracking_events` | `(organization_id, created_at DESC)` + BRIN em `created_at` | Timeline por org | 🔴 |
| `tracking_leads` | `(organization_id, lead_id)` | Join com `leads` | 🟠 |
| `meta_ads_insights` | `(ad_account_id, date_start)` | Agregações por período | 🟠 |
| `google_ads_insights` | `(ad_account_id, date)` | Idem | 🟠 |
| `whatsapp_messages` | `(chat_id, created_at DESC)` | Timeline de conversa | 🟠 |
| `lead_activities` | `(lead_id, created_at DESC)` | Feed de atividade | 🟡 |
| `finance_transactions` | `(organization_id, date DESC)` parcial `WHERE deleted_at IS NULL` | Listagem financeira | 🟡 |
| `audit_log_YYYY_MM` | `(actor_org_id, action, created_at)` por partição | Auditoria filtrada | 🟡 |

**Validar com `EXPLAIN (ANALYZE, BUFFERS)`** antes de criar cada índice na Sprint 5.2.

### 3.2 Constraints & FKs
- Confirmar `ON DELETE CASCADE` consistente em relações filhas de `organizations` (evita orphans e limpeza manual).
- Reforçar `NOT NULL` em `organization_id` de todas tabelas de dados (checkpoint).

### 3.3 Vacuum / Analyze / Estatísticas
- Autovacuum tuning para `tracking_events` (alta escrita): `autovacuum_vacuum_scale_factor = 0.05`.
- `ANALYZE` semanal em `audit_log` particionado após rotação.
- Monitorar bloat via `pg_stat_user_tables`.

### 3.4 Compostas / Chaves
- Nenhuma alteração de PK proposta (respeita Freeze).
- Índices compostos apenas — não substituem PKs.

---

## 4. WS-5.3 — BullMQ Review

> Análise baseada nos padrões do runbook `docs/runbooks/bullmq.md` e nos workers referenciados no Handbook. Nenhuma alteração de código nesta sprint.

| Aspecto | Estado atual (esperado) | Recomendação | Prioridade |
|---------|-------------------------|--------------|------------|
| Concorrência | Default (`1`) por worker | Definir por fila: `tracking=10`, `webhooks=20`, `ai=2`, `whatsapp=5` | 🟠 |
| Retry | Ad-hoc | Padrão `attempts=5`, `backoff: exponential 2s base` | 🟠 |
| Dead Letter | Não formalizado | Criar fila `*-dlq` + alerta ao mover | 🔴 |
| Throughput | Não medido | Instrumentar `completed/failed/sec` (Sprint 5 — observabilidade) | 🟠 |
| Memory | Sem limite | `removeOnComplete: { age: 3600, count: 1000 }`, `removeOnFail: { age: 86400 }` | 🔴 |
| Idempotência | Parcial | `jobId` determinístico por evento externo | 🟠 |
| Rate limit por provider | Ausente | `limiter: { max, duration }` por fila de provider | 🟠 |
| Prioridade | Não usada | `priority` para jobs de UX (WhatsApp reply) | 🟡 |

---

## 5. WS-5.4 — React Performance

| Item | Onde | Recomendação | Prioridade |
|------|------|--------------|------------|
| `React.memo` | Cards de Kanban, item de lista de leads, mensagem WhatsApp | Memoizar com comparator raso | 🟠 |
| `useMemo` | Filtros derivados em tabelas (`app.leads.index.tsx`, `app.meta-ads.campaigns.tsx`) | Memoizar arrays filtrados | 🟡 |
| `useCallback` | Handlers passados a listas virtualizadas / DnD | Estabilizar referências | 🟡 |
| `Suspense` | Rotas pesadas (Copiloto, Sigma Console) | `React.lazy` + Suspense boundary local | 🟠 |
| TanStack Query | Loader + `useSuspenseQuery` — padrão canônico | Migrar rotas que ainda usam `useQuery` puro | 🟠 |
| Cache | `staleTime` genérico ausente | Definir default `30s` no `QueryClient`; overrides por query | 🟠 |
| Lazy loading | Imagens dashboard/anúncios | `loading="lazy"` + width/height explícitos (CLS) | 🟡 |
| Code splitting | Rotas grandes | Já é automático via route-based; validar bundle < 200KB por rota | 🔵 |
| Virtualização | Listas > 200 itens (mensagens, eventos) | `@tanstack/react-virtual` | 🟡 |

---

## 6. WS-5.5 — Staging Check

Validação (leitura apenas) contra `docs/STAGING_CHECKLIST.md`:

| Dependência | Estado | Observação |
|-------------|--------|------------|
| Docker | ✅ | `docs/DOCKER.md` presente; imagens documentadas |
| PostgreSQL | ✅ | Schema estável, RLS ativa, partições até 2027-07 |
| Redis | ✅ | Documentado em `docs/runbooks/redis.md`; usado pelo BullMQ |
| OAuth Meta | ✅ | `meta_ad_accounts` + fluxo em `oauth_states`; runbook OK |
| OAuth Google | ✅ | `google_ad_accounts` + connector `GOOGLE_SEARCH_CONSOLE_API_KEY` configurado |
| WhatsApp | ✅ | `whatsapp_*` tables + runbook dedicado |
| Tracking | ✅ | `tracking_events` + `tracking_rate_limits` + `global_rate_limits` |
| Provider Layer | ✅ | Congelado (ADR); interface estável |
| Audit Log | ✅ | Append-only via trigger `audit_log_block_mutation` |
| Rate limit | ✅ | Funções `track_rate_limit_hit`, `global_rate_limit_hit` |

**Nenhum bloqueio arquitetural para staging.** Gargalos identificados são de tuning, não de correção estrutural.

---

## 7. Relatório Final

### 7.1 Gargalos encontrados (top)
1. 🔴 `tracking_events` sem índice `(org, created_at)` — escala linear.
2. 🔴 BullMQ sem DLQ nem `removeOnComplete/Fail` — risco de OOM Redis.
3. 🔴 TanStack Query sem `staleTime` padrão — refetch excessivo.
4. 🔴 Falta política de retenção de partições `audit_log`.
5. 🟠 N+1 em WhatsApp / Tickets / Clients.
6. 🟠 Renders excessivos em Kanban e Chat.
7. 🟠 Duplicação de queries por rota (orgProfile / subscription).

### 7.2 Quick Wins (< 1 dia cada, aditivos)
- Setar defaults do `QueryClient` (`staleTime: 30_000`, `gcTime: 5min`).
- Adicionar `removeOnComplete/Fail` global nos workers BullMQ.
- Adicionar `React.memo` em `MessageBubble`, `LeadCard`, `KanbanCard`.
- Consolidar `queryOptions` compartilhados (`orgProfile`, `subscription`).
- Preload de rotas pesadas via `Link preload="intent"`.

### 7.3 Plano para Sprint 5.2 (proposta)
| # | Item | Prioridade | Esforço | Risco |
|---|------|------------|---------|-------|
| 1 | Migration aditiva com índices Q1/Q3/N1 (via `EXPLAIN` first) | 🔴 | M | Baixo (índices) |
| 2 | Configuração BullMQ (DLQ, retenção, concorrência, limiter) | 🔴 | M | Médio |
| 3 | Defaults TanStack Query + `queryOptions` compartilhados | 🔴 | S | Baixo |
| 4 | Job de retenção de partições `audit_log` (cron) | 🔴 | S | Baixo |
| 5 | Memoização React em listas críticas | 🟠 | M | Baixo |
| 6 | Refatoração N+1 (whatsapp/tickets/clients) via `select` composto | 🟠 | M | Médio |
| 7 | Virtualização de listas grandes | 🟡 | M | Baixo |
| 8 | Lazy load + Suspense em Copiloto/Sigma | 🟡 | S | Baixo |

### 7.4 Impacto esperado
- **-40% a -70%** no p95 de `tracking_events` list após índice.
- **-30%** em requisições HTTP do frontend (cache + queries compartilhadas).
- **Zero OOM** no Redis com política de retenção BullMQ.
- **-50%** re-renders no Kanban / Chat.

### 7.5 Riscos
- Índices podem aumentar tempo de escrita em `tracking_events` (~5-10%) — aceitável.
- Ajuste de concorrência BullMQ pode saturar providers externos — mitigado com `limiter`.
- Mudança de `staleTime` pode mascarar bugs de invalidação — cobrir com testes.

### 7.6 Parecer final
🟡 **READY FOR STAGING — OPTIMIZATION PENDING**

O sistema pode entrar em staging imediatamente. Os itens 🔴 devem ser tratados na Sprint 5.2 antes de qualquer promoção a produção com carga real.

---

**Não implementar otimizações nesta sprint. Documento serve como base para Sprint 5.2.**
