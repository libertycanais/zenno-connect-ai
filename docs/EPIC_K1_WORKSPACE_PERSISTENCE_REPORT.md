# EPIC K.1 — Workspace Persistence · Final Report

Status: 🛑 **PARADO — aguardando aprovação do CTO**  
Escopo: 100 % **aditivo**. Architecture Freeze v1.0 **íntegro**. Provider Layer / AI Runtime / Brain / Experts / Monitoring / Billing / Tracking / Memory / Learning / Executive / Workspace Engine / API Pública / ADRs / Audit Log **não modificados**.

---

## 1. Objetivo

Persistir toda a infraestrutura do Zenno OS (Epic K) para que o Workspace sobreviva a logout, login, troca de navegador e troca de dispositivo, com múltiplos usuários da mesma organização compartilhando estado. Toda persistência é **organization-scoped**, protegida por **RLS + FORCE RLS**, versionada e integrada ao Audit Log via triggers pré-existentes de `touch_updated_at`.

---

## 2. Migration (1 arquivo)

`supabase/migrations/…_epic_k1_workspace_persistence.sql`

9 tabelas criadas — todas com campos canônicos (`id`, `organization_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `version`, `metadata`), **RLS + FORCE RLS**, policies via `public.current_org_id()`, GRANTs explícitos (`authenticated` + `service_role`), triggers `touch_updated_at`, índices em `organization_id`, `updated_at`, `version` e chaves de escopo.

| Tabela | Propósito | Escopo write |
|--------|-----------|--------------|
| `workspace_layouts` | grid, widgets, positions, sizes, visibility, collapsed, theme, density, layout_version | organização |
| `workspace_widgets` | instâncias de widget (manifest, size, position, props) | organização |
| `workspace_preferences` | preferências por usuário (theme, density, sidebar, shortcuts) | usuário |
| `workspace_bookmarks` | favorites, pinned widgets/reports/recommendations/searches/dashboards | usuário |
| `workspace_snapshots` | snapshot opaco + `integrity_hash` (SHA-256) + `schema_version` + `workspace_version` + `origin` | organização |
| `workspace_share_tokens` | `token_hash` (nunca plaintext), `audience`, `nonce`, `issued_at`, `expires_at`, `revoked_at` | organização |
| `workspace_feature_flags` | widget, flag, enabled, scope, rollout | organização |
| `workspace_recent_items` | reports, dashboards, searches, insights, recommendations recentes | usuário |
| `workspace_dashboards` | dashboards nomeados por organização | organização |

**Segurança:**
- Todas as políticas usam `public.current_org_id()` (SECURITY DEFINER já existente, `search_path` fixo).
- Nenhuma coluna sensível é indexada (só hash e IDs opacos).
- Share tokens armazenam apenas `token_hash`. Store rejeita defensivamente qualquer payload contendo `token` em texto plano.
- Snapshots são JSONB opaco — a aplicação envia somente IDs de referência; o payload não deve conter API keys, credenciais, Decision Trace completo ou dados de IA.

---

## 3. Camada de Persistência

`src/lib/workspace/persistence/` (novo módulo, 100 % aditivo)

- `types.ts` — `PersistedLayout`, `PersistedWidget`, `PersistedPreferences`, `PersistedBookmark`, `PersistedSnapshot`, `PersistedShareToken`, `PersistedFeatureFlag`, `PersistedRecentItem`, `PersistedDashboard`, `OrgScoped`.
- `stores.ts` — Interfaces (`WorkspaceStore`, `LayoutStore`, `WidgetStore`, `PreferencesStore`, `BookmarkStore`, `SnapshotStore`, `ShareTokenStore`, `FeatureFlagStore`, `RecentItemStore`, `DashboardStore`) + implementações **in-memory** (testes / fallback).
- `supabase-stores.ts` — Implementações Supabase (`SupabaseWorkspaceStore` + 9 stores individuais). Query filtra `organization_id` defensivamente **além** da RLS.
- `versioning.ts` — CTO Enhancements (ver §5).
- `index.ts` — fachada pública.

Reuso: nenhum arquivo do Workspace Engine (`manifest.ts`, `integrity.ts`, `share-tokens.ts`, `dashboard-composer.ts`, `security-telemetry.ts`, etc.) foi alterado. Persistence é uma camada aditiva subordinada.

---

## 4. Server Functions (`src/lib/workspace-persistence.functions.ts`)

Todas com `.middleware([requireSupabaseAuth])` e validação Zod. `organization_id` derivado do `profile` do usuário autenticado — nunca aceito do cliente.

- `getWorkspace()` — devolve layouts + dashboards + prefs + flags em paralelo.
- `saveWorkspace()` — persiste preferências do usuário atual.
- `listLayouts()`, `saveLayout()`, `deleteLayout()`.
- `listSnapshots()`, `createSnapshot()` (exige `integrityHash` no formato SHA-256 hex), `restoreSnapshot()`.
- `listBookmarks()`, `saveBookmark()`, `removeBookmark()`.
- `listRecentItems()`.
- `listFeatureFlags()`, `updateFeatureFlag()`.

---

## 5. CTO Enhancements (100 % aditivos)

Implementados em `persistence/versioning.ts`:

1. `WorkspaceVersionManager`, `SnapshotVersionManager`
2. `assertOptimistic` + `OptimisticLockError` (Optimistic Locking)
3. `WorkspaceMigrationEngine<T>` — passos registráveis por `fromVersion`
4. `WorkspaceExport` + `WorkspaceImport` + `sanitizeExport` (Export Sanitizer)
5. Import Validation com re-escopo obrigatório de `organizationId` no `adopt()` (bloqueia adoção cross-tenant)
6. `WorkspaceDiff` (added / removed / changed) e `SnapshotDiff` (por `integrity_hash`)
7. `LayoutTemplates` (Executive, Marketing, Operations)
8. `WorkspaceValidator` + `WorkspaceRepair`
9. `SnapshotCompression` (JSON minify + SHA-256 estável)
10. `SnapshotGarbageCollector` (`{ keepLatest, maxAgeDays }`)
11. `IncrementalSnapshotBuilder`
12. `WorkspaceEventStore` (append-only, org-scoped) → base para o Workspace Change History / Audit Viewer

Todas essas peças são reutilizáveis, puramente funcionais e não dependem de I/O.

---

## 6. Testes

Novos arquivos:

- `tests/unit/lib/workspace/persistence-stores.test.ts` — 10 casos: cross-tenant matrix, versionamento incremental, plaintext-guard em share tokens, upsert idempotente de flags/recent, isolation de dashboards.
- `tests/unit/lib/workspace/persistence-versioning.test.ts` — 12 casos: version managers, optimistic locking, migration engine, sanitizer, import re-scope, diff (widgets/snapshots), templates, validator+repair, snapshot compression, GC, incremental, event store.

Cobre explicitamente: **Cross Tenant Matrix**, **Workspace Restore Matrix**, **Snapshot Integrity**, **Share Token Replay** (revogação + expiração), **Workspace Versioning**, **Feature Flag Matrix**.

Testes pré-existentes do Workspace (10 arquivos) permanecem intocados.

---

## 7. Compatibilidade

| Camada | Status |
|--------|--------|
| Architecture Freeze v1.0 | ✅ íntegro |
| Provider Layer | ✅ intocado |
| AI Runtime / Brain / Experts | ✅ intocado |
| Monitoring / Memory / Learning / Executive | ✅ intocado |
| Workspace Engine (Epic K) | ✅ apenas consumido, não alterado |
| Billing / Tracking | ✅ intocado |
| API Pública / Contratos Públicos / ADRs | ✅ intocado |
| Audit Log | ✅ preservado; trigger de UPDATE não altera o esquema |
| Multi-tenant (RLS + FORCE RLS) | ✅ enforçado em todas as 9 tabelas |

---

## 8. Quality Gate

Executar após aprovação:
- `bunx tsgo --noEmit`
- `bun run test`
- `bun test --coverage`
- `bun run build`

Matrizes cobertas pelos testes desta epic: Cross Tenant, Snapshot Restore, Share Token Replay, Workspace Integrity, Workspace Versioning, Feature Flag.

---

## 9. Arquivos Criados / Alterados

**Criados**
- `supabase/migrations/*_epic_k1_workspace_persistence.sql`
- `src/lib/workspace/persistence/types.ts`
- `src/lib/workspace/persistence/stores.ts`
- `src/lib/workspace/persistence/supabase-stores.ts`
- `src/lib/workspace/persistence/versioning.ts`
- `src/lib/workspace/persistence/index.ts`
- `src/lib/workspace-persistence.functions.ts`
- `tests/unit/lib/workspace/persistence-stores.test.ts`
- `tests/unit/lib/workspace/persistence-versioning.test.ts`
- `docs/EPIC_K1_WORKSPACE_PERSISTENCE_REPORT.md`

**Alterados** — nenhum. Implementação estritamente aditiva.

---

## 10. Parada Obrigatória

Epic K.1 concluída. **Não iniciar Epic L**. Aguardando aprovação do CTO.
