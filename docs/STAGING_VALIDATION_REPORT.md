# Sprint 5.4 — Enterprise Staging Validation Report

**Status:** 🟡 **READY FOR STAGING** · 🟠 **NOT READY FOR PRODUCTION** (gaps operacionais listados)  
**Arquitetura:** ✅ Freeze v1.0 respeitado — nenhuma alteração de código, contratos, RLS ou Provider Layer.  
**Escopo:** Validação documental do sistema em ambiente próximo de produção. Não substitui execução real de staging (ver §7 — gaps).

---

## 1. WS-5.4.1 — Staging Validation Checklist

Validação estática contra código, migrações, docs e testes automatizados. Itens marcados 🟡 exigem execução real em staging para confirmação empírica (fora do escopo desta sprint — sem infra ao vivo).

| # | Item | Fonte de evidência | Resultado |
|---|------|--------------------|-----------|
| 1 | Login (email/senha) | `src/routes/auth.*`, `@lovable.dev/cloud-auth-js` | ✅ Configurado |
| 2 | Login Google | `lovable.auth.signInWithOAuth('google', ...)` | ✅ Configurado |
| 3 | Cadastro + trigger `handle_new_user` | `db-functions` (SECURITY DEFINER) | ✅ Cria org + profile + role owner |
| 4 | Organização (multi-tenant) | `organizations` + `current_org_id()` | ✅ |
| 5 | Isolamento multi-tenant (RLS) | `tests/integration/security/cross-tenant.test.ts` | ✅ 100% das policies referenciam `organization_id / auth.uid() / has_role / current_org_id` |
| 6 | Provider Layer | `tests/contracts/provider-payloads.contract.test.ts` | ✅ Contrato estável |
| 7 | Tracking events | `tracking_events` + `tracking.functions.ts` | ✅ Ingestão testada |
| 8 | Tracking session | `tracking_leads` + índice `(org, lead_id)` (5.2) | ✅ |
| 9 | Attribution | `attribution.server.ts` | ✅ Contrato testado; 🟡 latência real pendente de load |
| 10 | OAuth Meta | `meta_ad_accounts`, `oauth_states`, runbook | ✅ Configurado |
| 11 | OAuth Google | `google_ad_accounts`, connector `GOOGLE_SEARCH_CONSOLE_API_KEY` | ✅ Configurado |
| 12 | WhatsApp | `whatsapp_*` tabelas + `whatsapp.webhook.$instanceId.ts` | ✅ Configurado |
| 13 | Audit Log | `audit_log` particionado + `audit_log_block_mutation` + `audit_redact` | ✅ Append-only e redação garantidas |
| 14 | Rate Limit | `global_rate_limit_hit`, `track_compound_rate_limit_hit`, `track_rate_limit_hit` | ✅ SECURITY DEFINER |
| 15 | Docker | `docs/DOCKER.md`, `Dockerfile`, compose | 🟡 Baseline v1.0 é Cloudflare Workers; Docker é target opcional |
| 16 | Health `/api/public/health` | `src/routes/api/public/health.ts` | ✅ Endpoint público (a validar em staging real) |
| 17 | Ready `/api/public/ready` | idem | ✅ |
| 18 | Live `/api/public/live` | idem | ✅ |
| 19 | Logs estruturados | `src/lib/logger.ts` + redação | ✅ Padrão Enterprise |
| 20 | Métricas | `src/lib/observability/metrics.ts` + `/api/public/metrics` (token) | ✅ Sprint 5.3 |
| 21 | Tracing | `src/lib/observability/tracing.ts` (NoopTracer, OTel-shaped) | ✅ Pronto para swap |
| 22 | CI (Quality Gate) | `tsgo --noEmit`, `bun run test` | ✅ 313/313 verde |
| 23 | Deploy | `docs/DEPLOY_CHECKLIST.md`, `docs/RELEASE_PLAN.md` | ✅ Documentado |

**Bloqueios arquiteturais:** nenhum.  
**Bloqueios operacionais:** ver §5 (Production Gap).

---

## 2. WS-5.4.2 — Load Test Plan

> Plano **documental**. Execução real exige ambiente de staging isolado com carga sintética (`k6`, `artillery` ou `bombardier`).

### 2.1 Cenários

| # | Cenário | Ferramenta sugerida | Duração | Alvo (SLO) |
|---|---------|---------------------|---------|------------|
| L1 | 100 VUs simultâneos navegando app autenticado | k6 (`browser`+`http`) | 10 min | p95 < 500 ms |
| L2 | 500 VUs simultâneos | k6 | 15 min | p95 < 800 ms |
| L3 | 1 000 VUs simultâneos | k6 | 15 min | p95 < 1200 ms, erro < 1 % |
| L4 | 5 000 tracking events / min sustentados | k6 constant-arrival-rate | 30 min | ingest p95 < 300 ms, 0 % perda |
| L5 | 1 000 OAuth callbacks distribuídos | k6 ramp | 5 min | 0 estados corrompidos em `oauth_states` |
| L6 | 1 000 mensagens WhatsApp / min | k6 → `/api/public/whatsapp.webhook.$instanceId` | 15 min | p95 < 500 ms, 0 duplicação |
| L7 | Conversões simultâneas (100 rps) | k6 | 10 min | p95 < 1 s, 100 % gravadas |

### 2.2 Métricas obrigatórias (por cenário)

| Camada | Métricas |
|--------|----------|
| Cliente | RPS, throughput, erro %, p50/p95/p99, cold-start count |
| Server Functions | `app_request_duration_ms`, `app_errors_total` (por rota) |
| DB (PostgreSQL / Cloud) | CPU %, mem %, conexões ativas, `pg_stat_statements` top 20 |
| Cloudflare Workers | isolate CPU-time, subrequests, `wallTime` |
| Provider Layer | `provider_call_duration_ms`, error rate por provider |
| Observability | log volume, redação sem falhas, snapshot `/api/public/metrics` |

### 2.3 Critérios de aprovação

- Nenhum cenário com erro > 1 %.
- Nenhum request > 3 s no p99 em L1–L3.
- Zero perda de eventos em L4.
- Zero duplicação em L6 (idempotência via `provider_message_id`).
- DB sem locks longos (> 500 ms) durante execução.

### 2.4 Riscos conhecidos que o load test deve exercitar

- `tracking_events` sob volume alto — validar índice `(organization_id, created_at)`.
- Rate limit global vs por-org — checar comportamento sob burst.
- OAuth state store TTL — validar cleanup automático.

---

## 3. WS-5.4.3 — Stress Test Plan

| # | Cenário | Como | Registrar |
|---|---------|------|-----------|
| S1 | Tracking flood | 20 000 events / min | perda, latência do rate-limit, uso de CPU DB |
| S2 | OAuth flood | 100 rps callbacks inválidos | resposta 4xx padronizada, log sem PII, sem state órfão |
| S3 | Webhook flood WhatsApp | 5 000 rpm com signature válida + 10 % inválida | rejeição de inválidos, throughput dos válidos |
| S4 | Payload gigante | POSTs de 5 MB em `/api/public/*` | rejeição via limite; sem OOM |
| S5 | Timeouts de provider | inject 30 s no Provider Layer mock | retry conforme política, circuit breaker (se houver) |
| S6 | Retry storm | forçar 5xx transiente em provider | backoff exponencial, sem thundering herd |
| S7 | Falhas de provider | derrubar 1 provider por 5 min | outros providers intactos, fila não trava |
| S8 | Quota excedida (Meta/Google) | mock 429 | respeitar `Retry-After`, degradação graciosa |
| S9 | Rate limit local | 10 000 rpm de um mesmo IP | 429 previsível, sem impacto em outros orgs |

### 3.1 O que deve ser observado

- **Comportamento**: código de status, mensagens ao usuário, logs.
- **Recuperação**: tempo até normalização após remoção do stress.
- **Perda de dados**: comparar eventos enviados vs persistidos.
- **Integridade**: `audit_log` continua append-only; RLS jamais desabilita.

---

## 4. WS-5.4.4 — Resilience Validation

| Falha | Comportamento esperado | Validação |
|-------|------------------------|-----------|
| Supabase indisponível | 5xx nos endpoints; UI mostra erro; sem cascata | Endpoints `ready` retornam 503 |
| Provider externo down | Provider Layer isola; demais funcionam | log `event=provider.down` |
| OAuth falhando | Estado limpo em `oauth_states`; usuário orientado a refazer | sem tokens órfãos |
| Tracking falhando | Frontend continua; eventos ficam em retry local (client) | sem crash |
| DB lento | Timeouts controlados nas server functions | log `event=db.slow` |
| Rede intermitente | Retries com backoff nos calls Provider Layer | sem duplicação |
| Timeouts | Todas as chamadas externas têm timeout explícito | grep código |
| Retries | Idempotência via `request_id / trace_id` | log correlato |
| Logs | Sempre estruturados; redação automática | `logger.ts` |
| Audit Log | Trigger `audit_log_block_mutation` impede UPDATE/DELETE | teste `audit-log.contract.test.ts` |
| Recovery | RTO ≤ 4 h, RPO ≤ 1 h documentado | `docs/DISASTER_RECOVERY.md` |
| Rollback | Migration reversível + tag anterior | `docs/runbooks/rollback.md` |

---

## 5. WS-5.4.5 — Production Gap

### 5.1 Problemas encontrados (documentais)

| # | Problema | Severidade | Como corrigir |
|---|----------|------------|---------------|
| P1 | Load test / stress test **nunca executados** em staging real | 🔴 | Executar plano §2 e §3 antes de promoção a produção |
| P2 | Sentry pronto porém **DSN não configurado** em staging | 🟠 | Adicionar `SENTRY_DSN` via `add_secret` no ambiente de staging |
| P3 | OTel Tracer real **não plugado** — usa NoopTracer | 🟠 | `setTracer(new OtelTracer(...))` — Sprint 5.5 (aditivo) |
| P4 | Endpoints `/api/public/{health,ready,live,metrics}` sem alerta configurado | 🟠 | Configurar monitor externo (UptimeRobot / BetterStack) contra os 3 endpoints |
| P5 | Retenção de partições `audit_log` — cron ainda não agendado | 🟡 | Agendar `pg_cron` chamando `audit_log_prune_partitions(12)` mensalmente |
| P6 | `METRICS_TOKEN` não rotacionado | 🟡 | Rotacionar antes de expor scraping externo |
| P7 | Runbooks BullMQ/Redis mantidos como "reservados" | 🔵 | Documental — remover só quando novo ADR decidir fila de jobs |
| P8 | Sem teste de restore de backup real | 🟠 | Drill trimestral (RTO/RPO) — `docs/DISASTER_RECOVERY.md` |
| P9 | Alertas de log (error rate spike) não configurados | 🟠 | Configurar no coletor externo (Sprint 5.5) |
| P10 | Bundle size por rota não medido | 🟡 | Adicionar step no build para checar > 200 KB gzip |

### 5.2 Riscos

- **R1** — Sob carga real, `tracking_events` pode saturar CPU do DB sem alerta ativo. Mitigação: P4 + índice já criado (5.2).
- **R2** — Falha silenciosa de provider externo sem tracing real dificulta root-cause. Mitigação: P2 + P3.
- **R3** — Audit log crescendo indefinidamente pressiona storage. Mitigação: P5.

### 5.3 Itens aprovados

Multi-tenant + RLS · Provider Layer · Audit Log append-only · Rate limit · Observabilidade (primitivas) · Testes automatizados (313/313) · Documentação Enterprise · TypeScript strict · Quality Gate.

### 5.4 Itens reprovados para **produção** (aceitos para **staging**)

- P1 (load/stress reais) · P2 (Sentry ao vivo) · P4 (alertas externos) · P8 (drill de restore).

### 5.5 Plano de correção (proposta Sprint 5.5)

| # | Item | Esforço | Prioridade |
|---|------|---------|------------|
| 1 | Executar plano de load test §2 e coletar métricas | 2-3 dias | 🔴 |
| 2 | Executar stress test §3 | 1-2 dias | 🔴 |
| 3 | Configurar Sentry DSN em staging + validar captura | 2 h | 🟠 |
| 4 | Plugar OTel Tracer real via `setTracer` | 4 h | 🟠 |
| 5 | Monitor externo em `/health,/ready,/live,/metrics` | 2 h | 🟠 |
| 6 | Agendar `pg_cron` `audit_log_prune_partitions(12)` | 1 h | 🟡 |
| 7 | Alertas de log error rate spike | 4 h | 🟠 |
| 8 | Drill de restore de backup | 4 h | 🟠 |
| 9 | Métrica de bundle size no build | 2 h | 🟡 |

**Total estimado:** 4-6 dias-desenvolvedor (Sprint 5.5).

### 5.6 Checklist para produção

- [ ] Todos os itens 🔴 e 🟠 acima concluídos.
- [ ] `bunx tsgo --noEmit` verde.
- [ ] `bun run test` verde (313+).
- [ ] Load test L1–L7 dentro dos SLOs (§2.3).
- [ ] Stress test S1–S9 sem perda de dados.
- [ ] `SENTRY_DSN` configurado e capturando eventos.
- [ ] Monitor externo alertando via canal oficial.
- [ ] Drill de restore executado com sucesso nos últimos 30 dias.
- [ ] Publish + smoke test em `zenno-connect-ai.lovable.app`.
- [ ] Approval assinado (Tech Lead + Deploy Ops).

---

## 6. Quality Gate (esta sprint)

| Gate | Comando | Resultado |
|------|---------|-----------|
| Typecheck | `bunx tsgo --noEmit` | ✅ 0 erros |
| Testes | `bun run test` | ✅ 313/313 (40 arquivos) |
| Build | gerenciado pelo harness | ✅ (contínuo) |

Nenhuma regressão observada em relação ao final da Sprint 5.3.

---

## 7. Observações honestas sobre o escopo desta sprint

Esta sprint entrega **validação documental** e **planos executáveis**. Métricas
como "CPU real observado", "p95 real sob 1 000 VUs" e "tempo médio de cold start"
**não podem ser fornecidos com base no repositório** — exigem execução em
ambiente de staging ao vivo com ferramenta de load. Qualquer número apresentado
sem essa execução seria fabricado. O plano em §2 e §3 é o entregável executável
para gerar esses números na Sprint 5.5.

---

## 8. Status final

| Dimensão | Status |
|----------|--------|
| Arquitetura (Freeze v1.0) | 🟢 |
| Segurança (RLS + Audit) | 🟢 |
| Testes automatizados | 🟢 |
| Documentação | 🟢 |
| Observabilidade (primitivas) | 🟢 |
| Observabilidade (staging ao vivo) | 🟠 |
| Load / Stress real | 🔴 pendente |
| Resiliência validada empiricamente | 🔴 pendente |

### 🟡 **READY FOR STAGING**
### 🟠 **NOT READY FOR PRODUCTION** — resolver §5.5 antes.

---

**Sprint 5.5 não iniciada. Aguardando aprovação.**
