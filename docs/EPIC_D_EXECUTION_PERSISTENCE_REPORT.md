# EPIC D — AI Execution & Persistence Layer

**Status:** ✅ Implementado · 100% aditivo · Freeze v1.0 preservado.

## 1. Objetivo

Conectar o Marketing Expert (Epic C) ao WorkflowExecutor (Epic B) e materializar as saídas estruturadas (Evidence, Playbook, Recommendation) em três novas tabelas com RLS multi-tenant.

## 2. Arquitetura

```
Expert Layer (Epic C, imutável)
        │
        ▼
ExpertService.runAndPersist()      ← src/lib/ai/experts/service.ts
        │
        ├── EvidenceRepository     ← contracts/expert-persistence.ts
        ├── PlaybookRepository
        └── RecommendationRepository
                │
   ┌────────────┴────────────┐
   │                         │
InMemory (tests)      Supabase (prod)
persistence/experts   persistence/experts.server.ts
                            │
                            ▼
             ai_evidence · ai_playbooks · ai_recommendations
                     (RLS por organization_id)
```

## 3. Database Layer

Migration `EPIC D` cria três tabelas em `public`:

| Tabela | PK biz | FKs | RLS |
| --- | --- | --- | --- |
| `ai_evidence` | `(org, evidence_id)` | — | SELECT org; INSERT/UPDATE/DELETE apenas owner/admin |
| `ai_playbooks` | `(org, playbook_id)` | `evidence_id → ai_evidence` | idem |
| `ai_recommendations` | `(org, recommendation_id)` | `evidence_id`, `playbook_id` | idem + filtro por `status` |

Todas com:
- `ENABLE + FORCE ROW LEVEL SECURITY`
- `GRANT SELECT TO authenticated` (leitura por membros da org)
- `GRANT ALL TO service_role` (writes via Execution Engine)
- Índices: `(organization_id, created_at DESC)` e `(organization_id, status)` para recomendações.
- Trigger `touch_updated_at` reaproveita função existente.

## 4. Repository Layer

- `src/lib/ai/contracts/expert-persistence.ts` — interfaces puras.
- `src/lib/ai/persistence/experts.ts` — In-memory (tests, dev).
- `src/lib/ai/persistence/experts.server.ts` — Supabase-backed via `supabaseAdmin`; carregado **dentro** de handlers de server functions para não vazar para o bundle do cliente (import graph rules).

## 5. Service Layer

`ExpertService` recebe um `Expert` e um `ExpertRepositoryBundle`. Ordem canônica de gravação: Evidence → Playbook → Recommendation (respeita FK).

## 6. Workflow Integration

`MarketingWorkflowRunner` compõe `WorkflowExecutor` (Epic B) + `ExpertService` (Epic D). O executor cuida da telemetria, budget, retry e fallback de provider; o Expert entrega o output estruturado que é persistido em seguida. Nenhuma alteração no `WorkflowExecutor`.

## 7. Server Functions (`src/lib/experts.functions.ts`)

- `listRecommendations({ status?, limit? })`
- `listPlaybooks({ limit? })`
- `listEvidence({ limit? })`
- `updateRecommendationStatus({ recommendationId, status })`

Todas passam por `requireSupabaseAuth` e resolvem `organization_id` via `profiles`, garantindo isolamento multi-tenant mesmo com service_role.

## 8. Testes

- `tests/unit/lib/ai/epic-d-persistence.test.ts` (4 casos): persistência, isolamento multi-tenant, status update, idempotência de upsert.
- `tests/unit/lib/ai/epic-d-workflow.test.ts` (1 caso): composição Workflow × Expert × Persistência.

## 9. Restrições Respeitadas

- Freeze v1.0: intacto (nenhum contrato alterado).
- Provider Layer: intacto.
- Tracker / Attribution / Session Manager / Event Pipeline: intactos.
- Nenhum componente React modificado.
- Nenhuma API pública modificada.

## 10. Riscos / Pendências

- UI dedicada de Recommendations/Playbooks não faz parte do escopo (Epic E ou Feature P0.6/UI-6).
- Enriquecimento por Claude ainda usa mock adapter; a integração real acontece quando o provider adapter para Claude for ativado com credenciais.
