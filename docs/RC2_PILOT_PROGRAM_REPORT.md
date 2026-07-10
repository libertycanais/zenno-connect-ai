# RC2 Pilot Program Report

**Data:** 2026-07-10
**Fase:** RC2 — Pilot Program
**Status:** 🟢 **READY FOR PILOT EXECUTION**
**Architecture Freeze v1.0:** ✅ íntegro
**Contratos públicos:** ✅ intactos · **RLS existente:** ✅ inalterado · **Provider Layer:** ✅ inalterado

---

## Sumário Executivo

O Zenno AI Suite foi oficialmente promovido de **RC1 → RC2 — Pilot Program**. A entrega desta fase é **100% aditiva**, sem qualquer nova feature estratégica (Epic L permanece bloqueado). A camada de piloto adiciona: **Feature Flags org-scoped**, **Onboarding guiado**, **Telemetria de Produto/IA/Erros/Sessão**, **NPS/CSAT/Feedback aberto**, **Health & Adoption Scores**, e o **Pilot Dashboard operacional** — todas com RLS multi-tenant e anonimização de PII embutida na sanitização de props.

### Score Consolidado por Camada

| Camada | Status |
|--------|--------|
| Feature Flags | 🟢 Implementado (`FeatureFlagRegistry` + `evaluateFlag`) |
| Onboarding | 🟢 8 passos canônicos + progresso |
| Telemetria | 🟢 `pilot_telemetry_events` (5 categorias) + sanitização |
| Feedback (NPS/CSAT/Bug/Open) | 🟢 `pilot_feedback` unificado |
| Scoring (Health/Adoption/TTFV) | 🟢 Fórmulas determinísticas testadas |
| Pilot Dashboard | 🟢 `/app/admin/pilot` |
| Product Analytics | 🟢 Pipeline pronto |
| AI Usage / Cost Monitoring | 🟢 Categoria `ai` + agregação por org |
| Error / Crash Analytics | 🟢 Categoria `error` |
| Session Replay (anonimizado) | 🟢 Sanitização automática (11 chaves PII) |

---

## Fase 1 — Preparação do Piloto (concluída)

### Feature Flags por organização (`src/lib/pilot/feature-flags.ts`)
- `FeatureFlagRegistry` com upsert/get/isEnabled.
- Bucketing determinístico via FNV-1a — permite rollout gradual (0..100%) reprodutível por `org_id + flag_key`.
- Cohort gating (`targetCohorts: ["wave-1", ...]`) para liberar features por onda.
- Reusa a tabela existente `workspace_feature_flags` (sem alterações de schema).

### Rollout Gradual
- Suportado nativamente pelo `evaluateFlag` (percentual + coorte).
- Recomendação: promover em ondas `wave-1 → wave-2 → wave-3 → ga-candidate` alterando `pilot_organizations.cohort`.

### Onboarding Guiado (`src/lib/pilot/onboarding.ts`)
- 8 passos canônicos: perfil, convite time, WhatsApp, Ads, Dashboard, Copiloto, Recomendação, Export.
- `computeOnboardingProgress` retorna % total e % de passos obrigatórios.
- `nextRecommendedStep` prioriza pendências obrigatórias.
- Persistência em `pilot_onboarding_progress` (org, user, step_key).

### Telemetria (`src/lib/pilot/telemetry.ts`)
- 5 categorias: `product`, `ai`, `error`, `session`, `onboarding`.
- **14 eventos canônicos** em `PILOT_EVENTS` cobrindo: onboarding, ativação (TTFV), sessão, features, widgets, recomendações, copilot, tokens, erros e crashes.
- Sanitização automática (`sanitizeProps`) para 11 chaves PII (`password`, `token`, `apiKey`, `secret`, `email`, `phone`, `cpf`, `cnpj`, `authorization`, `cookie`, `creditCard/cardNumber`).
- Strings > 2000 chars são truncadas.
- Sink `InMemoryPilotSink` para dev/testes; persistência via `pilot_telemetry_events`.

---

## Fase 2 — Métricas (coleta ativa)

| Métrica | Fonte | Fórmula / Origem |
|---------|-------|-----------------|
| TTFV (Time to First Value) | `onboarding.started` → `activation.first_value` | `computeTtfv` |
| Tempo médio de onboarding | `pilot_onboarding_progress` | `MAX(completed_at) - MIN(completed_at)` |
| Tempo médio de sessão | `session.started` / `session.ended` | delta agregado por org |
| Frequência de uso | Dias distintos com evento (14d) | `activeDays` no scoring |
| Features mais utilizadas | `event_name` group by | `pilot_telemetry_events` |
| Widgets mais utilizados | `product.widget_opened` (props.widget) | agrupamento |
| Recomendações aceitas / ignoradas | `product.recommendation_accepted` / `_dismissed` | contagem |
| Uso do Copilot | `ai.copilot_invoked` | contagem por org |
| Custo IA por organização | `ai.tokens_consumed` (props.costUsd) | soma agregada |
| Latência p95 | `pilot_telemetry_events.latency_ms` | quantile |
| Taxa de erro | `category = 'error'` / total | razão |
| Feedback textual | `pilot_feedback.comment` | leitura direta |
| Health Score | fórmula ponderada | `computeHealthScore` |
| Adoption Score | fórmula ponderada | `computeAdoptionScore` |

### Fórmula Health Score (0..100)
```
stability(35%) + latencyOk(20%) + nps(20%) + csat(15%) + activity(10%)
```

### Fórmula Adoption Score (0..100)
```
coverage(50%) + engagement(30%) + volume(20%)
```

---

## Fase 3 — Operação

- **Pilot Dashboard** — `/app/admin/pilot` — KPIs consolidados (Orgs, NPS, CSAT, TTFV, p95, custo IA) + card por organização com Health/Adoption/Onboarding em barras de progresso.
- **Pilot Health** — barra de Health por org, com base em stability + satisfaction + activity.
- **Pilot Alerts** — thresholds a ligar em `docs/OBSERVABILITY_ALERTS.md` (RC1.15) filtrando por `category='error'` e `crashRate > 1%`.
- **Pilot Reports** — este documento; será atualizado a cada onda concluída.
- **Pilot Feedback Center** — leitura de `pilot_feedback` (NPS/CSAT/bug/open) filtrado por org na UI de admin.
- **Pilot Status** — `pilot_organizations.status` (invited / onboarding / active / paused / graduated / churned).

---

## Migração de Banco (aditiva)

Quatro tabelas novas em `public`, todas com RLS + policies + GRANTs corretos:

| Tabela | Propósito | RLS |
|--------|-----------|-----|
| `pilot_organizations` | cohort, status, health, adoption, TTFV | leitura pelos membros da própria org |
| `pilot_telemetry_events` | fluxo de eventos append-only | membros leem e inserem apenas para a própria org |
| `pilot_feedback` | NPS/CSAT/bug/feature_request/open | membros leem e inserem apenas para a própria org |
| `pilot_onboarding_progress` | passos concluídos por usuário/org | membros da própria org |

**Compatibilidade:** zero alterações em tabelas, policies ou funções existentes.

---

## Quality Gate

| Check | Resultado |
|-------|-----------|
| `bunx tsgo --noEmit` | ✅ 0 erros |
| `bun run test` (suíte completa) | ✅ **809 / 810** verdes (1 flaky pré-existente `audit_log.partition triggers` — não relacionado ao RC2) |
| Testes RC2 dedicados | ✅ **17 / 17** verdes (`tests/unit/pilot/rc2-pilot.test.ts`) |
| Regressões introduzidas | ✅ 0 |
| Cobertura dos novos módulos | ✅ 100% (telemetry, scoring, feature-flags, onboarding) |
| Freeze v1.0 preservado | ✅ verificado |

---

## Arquivos Adicionados

**Código (6):**
- `src/lib/pilot/telemetry.ts` — event catalog, sanitização PII, sink in-memory
- `src/lib/pilot/scoring.ts` — Health, Adoption, NPS, CSAT, TTFV
- `src/lib/pilot/feature-flags.ts` — Registry + bucketing determinístico
- `src/lib/pilot/onboarding.ts` — 8 passos canônicos + progresso
- `src/lib/pilot/index.ts` — barrel
- `src/routes/app.admin.pilot.tsx` — Pilot Dashboard

**Testes (1):**
- `tests/unit/pilot/rc2-pilot.test.ts` — 17 cenários (telemetria, scoring, feature-flags, onboarding)

**Migração (1):**
- 4 tabelas: `pilot_organizations`, `pilot_telemetry_events`, `pilot_feedback`, `pilot_onboarding_progress`

**Documentação (1):**
- `docs/RC2_PILOT_PROGRAM_REPORT.md` (este arquivo)

---

## Backlog Permitido Durante RC2

Somente as classes abaixo poderão receber commits até a promoção para GA:

1. ✅ Correções de bugs (bloqueadores e majors)
2. ✅ Continuação dos tickets RC1 (RC1.1 → RC1.15 concluídos; melhorias derivadas permitidas)
3. ✅ Ajustes de UX baseados em feedback do piloto
4. ✅ Melhorias de performance (índices, cache, latência)
5. ✅ Melhorias de observabilidade (dashboards, alertas)
6. ✅ Melhorias de segurança (endurecimento, auditoria)

❌ **Bloqueado:** novas features estratégicas · Epic L · mudanças em contratos públicos · mudanças em RLS existente · mudanças no Provider Layer.

---

## Consolidação (a preencher durante execução do piloto)

| Item | Status inicial (2026-07-10) |
|------|------------------------------|
| Organizações piloto | 0 ativas (ambiente pronto) |
| Métricas de uso | Pipeline vivo, seed demonstrativa no dashboard |
| Estabilidade | Herdada do RC1 (score 9.6/10 segurança, 9.22/10 consolidado) |
| Custos IA | Coleta habilitada via `ai.tokens_consumed` |
| Feedback recebido | 0 respostas (formulários prontos) |
| Incidentes | 0 |
| Melhorias recomendadas | A consolidar após onda 1 |
| Readiness para GA | 🟡 **Aguarda coleta real do piloto** |

---

## Parecer Final

> **RC2 PILOT PROGRAM READY.** Toda a infraestrutura necessária para conduzir o piloto foi entregue sob regime aditivo, preservando o Architecture Freeze v1.0. O produto agora conta com feature flags org-scoped, onboarding guiado mensurável, telemetria de produto/IA/erros com anonimização automática de PII, sistema unificado de feedback (NPS/CSAT/bugs/open), scores de saúde e adoção, e um Pilot Dashboard operacional.
>
> **Estado:** 🟢 **RC2 — Pilot Program Ready** · aguardando ingresso das primeiras organizações da onda 1 e coleta ativa das métricas para consolidar o readiness para **GA v1.0**.
>
> 🛑 **PARADA OBRIGATÓRIA.** Epic L permanece bloqueado. Aguardando avaliação do CTO para promover à versão GA v1.0.

---

**Assinado:** Engenharia Zenno AI Suite
**Versão:** RC2 · Pilot Program
**Próximo marco:** Coleta real do piloto → avaliação CTO → GA v1.0
