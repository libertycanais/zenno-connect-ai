# RC2 Operational Enhancements Report

**Data:** 2026-07-10
**Fase:** RC2 — Pilot Program (execução)
**Status:** 🟢 **ENHANCEMENTS DELIVERED · 100% ADDITIVE**
**Architecture Freeze v1.0:** ✅ íntegro · **Contratos públicos:** ✅ intactos · **RLS existente:** ✅ inalterado · **Provider Layer:** ✅ inalterado

---

## Sumário Executivo

Entrega das 4 diretrizes estratégicas do CTO + 3 reforços de segurança recomendados, sob regime aditivo. Nenhuma feature estratégica nova foi introduzida — Epic L permanece bloqueado.

| # | Diretriz | Camada | Status |
|---|----------|--------|--------|
| 1 | Pilot Daily Dashboard | Rota admin + server function | 🟢 |
| 2 | Telemetria Funcional Expandida | Catálogo de eventos + ingest | 🟢 |
| 3 | Feedback Contextual do Copilot | UI + tabela + server function | 🟢 |
| 4 | Governança de Backlog por Evidências | Motor de scoring + tabela + API | 🟢 |
| 5 | `sanitizeProps` recursiva | Refatoração do módulo telemetry | 🟢 |
| 6 | Rate Limit por organização | Limiter in-memory + counter table | 🟢 |
| 7 | Retenção 90 dias (pg_cron) | Function + cron job diário | 🟢 |

---

## 1 · Pilot Daily Dashboard

- **Rota:** `src/routes/app.admin.pilot.daily.tsx` (`/app/admin/pilot/daily`).
- **Agregação server-side:** `getPilotDailyDashboard` em `src/lib/pilot.functions.ts` — `Promise.all` de 9 consultas paralelas.
- **Multi-tenant safe:** roda sob `requireSupabaseAuth`; toda leitura passa por RLS `current_org_id()`. Nenhuma agregação cross-tenant no cliente.
- **KPIs entregues:** orgs ativas, usuários ativos 24h, sessões, duração média, Health Score médio, Adoption Score médio, invocations do Copilot, latência média do Copilot, satisfação (👍/👎), recomendações aceitas/ignoradas, custo IA (24h), tokens IA, taxa de erro, p95 latência, feature flags ativas, rollout médio, eventos telemetria 24h, feedback recebido (14d) e telemetria bloqueada por rate limit.
- **UI:** grid de 15 KPIs + top widgets + cohorts. Refresh automático a cada 60s via TanStack Query.

## 2 · Telemetria Funcional Expandida

Adicionados 14 eventos canônicos em `PILOT_EVENTS` (todos reutilizando `pilot_telemetry_events`):

```
ai.copilot_opened            product.workflow_executed
ai.copilot_answered          product.dashboard_viewed
product.recommendation_rejected  product.widget_added
product.widget_removed       product.workspace_customized
ai.campaign_analyzed         ai.finance_analyzed
ai.crm_analyzed              product.executive_viewed
product.insight_opened       product.timeline_viewed
```

- Endpoint de ingestão: `ingestPilotEvent` (server function autenticada, sanitiza props, aplica rate limit, persiste hit de bloqueio).

## 3 · Feedback Contextual do Copilot

- **Tabela:** `pilot_copilot_feedback` (RLS org-scoped) — armazena apenas `message_id`, `conversation_id`, reação, `reason_code`, comentário ≤ 2000 chars, `model_hint`, `latency_ms`. **Nunca** persiste prompt ou resposta do LLM.
- **Server function:** `submitCopilotFeedback` (`src/lib/pilot.functions.ts`) — Zod validator + strip de tags HTML no comentário.
- **UI:** `src/components/copilot/CopilotFeedback.tsx` — botões 👍/👎, textarea com contador, escape padrão do React, `dangerouslySetInnerHTML` proibido, `aria-label` em todos os controles.

## 4 · Governança do Backlog baseada em Evidências

- **Tabela:** `pilot_backlog_items` (RLS org-scoped). CHECK constraints em todos os campos numéricos e enums (`source`, `status`, `priority_bucket`).
- **Motor:** `src/lib/pilot/backlog.ts` — `scoreBacklogItem` + `rankBacklog`.
- **Fórmula (determinística):** `score = ((0.20·reach + 0.15·freq + 0.25·financial + 0.20·retention + 0.20·ops) / effortDivisor) · 1000`, com `effortDivisor = clamp(log2(effort+1), 0.5, 3)`.
- **Buckets:** `P0 ≥ 650`, `P1 ≥ 400`, `P2 ≥ 200`, `P3 < 200`. Itens sem reach + frequência são forçados para P3.
- **API:** `createBacklogItem` (valida + score automático), `listBacklogItems` (ordena por `priority_score`).

## 5 · `sanitizeProps` recursiva

Refactor de `src/lib/pilot/telemetry.ts`:

- Redação case-insensitive em qualquer profundidade (novas chaves: `client_secret`, `bearer`, `session_token`, `rg`, `card_number`).
- Truncamento de strings > 2000 chars.
- Cap de arrays em 200 elementos.
- Guarda de profundidade máxima (8) → substitui por `[TRUNCATED_DEPTH]`.
- Normaliza `Date` → ISO, `BigInt` → string, prototipos exóticos → string segura.
- Cobertura: 5 cenários dedicados no `rc2-enhancements.test.ts`.

## 6 · Rate Limit por Organização

- **Limiter in-memory:** `checkPilotRateLimit(orgId, cfg)` — janela deslizante de 60s, teto padrão 240 eventos/janela por org.
- **Persistência de bloqueios:** upsert em `pilot_telemetry_rate_hits` sempre que `ingestPilotEvent` bloqueia.
- **Observabilidade:** total de bloqueios exposto no Daily Dashboard (`telemetryBlockedByRateLimit`).
- **Isolamento por org:** validado em teste (`isolates organizations`).

## 7 · Retenção 90 dias

- **Função:** `public.pilot_telemetry_prune(_days int default 90)` — `SECURITY DEFINER`, `search_path` fixo.
- **Cron:** `pilot-telemetry-prune-90d` (`15 3 * * *` UTC) via `pg_cron`.
- **Escopo:** deleta `pilot_telemetry_events` > 90 dias e limpa `pilot_telemetry_rate_hits` > 30 dias.
- **Ré-agendamento seguro:** `DO $$ ... IF EXISTS` unschedule + schedule dentro da migração.

---

## Arquivos

### Criados
- `src/lib/pilot/backlog.ts`
- `src/lib/pilot.functions.ts`
- `src/components/copilot/CopilotFeedback.tsx`
- `src/routes/app.admin.pilot.daily.tsx`
- `tests/unit/pilot/rc2-enhancements.test.ts`
- `docs/RC2_OPERATIONAL_ENHANCEMENTS_REPORT.md`
- Migração: 3 tabelas + 1 função + 1 cron job.

### Modificados
- `src/lib/pilot/telemetry.ts` (recursive sanitize + expanded events + rate limiter)
- `src/lib/pilot/index.ts` (barrel export do `backlog`)

---

## Compatibilidade

| Requisito | Verificação |
|-----------|-------------|
| Architecture Freeze v1.0 | ✅ Nenhum contrato público alterado |
| Provider Layer | ✅ Não tocado |
| Multi-tenant | ✅ Toda leitura/gravação passa por `current_org_id()` |
| RLS existente | ✅ Não alterada; novas tabelas seguem o mesmo padrão |
| Security Review | ✅ Sem `dangerouslySetInnerHTML`, sem `service_role` no cliente, sanitize recursiva, comentários ≤ 2000c, HTML strip no server, `SECURITY DEFINER` com `search_path` fixo |
| PII | ✅ Nunca persistimos prompt/resposta do LLM; sanitize opera em qualquer profundidade |
| Retenção | ✅ Job diário automatizado; documentado neste relatório |

---

## Métricas / Eventos adicionados

- 14 novos `event_name` em `PILOT_EVENTS`
- 17 KPIs no Daily Dashboard
- 1 métrica de observabilidade (telemetria bloqueada por rate limit)
- 1 job pg_cron
- 3 tabelas + 1 função SQL

## Testes

- `tests/unit/pilot/rc2-enhancements.test.ts` — 16 cenários novos cobrindo sanitize recursiva (5), rate limit (3), catálogo de eventos + track (3) e backlog governance (5).
- Suíte RC2 anterior (`rc2-pilot.test.ts`) permanece verde.

## Política de Retenção (documentada)

- **`pilot_telemetry_events`** → 90 dias.
- **`pilot_telemetry_rate_hits`** → 30 dias.
- **`pilot_copilot_feedback`, `pilot_feedback`, `pilot_backlog_items`, `pilot_onboarding_progress`, `pilot_organizations`** → retenção indefinida até decisão explícita do CTO (dados agregados / não-transacionais de PII).
- **Execução:** diária às 03:15 UTC via `pg_cron`.
- **Auditoria:** o retorno da função pode ser inspecionado em `cron.job_run_details`.

---

## Parecer Final

> Entrega concluída sob regime **100% aditivo**. Nenhum contrato público, RLS existente ou componente do Provider Layer foi alterado. As 4 diretrizes estratégicas do CTO e os 3 reforços de segurança estão ativos e prontos para operar durante o piloto.
>
> 🛑 **PARADA OBRIGATÓRIA.** Não iniciar GA. Não iniciar Epic L. Aguardar aprovação formal do CTO.

**Assinado:** Engenharia Zenno AI Suite
**Versão:** RC2 · Operational Enhancements
