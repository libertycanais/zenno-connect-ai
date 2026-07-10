# FEATURE — Enterprise Marketing Platform Connector v1.0 (Build)

Fase 2 do SDR aprovado. 100% aditiva. Architecture Freeze v1.0 preservado. Zero alteração em Provider Layer existente, AI Runtime, Brain, Task Engine, RC2.

## Escopo (CTO Addendum — 8 diretrizes obrigatórias)

Plataforma genérica de conectores de marketing, com Google como primeiro adaptador. Reutilizável para Meta, TikTok, LinkedIn e Microsoft Ads.

## Arquitetura

Nova pasta isolada: `src/lib/marketing/` (não toca `src/providers/ads/*` existente — coexistência).

```text
src/lib/marketing/
├── contracts/
│   ├── connector.ts          # MarketingPlatformConnector interface
│   ├── assets.ts             # PlatformAsset, AssetKind, AssetHealth
│   ├── capability.ts         # CapabilityRegistry
│   ├── sync.ts               # SyncPolicy, SyncTier
│   ├── graph.ts              # RelationshipGraph
│   └── timeline.ts           # MarketingTimelineEvent
├── registry/
│   ├── capability-registry.ts     # Google/Meta/TikTok/LinkedIn/MS matrix
│   └── connector-registry.ts      # provider → connector factory
├── engines/
│   ├── discovery-engine.ts        # discoverPlatformAssets(provider)
│   ├── health-engine.ts           # score 0-100 por ativo
│   ├── sync-engine.ts             # tier-based scheduler
│   ├── relationship-graph.ts      # nós + arestas em memória + persistência
│   ├── timeline-engine.ts         # append-only events
│   └── marketing-context.ts       # feed para AI Context Engine
├── connectors/
│   ├── google.connector.ts        # implementa contrato (Ads/GA4/GSC/GTM/Merchant/GBP)
│   ├── meta.connector.stub.ts     # stub registrado, capabilities só
│   ├── tiktok.connector.stub.ts
│   ├── linkedin.connector.stub.ts
│   └── microsoft.connector.stub.ts
└── index.ts
```

Server functions em `src/lib/marketing.functions.ts` (client-safe, chamam engines).

## Migração SQL (aditiva)

7 tabelas novas, todas com RLS org-scoped + FORCE RLS + audit trigger + GRANTs (authenticated + service_role):

1. `marketing_connections` — provider, org_id, status, credentials_encrypted (AES-256-GCM), scopes, last_health, meta
2. `marketing_assets` — connection_id, asset_kind, external_id, name, health_score, health_status, last_synced_at, capabilities jsonb
3. `marketing_asset_bindings` — asset_id, bound_at, bound_by, purpose
4. `marketing_sync_jobs` — asset_id, tier, next_run_at, last_status, last_error, backoff
5. `marketing_asset_relationships` — from_asset_id, to_asset_id, relation_kind, confidence
6. `marketing_timeline_events` — org_id, connection_id, asset_id, event_type, payload, occurred_at
7. `marketing_oauth_states` — state HMAC single-use, provider, org_id, user_id, expires_at, consumed_at

Reaproveita `AI_ENCRYPTION_KEY` existente para tokens (mesma AES-256-GCM do P0.6).

## Server routes (públicas, verify no handler)

- `src/routes/api/public/marketing/oauth/callback.ts` — genérico `?provider=google|meta|...`, valida state HMAC single-use, redirect para `/app/marketing/connect/success`.

## Server functions (auth via requireSupabaseAuth)

- `startConnect({ provider })` — inicia OAuth (state HMAC)
- `disconnectConnection({ id })`
- `discoverAssets({ connectionId })` — chama `discovery-engine`
- `bindAsset({ assetId, purpose })`
- `runSync({ assetId?, tier? })`
- `getHealthOverview()` — health por provider e por ativo
- `getRelationshipGraph()`
- `getTimeline({ limit, cursor })`
- `refreshMarketingContext()` — atualiza slice do Context Engine

## UI (Golden Rules v1.0 — invisible UI, dark tokens, sem hardcoded)

Rota-mãe: `src/routes/app.marketing.tsx` (layout com 4 tabs)
- `app.marketing.index.tsx` — dashboard Health por plataforma + timeline recente
- `app.marketing.connect.tsx` — Wizard (Provider → OAuth → Discovery → Bind)
- `app.marketing.assets.tsx` — lista de ativos, filtro por provider/capability, health chips
- `app.marketing.graph.tsx` — Relationship Graph (SVG simples)

Wizard é **capability-driven**: lê `capability-registry.ts` para renderizar steps.

## Sync tiers (Intelligent Sync)

| Kind | Tier | Interval |
|---|---|---|
| Campaigns | hot | 15 min |
| Analytics | warm | 30 min |
| Search Console | cold | 6 h |
| Merchant | cold | 12 h |
| GBP | cold | 24 h |

Scheduler in-process via `pg_cron` chamando `/api/public/marketing/sync/tick` com `apikey` (anon).

## AI Marketing Context

Novo módulo em `src/lib/marketing/engines/marketing-context.ts` expõe `buildMarketingSlice(orgId): MarketingSlice` consumido opcionalmente por Context Engine (sem alterar contratos — helper aditivo).

## Observabilidade

Métricas via observability existente:
- `marketing.oauth.duration_ms`
- `marketing.discovery.assets_count`
- `marketing.assets.bound`
- `marketing.sync.errors{provider,kind}`
- `marketing.last_sync_age_seconds{org,provider}`

Timeline events replicam para audit_log via trigger.

## Testes (Vitest)

- `tests/unit/lib/marketing/capability-registry.test.ts`
- `tests/unit/lib/marketing/discovery-engine.test.ts`
- `tests/unit/lib/marketing/health-engine.test.ts`
- `tests/unit/lib/marketing/sync-engine.test.ts`
- `tests/unit/lib/marketing/relationship-graph.test.ts`
- `tests/unit/lib/marketing/timeline-engine.test.ts`
- `tests/unit/lib/marketing/google.connector.test.ts` (mock fetch)
- `tests/integration/security/marketing-oauth.test.ts` (state HMAC single-use)

Meta: +40 testes verdes. Total esperado ≥ 830.

## Quality Gates (parada obrigatória)

1. `tsgo --noEmit` ✅
2. `bun run test` ✅ (todos verdes)
3. Supabase linter ✅
4. Zero import de SDK externo fora de `src/lib/marketing/connectors/*`
5. Architecture Freeze diff = 0 em `src/providers/*`, `src/lib/ai/*`, `src/lib/workspace/*`

## Entregável final

- 7 migrations aplicadas
- ~40 arquivos novos em `src/lib/marketing/`, rotas e testes
- `docs/MARKETING_CONNECTOR_BUILD_REPORT.md`
- **PARADA OBRIGATÓRIA**: sem iniciar próxima feature.

## Sequência de execução

1. Migration SQL (7 tabelas + policies + GRANTs) → aguarda aprovação
2. Contracts + Registry + Engines (puros, sem I/O)
3. GoogleConnector (reaproveita lógica de `src/lib/google-ads.functions.ts` sem removê-la)
4. Server functions + routes API + rota OAuth callback genérica
5. UI Wizard + Dashboard + Assets + Graph
6. Testes + Quality Gates
7. Relatório final

## Fora de escopo (proibido nesta feature)

- Alterar `src/providers/ads/*`
- Alterar contratos públicos do Brain / Task Engine
- Remover `src/lib/google-ads.functions.ts` (coexiste; deprecação em feature futura)
- Novas Epics
