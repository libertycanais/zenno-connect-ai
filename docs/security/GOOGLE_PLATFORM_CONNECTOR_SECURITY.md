# Security Design Review — Enterprise Google Marketing Platform Connector v1.0

> Status: **DRAFT / AWAITING CTO APPROVAL**
> Scope: Fase 1 (SDR) — nenhuma implementação de código, migração ou alteração de contrato.
> Architecture Freeze v1.0: **preservado**. RC2 em operação: **preservado**.
> Feature será 100% aditiva sob `src/lib/google/*`, novas tabelas `google_*`, novas rotas `/app/google/*` e `/api/public/google/*`.

---

## 1. Executive Summary

O Google Marketing Platform Connector amplia o Provider Layer existente (`google_ads` já presente) para um conector **multi-serviço** cobrindo Ads (incluindo MCC), GA4, Tag Manager, Search Console, Merchant Center e Business Profile, com um **Enterprise Setup Wizard** que executa OAuth incremental, discovery automático de ativos, seleção manual e binding a organizações do tenant.

A superfície de ataque cresce em três dimensões — **credenciais OAuth de longa duração**, **cross-tenant leakage no MCC discovery**, e **quota/API abuse contra Google**. Este SDR define o modelo de ameaças, os invariantes de segurança inegociáveis, e o checklist de merge que a Fase 2 (Build) deverá satisfazer.

**Recomendação estratégica (CTO):** desenhar o contrato como `MarketingPlatformConnector` reutilizável (Google, Meta, TikTok, LinkedIn, Microsoft Ads) — o wizard, health-check, telemetria e circuit breaker vivem no core; adapters são plugáveis. Isso é registrado como invariante arquitetural I-A1.

---

## 2. Trust Boundaries

```
┌───────────────────────────────────┐
│ Browser (tenant user)             │  ← untrusted input, sem segredos
└───────────────┬───────────────────┘
                │ HTTPS + Supabase JWT
┌───────────────▼───────────────────┐
│ TanStack Server Functions         │  ← requireSupabaseAuth + RBAC
│ src/lib/google/*.functions.ts     │
└───────────────┬───────────────────┘
                │ server-only
┌───────────────▼───────────────────┐
│ Google OAuth 2.0 / Ads / GA4 …    │  ← quota + rate-limit
└───────────────────────────────────┘

┌───────────────────────────────────┐
│ /api/public/google/oauth/callback │  ← anonymous, HMAC state, rate-limited
└───────────────────────────────────┘

┌───────────────────────────────────┐
│ Postgres (Supabase)               │  ← RLS + FORCE RLS + audit triggers
│ google_connections, google_assets,│
│ google_mcc_accounts, sync_jobs …  │
└───────────────────────────────────┘
```

Boundaries críticas:
- **B1 — Browser ↔ Server functions:** nenhum `access_token`/`refresh_token` cruza para o cliente. Frontend só recebe metadata (nome da conta, customer_id mascarado, status).
- **B2 — Server ↔ Google:** único ponto de saída. SDK/HTTP centralizado em `src/lib/google/http` com circuit breaker, retry exponencial e sanitização de erros (`sanitizeProviderError`).
- **B3 — OAuth callback público:** `/api/public/google/oauth/callback` é anônimo por definição — validação é feita via `state` HMAC + `oauth_states` de uso único + `global_rate_limit_hit`.
- **B4 — Tenant ↔ Tenant:** intransponível. Toda linha `google_*` carrega `organization_id`; toda leitura roteia por `current_org_id()` sob RLS FORCE.

---

## 3. Threat Model (STRIDE)

| # | Ameaça | Categoria | Vetor | Impacto | Mitigação principal |
|---|--------|-----------|-------|---------|---------------------|
| T1 | Roubo de `refresh_token` no banco | Information Disclosure | Backup dump, SQLi hipotética, insider | Acesso permanente à conta Google do cliente | AES-256-GCM per-row, chave em `AI_ENCRYPTION_KEY` (rotação anual), nonce único, `audit_redact` |
| T2 | Cross-tenant discovery leakage | Elevation of Privilege | Bug de query, RLS ausente, cache global | Org A vê contas MCC descobertas por Org B | RLS + FORCE RLS em `google_mcc_accounts`, `google_discovery_cache` chaveado por `(org, connection_id)`, testes multi-tenant obrigatórios |
| T3 | CSRF no OAuth callback | Spoofing | Atacante induz vítima a `?state=x&code=y` | Vincula conta do atacante ao tenant da vítima | `state` = 32B random, guardado em `oauth_states` com `organization_id + user_id`, TTL 10min, single-use, `SameSite=Lax` |
| T4 | Redirect URI hijack | Tampering | Registro de `redirect_uri` frouxo no Google Console | Interceptação de `code` | Allowlist exata (produção + preview de domínio Lovable), sem wildcards, sem `localhost` em prod |
| T5 | MCC binding não-autorizado | EoP | Owner de Org A vincula um `customer_id` do MCC da Org B | Ads de terceiros aparecem no dashboard errado | Binding requer: conexão dona do MCC + confirmação explícita + registro de `bound_by_user_id` + audit trail |
| T6 | Token replay / stale refresh | Repudiation | Refresh armazenado após revogação silenciosa | Continua "consumindo" quota até detectar erro | Health-check periódico (`pg_cron` a cada 6h), detecção `invalid_grant` → mover para `status=revoked`, notificar owner |
| T7 | Quota exhaustion / DoS Google | DoS | Sync agressivo dispara 429/quota | Bloqueio da conta Google inteira | Circuit breaker por `(provider, org)`, backoff exponencial com full jitter (reusar `withRetry` já em `src/lib/ai/resilience`), quota tracker |
| T8 | Scope creep / over-permission | EoP | Solicitar `adwords` + `analytics.edit` upfront | Blast radius maior em token vazado | **Incremental consent** — cada serviço solicita apenas seu scope no momento da ativação |
| T9 | Frontend recebe segredos | Info Disclosure | Server function retorna row completa | XSS lê `access_token` | Projeções explícitas em toda server fn (`select` só de colunas seguras), types dedicados `GoogleConnectionPublic` |
| T10 | Logs vazam tokens | Info Disclosure | `console.error(err)` com body do Google | Tokens em Cloudflare/Sentry | `sanitizeProviderError` + `audit_redact` estendido com chaves Google (`access_token`, `refresh_token`, `id_token`, `developer_token`) |
| T11 | Revogação parcial | Availability | Owner revoga mas assets órfãos permanecem | Dados stale exibidos | Revogação em cascata: `POST /oauth2/revoke` + `google_connections.status='revoked'` + `google_assets.status='orphaned'` |
| T12 | LGPD — direito ao esquecimento | Compliance | Cliente pede exclusão | Fine + reputational | `google_erasure(org)` server fn: revoke → delete `google_*` da org → audit log imutável |

---

## 4. Security Invariants

**I-S1.** Nenhum `access_token`, `refresh_token`, `developer_token` ou `client_secret` cruza a boundary Server→Client. **Sempre.**

**I-S2.** Toda tabela `google_*` tem `organization_id NOT NULL`, RLS habilitada, **FORCE RLS** habilitada, e todas as policies usam `current_org_id()` (nunca `auth.uid()` direto para leitura cross-user dentro do tenant).

**I-S3.** Toda server fn em `src/lib/google/**/*.functions.ts` declara `.middleware([requireSupabaseAuth])` **e** valida RBAC (`has_role(user, 'owner'|'admin', org)`) antes de qualquer ação privilegiada (bind, unbind, revoke, sync manual).

**I-S4.** Refresh tokens são cifrados com AES-256-GCM antes do INSERT; a chave é `AI_ENCRYPTION_KEY` (já provisionada); nonce é gerado por linha; ciphertext e nonce moram em colunas separadas (`refresh_token_ciphertext bytea`, `refresh_token_nonce bytea`). Reusar `src/lib/ai/crypto` (já auditado).

**I-S5.** `state` do OAuth é HMAC-random 32B, single-use, TTL ≤ 10min, com rate limit `oauth:<ip>` (20/min) e `oauth:<state>` (3/min) via `global_rate_limit_hit`.

**I-S6.** Redirect URI é **exata** — array constante `GOOGLE_REDIRECT_URIS` em `src/lib/google/oauth/config.ts`, validado contra a request. Nenhum matching por prefixo/regex.

**I-S7.** Discovery cache (`google_discovery_cache`) é chaveado por `(organization_id, connection_id, service)`. Nunca há cache "global" de contas Google.

**I-S8.** MCC binding é **manual e explícito**. Sugestões automáticas são permitidas na UI (score de match por nome/email), mas o INSERT em `google_connection_bindings` exige clique consciente e é audited com `actor_user_id`, `mcc_id`, `customer_id`, `organization_id`.

**I-S9.** Consentimento é **incremental**. Wizard pede apenas o scope do serviço sendo ativado. Adicionar novo serviço = novo consent flow.

**I-S10.** Toda escrita sensível dispara trigger `audit_row_change` (padrão já existente) — tabelas: `google_connections`, `google_connection_bindings`, `google_mcc_accounts`, `google_sync_jobs`.

**I-A1.** (Arquitetural, recomendação CTO) — interface `MarketingPlatformConnector` em `src/lib/marketing-platform/contracts/` é o contrato; Google, Meta, TikTok etc. são adapters. Wizard, health, telemetria, circuit breaker vivem no core.

**I-A2.** Feature é 100% aditiva. Zero mudança em: Provider Layer, AI Runtime, Brain, Task Engine, Billing, Tracking, Executive, Workspace, Product Layer, Security, Observability, RC2, contratos públicos.

---

## 5. Multi-Tenant Architecture — Validation Plan

Tabelas propostas (validação estrutural, DDL na Fase 2):

| Tabela | PK | FKs | RLS Policy (SELECT/ALL) | Índices críticos |
|--------|----|----|-------------------------|------------------|
| `google_connections` | uuid | `organization_id`, `owner_user_id` | `organization_id = current_org_id()` | `(organization_id, status)`, `(organization_id, google_account_email)` UNIQUE |
| `google_mcc_accounts` | uuid | `connection_id`, `organization_id` | `organization_id = current_org_id()` | `(connection_id, manager_customer_id)` UNIQUE |
| `google_discovery_cache` | uuid | `connection_id`, `organization_id` | `organization_id = current_org_id()` | `(connection_id, service)`, TTL `expires_at` |
| `google_connection_bindings` | uuid | `connection_id`, `organization_id`, `resource_id` | `organization_id = current_org_id()` | `(organization_id, service, resource_id)` UNIQUE |
| `google_assets` | uuid | `binding_id`, `organization_id` | `organization_id = current_org_id()` | `(organization_id, service, external_id)` UNIQUE |
| `google_sync_jobs` | uuid | `connection_id`, `organization_id` | `organization_id = current_org_id()` | `(organization_id, status, scheduled_for)` |
| `google_audit` | (reusa `audit_log` particionado) | — | herdada | — |

Cada tabela deve ter: `created_at`, `updated_at`, `deleted_at?`, trigger `touch_updated_at`, trigger `audit_row_change`, GRANTs para `authenticated` e `service_role`.

**Validação cross-tenant (test matrix — Fase 2):**
- Owner de Org A não consegue ler `google_connections` de Org B (403/empty).
- Owner de Org A não consegue vincular `manager_customer_id` descoberto por Org B.
- `google_discovery_cache` de A é invisível a B mesmo com mesmo `connection.google_account_email`.
- `google_sync_jobs` executam sob RLS do owner, nunca com `service_role` bypass de tenant.

---

## 6. OAuth Flow — Design

1. **Start** (`startGoogleConnection`, server fn, `requireSupabaseAuth`):
   - Gera `state` = 32B base64url.
   - Insere `oauth_states { state, provider='google', organization_id, user_id, requested_scopes, created_at }`, TTL 10min.
   - Rate limit: `google_oauth:start:<user>` 5/min.
   - Retorna URL com `access_type=offline`, `prompt=consent`, `include_granted_scopes=true` (incremental consent).

2. **Callback** (`/api/public/google/oauth/callback`, público):
   - Rate limit `google_oauth:cb:<ip>` 20/min + `google_oauth:state:<state>` 3/min.
   - Valida `state` existe, não expirado, não consumido → marca `consumed_at=now()`.
   - Troca `code` por tokens via `POST /token` com `client_secret` server-side.
   - Cifra `refresh_token` (AES-256-GCM) + persiste `google_connections`.
   - Redireciona para `/app/integracoes/google?connection=<id>` (nunca para URL externa vinda de query).

3. **Refresh** (background, `ensureAccessToken`):
   - Se `expires_at - now < 60s` → refresh.
   - Erro `invalid_grant` → `status='revoked'` + notifica owner + emite métrica.

4. **Revoke** (`revokeGoogleConnection`, RBAC owner/admin):
   - `POST https://oauth2.googleapis.com/revoke` com refresh token descifrado.
   - Update `status='revoked'`, propaga para `google_connection_bindings.status='inactive'`.
   - Audit.

---

## 7. MCC & Discovery — Design

**Descoberta:**
- Após OAuth Ads, chamar `customers:listAccessibleCustomers` → para cada `customer_id` chamar `GoogleAdsService.searchStream` com query de `customer_client` para detectar hierarquia MCC.
- Persistir em `google_mcc_accounts` (se `manager=true`) e cache em `google_discovery_cache` com `expires_at = now() + 24h`.
- **Nunca** cache global — sempre `(organization_id, connection_id, service)`.

**Busca:**
- Server fn `searchDiscoveredAccounts({ query, filters, page })` — filtra `SELECT ... FROM google_discovery_cache WHERE organization_id = current_org_id() AND connection_id = $1 AND (name ILIKE ... OR customer_id = ...)`. Paginação keyset.

**Binding:**
- `bindDiscoveredAccount({ connection_id, customer_id, target_organization_id })`.
- Servidor valida: (a) `connection.organization_id = current_org_id()`, (b) `target_organization_id` pertence ao mesmo tenant OU o usuário é `agency_admin` do grupo, (c) `customer_id` está em `google_discovery_cache` da conexão.
- INSERT `google_connection_bindings` + audit.

Para serviços não-Ads (GA4, GTM, GSC, Merchant, Business), discovery usa endpoints análogos (`properties.list`, `containers.list`, `sites.list`, `accounts.list`, `accounts.list/locations.list`) — mesma disciplina de cache e binding.

---

## 8. Token Storage & Crypto

- Reusar `src/lib/ai/crypto` (AES-256-GCM já auditado no Epic P0.6).
- Colunas: `refresh_token_ciphertext bytea NOT NULL`, `refresh_token_nonce bytea NOT NULL`, `refresh_token_key_version smallint NOT NULL DEFAULT 1`.
- `access_token` é curto-prazo — armazenado **em plaintext** apenas se `expires_at > now()+30s`; ideal manter só cifrado ou não persistir (recomputar via refresh).
- Chave: `AI_ENCRYPTION_KEY`. Rotação: incrementar `key_version`, re-cifrar em job de manutenção. Documentar em `docs/runbooks/google.md` (Fase 2).
- `audit_redact` **deve ser estendido** para incluir: `refresh_token_ciphertext`, `refresh_token_nonce`, `developer_token`, `id_token`, `google_client_secret`.

---

## 9. Server Functions — Contract

Todas em `src/lib/google/**/*.functions.ts`, todas com `.middleware([requireSupabaseAuth])`:

| Server Fn | RBAC | Rate-limit | Escrita | Auditada |
|-----------|------|-----------|---------|----------|
| `startGoogleConnection` | member | 5/min/user | oauth_states | — |
| `listGoogleConnections` | member | — | — | — |
| `revokeGoogleConnection` | owner/admin | 3/min/org | connections, bindings | ✅ |
| `discoverGoogleAssets` | admin | 6/min/connection | discovery_cache | ✅ |
| `searchDiscoveredAccounts` | member | — | — | — |
| `bindDiscoveredAccount` | owner/admin | 30/min/user | bindings | ✅ |
| `unbindAccount` | owner/admin | 30/min/user | bindings | ✅ |
| `syncBinding` (manual) | admin | 4/min/binding | sync_jobs, assets | ✅ |
| `getConnectionHealth` | member | — | — | — |
| `googleErasure` (LGPD) | owner | 1/min/org | tudo | ✅ |

Nenhum endpoint público exceto o callback OAuth.

---

## 10. Observability — Metrics Plan

Registrar via módulo `src/lib/observability` já existente (Sprint 5.3):

| Métrica | Tipo | Labels |
|---------|------|--------|
| `google.oauth.start` | counter | `service` |
| `google.oauth.success` | counter | `service` |
| `google.oauth.error` | counter | `service`, `reason` |
| `google.discovery.duration_ms` | histogram | `service` |
| `google.discovery.assets_found` | histogram | `service` |
| `google.binding.created` | counter | `service` |
| `google.sync.duration_ms` | histogram | `service` |
| `google.sync.error` | counter | `service`, `reason` |
| `google.token.refresh` | counter | `outcome` |
| `google.token.revoked_detected` | counter | — |
| `google.permission.lost` | counter | `service` |
| `google.circuit.open` | counter | `service` |
| `google.quota.throttled` | counter | `service` |

Alertas propostos (docs/OBSERVABILITY_ALERTS.md, Fase 2):
- `google.oauth.error / google.oauth.start > 20%` por 15min → warn.
- `google.token.revoked_detected > 5` por hora → warn.
- `google.circuit.open > 0` sustained 5min → error.

---

## 11. LGPD Compliance

- **Retenção:** `google_connections` e derivados retidos enquanto a conexão está ativa. `google_sync_jobs.raw_payload` retido 90 dias, purge via `pg_cron`.
- **Revogação:** endpoint `revokeGoogleConnection` = OAuth revoke + soft-delete no lado Zenno.
- **Direito ao esquecimento:** `googleErasure(org)` — revoga OAuth, apaga `google_*` da org, mantém `audit_log` (append-only, particionado) com PII redigida.
- **Dados mínimos:** apenas metadata operacional (customer_id, nome, moeda, timezone). Não persistir dados pessoais de leads/usuários do cliente final além do estritamente necessário para relatórios agregados.
- **Base legal:** consentimento explícito no wizard (checkbox "Autorizo o Zenno a acessar minhas contas Google...") + política de privacidade linkada.

---

## 12. Merge Checklist (Fase 2)

Bloqueadores — sem estes, PR **não** merga:

- [ ] Todas as tabelas `google_*` com RLS + FORCE RLS + GRANTs + trigger de audit.
- [ ] Zero secret exposto ao client (grep em bundle contra `refresh_token`, `client_secret`, `developer_token`).
- [ ] `sanitizeProviderError` cobre todos os erros Google (unit test).
- [ ] `audit_redact` estendido com chaves Google (test do `audit_log.test.ts`).
- [ ] OAuth callback: rate-limit + state single-use + redirect_uri exato (integration test).
- [ ] Multi-tenant test: Org A não vê nada da Org B em `google_*` (integration test dedicado).
- [ ] Toda server fn de escrita: `requireSupabaseAuth` + RBAC + audit log verificado.
- [ ] Circuit breaker + retry exponencial aplicados no client HTTP Google (unit test).
- [ ] Health check job registrado em `pg_cron` (6h) — plan documentado.
- [ ] `docs/runbooks/google.md` com procedimentos: rotação de chave, revogação em massa, incident response.
- [ ] `bunx tsgo --noEmit` verde, `bun run test` verde, `bun run build` verde.

---

## 13. Test Matrix

| Camada | Cenário | Esperado |
|--------|---------|----------|
| Unit | `sanitizeProviderError` remove bearer/refresh/developer tokens | strings redigidas |
| Unit | AES-GCM roundtrip refresh_token | plaintext idêntico |
| Unit | Circuit breaker abre após N falhas Google | estado OPEN |
| Unit | Retry backoff respeita `Retry-After` do Google | delay ≥ header |
| Integration | OAuth callback rejeita state expirado | 400 |
| Integration | OAuth callback rejeita state consumido | 400 |
| Integration | OAuth callback rate-limited após 20 hits/min | 429 |
| Integration | Redirect URI fora da allowlist | 400 |
| Integration | RLS: Org A SELECT em `google_connections` → 0 rows de Org B | pass |
| Integration | Binding cross-tenant recusado | 403 |
| Integration | Revoke propaga para bindings | `status='inactive'` |
| Integration | Erasure remove todos os `google_*` da org | 0 rows, audit permanece |
| E2E | Wizard: login → discovery → seleção → bind → resumo | happy path |
| E2E | Wizard: MCC com 500+ clientes → busca paginada | responsivo |
| Security | Frontend bundle não contém chaves Google | grep 0 hits |
| Security | Fuzzing no callback (state, code, error) | sem 5xx |

---

## 14. Riscos Residuais Aceitos

| Risco | Justificativa | Mitigação compensatória |
|-------|---------------|-------------------------|
| Google pode revogar API sem aviso (deprecação Ads v17→v18) | Fora do controle | Versão da API em const centralizada; smoke test noturno |
| `client_secret` compartilhado entre tenants | Google não emite por-tenant; padrão da plataforma | Rotação anual documentada + monitoramento de uso anômalo |
| Circuit breaker é in-memory (Worker) | Cloudflare Workers isolam por instância | Aceitável para RC2; ticket futuro para KV/DO se necessário |
| Health-check com pg_cron requer `pg_net` | Já dependência do projeto | — |

---

## 15. CTO Recommendations — Compliance Map

| # | Recomendação CTO | Onde entra no design |
|---|------------------|----------------------|
| 1 | Consentimento incremental | I-S9; OAuth start solicita scope por serviço |
| 2 | Health Check automático | pg_cron 6h + métricas |
| 3 | Reconexão inteligente | Detecção `invalid_grant` → banner no wizard com re-consent |
| 4 | Revogação por organização | `revokeGoogleConnection` + cascade |
| 5 | Logs de segurança | Trigger `audit_row_change` em todas as tabelas |
| 6 | Rotação automática | `key_version` + runbook |
| 7 | Auditoria completa | Reusa `audit_log` particionado |
| 8 | Allowlist de serviços | Enum `google_service` em const server-side |
| 9 | Retry exponencial | Reusa `withRetry` de `src/lib/ai/resilience` |
| 10 | Circuit Breaker | Reusa `circuitBreaker` do mesmo módulo |
| 11 | Quotas Google | Tracker por `(service, connection)` — expostos em health |
| 12 | Backoff | Full jitter, respeita `Retry-After` |
| 13 | Observabilidade | Seção 10 |
| 14 | Multiplataforma (I-A1) | Contrato `MarketingPlatformConnector`; Google é primeiro adapter |

---

## 16. Approval Gate

Este documento encerra a **Fase 1 — Security Design Review**.

Nenhum código, migração, política ou contrato foi alterado.

**Próximo passo:** aguardar aprovação explícita do CTO para iniciar a Fase 2 (Build), conforme Prompt 2 do plano.

**Sign-off proposto:**
- [ ] CTO — aprovação do modelo de ameaças e invariantes.
- [ ] Security — aprovação do plano cripto (AES-GCM + rotação).
- [ ] Arquitetura — aprovação do contrato `MarketingPlatformConnector` (I-A1).
- [ ] LGPD/DPO — aprovação do plano de retenção e erasure.

— Fim do SDR.
