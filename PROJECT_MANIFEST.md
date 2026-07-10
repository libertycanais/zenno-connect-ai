# PROJECT MANIFEST — Zenno AI Suite

**Versão do manifesto:** 1.0
**Data:** 2026-07-10
**Estado:** Architecture Freeze v1.0 · RC2 Pilot · Design LOCKED · Product Evolution
**Propósito:** Fonte única de verdade para migração de stack, onboarding de novos agentes (humanos ou IA) e auditoria externa.

---

## 1. Identidade

- **Nome:** Zenno AI Suite (Enterprise)
- **Categoria:** Marketing Intelligence Operating System, multi-tenant
- **Público-alvo:** Agências e empresas que operam Google Marketing Platform + Meta + WhatsApp
- **Proposta de valor:** Transformar dados de marketing em decisões executivas, com IA explicável e Copilot proativo

---

## 2. Estado atual (snapshot congelado)

| Item | Valor |
|---|---|
| Architecture Freeze | v1.0 (`docs/ARCHITECTURE_FREEZE.md`) |
| Release Candidate | RC2 — Pilot Program |
| Testes | 848+ verdes (Vitest + Playwright) |
| Migrações Supabase | 35+ versionadas |
| Documentos oficiais | 60+ em `docs/` |
| ADRs aceitos | 12 (`docs/ARCHITECTURE_DECISIONS.md`) |
| Design System | V2 Enterprise OS · LOCKED |
| Modo de projeto | Product Evolution (`mem/project-mode.md`) |

---

## 3. Arquitetura em uma página

```
┌─────────────────────────────────────────────────────────────┐
│                  UI · React 19 + TanStack                   │
│  WorkspaceShell · Command Palette · Marketing Intel Card    │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │       Server Functions (RPC)        │
        │  createServerFn + requireSupabaseAuth│
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │           Provider Layer            │
        │  AIProvider · PaymentProvider ·     │
        │  AdsProvider · WhatsAppProvider     │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │  Marketing Intelligence Pipeline    │
        │  (Event Bus: 8 eventos canônicos)   │
        │  Knowledge → KPIs → Context →       │
        │  LLM → Recommendation → Playbook    │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │  PostgreSQL · RLS 100% · multi-tenant│
        │  organization_id em toda linha       │
        └─────────────────────────────────────┘
```

Runtime alvo: **Cloudflare Workers** com `nodejs_compat`.

---

## 4. Módulos oficiais

### 4.1 Core
- `src/lib/ai/` — Copilot, Governance (Rule Registry, Artifact Lineage), Brain (Planner/Workflow), Experts, Knowledge, Evidence, Playbooks
- `src/lib/business/` — Business KPI Engine (fonte oficial de métricas)
- `src/lib/marketing/` — Connectors, Intelligence Pipeline, Event Bus, Snapshot Store, First Five Minutes (TTFI)
- `src/lib/workspace/` — Zenno OS (Workspace Registry, Command Palette, Widgets)
- `src/lib/pilot/` — Feature Flags e Telemetria RC2
- `src/providers/` — Provider Layer (ads, ai, payments, whatsapp)
- `src/integrations/supabase/` — clientes gerados (não editar manualmente)

### 4.2 UI
- `src/routes/` — rotas TanStack (páginas `app.*`, API pública `api/public/*`)
- `src/components/workspace/`, `src/components/marketing/`, `src/components/experience/`

### 4.3 Persistência
- `supabase/migrations/*` — DDL versionado, RLS, GRANTs, funções `SECURITY DEFINER` com `search_path` fixo

---

## 5. Contratos invioláveis (Freeze v1.0)

1. RLS habilitado em 100% das tabelas públicas
2. Isolamento por `organization_id` em toda query e policy
3. Provider Layer é o único ponto de entrada para SDKs externos
4. Server-only nunca vaza para o bundle do client
5. Segredos exclusivamente no runtime server (nunca `VITE_*` exceto keys publishable)
6. Toda mudança arquitetural exige **novo ADR** aprovado
7. Contratos públicos (endpoints, webhooks, snapshots) não podem quebrar
8. Quality Gate mínimo: `tsgo --noEmit` limpo + suíte verde

---

## 6. Eventos canônicos (Marketing Intelligence Event Bus)

| Evento | Emissor | Consumidor |
|---|---|---|
| `PlatformConnected` | OAuth Callback | Discovery, Timeline |
| `MarketingSyncStarted` | Orchestrator | TTFI Tracker |
| `MarketingSyncCompleted` | Sync Engine | Health, Intelligence |
| `HealthUpdated` | Health Engine | Snapshot Store |
| `RecommendationsGenerated` | Expert Pipeline | Snapshot, Copilot |
| `ExecutiveSummaryGenerated` | Executive Engine | Snapshot, Notification |
| `ContextUpdated` | Context Updater | Copilot |
| `IntelligenceSnapshotUpdated` | Snapshot Store | UI, Briefing Notification |

---

## 7. Segurança em números

- Criptografia de tokens: **AES-256-GCM**
- OAuth com `state` + `nonce` persistidos em `oauth_states`
- Webhooks: HMAC + idempotência (`webhook_events`)
- Audit log particionado + `pg_cron` para prune
- Rate limit por endpoint sensível
- Última auditoria: RC1 Security **9.6/10**, RC2 consolidada **9.22/10**

Referências: `docs/SECURITY.md`, `docs/security/*`.

---

## 8. Handoff para Claude Code (migração)

Consumir na ordem:
1. Este `PROJECT_MANIFEST.md`
2. `docs/ARCHITECTURE_FREEZE.md`
3. `docs/ARCHITECTURE.md` + `docs/ARCHITECTURE_DECISIONS.md`
4. `docs/MIGRATION_GUIDE.md`
5. `docs/CLAUDE_CODE_HANDOFF.md`
6. `docs/SECURITY.md` + `docs/security/*`
7. `docs/ENGINEERING_HANDBOOK.md`
8. `docs/PRODUCT_BACKLOG.md`
9. `mem/architecture/*` (constraints permanentes)

**Regra de ouro para o migrador:** replicar contratos, não copiar implementação linha-a-linha. Preservar RLS, multi-tenant, Provider Layer e o Event Bus. Qualquer desvio exige novo ADR.

---

## 9. Não fazer (para futuros agentes)

- Não introduzir SDK externo fora do Provider Layer
- Não alterar `src/integrations/supabase/*` gerados
- Não remover RLS de nenhuma tabela pública
- Não usar Redis/BullMQ (removido da baseline — Workers-first)
- Não recriar Sprints genéricas; toda demanda é uma FEATURE
- Não commitar segredos; usar Lovable Cloud Secrets ou variáveis de ambiente do runtime alvo

---

## 10. Ponteiros rápidos

- Índice de docs: [`docs/INDEX.md`](docs/INDEX.md)
- Roadmap: [`docs/MASTER_ROADMAP.md`](docs/MASTER_ROADMAP.md)
- Backlog: [`docs/PRODUCT_BACKLOG.md`](docs/PRODUCT_BACKLOG.md)
- Runbooks: [`docs/runbooks/`](docs/runbooks/)
- Diagramas: [`docs/DIAGRAMS.md`](docs/DIAGRAMS.md)

---

**Fim do manifesto.** Este documento é a fonte de verdade para qualquer decisão de migração ou onboarding.
