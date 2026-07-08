# Runbook — Redis (Reservado)

> **Status atual (Sprint 5.3):** ⚠️ **NÃO APLICÁVEL À ARQUITETURA CONGELADA v1.0.**
>
> A baseline (TanStack Start + Cloudflare Workers + PostgreSQL/Supabase) **não
> depende de Redis**. Rate limit e caching leve são resolvidos em Postgres
> (funções `global_rate_limit_hit`, `track_compound_rate_limit_hit`) e no
> cache do TanStack Query (client-side).
>
> Este runbook fica **arquivado** para o caso de futura adoção de Redis
> (fila BullMQ externa, cache compartilhado entre isolates, pub/sub).
> Qualquer adoção real exigirá **novo ADR** e revisão do Architecture Freeze.

## Se um dia for adotado (esboço)

Casos de uso candidatos:
- Cache de resposta cross-isolate (hoje N/A — cada isolate mantém seu próprio in-memory).
- Fila BullMQ (ver `runbooks/bullmq.md`).
- Pub/sub para invalidação de cache.

Métricas mínimas a expor: `redis_up`, `redis_latency_ms`,
`redis_memory_used_bytes`, `redis_connected_clients`.

Runbook operacional real deverá ser escrito **após** o ADR de adoção.
