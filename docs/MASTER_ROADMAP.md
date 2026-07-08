# Master Roadmap — Zenno AI Suite

Consolida sprints entregues e planejadas até v2.0.

## Sprints entregues

### Sprint Infra 1 — Fundação operacional
- `Dockerfile` multi-stage + `docker-compose` reprodutível.
- Healthchecks `/api/public/live`, `/ready`, `/health`.
- Logger JSON estruturado com redaction automática.
- Documentação: `DOCKER.md`, `DEPLOYMENT.md`.

### Sprint Segurança 2 — Endurecimento de dados
- `audit_log` particionado append-only.
- `global_rate_limit_hit(key, limit, window)`.
- `search_path` fixo em todas as funções `SECURITY DEFINER`.
- Redaction em pipeline de log/audit.

### Sprint Arquitetura 3 — Provider Layer & Multi-tenant
- Provider Layer congelada: Ads, WhatsApp, Payments, AI.
- Fábricas + interfaces tipadas + testes unitários.
- Multi-tenant validado via RLS + `has_role()`.

### Sprint 3.5 — Segurança em profundidade
- Fuzzing, provider leakage, tracking dispatch, webhook Uazapi.
- Middleware `requireSupabaseAuth` + attacher.
- Rate limit por org/IP em `/api/public/*`.

### Sprint 4 — Testes, contratos e CI
- WS-7 Database security tests (RLS, indexes, integrity, migrations,
  rate-limit, security-definer, audit-log).
- WS-8 Contract tests (endpoints públicos + payloads externos).
- WS-9 GitHub Actions CI + vitest isolado + thresholds.
- WS-10 Quality Gate final consolidado.

### Sprint Staging Enterprise (WS-0.x)
- `RELEASE_PLAN.md`, `STAGING_CHECKLIST.md`, `DEPLOY_CHECKLIST.md`,
  `PRODUCTION_READINESS.md`, `.env.staging.example`.
- `ARCHITECTURE_DECISIONS.md` (12 ADRs).
- `ENGINEERING_HANDBOOK.md`, `INDEX.md`, `CONTRIBUTING.md`,
  `CODE_STYLE.md`, `INCIDENT_RESPONSE.md`, `DISASTER_RECOVERY.md`,
  runbooks completos, `VERSION_HISTORY.md`, `MASTER_ROADMAP.md`.

## Sprints futuras (planejadas)

### Sprint 5 — Observabilidade externa
- Sentry (client + server).
- Coletor de logs externo (Loki / Datadog / CloudWatch).
- Job de retenção de partições do `audit_log`.
- Drill de rollback ponta-a-ponta em staging.
- OTel exporter OTLP.

### Sprint 6 — Performance e carga
- Load-test formal (k6/Artillery) nos endpoints críticos.
- Baseline de latência e throughput.
- `/metrics` endpoint (Prometheus).
- Grafana dashboards.
- Cobertura server-side ≥ 60%.
- Cache camada (Redis) onde payoff for claro.

### Sprint 7 — Compliance e governança
- Política LGPD/GDPR formalizada.
- Fluxo de esquecimento (direito ao apagamento).
- DPA modelo.
- Aviso de privacidade.
- 2FA obrigatório para admins.
- SLO/SLA formais + error budget.
- Página de status pública.

### Sprint 8 — Escala e alta disponibilidade
- Multi-AZ para Postgres.
- App ≥ 2 instâncias atrás de LB (quando aplicável em deploy externo).
- Estratégia de cache formalizada (ADR-013).
- **Fila de jobs assíncronos** (Cloudflare Queues ou BullMQ em worker Node externo)
  se adotada — exige ADR-013 dedicado antes.

## Roadmap até v2.0

| Milestone | Escopo | ETA (indicativo) |
|-----------|--------|------------------|
| **v1.0-rc1** | Sprint 5 concluída → observabilidade viva | +1 mês |
| **v1.0-rc2** | Sprint 6 concluída → performance validada | +2 meses |
| **v1.0** | Sprint 7 concluída → compliance + SLO ativos | +3 meses |
| **v1.1** | Feature flags + i18n | +4 meses |
| **v1.2** | Billing multi-região refinado (ADR-018) | +5 meses |
| **v1.5** | Sprint 8 → multi-AZ, HA, fila de jobs (se aprovada por ADR) | +6-8 meses |
| **v2.0** | Mobile (PWA/nativo) + API pública versionada | +12 meses |

## Escalabilidade
- Postgres: read replicas quando p95 read > alvo.
- Fila de jobs externa: N/A na baseline v1.0; considerar em v1.5 mediante ADR.

## Alta disponibilidade (alvo v1.5)
- Multi-AZ (Supabase Pro / RDS multi-AZ).
- Redis com Sentinel.
- App em ≥ 2 instâncias atrás de LB com healthchecks.

## Disaster Recovery (alvo v1.0)
- RPO ≤ 1 h.
- RTO ≤ 4 h.
- Drill trimestral em ambiente scratch.
