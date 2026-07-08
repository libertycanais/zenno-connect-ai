# Runbook — Fila de Jobs Assíncronos (Reservado)

> **Status atual (Sprint 5.3):** ⚠️ **NÃO APLICÁVEL À ARQUITETURA CONGELADA v1.0.**
>
> O stack oficial é **TanStack Start + Cloudflare Workers** (Architecture Freeze v1.0,
> ver [`../ARCHITECTURE_FREEZE.md`](../ARCHITECTURE_FREEZE.md) e ADR-001/ADR-007).
> Cloudflare Workers **não possuem processo Node persistente**, portanto **BullMQ
> não é executável** neste runtime e **não faz parte** da baseline.
>
> Jobs assíncronos hoje são resolvidos por:
> - `pg_cron` para tarefas agendadas de banco (retention, aggregation).
> - Server functions idempotentes disparadas por webhooks.
> - `/api/public/*` endpoints com verificação de assinatura.
>
> Este runbook fica **arquivado** como referência para uma eventual futura
> adoção de fila (Cloudflare Queues ou BullMQ em worker Node externo).
> Qualquer adoção real exigirá **novo ADR** e revisão do Architecture Freeze.

## Se um dia for adotado (esboço)

Fila candidata #1: **Cloudflare Queues** (nativo, sem Redis, compatível com Workers).
Fila candidata #2: **BullMQ** em worker Node externo (requer VPS + Redis).

Métricas a expor (padrão observability): `queue_jobs_total{queue,status}`,
`queue_job_duration_ms{queue}`, `queue_depth{queue}`.

Runbook operacional (sintomas, diagnóstico, correção, rollback) deverá ser
escrito **após** o ADR de adoção — não usar este arquivo como fonte de verdade.
